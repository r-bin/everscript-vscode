import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "make boy walk by {num},-{num}",
    "instructionAddress": 9745580,
    "expectedSize": 4,
    "opcode": 109
  },
  {
    "shape": "make entity attached to script? walk by -{num},{num}",
    "instructionAddress": 9758154,
    "expectedSize": 4,
    "opcode": 109
  },
  {
    "shape": "make dog walk by -{num},{num}",
    "instructionAddress": 9808597,
    "expectedSize": 4,
    "opcode": 109
  },
  {
    "shape": "make dog walk by {num},-{num}",
    "instructionAddress": 9951719,
    "expectedSize": 4,
    "opcode": 109
  },
  {
    "shape": "make boy walk by {num},{num}",
    "instructionAddress": 9952998,
    "expectedSize": 4,
    "opcode": 109
  }
];

test('opcode shape corpus 0x6d', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
