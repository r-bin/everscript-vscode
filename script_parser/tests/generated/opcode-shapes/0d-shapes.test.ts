import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "{mem} &= {hex} (8bit mode)",
    "instructionAddress": 9688229,
    "expectedSize": 4,
    "opcode": 13
  },
  {
    "shape": "{mem} |= {hex}",
    "instructionAddress": 9810092,
    "expectedSize": 4,
    "opcode": 13
  }
];

test('opcode shape corpus 0x0d', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
