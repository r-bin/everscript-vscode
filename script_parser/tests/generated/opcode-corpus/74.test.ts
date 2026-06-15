import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 116,
    "instructionAddress": 9668251,
    "expectedSize": 2,
    "text": "MAKE boy FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9757603,
    "expectedSize": 4,
    "text": "MAKE $2835 FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9757638,
    "expectedSize": 4,
    "text": "MAKE $2835 FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9757774,
    "expectedSize": 2,
    "text": "MAKE dog FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9877432,
    "expectedSize": 4,
    "text": "MAKE $2857 FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9822487,
    "expectedSize": 4,
    "text": "MAKE $2842 FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9822502,
    "expectedSize": 4,
    "text": "MAKE $2842 FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9822517,
    "expectedSize": 4,
    "text": "MAKE $2846 FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9822532,
    "expectedSize": 4,
    "text": "MAKE $2836 FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9822547,
    "expectedSize": 4,
    "text": "MAKE $283c FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9822562,
    "expectedSize": 4,
    "text": "MAKE $2840 FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9822577,
    "expectedSize": 4,
    "text": "MAKE $2844 FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9822592,
    "expectedSize": 4,
    "text": "MAKE $2838 FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9822607,
    "expectedSize": 4,
    "text": "MAKE $2848 FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9822622,
    "expectedSize": 4,
    "text": "MAKE $284a FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9944791,
    "expectedSize": 4,
    "text": "MAKE $2836 FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9944806,
    "expectedSize": 4,
    "text": "MAKE $2838 FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9944821,
    "expectedSize": 4,
    "text": "MAKE $283a FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9944836,
    "expectedSize": 4,
    "text": "MAKE $283c FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9944851,
    "expectedSize": 4,
    "text": "MAKE $283e FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9818108,
    "expectedSize": 2,
    "text": "MAKE boy FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 10087771,
    "expectedSize": 4,
    "text": "MAKE $244d FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9812872,
    "expectedSize": 4,
    "text": "MAKE $2455 FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9812876,
    "expectedSize": 2,
    "text": "MAKE boy FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9951736,
    "expectedSize": 2,
    "text": "MAKE boy FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 10022896,
    "expectedSize": 4,
    "text": "MAKE $2836 FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 10063094,
    "expectedSize": 2,
    "text": "MAKE boy FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 10214604,
    "expectedSize": 4,
    "text": "MAKE $285b FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 10216280,
    "expectedSize": 2,
    "text": "MAKE boy FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 10216291,
    "expectedSize": 2,
    "text": "MAKE dog FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 10205660,
    "expectedSize": 2,
    "text": "MAKE boy FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 10205662,
    "expectedSize": 2,
    "text": "MAKE dog FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9629545,
    "expectedSize": 6,
    "text": "MAKE dog FACE NORTH"
  },
  {
    "opcode": 116,
    "instructionAddress": 9629601,
    "expectedSize": 2,
    "text": "MAKE boy FACE NORTH"
  }
];

test('opcode corpus 0x74', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
