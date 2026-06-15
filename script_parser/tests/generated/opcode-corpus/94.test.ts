import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 148,
    "instructionAddress": 10129220,
    "expectedSize": 22,
    "text": "HEAL $283f FOR 20 + (RAND & 0x3f) WITH ANIMATION"
  }
];

test('opcode corpus 0x94', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
