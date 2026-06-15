import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 111,
    "instructionAddress": 9668220,
    "expectedSize": 4,
    "text": "Make boy walk by 0,-6 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9668224,
    "expectedSize": 4,
    "text": "Make dog walk by 0,-5 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9668245,
    "expectedSize": 4,
    "text": "Make boy walk by 7,-2 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9687906,
    "expectedSize": 4,
    "text": "Make boy walk by 0,-13 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9687912,
    "expectedSize": 4,
    "text": "Make dog walk by 0,-12 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9687959,
    "expectedSize": 4,
    "text": "Make dog walk by 0,-3 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9687976,
    "expectedSize": 4,
    "text": "Make boy walk by 0,-3 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9877575,
    "expectedSize": 4,
    "text": "Make entity attached to script? walk by 0,6 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9877593,
    "expectedSize": 4,
    "text": "Make dog walk by 0,6 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9877600,
    "expectedSize": 4,
    "text": "Make boy walk by 0,6 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9822943,
    "expectedSize": 4,
    "text": "Make entity attached to script? walk by 0,6 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9822961,
    "expectedSize": 4,
    "text": "Make dog walk by 0,6 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9822968,
    "expectedSize": 4,
    "text": "Make boy walk by 0,6 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9816954,
    "expectedSize": 4,
    "text": "Make controlled char walk by 0,5 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9816958,
    "expectedSize": 4,
    "text": "Make non-controlled char walk by 0,4 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 10006823,
    "expectedSize": 4,
    "text": "Make controlled char walk by 0,4 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 10006827,
    "expectedSize": 4,
    "text": "Make non-controlled char walk by 0,3 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 10006836,
    "expectedSize": 4,
    "text": "Make controlled char walk by 0,4 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 10006840,
    "expectedSize": 4,
    "text": "Make non-controlled char walk by 0,4 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9999711,
    "expectedSize": 4,
    "text": "Make dog walk by 3,0 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9999727,
    "expectedSize": 4,
    "text": "Make dog walk by -3,0 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9999743,
    "expectedSize": 4,
    "text": "Make dog walk by 0,3 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 9999759,
    "expectedSize": 4,
    "text": "Make dog walk by 0,-3 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 10128551,
    "expectedSize": 4,
    "text": "Make controlled char walk by -13,0 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 10128557,
    "expectedSize": 4,
    "text": "Make non-controlled char walk by -13,0 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 10128570,
    "expectedSize": 6,
    "text": "Make $2837 walk by 4,0 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 10129553,
    "expectedSize": 4,
    "text": "Make controlled char walk by -1,0 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 10129666,
    "expectedSize": 4,
    "text": "Make controlled char walk by 4,0 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 10129670,
    "expectedSize": 23,
    "text": "Make non-controlled char walk by 3,-1 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 10129926,
    "expectedSize": 4,
    "text": "Make boy walk by -2,0 directly"
  },
  {
    "opcode": 111,
    "instructionAddress": 10129959,
    "expectedSize": 4,
    "text": "Make boy walk by 1,0 directly"
  }
];

test('opcode corpus 0x6f', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
