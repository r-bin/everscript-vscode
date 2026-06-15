import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "switch char to dog",
    "instructionAddress": 10134591,
    "expectedSize": 7,
    "opcode": 152
  },
  {
    "shape": "switch char to boy",
    "instructionAddress": 10142615,
    "expectedSize": 2,
    "opcode": 152
  }
];

test('opcode shape corpus 0x98', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
