import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "write {mem} = last entity ({mem})",
    "instructionAddress": 9671020,
    "expectedSize": 4,
    "opcode": 25
  },
  {
    "shape": "write {mem} = *({mem} + {hex})",
    "instructionAddress": 9685173,
    "expectedSize": 11,
    "opcode": 25
  },
  {
    "shape": "write {mem} = {mem} * ((rand & {num}) + {num})",
    "instructionAddress": 9685184,
    "expectedSize": 15,
    "opcode": 25
  },
  {
    "shape": "write {mem} = {hex}",
    "instructionAddress": 9687730,
    "expectedSize": 4,
    "opcode": 25
  },
  {
    "shape": "write {mem} = {mem}",
    "instructionAddress": 9688052,
    "expectedSize": 6,
    "opcode": 25
  },
  {
    "shape": "write {mem} = {mem} - {num}",
    "instructionAddress": 9745473,
    "expectedSize": 9,
    "opcode": 25
  },
  {
    "shape": "write {mem} = {num} + ({num} * {mem})",
    "instructionAddress": 9810178,
    "expectedSize": 12,
    "opcode": 25
  },
  {
    "shape": "write {mem} = {mem} + {num}",
    "instructionAddress": 9810896,
    "expectedSize": 9,
    "opcode": 25
  },
  {
    "shape": "write {mem} = randrange({num},<{num}) + {num}",
    "instructionAddress": 10192477,
    "expectedSize": 8,
    "opcode": 25
  }
];

test('opcode shape corpus 0x19', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
