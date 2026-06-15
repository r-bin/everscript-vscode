import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 85,
    "instructionAddress": 9752645,
    "expectedSize": 1,
    "text": "CLEAR TEXT"
  },
  {
    "opcode": 85,
    "instructionAddress": 9877684,
    "expectedSize": 1,
    "text": "CLEAR TEXT"
  },
  {
    "opcode": 85,
    "instructionAddress": 9877700,
    "expectedSize": 1,
    "text": "CLEAR TEXT"
  },
  {
    "opcode": 85,
    "instructionAddress": 9816972,
    "expectedSize": 1,
    "text": "CLEAR TEXT"
  },
  {
    "opcode": 85,
    "instructionAddress": 9997055,
    "expectedSize": 1,
    "text": "CLEAR TEXT"
  },
  {
    "opcode": 85,
    "instructionAddress": 10128588,
    "expectedSize": 1,
    "text": "CLEAR TEXT"
  },
  {
    "opcode": 85,
    "instructionAddress": 10129552,
    "expectedSize": 1,
    "text": "CLEAR TEXT"
  },
  {
    "opcode": 85,
    "instructionAddress": 10129567,
    "expectedSize": 1,
    "text": "CLEAR TEXT"
  },
  {
    "opcode": 85,
    "instructionAddress": 10129852,
    "expectedSize": 1,
    "text": "CLEAR TEXT"
  },
  {
    "opcode": 85,
    "instructionAddress": 10129953,
    "expectedSize": 6,
    "text": "CLEAR TEXT"
  },
  {
    "opcode": 85,
    "instructionAddress": 10130038,
    "expectedSize": 1,
    "text": "CLEAR TEXT"
  },
  {
    "opcode": 85,
    "instructionAddress": 10130076,
    "expectedSize": 1,
    "text": "CLEAR TEXT"
  },
  {
    "opcode": 85,
    "instructionAddress": 9627032,
    "expectedSize": 1,
    "text": "CLEAR TEXT"
  },
  {
    "opcode": 85,
    "instructionAddress": 9627122,
    "expectedSize": 1,
    "text": "CLEAR TEXT"
  },
  {
    "opcode": 85,
    "instructionAddress": 9627199,
    "expectedSize": 1,
    "text": "CLEAR TEXT"
  },
  {
    "opcode": 85,
    "instructionAddress": 9629592,
    "expectedSize": 7,
    "text": "CLEAR TEXT"
  }
];

test('opcode corpus 0x55', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
