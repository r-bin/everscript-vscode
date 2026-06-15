import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "write {mem} = {hex}",
    "instructionAddress": 9758927,
    "expectedSize": 4,
    "opcode": 16
  },
  {
    "shape": "write {mem} = (({mem})&{hex}) + {num}",
    "instructionAddress": 9948155,
    "expectedSize": 9,
    "opcode": 16
  }
];

test('opcode shape corpus 0x10', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
