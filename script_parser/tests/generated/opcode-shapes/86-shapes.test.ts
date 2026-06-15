import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "set audio volume to signed arg0",
    "instructionAddress": 9671187,
    "expectedSize": 3,
    "opcode": 134
  },
  {
    "shape": "set audio volume to {hex}",
    "instructionAddress": 9757869,
    "expectedSize": 3,
    "opcode": 134
  }
];

test('opcode shape corpus 0x86', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
