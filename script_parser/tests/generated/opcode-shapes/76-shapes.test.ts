import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "make boy face west",
    "instructionAddress": 9679559,
    "expectedSize": 2,
    "opcode": 118
  },
  {
    "shape": "make dog face west",
    "instructionAddress": 9687967,
    "expectedSize": 7,
    "opcode": 118
  },
  {
    "shape": "make {mem} face west",
    "instructionAddress": 9877454,
    "expectedSize": 4,
    "opcode": 118
  }
];

test('opcode shape corpus 0x76', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
