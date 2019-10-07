import * as AST from './types/nodes';
import { Option, Dict } from '@glimmer/interfaces';
import { deprecate, assign } from '@glimmer/util';
import { DEVMODE } from '@glimmer/local-debug-flags';
import { StringLiteral, BooleanLiteral, NumberLiteral } from './types/handlebars-ast';

// Statements

export type BuilderPath = string | AST.PathExpression;
export type TagDescriptor = string | { name: string; selfClosing: boolean };

function withFallback<T, U>(originalValue: T | null | undefined, fallbackValue: U): T | U {
  return originalValue !== null && originalValue !== undefined ? originalValue : fallbackValue;
}

function buildMustache(
  path: BuilderPath | AST.Literal,
  params?: AST.Expression[],
  hash?: AST.Hash,
  raw?: boolean,
  loc?: AST.SourceLocation,
  strip?: AST.StripFlags
): AST.MustacheStatement {
  if (typeof path === 'string') {
    path = buildPath(path);
  }

  return {
    type: 'MustacheStatement',
    path,
    params: withFallback(params, []),
    hash: withFallback(hash, buildHash([])),
    escaped: !(raw === true),
    loc: buildLoc(withFallback(loc, null)),
    strip: withFallback(strip, { open: false, close: false }),
  };
}

function buildBlock(
  path: BuilderPath,
  params: Option<AST.Expression[]>,
  hash: Option<AST.Hash>,
  _defaultBlock: AST.PossiblyDeprecatedBlock,
  _elseBlock?: Option<AST.PossiblyDeprecatedBlock>,
  loc?: AST.SourceLocation,
  openStrip?: AST.StripFlags,
  inverseStrip?: AST.StripFlags,
  closeStrip?: AST.StripFlags
): AST.BlockStatement {
  let defaultBlock: AST.Block;
  let elseBlock: Option<AST.Block> | undefined;

  if (_defaultBlock.type === 'Template') {
    if (DEVMODE) {
      deprecate(`b.program is deprecated. Use b.blockItself instead.`);
    }

    defaultBlock = (assign({}, _defaultBlock, { type: 'Block' }) as unknown) as AST.Block;
  } else {
    defaultBlock = _defaultBlock;
  }

  if (_elseBlock !== undefined && _elseBlock !== null && _elseBlock.type === 'Template') {
    if (DEVMODE) {
      deprecate(`b.program is deprecated. Use b.blockItself instead.`);
    }

    elseBlock = (assign({}, _elseBlock, { type: 'Block' }) as unknown) as AST.Block;
  } else {
    elseBlock = _elseBlock;
  }

  return {
    type: 'BlockStatement',
    path: buildPath(path),
    params: withFallback(params, []),
    hash: withFallback(hash, buildHash([])),
    program: defaultBlock,
    inverse: withFallback(elseBlock, null),
    loc: buildLoc(withFallback(loc, null)),
    openStrip: withFallback(openStrip, { open: false, close: false }),
    inverseStrip: withFallback(inverseStrip, { open: false, close: false }),
    closeStrip: withFallback(closeStrip, { open: false, close: false }),
  };
}

function buildElementModifier(
  path: BuilderPath,
  params?: AST.Expression[],
  hash?: AST.Hash,
  loc?: Option<AST.SourceLocation>
): AST.ElementModifierStatement {
  return {
    type: 'ElementModifierStatement',
    path: buildPath(path),
    params: withFallback(params, []),
    hash: withFallback(hash, buildHash([])),
    loc: buildLoc(withFallback(loc, null)),
  };
}

function buildPartial(
  name: AST.PathExpression,
  params?: AST.Expression[],
  hash?: AST.Hash,
  indent?: string,
  loc?: AST.SourceLocation
): AST.PartialStatement {
  return {
    type: 'PartialStatement',
    name: name,
    params: withFallback(params, []),
    hash: withFallback(hash, buildHash([])),
    indent: withFallback(indent, ''),
    strip: { open: false, close: false },
    loc: buildLoc(withFallback(loc, null)),
  };
}

