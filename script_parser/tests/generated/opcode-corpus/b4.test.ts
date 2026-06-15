import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 180,
    "instructionAddress": 9946525,
    "expectedSize": 12,
    "text": "CALL Absolute (24bit) script 0x92d93e (\"Unnamed ABS script 0x92d93e\")"
  },
  {
    "opcode": 180,
    "instructionAddress": 9946781,
    "expectedSize": 12,
    "text": "CALL Absolute (24bit) script 0x92d93e (\"Unnamed ABS script 0x92d93e\")"
  }
];

test('opcode corpus 0xb4', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
