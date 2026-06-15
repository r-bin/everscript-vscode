import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "write {mem} = last entity ({mem})",
    "instructionAddress": 9752254,
    "expectedSize": 4,
    "opcode": 28
  },
  {
    "shape": "write {mem} = {mem}",
    "instructionAddress": 9752446,
    "expectedSize": 6,
    "opcode": 28
  },
  {
    "shape": "write {mem} = ({mem})&{hex}",
    "instructionAddress": 9804526,
    "expectedSize": 6,
    "opcode": 28
  },
  {
    "shape": "write {mem} = gametimer&{hex}",
    "instructionAddress": 9877186,
    "expectedSize": 4,
    "opcode": 28
  }
];

test('opcode shape corpus 0x1c', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
