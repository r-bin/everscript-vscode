import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 43,
    "instructionAddress": 9758171,
    "expectedSize": 2,
    "text": "Make controlled char player/AI controlled"
  },
  {
    "opcode": 43,
    "instructionAddress": 9883735,
    "expectedSize": 2,
    "text": "Make controlled char player/AI controlled"
  },
  {
    "opcode": 43,
    "instructionAddress": 9996923,
    "expectedSize": 4,
    "text": "Make $2455 player/AI controlled"
  },
  {
    "opcode": 43,
    "instructionAddress": 10129242,
    "expectedSize": 4,
    "text": "Make $283b player/AI controlled"
  },
  {
    "opcode": 43,
    "instructionAddress": 10129246,
    "expectedSize": 7,
    "text": "Make $283f player/AI controlled"
  }
];

test('opcode corpus 0x2b', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
