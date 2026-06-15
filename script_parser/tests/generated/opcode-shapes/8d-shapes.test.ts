import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "{num} start screen shaking",
    "instructionAddress": 9752100,
    "expectedSize": 2,
    "opcode": 141
  },
  {
    "shape": "{num} stop screen shaking",
    "instructionAddress": 10205713,
    "expectedSize": 10,
    "opcode": 141
  }
];

test('opcode shape corpus 0x8d', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
