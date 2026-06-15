import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 164,
    "instructionAddress": 9668255,
    "expectedSize": 3,
    "text": "CALL 0x07e9 -> 0x93802b"
  },
  {
    "opcode": 164,
    "instructionAddress": 10077103,
    "expectedSize": 3,
    "text": "CALL 0x048c -> 0x99aa89"
  },
  {
    "opcode": 164,
    "instructionAddress": 10077118,
    "expectedSize": 3,
    "text": "CALL 0x048f -> 0x99aa70"
  },
  {
    "opcode": 164,
    "instructionAddress": 10077133,
    "expectedSize": 3,
    "text": "CALL 0x0492 -> 0x99aaa2"
  },
  {
    "opcode": 164,
    "instructionAddress": 10128582,
    "expectedSize": 3,
    "text": "CALL 0x1a7f -> 0x9a8591"
  },
  {
    "opcode": 164,
    "instructionAddress": 10129546,
    "expectedSize": 3,
    "text": "CALL 0x1a7f -> 0x9a8591"
  },
  {
    "opcode": 164,
    "instructionAddress": 10129561,
    "expectedSize": 3,
    "text": "CALL 0x1a7f -> 0x9a8591"
  },
  {
    "opcode": 164,
    "instructionAddress": 10191134,
    "expectedSize": 3,
    "text": "CALL 0x0a83 -> 0x9b8210"
  }
];

test('opcode corpus 0xa4', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
