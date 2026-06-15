import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 28,
    "instructionAddress": 9752254,
    "expectedSize": 4,
    "text": "WRITE $2533 = last entity ($0341)"
  },
  {
    "opcode": 28,
    "instructionAddress": 9752322,
    "expectedSize": 6,
    "text": "WRITE $2533 = $2841"
  },
  {
    "opcode": 28,
    "instructionAddress": 9752344,
    "expectedSize": 4,
    "text": "WRITE $2533 = last entity ($0341)"
  },
  {
    "opcode": 28,
    "instructionAddress": 9752446,
    "expectedSize": 6,
    "text": "WRITE $2533 = $2839"
  },
  {
    "opcode": 28,
    "instructionAddress": 9877186,
    "expectedSize": 4,
    "text": "WRITE $2513 = GameTimer&0xffff"
  },
  {
    "opcode": 28,
    "instructionAddress": 9804526,
    "expectedSize": 6,
    "text": "WRITE $2537 = ($2357)&0xff"
  },
  {
    "opcode": 28,
    "instructionAddress": 10192660,
    "expectedSize": 6,
    "text": "WRITE $2537 = $2835"
  }
];

test('opcode corpus 0x1c', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
