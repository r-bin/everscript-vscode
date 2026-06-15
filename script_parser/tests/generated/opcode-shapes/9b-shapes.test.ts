import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "destroy/dealloc entity signed arg30",
    "instructionAddress": 9626286,
    "expectedSize": 3,
    "opcode": 155
  },
  {
    "shape": "destroy/dealloc entity signed arg0",
    "instructionAddress": 9953024,
    "expectedSize": 3,
    "opcode": 155
  },
  {
    "shape": "destroy/dealloc entity signed arg14",
    "instructionAddress": 10129019,
    "expectedSize": 3,
    "opcode": 155
  },
  {
    "shape": "destroy/dealloc entity signed arg16",
    "instructionAddress": 10129022,
    "expectedSize": 3,
    "opcode": 155
  },
  {
    "shape": "destroy/dealloc entity signed arg18",
    "instructionAddress": 10129025,
    "expectedSize": 3,
    "opcode": 155
  },
  {
    "shape": "destroy/dealloc entity signed arg20",
    "instructionAddress": 10129028,
    "expectedSize": 3,
    "opcode": 155
  },
  {
    "shape": "destroy/dealloc entity signed arg22",
    "instructionAddress": 10129031,
    "expectedSize": 3,
    "opcode": 155
  },
  {
    "shape": "destroy/dealloc entity signed arg24",
    "instructionAddress": 10129034,
    "expectedSize": 3,
    "opcode": 155
  },
  {
    "shape": "destroy/dealloc entity {mem}",
    "instructionAddress": 10129333,
    "expectedSize": 7,
    "opcode": 155
  }
];

test('opcode shape corpus 0x9b', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
