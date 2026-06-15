import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "heal {mem} for {num} + (rand & {hex}) with animation",
    "instructionAddress": 10129220,
    "expectedSize": 22,
    "opcode": 148
  }
];

test('opcode shape corpus 0x94', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
