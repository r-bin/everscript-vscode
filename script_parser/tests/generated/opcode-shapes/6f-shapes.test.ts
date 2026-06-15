import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "make boy walk by {num},-{num} directly",
    "instructionAddress": 9687906,
    "expectedSize": 4,
    "opcode": 111
  },
  {
    "shape": "make dog walk by {num},-{num} directly",
    "instructionAddress": 9687959,
    "expectedSize": 4,
    "opcode": 111
  },
  {
    "shape": "make non-controlled char walk by {num},{num} directly",
    "instructionAddress": 9816958,
    "expectedSize": 4,
    "opcode": 111
  },
  {
    "shape": "make entity attached to script? walk by {num},{num} directly",
    "instructionAddress": 9877575,
    "expectedSize": 4,
    "opcode": 111
  },
  {
    "shape": "make dog walk by {num},{num} directly",
    "instructionAddress": 9999711,
    "expectedSize": 4,
    "opcode": 111
  },
  {
    "shape": "make dog walk by -{num},{num} directly",
    "instructionAddress": 9999727,
    "expectedSize": 4,
    "opcode": 111
  },
  {
    "shape": "make controlled char walk by {num},{num} directly",
    "instructionAddress": 10006836,
    "expectedSize": 4,
    "opcode": 111
  },
  {
    "shape": "make controlled char walk by -{num},{num} directly",
    "instructionAddress": 10128551,
    "expectedSize": 4,
    "opcode": 111
  },
  {
    "shape": "make non-controlled char walk by -{num},{num} directly",
    "instructionAddress": 10128557,
    "expectedSize": 4,
    "opcode": 111
  },
  {
    "shape": "make {mem} walk by {num},{num} directly",
    "instructionAddress": 10128570,
    "expectedSize": 6,
    "opcode": 111
  },
  {
    "shape": "make non-controlled char walk by {num},-{num} directly",
    "instructionAddress": 10129670,
    "expectedSize": 23,
    "opcode": 111
  },
  {
    "shape": "make boy walk by -{num},{num} directly",
    "instructionAddress": 10129926,
    "expectedSize": 4,
    "opcode": 111
  },
  {
    "shape": "make boy walk by {num},{num} directly",
    "instructionAddress": 10129959,
    "expectedSize": 4,
    "opcode": 111
  }
];

test('opcode shape corpus 0x6f', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
