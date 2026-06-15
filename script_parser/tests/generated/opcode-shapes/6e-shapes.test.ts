import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "make dog walk to x={hex},y={hex}",
    "instructionAddress": 9629541,
    "expectedSize": 4,
    "opcode": 110
  },
  {
    "shape": "make boy walk to x={hex},y={hex}",
    "instructionAddress": 9629561,
    "expectedSize": 8,
    "opcode": 110
  },
  {
    "shape": "make {mem} walk to x={hex},y={hex}",
    "instructionAddress": 9745567,
    "expectedSize": 6,
    "opcode": 110
  }
];

test('opcode shape corpus 0x6e', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
