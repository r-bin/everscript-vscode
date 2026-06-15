import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 117,
    "instructionAddress": 9668241,
    "expectedSize": 2,
    "text": "MAKE boy FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9752499,
    "expectedSize": 4,
    "text": "MAKE $283b FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9679563,
    "expectedSize": 2,
    "text": "MAKE boy FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9733307,
    "expectedSize": 2,
    "text": "MAKE dog FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9733310,
    "expectedSize": 2,
    "text": "MAKE boy FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9744931,
    "expectedSize": 4,
    "text": "MAKE $2834 FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9877669,
    "expectedSize": 3,
    "text": "MAKE boy FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9822643,
    "expectedSize": 4,
    "text": "MAKE $284c FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9822658,
    "expectedSize": 4,
    "text": "MAKE $284e FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9944866,
    "expectedSize": 4,
    "text": "MAKE $2840 FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9818110,
    "expectedSize": 2,
    "text": "MAKE dog FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9816888,
    "expectedSize": 4,
    "text": "MAKE $2837 FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9814718,
    "expectedSize": 11,
    "text": "MAKE $2842 FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9887816,
    "expectedSize": 4,
    "text": "MAKE $2837 FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9953004,
    "expectedSize": 2,
    "text": "MAKE boy FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9953031,
    "expectedSize": 2,
    "text": "MAKE dog FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9808574,
    "expectedSize": 2,
    "text": "MAKE boy FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9808601,
    "expectedSize": 2,
    "text": "MAKE dog FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9937860,
    "expectedSize": 2,
    "text": "MAKE boy FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9937862,
    "expectedSize": 2,
    "text": "MAKE dog FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9951740,
    "expectedSize": 2,
    "text": "MAKE boy FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9742509,
    "expectedSize": 4,
    "text": "MAKE $2455 FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10011845,
    "expectedSize": 2,
    "text": "MAKE last entity ($0341) FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10011866,
    "expectedSize": 2,
    "text": "MAKE last entity ($0341) FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10011899,
    "expectedSize": 2,
    "text": "MAKE last entity ($0341) FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10013206,
    "expectedSize": 4,
    "text": "MAKE $2834 FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10018903,
    "expectedSize": 2,
    "text": "MAKE boy FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10018935,
    "expectedSize": 11,
    "text": "MAKE $2835 FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10018963,
    "expectedSize": 11,
    "text": "MAKE $2455 FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10018992,
    "expectedSize": 2,
    "text": "MAKE boy FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10018994,
    "expectedSize": 2,
    "text": "MAKE dog FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10134598,
    "expectedSize": 9,
    "text": "MAKE dog FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10136347,
    "expectedSize": 4,
    "text": "MAKE $2835 FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10070076,
    "expectedSize": 2,
    "text": "MAKE boy FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10070092,
    "expectedSize": 2,
    "text": "MAKE boy FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10008668,
    "expectedSize": 2,
    "text": "MAKE boy FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10008670,
    "expectedSize": 2,
    "text": "MAKE dog FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10129481,
    "expectedSize": 2,
    "text": "MAKE boy FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10214736,
    "expectedSize": 2,
    "text": "MAKE boy FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 10214738,
    "expectedSize": 2,
    "text": "MAKE dog FACE SOUTH"
  },
  {
    "opcode": 117,
    "instructionAddress": 9629579,
    "expectedSize": 2,
    "text": "MAKE boy FACE SOUTH"
  }
];

test('opcode corpus 0x75', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
