import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "call relative (16bit) script {hex} (\"unnamed abs script {hex}\")",
    "instructionAddress": 9946830,
    "expectedSize": 17,
    "opcode": 179
  }
];

test('opcode shape corpus 0xb3', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
