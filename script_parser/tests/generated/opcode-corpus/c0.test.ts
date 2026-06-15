import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 192,
    "instructionAddress": 9752635,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9733306,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9733848,
    "expectedSize": 2,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9745440,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9747873,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9759563,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9759639,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9759652,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9758904,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9758939,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9877562,
    "expectedSize": 7,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9877668,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9822932,
    "expectedSize": 7,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 10087848,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9819209,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9816949,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9812857,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9887820,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9809945,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9951712,
    "expectedSize": 7,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 10134561,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 10136375,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 10006788,
    "expectedSize": 22,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 10022900,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 10142614,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9996538,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9998648,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9998669,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9999634,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 10008682,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 10128509,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 10128794,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9625824,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  },
  {
    "opcode": 192,
    "instructionAddress": 9626851,
    "expectedSize": 1,
    "text": "BOY+DOG = STOPPED"
  }
];

test('opcode corpus 0xc0', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