function buildComment(value: string, loc?: AST.SourceLocation): AST.CommentStatement {
  return {
    type: 'CommentStatement',
    value: value,
    loc: buildLoc(withFallback(loc, null)),
  };
}

function buildMustacheComment(
  value: string,
  loc?: AST.SourceLocation
): AST.MustacheCommentStatement {
  return {
    type: 'MustacheCommentStatement',
    value: value,
    loc: buildLoc(withFallback(loc, null)),
  };
}

function buildConcat(
  parts: (AST.TextNode | AST.MustacheStatement)[],
  loc?: AST.SourceLocation
): AST.ConcatStatement {
  return {
    type: 'ConcatStatement',
    parts: withFallback(parts, []),
    loc: buildLoc(withFallback(loc, null)),
  };
}

// Nodes

export type ElementArgs =
  | ['attrs', ...AttrSexp[]]
  | ['modifiers', ...ModifierSexp[]]
  | ['body', ...AST.Statement[]]
  | ['comments', ...ElementComment[]]
  | ['as', ...string[]]
  | ['loc', AST.SourceLocation];

export type PathSexp = string | ['path', string, LocSexp?];

export type ModifierSexp =
  | string
  | [PathSexp, LocSexp?]
  | [PathSexp, AST.Expression[], LocSexp?]
  | [PathSexp, AST.Expression[], Dict<AST.Expression>, LocSexp?];

export type AttrSexp = [string, AST.AttrNode['value'] | string, LocSexp?];

export type LocSexp = ['loc', AST.SourceLocation];

export type ElementComment = AST.MustacheCommentStatement | AST.SourceLocation | string;

export type SexpValue =
  | string
  | AST.Expression[]
  | Dict<AST.Expression>
  | LocSexp
  | PathSexp
  | undefined;

export function isLocSexp(value: SexpValue): value is LocSexp {
  return Array.isArray(value) && value.length === 2 && value[0] === 'loc';
}

export function isParamsSexp(value: SexpValue): value is AST.Expression[] {
  return Array.isArray(value) && !isLocSexp(value);
}

export function isHashSexp(value: SexpValue): value is Dict<AST.Expression> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    expectType<Dict<AST.Expression>>(value);
    return true;
  } else {
    return false;
  }
}

function expectType<T>(_input: T): void {
  return;
}

export function normalizeModifier(sexp: ModifierSexp): AST.ElementModifierStatement {
  if (typeof sexp === 'string') {
    return buildElementModifier(sexp);
  }

  let path: AST.PathExpression = normalizePath(sexp[0]);
  let params: AST.Expression[] | undefined;
  let hash: AST.Hash | undefined;
  let loc: AST.SourceLocation | null = null;

  let parts = sexp.slice(1);
  let next = parts.shift();

  process: {
    if (isParamsSexp(next)) {
      params = next as AST.Expression[];
    } else {
      break process;
    }

    next = parts.shift();

    if (isHashSexp(next)) {
      hash = normalizeHash(next as Dict<AST.Expression>);
    } else {
      break process;
    }
  }

  if (isLocSexp(next)) {
    loc = next[1];
  }

  return buildElementModifier(path, params, hash, loc);
}

export function normalizeAttr(sexp: AttrSexp): AST.AttrNode {
  let name = sexp[0];
  let value;

  if (typeof sexp[1] === 'string') {
    value = buildText(sexp[1]);
  } else {
    value = sexp[1];
  }

  let loc = sexp[2] !== undefined && Array.isArray(sexp[2]) ? sexp[2][1] : undefined;

  return buildAttr(name, value, loc);
}

export function normalizeHash(hash: Dict<AST.Expression>, loc?: AST.SourceLocation): AST.Hash {
  let pairs: AST.HashPair[] = [];

  Object.keys(hash).forEach(key => {
    pairs.push(buildPair(key, hash[key]));
  });

  return buildHash(pairs, loc);
}

export function normalizePath(path: PathSexp): AST.PathExpression {
  if (typeof path === 'string') {
    return buildPath(path);
  } else {
    return buildPath(path[1], path[2] !== undefined ? path[2][1] : undefined);
  }
}

