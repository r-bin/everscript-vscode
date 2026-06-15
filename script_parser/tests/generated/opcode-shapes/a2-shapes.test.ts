import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "spawn npc {hex}>>{num}, flags {hex}, x:{mem} + {num}, y:{mem}",
    "instructionAddress": 10087782,
    "expectedSize": 14,
    "opcode": 162
  }
];

test('opcode shape corpus 0xa2', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
