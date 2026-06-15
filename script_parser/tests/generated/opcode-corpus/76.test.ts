import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 118,
    "instructionAddress": 9668237,
    "expectedSize": 2,
    "text": "MAKE boy FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9757351,
    "expectedSize": 2,
    "text": "MAKE boy FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9757353,
    "expectedSize": 2,
    "text": "MAKE dog FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9757772,
    "expectedSize": 2,
    "text": "MAKE boy FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9679559,
    "expectedSize": 2,
    "text": "MAKE boy FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9679573,
    "expectedSize": 2,
    "text": "MAKE boy FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9687967,
    "expectedSize": 7,
    "text": "MAKE dog FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9678645,
    "expectedSize": 4,
    "text": "MAKE $2455 FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9745379,
    "expectedSize": 2,
    "text": "MAKE boy FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9745381,
    "expectedSize": 2,
    "text": "MAKE dog FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9948222,
    "expectedSize": 2,
    "text": "MAKE boy FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9948224,
    "expectedSize": 2,
    "text": "MAKE dog FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9948226,
    "expectedSize": 4,
    "text": "MAKE $2836 FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9877454,
    "expectedSize": 4,
    "text": "MAKE $284b FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 10087812,
    "expectedSize": 4,
    "text": "MAKE $2835 FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9816832,
    "expectedSize": 4,
    "text": "MAKE $2835 FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9810777,
    "expectedSize": 4,
    "text": "MAKE $2455 FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9810829,
    "expectedSize": 7,
    "text": "MAKE boy FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9798756,
    "expectedSize": 4,
    "text": "MAKE $283b FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9814501,
    "expectedSize": 2,
    "text": "MAKE dog FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9887825,
    "expectedSize": 2,
    "text": "MAKE boy FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9887831,
    "expectedSize": 12,
    "text": "MAKE dog FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9951732,
    "expectedSize": 2,
    "text": "MAKE boy FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 10140392,
    "expectedSize": 2,
    "text": "MAKE boy FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 10140412,
    "expectedSize": 2,
    "text": "MAKE dog FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 10018905,
    "expectedSize": 2,
    "text": "MAKE dog FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 10063100,
    "expectedSize": 7,
    "text": "MAKE dog FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 10063117,
    "expectedSize": 4,
    "text": "MAKE $2455 FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 10063187,
    "expectedSize": 2,
    "text": "MAKE dog FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 10145950,
    "expectedSize": 4,
    "text": "MAKE $2455 FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 9996566,
    "expectedSize": 2,
    "text": "MAKE boy FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 10129806,
    "expectedSize": 2,
    "text": "MAKE boy FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 10129808,
    "expectedSize": 2,
    "text": "MAKE dog FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 10214814,
    "expectedSize": 2,
    "text": "MAKE boy FACE WEST"
  },
  {
    "opcode": 118,
    "instructionAddress": 10214830,
    "expectedSize": 2,
    "text": "MAKE dog FACE WEST"
  }
];

test('opcode corpus 0x76', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
