import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 190,
    "instructionAddress": 9948217,
    "expectedSize": 1,
    "text": "Stop/disable doggo (and SELECT button)"
  },
  {
    "opcode": 190,
    "instructionAddress": 9948355,
    "expectedSize": 6,
    "text": "Stop/disable doggo (and SELECT button)"
  },
  {
    "opcode": 190,
    "instructionAddress": 9948390,
    "expectedSize": 1,
    "text": "Stop/disable doggo (and SELECT button)"
  },
  {
    "opcode": 190,
    "instructionAddress": 9877548,
    "expectedSize": 1,
    "text": "Stop/disable doggo (and SELECT button)"
  },
  {
    "opcode": 190,
    "instructionAddress": 9822776,
    "expectedSize": 1,
    "text": "Stop/disable doggo (and SELECT button)"
  },
  {
    "opcode": 190,
    "instructionAddress": 9819968,
    "expectedSize": 1,
    "text": "Stop/disable doggo (and SELECT button)"
  },
  {
    "opcode": 190,
    "instructionAddress": 9946727,
    "expectedSize": 1,
    "text": "Stop/disable doggo (and SELECT button)"
  },
  {
    "opcode": 190,
    "instructionAddress": 9946767,
    "expectedSize": 1,
    "text": "Stop/disable doggo (and SELECT button)"
  },
  {
    "opcode": 190,
    "instructionAddress": 9824631,
    "expectedSize": 1,
    "text": "Stop/disable doggo (and SELECT button)"
  },
  {
    "opcode": 190,
    "instructionAddress": 9816935,
    "expectedSize": 1,
    "text": "Stop/disable doggo (and SELECT button)"
  },
  {
    "opcode": 190,
    "instructionAddress": 9878961,
    "expectedSize": 1,
    "text": "Stop/disable doggo (and SELECT button)"
  },
  {
    "opcode": 190,
    "instructionAddress": 9810846,
    "expectedSize": 1,
    "text": "Stop/disable doggo (and SELECT button)"
  },
  {
    "opcode": 190,
    "instructionAddress": 9814870,
    "expectedSize": 1,
    "text": "Stop/disable doggo (and SELECT button)"
  },
  {
    "opcode": 190,
    "instructionAddress": 9945520,
    "expectedSize": 6,
    "text": "Stop/disable doggo (and SELECT button)"
  },
  {
    "opcode": 190,
    "instructionAddress": 9945558,
    "expectedSize": 1,
    "text": "Stop/disable doggo (and SELECT button)"
  },
  {
    "opcode": 190,
    "instructionAddress": 10145910,
    "expectedSize": 1,
    "text": "Stop/disable doggo (and SELECT button)"
  },
  {
    "opcode": 190,
    "instructionAddress": 10214712,
    "expectedSize": 1,
    "text": "Stop/disable doggo (and SELECT button)"
  }
];

test('opcode corpus 0xbe', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
