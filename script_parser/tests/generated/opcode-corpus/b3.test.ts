import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 179,
    "instructionAddress": 9948477,
    "expectedSize": 15,
    "text": "CALL Relative (16bit) script 0x97c9a9 (\"Unnamed ABS script 0x97c9a9\")"
  },
  {
    "opcode": 179,
    "instructionAddress": 9946830,
    "expectedSize": 17,
    "text": "CALL Relative (16bit) script 0x97c3d9 (\"Unnamed ABS script 0x97c3d9\")"
  },
  {
    "opcode": 179,
    "instructionAddress": 9945612,
    "expectedSize": 8,
    "text": "CALL Relative (16bit) script 0x97c0f3 (\"Unnamed ABS script 0x97c0f3\")"
  },
  {
    "opcode": 179,
    "instructionAddress": 10146045,
    "expectedSize": 16,
    "text": "CALL Relative (16bit) script 0x9ac93f (\"Unnamed ABS script 0x9ac93f\")"
  }
];

test('opcode corpus 0xb3', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
