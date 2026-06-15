import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "make boy face north",
    "instructionAddress": 9668251,
    "expectedSize": 2,
    "opcode": 116
  },
  {
    "shape": "make dog face north",
    "instructionAddress": 9757774,
    "expectedSize": 2,
    "opcode": 116
  },
  {
    "shape": "make {mem} face north",
    "instructionAddress": 9944806,
    "expectedSize": 4,
    "opcode": 116
  }
];

test('opcode shape corpus 0x74', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
