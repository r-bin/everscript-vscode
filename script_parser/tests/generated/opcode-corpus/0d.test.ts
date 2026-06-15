import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 13,
    "instructionAddress": 9688219,
    "expectedSize": 4,
    "text": "$2834 |= 0x01"
  },
  {
    "opcode": 13,
    "instructionAddress": 9688229,
    "expectedSize": 4,
    "text": "$2834 &= 0xfe (8bit mode)"
  },
  {
    "opcode": 13,
    "instructionAddress": 9877759,
    "expectedSize": 4,
    "text": "$2834 |= 0x01"
  },
  {
    "opcode": 13,
    "instructionAddress": 9809950,
    "expectedSize": 4,
    "text": "$2834 |= 0x40"
  },
  {
    "opcode": 13,
    "instructionAddress": 9810000,
    "expectedSize": 4,
    "text": "$2834 |= 0x01"
  },
  {
    "opcode": 13,
    "instructionAddress": 9810023,
    "expectedSize": 4,
    "text": "$2834 |= 0x02"
  },
  {
    "opcode": 13,
    "instructionAddress": 9810046,
    "expectedSize": 4,
    "text": "$2834 |= 0x04"
  },
  {
    "opcode": 13,
    "instructionAddress": 9810069,
    "expectedSize": 4,
    "text": "$2834 |= 0x08"
  },
  {
    "opcode": 13,
    "instructionAddress": 9810092,
    "expectedSize": 4,
    "text": "$2834 |= 0x10"
  },
  {
    "opcode": 13,
    "instructionAddress": 9810115,
    "expectedSize": 4,
    "text": "$2834 |= 0x20"
  },
  {
    "opcode": 13,
    "instructionAddress": 9934055,
    "expectedSize": 4,
    "text": "$2834 |= 0x02"
  },
  {
    "opcode": 13,
    "instructionAddress": 9934286,
    "expectedSize": 4,
    "text": "$2834 &= 0xfd (8bit mode)"
  },
  {
    "opcode": 13,
    "instructionAddress": 9935505,
    "expectedSize": 4,
    "text": "$2834 |= 0x08"
  },
  {
    "opcode": 13,
    "instructionAddress": 9955528,
    "expectedSize": 4,
    "text": "$2834 &= 0xfe (8bit mode)"
  },
  {
    "opcode": 13,
    "instructionAddress": 10191120,
    "expectedSize": 4,
    "text": "$2834 &= 0xfe (8bit mode)"
  }
];

test('opcode corpus 0x0d', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