export function normalizeElementOptions(...args: ElementArgs[]): BuildElementOptions {
  let out: BuildElementOptions = {};

  for (let arg of args) {
    switch (arg[0]) {
      case 'attrs': {
        let [, ...rest] = arg;
        out.attrs = rest.map(normalizeAttr);
        break;
      }
      case 'modifiers': {
        let [, ...rest] = arg;
        out.modifiers = rest.map(normalizeModifier);
        break;
      }
      case 'body': {
        let [, ...rest] = arg;
        out.children = rest;
        break;
      }
      case 'comments': {
        let [, ...rest] = arg;

        out.comments = rest;
        break;
      }
      case 'as': {
        let [, ...rest] = arg;
        out.blockParams = rest;
        break;
      }
      case 'loc': {
        let [, rest] = arg;
        out.loc = rest;
        break;
      }
    }
  }

  return out;
}

export interface BuildElementOptions {
  attrs?: AST.AttrNode[];
  modifiers?: AST.ElementModifierStatement[];
  children?: AST.Statement[];
  comments?: ElementComment[];
  blockParams?: string[];
  loc?: AST.SourceLocation;
}

function buildElement(tag: TagDescriptor, options?: BuildElementOptions): AST.ElementNode;
function buildElement(tag: TagDescriptor, ...options: ElementArgs[]): AST.ElementNode;
function buildElement(
  tag: TagDescriptor,
  options?: BuildElementOptions | ElementArgs,
  ...rest: ElementArgs[]
): AST.ElementNode {
  let normalized: BuildElementOptions;
  if (Array.isArray(options)) {
    normalized = normalizeElementOptions(options, ...rest);
  } else {
    normalized = options !== undefined ? options : {};
  }

  let { attrs, blockParams, modifiers, comments, children, loc } = normalized;

  // this is used for backwards compat, prior to `selfClosing` being part of the ElementNode AST
  let selfClosing = false;
  if (typeof tag === 'object') {
    selfClosing = tag.selfClosing;
    tag = tag.name;
  } else {
    if (tag.slice(-1) === '/') {
      tag = tag.slice(0, -1);
      selfClosing = true;
    }
  }

  return {
    type: 'ElementNode',
    tag: withFallback(tag, ''),
    selfClosing: selfClosing,
    attributes: withFallback(attrs, []),
    blockParams: withFallback(blockParams, []),
    modifiers: withFallback(modifiers, []),
    comments: withFallback(comments as AST.MustacheCommentStatement[], []),
    children: withFallback(children, []),
    loc: buildLoc(withFallback(loc, null)),
  };
}

function buildAttr(
  name: string,
  value: AST.AttrNode['value'],
  loc?: AST.SourceLocation
): AST.AttrNode {
  return {
    type: 'AttrNode',
    name: name,
    value: value,
    loc: buildLoc(withFallback(loc, null)),
  };
}

function buildText(chars?: string, loc?: AST.SourceLocation): AST.TextNode {
  return {
    type: 'TextNode',
    chars: withFallback(chars, ''),
    loc: buildLoc(withFallback(loc, null)),
  };
}

// Expressions

function buildSexpr(
  path: BuilderPath,
  params?: AST.Expression[],
  hash?: AST.Hash,
  loc?: AST.SourceLocation
): AST.SubExpression {
  return {
    type: 'SubExpression',
    path: buildPath(path),
    params: withFallback(params, []),
    hash: withFallback(hash, buildHash([])),
    loc: buildLoc(withFallback(loc, null)),
  };
}

function buildPath(original: BuilderPath, loc?: AST.SourceLocation): AST.PathExpression {
  if (typeof original !== 'string') return original;

  let parts = original.split('.');
  let thisHead = false;

  if (parts[0] === 'this') {
    thisHead = true;
    parts = parts.slice(1);
  }

  return {
    type: 'PathExpression',
    original,
    this: thisHead,
    parts,
    data: false,
    loc: buildLoc(withFallback(loc, null)),
  };
}

function buildLiteral<T extends AST.Literal>(
  type: T['type'],
  value: T['value'],
  loc?: AST.SourceLocation
): T {
  return {
    type,
    value,
    original: value,
    loc: buildLoc(withFallback(loc, null)),
  } as T;
}

