import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "heal boy for {hex}",
    "instructionAddress": 9687881,
    "expectedSize": 5,
    "opcode": 149
  },
  {
    "shape": "heal dog for {hex}",
    "instructionAddress": 9687886,
    "expectedSize": 5,
    "opcode": 149
  }
];

test('opcode shape corpus 0x95', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
