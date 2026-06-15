import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "make boy face east",
    "instructionAddress": 9679555,
    "expectedSize": 2,
    "opcode": 119
  },
  {
    "shape": "make {mem} face east",
    "instructionAddress": 9757596,
    "expectedSize": 4,
    "opcode": 119
  },
  {
    "shape": "make dog face east",
    "instructionAddress": 9810854,
    "expectedSize": 7,
    "opcode": 119
  }
];

test('opcode shape corpus 0x77', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
