// @ts-check

const { normalizeAll, buildEnum, buildMetas } = require('../dist/@glimmer/debug');
const fs = require('fs');
const toml = require('toml');

function parse(file) {
  let opcodes = fs.readFileSync(file, { encoding: 'utf8' });
  let raw = toml.parse(opcodes);
  return normalizeAll(raw);
}

let parsed = parse('./packages/@glimmer/vm/lib/opcodes.toml');

let enums = buildEnum('MachineOp', parsed.machine) + '\n\n' + buildEnum('Op', parsed.syscall);

write('./packages/@glimmer/vm/lib/opcodes.ts', enums);

// console.log(buildEnum('MachineOp', parsed.machine));
// console.log('');
// console.log(buildEnum('Op', parsed.syscall));

let debugMetadata = `
import { Op, MachineOp } from './opcodes';
import { Option } from '@glimmer/interfaces';
import { fillNulls } from '@glimmer/util';
import { NormalizedMetadata } from '@glimmer/debug';

export function opcodeMetadata(op: MachineOp | Op, isMachine: 0 | 1): Option<NormalizedMetadata> {
  let value = isMachine ? MACHINE_METADATA[op] : METADATA[op];

  return value || null;
}

const METADATA: Option<NormalizedMetadata>[] = fillNulls(Op.Size);
const MACHINE_METADATA: Option<NormalizedMetadata>[] = fillNulls(MachineOp.Size);
`;

debugMetadata += buildMetas('MACHINE_METADATA', parsed.machine);
debugMetadata += buildMetas('METADATA', parsed.syscall);

write('./packages/@glimmer/vm/lib/-debug-strip.ts', debugMetadata);

function write(file, contents) {
  contents = `/* This file is generated by build/debug.js */\n\n${contents}`;

  fs.writeFileSync(file, contents);
}
