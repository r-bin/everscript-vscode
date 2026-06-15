import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 149,
    "instructionAddress": 9687881,
    "expectedSize": 5,
    "text": "HEAL boy FOR 0x03e7"
  },
  {
    "opcode": 149,
    "instructionAddress": 9687886,
    "expectedSize": 5,
    "text": "HEAL dog FOR 0x03e7"
  }
];

test('opcode corpus 0x95', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
