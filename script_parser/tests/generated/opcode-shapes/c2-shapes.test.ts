import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "add npc {hex} spawner at {hex},{hex}\u001b[0m",
    "instructionAddress": 9937699,
    "expectedSize": 4,
    "opcode": 194
  }
];

test('opcode shape corpus 0xc2', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
