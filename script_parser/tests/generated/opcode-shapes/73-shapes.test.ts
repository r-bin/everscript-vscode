import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "make {mem} walk to *(boy + {num}) + {hex},*(boy + {num}) directly",
    "instructionAddress": 10130010,
    "expectedSize": 18,
    "opcode": 115
  }
];

test('opcode shape corpus 0x73', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
