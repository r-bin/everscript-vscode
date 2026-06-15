import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "rcall -{num} (to {hex}): acid rain dialog",
    "instructionAddress": 9678689,
    "expectedSize": 2,
    "opcode": 165
  },
  {
    "shape": "rcall -{num} (to {hex}): unknown",
    "instructionAddress": 9747938,
    "expectedSize": 2,
    "opcode": 165
  },
  {
    "shape": "rcall -{num} (to {hex}): tinker part [{num}]",
    "instructionAddress": 10062987,
    "expectedSize": 2,
    "opcode": 165
  },
  {
    "shape": "rcall -{num} (to {hex}): gomi's tower part [{num}]",
    "instructionAddress": 10069726,
    "expectedSize": 2,
    "opcode": 165
  }
];

test('opcode shape corpus 0xa5', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
