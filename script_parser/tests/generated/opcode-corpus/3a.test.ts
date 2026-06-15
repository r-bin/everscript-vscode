import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 58,
    "instructionAddress": 9671190,
    "expectedSize": 8,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9752639,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9679575,
    "expectedSize": 6,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9733309,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9733312,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9745472,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9745511,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9745550,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9745566,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9748028,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9948406,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9822838,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9822862,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9822886,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9822910,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9822925,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9819274,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9824649,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9824672,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 10012072,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 10012097,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 10012122,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 10012138,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 10013449,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 10013465,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 10013492,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 10013519,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 10013535,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 10128672,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 10128783,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 10129291,
    "expectedSize": 8,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 10129660,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 10129810,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 10130028,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9625932,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9625997,
    "expectedSize": 1,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9626238,
    "expectedSize": 8,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9626322,
    "expectedSize": 6,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9626367,
    "expectedSize": 8,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9626406,
    "expectedSize": 8,
    "text": "YIELD (break out of script loop, continue later)"
  },
  {
    "opcode": 58,
    "instructionAddress": 9626468,
    "expectedSize": 8,
    "text": "YIELD (break out of script loop, continue later)"
  }
];

test('opcode corpus 0x3a', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
