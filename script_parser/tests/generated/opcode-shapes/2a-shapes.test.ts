import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "make signed arg30 script controlled",
    "instructionAddress": 9626087,
    "expectedSize": 11,
    "opcode": 42
  },
  {
    "shape": "make controlled char script controlled",
    "instructionAddress": 9685162,
    "expectedSize": 2,
    "opcode": 42
  },
  {
    "shape": "make non-controlled char script controlled",
    "instructionAddress": 9745432,
    "expectedSize": 2,
    "opcode": 42
  },
  {
    "shape": "make last entity ({mem}) script controlled",
    "instructionAddress": 9814660,
    "expectedSize": 2,
    "opcode": 42
  },
  {
    "shape": "make {mem} script controlled",
    "instructionAddress": 10129192,
    "expectedSize": 14,
    "opcode": 42
  }
];

test('opcode shape corpus 0x2a', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
