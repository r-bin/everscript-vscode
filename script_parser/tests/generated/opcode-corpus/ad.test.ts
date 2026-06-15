import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 173,
    "instructionAddress": 9955617,
    "expectedSize": 7,
    "text": "WRITE $2859 = 0x003d"
  },
  {
    "opcode": 173,
    "instructionAddress": 10134420,
    "expectedSize": 7,
    "text": "WRITE $2878 = 0x0001"
  },
  {
    "opcode": 173,
    "instructionAddress": 10134562,
    "expectedSize": 7,
    "text": "WRITE $285e = 0x000b"
  }
];

test('opcode corpus 0xad', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
