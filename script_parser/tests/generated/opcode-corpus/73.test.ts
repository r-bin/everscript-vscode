import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 115,
    "instructionAddress": 10130010,
    "expectedSize": 18,
    "text": "Make $2835 walk to *(boy + 26) + 0x20,*(boy + 28) directly"
  }
];

test('opcode corpus 0x73', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
