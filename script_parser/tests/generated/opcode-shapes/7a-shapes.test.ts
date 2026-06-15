import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "write *({mem} + {hex}) = {hex}",
    "instructionAddress": 9671062,
    "expectedSize": 10,
    "opcode": 122
  },
  {
    "shape": "write *(last entity ({mem}) + {hex}) = {hex}",
    "instructionAddress": 9937821,
    "expectedSize": 9,
    "opcode": 122
  },
  {
    "shape": "write *({mem} + {hex}) = {num}",
    "instructionAddress": 10129588,
    "expectedSize": 27,
    "opcode": 122
  },
  {
    "shape": "write *({mem} + {num}) = *({mem} + {num}) + ((signed arg10 - signed arg2)<<{num})",
    "instructionAddress": 10129693,
    "expectedSize": 29,
    "opcode": 122
  },
  {
    "shape": "write *({mem} + {num}) = {num}",
    "instructionAddress": 10129821,
    "expectedSize": 8,
    "opcode": 122
  },
  {
    "shape": "write *({mem} + {num}) = {hex}",
    "instructionAddress": 10129862,
    "expectedSize": 10,
    "opcode": 122
  },
  {
    "shape": "write *({mem} + {hex}) = -{num}",
    "instructionAddress": 10129872,
    "expectedSize": 9,
    "opcode": 122
  },
  {
    "shape": "write *(boy + {num}) = {hex}",
    "instructionAddress": 10205672,
    "expectedSize": 8,
    "opcode": 122
  },
  {
    "shape": "write *(boy + {hex}) = -{num}",
    "instructionAddress": 10205680,
    "expectedSize": 7,
    "opcode": 122
  }
];

test('opcode shape corpus 0x7a', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
