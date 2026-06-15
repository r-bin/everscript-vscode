import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 193,
    "instructionAddress": 9752646,
    "expectedSize": 1,
    "text": "BOY+DOG = Player controlled"
  },
  {
    "opcode": 193,
    "instructionAddress": 9745383,
    "expectedSize": 1,
    "text": "BOY+DOG = Player controlled"
  },
  {
    "opcode": 193,
    "instructionAddress": 9745586,
    "expectedSize": 7,
    "text": "BOY+DOG = Player controlled"
  },
  {
    "opcode": 193,
    "instructionAddress": 9816973,
    "expectedSize": 1,
    "text": "BOY+DOG = Player controlled"
  },
  {
    "opcode": 193,
    "instructionAddress": 9953042,
    "expectedSize": 1,
    "text": "BOY+DOG = Player controlled"
  },
  {
    "opcode": 193,
    "instructionAddress": 9808605,
    "expectedSize": 1,
    "text": "BOY+DOG = Player controlled"
  },
  {
    "opcode": 193,
    "instructionAddress": 9810128,
    "expectedSize": 1,
    "text": "BOY+DOG = Player controlled"
  },
  {
    "opcode": 193,
    "instructionAddress": 9810238,
    "expectedSize": 1,
    "text": "BOY+DOG = Player controlled"
  },
  {
    "opcode": 193,
    "instructionAddress": 9951742,
    "expectedSize": 1,
    "text": "BOY+DOG = Player controlled"
  },
  {
    "opcode": 193,
    "instructionAddress": 9742479,
    "expectedSize": 1,
    "text": "BOY+DOG = Player controlled"
  },
  {
    "opcode": 193,
    "instructionAddress": 10006858,
    "expectedSize": 1,
    "text": "BOY+DOG = Player controlled"
  },
  {
    "opcode": 193,
    "instructionAddress": 9997056,
    "expectedSize": 1,
    "text": "BOY+DOG = Player controlled"
  },
  {
    "opcode": 193,
    "instructionAddress": 10128609,
    "expectedSize": 1,
    "text": "BOY+DOG = Player controlled"
  },
  {
    "opcode": 193,
    "instructionAddress": 10129097,
    "expectedSize": 1,
    "text": "BOY+DOG = Player controlled"
  }
];

test('opcode corpus 0xc1', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
