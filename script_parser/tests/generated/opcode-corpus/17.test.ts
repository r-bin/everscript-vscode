import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 23,
    "instructionAddress": 9687581,
    "expectedSize": 5,
    "text": "WRITE $249b = 0x0001"
  },
  {
    "opcode": 23,
    "instructionAddress": 9687679,
    "expectedSize": 5,
    "text": "WRITE $249b = 0x0001"
  },
  {
    "opcode": 23,
    "instructionAddress": 9687772,
    "expectedSize": 5,
    "text": "WRITE $249b = 0x0001"
  },
  {
    "opcode": 23,
    "instructionAddress": 10129362,
    "expectedSize": 8,
    "text": "WRITE $2537 = 0x0007"
  },
  {
    "opcode": 23,
    "instructionAddress": 10129381,
    "expectedSize": 8,
    "text": "WRITE $2537 = 0x000a"
  },
  {
    "opcode": 23,
    "instructionAddress": 10129400,
    "expectedSize": 8,
    "text": "WRITE $2537 = 0x0006"
  },
  {
    "opcode": 23,
    "instructionAddress": 10129411,
    "expectedSize": 8,
    "text": "WRITE $2537 = 0x0009"
  }
];

test('opcode corpus 0x17', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
