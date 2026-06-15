import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 168,
    "instructionAddress": 9748022,
    "expectedSize": 3,
    "text": "SLEEP 899 TICKS"
  },
  {
    "opcode": 168,
    "instructionAddress": 9626482,
    "expectedSize": 3,
    "text": "SLEEP 479 TICKS"
  },
  {
    "opcode": 168,
    "instructionAddress": 9626996,
    "expectedSize": 3,
    "text": "SLEEP 279 TICKS"
  },
  {
    "opcode": 168,
    "instructionAddress": 9627007,
    "expectedSize": 3,
    "text": "SLEEP 1147 TICKS"
  },
  {
    "opcode": 168,
    "instructionAddress": 9627083,
    "expectedSize": 3,
    "text": "SLEEP 1019 TICKS"
  }
];

test('opcode corpus 0xa8', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
