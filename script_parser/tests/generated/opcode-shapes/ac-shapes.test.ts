import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "{mem} casts spell {num} power {hex} on boy, dog if alive",
    "instructionAddress": 10129157,
    "expectedSize": 13,
    "opcode": 172
  }
];

test('opcode shape corpus 0xac', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
