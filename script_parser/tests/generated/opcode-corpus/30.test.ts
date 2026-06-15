import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 48,
    "instructionAddress": 9877571,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x46 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9877646,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x42 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9822939,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x46 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9823007,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x42 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9818123,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x76 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9952974,
    "expectedSize": 8,
    "text": "PLAY SOUND EFFECT 0x36 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9953006,
    "expectedSize": 8,
    "text": "PLAY SOUND EFFECT 0x36 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9808544,
    "expectedSize": 8,
    "text": "PLAY SOUND EFFECT 0x36 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9808576,
    "expectedSize": 8,
    "text": "PLAY SOUND EFFECT 0x36 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9955669,
    "expectedSize": 7,
    "text": "PLAY SOUND EFFECT 0x76 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10012073,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x42 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10012098,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x42 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10012123,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x42 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10012139,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x42 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10013450,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x42 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10013466,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x42 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10013493,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x42 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10013520,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x42 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10013536,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x42 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10019654,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x42 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10138527,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x42 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10006851,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x76 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10020952,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x42 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10003298,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x46 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10003325,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x46 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9996951,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x46 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9996960,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x42 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9997053,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x24 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9997129,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x5a ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10129209,
    "expectedSize": 9,
    "text": "PLAY SOUND EFFECT 0x2e ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10129451,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x64 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10129829,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x32 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10129860,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x32 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10129916,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x64 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 10130046,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x44 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9627086,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x60 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9627092,
    "expectedSize": 8,
    "text": "PLAY SOUND EFFECT 0x60 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9627103,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x60 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9627111,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x60 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9627116,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x34 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9627120,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0xaa ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9627131,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x64 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9629512,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x70 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9629537,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x24 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9629553,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x24 ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9629691,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x3c ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9629695,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x3e ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9629699,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x3c ??"
  },
  {
    "opcode": 48,
    "instructionAddress": 9629721,
    "expectedSize": 2,
    "text": "PLAY SOUND EFFECT 0x42 ??"
  }
];

test('opcode corpus 0x30', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
