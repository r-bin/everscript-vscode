import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 146,
    "instructionAddress": 9685199,
    "expectedSize": 7,
    "text": "DAMAGE $2869 FOR $283f WITH ANIMATION"
  }
];

test('opcode corpus 0x92', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
