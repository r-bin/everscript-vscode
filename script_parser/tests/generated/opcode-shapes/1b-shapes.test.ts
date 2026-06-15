import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "write {mem} = {hex}",
    "instructionAddress": 9629709,
    "expectedSize": 7,
    "opcode": 27
  },
  {
    "shape": "write map y start ({mem}) = {hex}",
    "instructionAddress": 9758225,
    "expectedSize": 7,
    "opcode": 27
  },
  {
    "shape": "write map y end ({mem}) = {hex}",
    "instructionAddress": 10018732,
    "expectedSize": 7,
    "opcode": 27
  }
];

test('opcode shape corpus 0x1b', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
