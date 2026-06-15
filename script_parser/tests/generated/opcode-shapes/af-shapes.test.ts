import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "call absolute (24bit) script {hex} (\"unnamed abs script {hex}\")",
    "instructionAddress": 9948407,
    "expectedSize": 13,
    "opcode": 175
  }
];

test('opcode shape corpus 0xaf', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
