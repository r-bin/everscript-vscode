import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 172,
    "instructionAddress": 10129144,
    "expectedSize": 10,
    "text": "$283f CASTS SPELL 16 POWER 0x64 ON boy, dog if alive"
  },
  {
    "opcode": 172,
    "instructionAddress": 10129157,
    "expectedSize": 13,
    "text": "$283f CASTS SPELL 22 POWER 0x64 ON boy, dog if alive"
  }
];

test('opcode corpus 0xac', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
