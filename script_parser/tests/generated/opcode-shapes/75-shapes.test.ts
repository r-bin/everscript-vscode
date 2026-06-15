import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "make boy face south",
    "instructionAddress": 9679563,
    "expectedSize": 2,
    "opcode": 117
  },
  {
    "shape": "make dog face south",
    "instructionAddress": 9733307,
    "expectedSize": 2,
    "opcode": 117
  },
  {
    "shape": "make {mem} face south",
    "instructionAddress": 9944866,
    "expectedSize": 4,
    "opcode": 117
  },
  {
    "shape": "make last entity ({mem}) face south",
    "instructionAddress": 10011899,
    "expectedSize": 2,
    "opcode": 117
  }
];

test('opcode shape corpus 0x75', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
