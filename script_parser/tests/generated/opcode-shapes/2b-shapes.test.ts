import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "make controlled char player/ai controlled",
    "instructionAddress": 9883735,
    "expectedSize": 2,
    "opcode": 43
  },
  {
    "shape": "make {mem} player/ai controlled",
    "instructionAddress": 10129246,
    "expectedSize": 7,
    "opcode": 43
  }
];

test('opcode shape corpus 0x2b', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