// Miscellaneous

function buildHash(pairs?: AST.HashPair[], loc?: AST.SourceLocation): AST.Hash {
  return {
    type: 'Hash',
    pairs: withFallback(pairs, []),
    loc: buildLoc(withFallback(loc, null)),
  };
}

function buildPair(key: string, value: AST.Expression, loc?: AST.SourceLocation): AST.HashPair {
  return {
    type: 'HashPair',
    key: key,
    value,
    loc: buildLoc(withFallback(loc, null)),
  };
}

function buildProgram(
  body?: AST.Statement[],
  blockParams?: string[],
  loc?: AST.SourceLocation
): AST.Template {
  return {
    type: 'Template',
    body: withFallback(body, []),
    blockParams: withFallback(blockParams, []),
    loc: buildLoc(withFallback(loc, null)),
  };
}

function buildBlockItself(
  body?: AST.Statement[],
  blockParams?: string[],
  chained = false,
  loc?: AST.SourceLocation
): AST.Block {
  return {
    type: 'Block',
    body: withFallback(body, []),
    blockParams: withFallback(blockParams, []),
    chained,
    loc: buildLoc(withFallback(loc, null)),
  };
}

function buildTemplate(
  body?: AST.Statement[],
  blockParams?: string[],
  loc?: AST.SourceLocation
): AST.Template {
  return {
    type: 'Template',
    body: withFallback(body, []),
    blockParams: withFallback(blockParams, []),
    loc: buildLoc(withFallback(loc, null)),
  };
}

function buildSource(source?: string) {
  return withFallback(source, null);
}

function buildPosition(line: number, column: number) {
  return {
    line,
    column,
  };
}

export const SYNTHETIC: AST.SourceLocation = {
  source: '(synthetic)',
  start: { line: 1, column: 0 },
  end: { line: 1, column: 0 },
};

function buildLoc(loc: Option<AST.SourceLocation>): AST.SourceLocation;
function buildLoc(
  startLine: number,
  startColumn: number,
  endLine?: number,
  endColumn?: number,
  source?: string
): AST.SourceLocation;

function buildLoc(...args: any[]): AST.SourceLocation {
  if (args.length === 1) {
    let loc = args[0];

    if (loc !== undefined && typeof loc === 'object' && loc !== null) {
      return {
        source: buildSource(loc.source),
        start: buildPosition(loc.start.line, loc.start.column),
        end: buildPosition(loc.end.line, loc.end.column),
      };
    } else {
      return SYNTHETIC;
    }
  } else {
    let [startLine, startColumn, endLine, endColumn, source] = args;
    return {
      source: buildSource(source),
      start: buildPosition(startLine, startColumn),
      end: buildPosition(endLine, endColumn),
    };
  }
}

export default {
  mustache: buildMustache,
  block: buildBlock,
  partial: buildPartial,
  comment: buildComment,
  mustacheComment: buildMustacheComment,
  element: buildElement,
  elementModifier: buildElementModifier,
  attr: buildAttr,
  text: buildText,
  sexpr: buildSexpr,
  path: buildPath,
  concat: buildConcat,
  hash: buildHash,
  pair: buildPair,
  literal: buildLiteral,
  program: buildProgram,
  blockItself: buildBlockItself,
  template: buildTemplate,
  loc: buildLoc,
  pos: buildPosition,

  string: literal('StringLiteral') as (value: string) => StringLiteral,
  boolean: literal('BooleanLiteral') as (value: boolean) => BooleanLiteral,
  number: literal('NumberLiteral') as (value: number) => NumberLiteral,
  undefined() {
    return buildLiteral('UndefinedLiteral', undefined);
  },
  null() {
    return buildLiteral('NullLiteral', null);
  },
};

type BuildLiteral<T extends AST.Literal> = (value: T['value']) => T;

function literal<T extends AST.Literal>(type: T['type']): BuildLiteral<T> {
  return function(value: T['value']): T {
    return buildLiteral(type, value);
  };
}
