import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "call absolute (24bit) script {hex} (\"unnamed abs script {hex}\")",
    "instructionAddress": 9946525,
    "expectedSize": 12,
    "opcode": 180
  }
];

test('opcode shape corpus 0xb4', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
