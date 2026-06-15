import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 122,
    "instructionAddress": 9671062,
    "expectedSize": 10,
    "text": "WRITE *($283b + 0x2a) = 0x50"
  },
  {
    "opcode": 122,
    "instructionAddress": 9687863,
    "expectedSize": 9,
    "text": "WRITE *($23e5 + 15) = 0x4f"
  },
  {
    "opcode": 122,
    "instructionAddress": 9687872,
    "expectedSize": 9,
    "text": "WRITE *($23e7 + 15) = 0x4a"
  },
  {
    "opcode": 122,
    "instructionAddress": 9945494,
    "expectedSize": 15,
    "text": "WRITE *($2834 + 30) = 16"
  },
  {
    "opcode": 122,
    "instructionAddress": 9937821,
    "expectedSize": 9,
    "text": "WRITE *(last entity ($0341) + 0x2a) = 0x03e8"
  },
  {
    "opcode": 122,
    "instructionAddress": 10129588,
    "expectedSize": 27,
    "text": "WRITE *($2837 + 0x20) = 20"
  },
  {
    "opcode": 122,
    "instructionAddress": 10129693,
    "expectedSize": 29,
    "text": "WRITE *($2837 + 30) = *($2837 + 30) + ((signed arg10 - signed arg2)<<4)"
  },
  {
    "opcode": 122,
    "instructionAddress": 10129821,
    "expectedSize": 8,
    "text": "WRITE *($2837 + 30) = 0"
  },
  {
    "opcode": 122,
    "instructionAddress": 10129862,
    "expectedSize": 10,
    "text": "WRITE *($2837 + 30) = 0x0200"
  },
  {
    "opcode": 122,
    "instructionAddress": 10129872,
    "expectedSize": 9,
    "text": "WRITE *($2837 + 0x20) = -1"
  },
  {
    "opcode": 122,
    "instructionAddress": 10205672,
    "expectedSize": 8,
    "text": "WRITE *(boy + 30) = 0x0960"
  },
  {
    "opcode": 122,
    "instructionAddress": 10205680,
    "expectedSize": 7,
    "text": "WRITE *(boy + 0x20) = -10"
  }
];

test('opcode corpus 0x7a', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
