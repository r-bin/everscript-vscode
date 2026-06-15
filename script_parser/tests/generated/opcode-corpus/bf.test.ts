import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 191,
    "instructionAddress": 9668232,
    "expectedSize": 1,
    "text": "DOG = Player controlled"
  },
  {
    "opcode": 191,
    "instructionAddress": 9679554,
    "expectedSize": 1,
    "text": "DOG = Player controlled"
  },
  {
    "opcode": 191,
    "instructionAddress": 9877637,
    "expectedSize": 7,
    "text": "DOG = Player controlled"
  },
  {
    "opcode": 191,
    "instructionAddress": 9877701,
    "expectedSize": 1,
    "text": "DOG = Player controlled"
  },
  {
    "opcode": 191,
    "instructionAddress": 9822992,
    "expectedSize": 1,
    "text": "DOG = Player controlled"
  },
  {
    "opcode": 191,
    "instructionAddress": 9818117,
    "expectedSize": 1,
    "text": "DOG = Player controlled"
  },
  {
    "opcode": 191,
    "instructionAddress": 9996997,
    "expectedSize": 1,
    "text": "DOG = Player controlled"
  },
  {
    "opcode": 191,
    "instructionAddress": 9997102,
    "expectedSize": 1,
    "text": "DOG = Player controlled"
  },
  {
    "opcode": 191,
    "instructionAddress": 9999765,
    "expectedSize": 1,
    "text": "DOG = Player controlled"
  }
];

test('opcode corpus 0xbf', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
