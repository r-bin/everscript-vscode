import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "call {hex} intro part? running in bg",
    "instructionAddress": 9626979,
    "expectedSize": 4,
    "opcode": 7
  },
  {
    "shape": "call {hex} unnamed abs script {hex}",
    "instructionAddress": 9626999,
    "expectedSize": 4,
    "opcode": 7
  },
  {
    "shape": "call {hex} thraxx maggot trigger part",
    "instructionAddress": 9685208,
    "expectedSize": 4,
    "opcode": 7
  },
  {
    "shape": "call {hex} outro rain and sky color",
    "instructionAddress": 9946537,
    "expectedSize": 4,
    "opcode": 7
  },
  {
    "shape": "call {hex} timberdrake ai?",
    "instructionAddress": 10079753,
    "expectedSize": 4,
    "opcode": 7
  },
  {
    "shape": "call {hex} gothica - the show of life",
    "instructionAddress": 10128652,
    "expectedSize": 4,
    "opcode": 7
  }
];

test('opcode shape corpus 0x07', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
