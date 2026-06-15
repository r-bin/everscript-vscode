import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 119,
    "instructionAddress": 9668233,
    "expectedSize": 2,
    "text": "MAKE boy FACE EAST"
  },
  {
    "opcode": 119,
    "instructionAddress": 9757596,
    "expectedSize": 4,
    "text": "MAKE $2835 FACE EAST"
  },
  {
    "opcode": 119,
    "instructionAddress": 9679555,
    "expectedSize": 2,
    "text": "MAKE boy FACE EAST"
  },
  {
    "opcode": 119,
    "instructionAddress": 9745562,
    "expectedSize": 4,
    "text": "MAKE $2834 FACE EAST"
  },
  {
    "opcode": 119,
    "instructionAddress": 9877476,
    "expectedSize": 4,
    "text": "MAKE $283f FACE EAST"
  },
  {
    "opcode": 119,
    "instructionAddress": 9877492,
    "expectedSize": 4,
    "text": "MAKE $2839 FACE EAST"
  },
  {
    "opcode": 119,
    "instructionAddress": 9810854,
    "expectedSize": 7,
    "text": "MAKE dog FACE EAST"
  },
  {
    "opcode": 119,
    "instructionAddress": 9810871,
    "expectedSize": 4,
    "text": "MAKE $2455 FACE EAST"
  },
  {
    "opcode": 119,
    "instructionAddress": 9814483,
    "expectedSize": 2,
    "text": "MAKE boy FACE EAST"
  },
  {
    "opcode": 119,
    "instructionAddress": 10134371,
    "expectedSize": 4,
    "text": "MAKE $2834 FACE EAST"
  },
  {
    "opcode": 119,
    "instructionAddress": 10063181,
    "expectedSize": 2,
    "text": "MAKE boy FACE EAST"
  },
  {
    "opcode": 119,
    "instructionAddress": 9629640,
    "expectedSize": 2,
    "text": "MAKE boy FACE EAST"
  }
];

test('opcode corpus 0x77', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
