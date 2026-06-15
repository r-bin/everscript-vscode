import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "wait for boy (d0) to reach destination",
    "instructionAddress": 9668249,
    "expectedSize": 2,
    "opcode": 46
  },
  {
    "shape": "wait for entity from *{mem} to reach destination",
    "instructionAddress": 9745593,
    "expectedSize": 4,
    "opcode": 46
  },
  {
    "shape": "wait for character #{num} ?! to reach destination",
    "instructionAddress": 9747897,
    "expectedSize": 2,
    "opcode": 46
  },
  {
    "shape": "wait for controlled char (d2) to reach destination",
    "instructionAddress": 9758169,
    "expectedSize": 2,
    "opcode": 46
  },
  {
    "shape": "wait for entity attached to script? (ae) to reach destination",
    "instructionAddress": 9877604,
    "expectedSize": 2,
    "opcode": 46
  },
  {
    "shape": "wait for character from sub-instr {num} {num} to reach destination",
    "instructionAddress": 9953021,
    "expectedSize": 3,
    "opcode": 46
  },
  {
    "shape": "wait for dog (d1) to reach destination",
    "instructionAddress": 9953033,
    "expectedSize": 2,
    "opcode": 46
  },
  {
    "shape": "wait for non-controlled char (d3) to reach destination",
    "instructionAddress": 10006846,
    "expectedSize": 2,
    "opcode": 46
  }
];

test('opcode shape corpus 0x2e', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
