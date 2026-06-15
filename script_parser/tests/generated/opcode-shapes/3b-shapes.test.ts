import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "sleep {hex} + (rand & {hex}) ticks",
    "instructionAddress": 9955676,
    "expectedSize": 10,
    "opcode": 59
  }
];

test('opcode shape corpus 0x3b', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
