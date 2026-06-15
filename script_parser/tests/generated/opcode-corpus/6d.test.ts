import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 109,
    "instructionAddress": 9758154,
    "expectedSize": 4,
    "text": "Make entity attached to script? walk by -4,0"
  },
  {
    "opcode": 109,
    "instructionAddress": 9679567,
    "expectedSize": 4,
    "text": "Make boy walk by 6,4"
  },
  {
    "opcode": 109,
    "instructionAddress": 9684022,
    "expectedSize": 4,
    "text": "Make boy walk by 2,-8"
  },
  {
    "opcode": 109,
    "instructionAddress": 9684026,
    "expectedSize": 4,
    "text": "Make dog walk by 2,-10"
  },
  {
    "opcode": 109,
    "instructionAddress": 9684032,
    "expectedSize": 4,
    "text": "Make boy walk by 0,-2"
  },
  {
    "opcode": 109,
    "instructionAddress": 9745580,
    "expectedSize": 4,
    "text": "Make boy walk by 0,-1"
  },
  {
    "opcode": 109,
    "instructionAddress": 9952998,
    "expectedSize": 4,
    "text": "Make boy walk by 1,2"
  },
  {
    "opcode": 109,
    "instructionAddress": 9953027,
    "expectedSize": 4,
    "text": "Make dog walk by -1,2"
  },
  {
    "opcode": 109,
    "instructionAddress": 9808568,
    "expectedSize": 4,
    "text": "Make boy walk by 1,2"
  },
  {
    "opcode": 109,
    "instructionAddress": 9808597,
    "expectedSize": 4,
    "text": "Make dog walk by -1,2"
  },
  {
    "opcode": 109,
    "instructionAddress": 9951719,
    "expectedSize": 4,
    "text": "Make dog walk by 1,-1"
  }
];

test('opcode corpus 0x6d', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
