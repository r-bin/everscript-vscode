import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 59,
    "instructionAddress": 9955676,
    "expectedSize": 10,
    "text": "SLEEP 0x3f + (RAND & 0x7f) TICKS"
  }
];

test('opcode corpus 0x3b', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
