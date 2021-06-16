import type {
  Bounds,
  Environment,
  Option,
  ElementBuilder,
  Maybe,
  ModifierInstance,
} from '@glimmer/interfaces';
import { ConcreteBounds, NewElementBuilder } from '@glimmer/runtime';
import { RemoteLiveBlock } from '@glimmer/runtime';
import type {
  SimpleDocumentFragment,
  SimpleElement,
  SimpleNode,
  SimpleText,
} from '@simple-dom/interface';

const TEXT_NODE = 3;

const NEEDS_EXTRA_CLOSE = new WeakMap<SimpleNode>();

function currentNode(
  cursor: ElementBuilder | { element: SimpleElement; nextSibling: SimpleNode }
): Option<SimpleNode> {
  let { element, nextSibling } = cursor;

  if (nextSibling === null) {
    return element.lastChild;
  } else {
    return nextSibling.previousSibling;
  }
}

class SerializeBuilder extends NewElementBuilder implements ElementBuilder {
  private serializeBlockDepth = 0;

  __openBlock(): void {
    let { tagName } = this.element;

    if (tagName !== 'TITLE' && tagName !== 'SCRIPT' && tagName !== 'STYLE') {
      let depth = this.serializeBlockDepth++;
      this.__appendComment(`%+b:${depth}%`);
    }

    super.__openBlock();
  }

  __closeBlock(): void {
    let { tagName } = this.element;

    super.__closeBlock();

    if (tagName !== 'TITLE' && tagName !== 'SCRIPT' && tagName !== 'STYLE') {
      let depth = --this.serializeBlockDepth;
      this.__appendComment(`%-b:${depth}%`);
    }
  }

  __appendHTML(html: string): Bounds {
    let { tagName } = this.element;

    if (tagName === 'TITLE' || tagName === 'SCRIPT' || tagName === 'STYLE') {
      return super.__appendHTML(html);
    }

    // Do we need to run the html tokenizer here?
    let first = this.__appendComment('%glmr%');
    if (tagName === 'TABLE') {
      let openIndex = html.indexOf('<');
      if (openIndex > -1) {
        let tr = html.slice(openIndex + 1, openIndex + 3);
        if (tr === 'tr') {
          html = `<tbody>${html}</tbody>`;
        }
      }
    }
    if (html === '') {
      this.__appendComment('% %');
    } else {
      super.__appendHTML(html);
    }

    let last = this.__appendComment('%glmr%');
    return new ConcreteBounds(this.element, first, last);
  }

  __appendText(string: string): SimpleText {
    let { tagName } = this.element;
    let current = currentNode(this);

    if (tagName === 'TITLE' || tagName === 'SCRIPT' || tagName === 'STYLE') {
      return super.__appendText(string);
    } else if (string === '') {
      return (this.__appendComment('% %') as any) as SimpleText;
    } else if (current && current.nodeType === TEXT_NODE) {
      this.__appendComment('%|%');
    }

    return super.__appendText(string);
  }

  closeElement(): Option<ModifierInstance[]> {
    if (NEEDS_EXTRA_CLOSE.has(this.element)) {
      NEEDS_EXTRA_CLOSE.delete(this.element);
      super.closeElement();
    }

    return super.closeElement();
  }

  openElement(tag: string) {
    if (tag === 'tr') {
      if (
        this.element.tagName !== 'TBODY' &&
        this.element.tagName !== 'THEAD' &&
        this.element.tagName !== 'TFOOT'
      ) {
        this.openElement('tbody');
        // This prevents the closeBlock comment from being re-parented
        // under the auto inserted tbody. Rehydration builder needs to
        // account for the insertion since it is injected here and not
        // really in the template.
        NEEDS_EXTRA_CLOSE.set(this.constructing!, true);
        this.flushElement(null);
      }
    }

    return super.openElement(tag);
  }

  pushRemoteElement(
    element: SimpleElement,
    cursorId: string,
    insertBefore: Maybe<SimpleNode> = null
  ): Option<RemoteLiveBlock> {
    let { dom } = this;
    let script = dom.createElement('script');
    script.setAttribute('glmr', cursorId);
    dom.insertBefore(element, script, insertBefore);
    return super.pushRemoteElement(element, cursorId, insertBefore);
  }
}

export function serializeBuilder(
  env: Environment,
  cursor: { element: SimpleElement | SimpleDocumentFragment; nextSibling: Option<SimpleNode> }
): ElementBuilder {
  return SerializeBuilder.forInitialRender(env, cursor);
}
