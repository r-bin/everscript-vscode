import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "if {mem} & {hex} then unload obj {hex} \u001b[91m(todo: verify this)\u001b[0m",
    "instructionAddress": 9736729,
    "expectedSize": 5,
    "opcode": 93
  },
  {
    "shape": "if {mem} & {hex} then unload obj {num} \u001b[91m(todo: verify this)\u001b[0m",
    "instructionAddress": 10009498,
    "expectedSize": 4,
    "opcode": 93
  }
];

test('opcode shape corpus 0x5d', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
