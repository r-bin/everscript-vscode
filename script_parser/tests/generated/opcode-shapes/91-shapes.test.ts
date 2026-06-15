import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "sets brightness to signed arg0",
    "instructionAddress": 9627154,
    "expectedSize": 3,
    "opcode": 145
  },
  {
    "shape": "sets brightness to {mem}",
    "instructionAddress": 9810890,
    "expectedSize": 4,
    "opcode": 145
  },
  {
    "shape": "sets brightness to {num}",
    "instructionAddress": 9819272,
    "expectedSize": 2,
    "opcode": 145
  }
];

test('opcode shape corpus 0x91', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
