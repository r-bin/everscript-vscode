import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "show text 1d8e from {hex} compressed unwindowed",
    "instructionAddress": 10129206,
    "expectedSize": 3,
    "opcode": 82
  },
  {
    "shape": "show text 1da0 from {hex} compressed unwindowed",
    "instructionAddress": 10130048,
    "expectedSize": 3,
    "opcode": 82
  },
  {
    "shape": "show text 20fd from {hex} compressed unwindowed",
    "instructionAddress": 10192666,
    "expectedSize": 3,
    "opcode": 82
  }
];

test('opcode shape corpus 0x52', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
