import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 156,
    "instructionAddress": 10128675,
    "expectedSize": 4,
    "text": "DECREMENT SCRIPT COUNTER FOR ENTITY $2839 ?"
  },
  {
    "opcode": 156,
    "instructionAddress": 10128679,
    "expectedSize": 4,
    "text": "DECREMENT SCRIPT COUNTER FOR ENTITY $283b ?"
  },
  {
    "opcode": 156,
    "instructionAddress": 10128786,
    "expectedSize": 4,
    "text": "DECREMENT SCRIPT COUNTER FOR ENTITY $2839 ?"
  },
  {
    "opcode": 156,
    "instructionAddress": 10128790,
    "expectedSize": 4,
    "text": "DECREMENT SCRIPT COUNTER FOR ENTITY $283b ?"
  }
];

test('opcode corpus 0x9c', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
