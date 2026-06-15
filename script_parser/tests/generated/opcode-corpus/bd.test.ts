import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 189,
    "instructionAddress": 9877630,
    "expectedSize": 1,
    "text": "BOY = Player controlled"
  },
  {
    "opcode": 189,
    "instructionAddress": 9877702,
    "expectedSize": 2,
    "text": "BOY = Player controlled"
  },
  {
    "opcode": 189,
    "instructionAddress": 9822998,
    "expectedSize": 7,
    "text": "BOY = Player controlled"
  },
  {
    "opcode": 189,
    "instructionAddress": 9818112,
    "expectedSize": 1,
    "text": "BOY = Player controlled"
  },
  {
    "opcode": 189,
    "instructionAddress": 9819365,
    "expectedSize": 1,
    "text": "BOY = Player controlled"
  },
  {
    "opcode": 189,
    "instructionAddress": 10205723,
    "expectedSize": 1,
    "text": "BOY = Player controlled"
  }
];

test('opcode corpus 0xbd', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
