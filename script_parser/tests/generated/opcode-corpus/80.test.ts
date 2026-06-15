import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 128,
    "instructionAddress": 9752132,
    "expectedSize": 1,
    "text": "UNHIDE? UNWINDOWED TEXT"
  },
  {
    "opcode": 128,
    "instructionAddress": 9948404,
    "expectedSize": 2,
    "text": "UNHIDE? UNWINDOWED TEXT"
  },
  {
    "opcode": 128,
    "instructionAddress": 9808495,
    "expectedSize": 2,
    "text": "UNHIDE? UNWINDOWED TEXT"
  },
  {
    "opcode": 128,
    "instructionAddress": 9996539,
    "expectedSize": 1,
    "text": "UNHIDE? UNWINDOWED TEXT"
  },
  {
    "opcode": 128,
    "instructionAddress": 9999633,
    "expectedSize": 1,
    "text": "UNHIDE? UNWINDOWED TEXT"
  },
  {
    "opcode": 128,
    "instructionAddress": 10205658,
    "expectedSize": 2,
    "text": "UNHIDE? UNWINDOWED TEXT"
  }
];

test('opcode corpus 0x80', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
