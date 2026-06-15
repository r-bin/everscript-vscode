import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 110,
    "instructionAddress": 9745567,
    "expectedSize": 6,
    "text": "Make $2834 walk to x=0x1f,y=0x1b"
  },
  {
    "opcode": 110,
    "instructionAddress": 9747874,
    "expectedSize": 4,
    "text": "Make boy walk to x=0x18,y=0x2e"
  },
  {
    "opcode": 110,
    "instructionAddress": 9747880,
    "expectedSize": 4,
    "text": "Make dog walk to x=0x19,y=0x32"
  },
  {
    "opcode": 110,
    "instructionAddress": 9824661,
    "expectedSize": 6,
    "text": "Make $2838 walk to x=0x57,y=0x0b"
  },
  {
    "opcode": 110,
    "instructionAddress": 10130101,
    "expectedSize": 6,
    "text": "Make $2835 walk to x=0x39,y=0x24"
  },
  {
    "opcode": 110,
    "instructionAddress": 10130111,
    "expectedSize": 4,
    "text": "Make boy walk to x=0x39,y=0x24"
  },
  {
    "opcode": 110,
    "instructionAddress": 10130115,
    "expectedSize": 4,
    "text": "Make dog walk to x=0x39,y=0x24"
  },
  {
    "opcode": 110,
    "instructionAddress": 9629527,
    "expectedSize": 8,
    "text": "Make dog walk to x=0x14,y=0x6b"
  },
  {
    "opcode": 110,
    "instructionAddress": 9629541,
    "expectedSize": 4,
    "text": "Make dog walk to x=0x14,y=0x48"
  },
  {
    "opcode": 110,
    "instructionAddress": 9629561,
    "expectedSize": 8,
    "text": "Make boy walk to x=0x14,y=0x6b"
  },
  {
    "opcode": 110,
    "instructionAddress": 9629610,
    "expectedSize": 4,
    "text": "Make boy walk to x=0x14,y=0x48"
  },
  {
    "opcode": 110,
    "instructionAddress": 9629647,
    "expectedSize": 4,
    "text": "Make boy walk to x=0x14,y=0x37"
  }
];

test('opcode corpus 0x6e', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
