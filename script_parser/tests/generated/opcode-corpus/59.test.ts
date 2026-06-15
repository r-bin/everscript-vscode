import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 89,
    "instructionAddress": 10129443,
    "expectedSize": 1,
    "text": "FADE OUT VOLUME"
  },
  {
    "opcode": 89,
    "instructionAddress": 9626525,
    "expectedSize": 1,
    "text": "FADE OUT VOLUME"
  }
];

test('opcode corpus 0x59', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
