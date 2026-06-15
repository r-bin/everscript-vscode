import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "write hut/house to enter ({mem}) = {hex}",
    "instructionAddress": 9740269,
    "expectedSize": 4,
    "opcode": 20
  },
  {
    "shape": "write hut/house to enter ({mem}) = (({mem})&{hex}) & {num}",
    "instructionAddress": 9998625,
    "expectedSize": 9,
    "opcode": 20
  },
  {
    "shape": "write {mem} = {hex}",
    "instructionAddress": 10193138,
    "expectedSize": 4,
    "opcode": 20
  }
];

test('opcode shape corpus 0x14', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
