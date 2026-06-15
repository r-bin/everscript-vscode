import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 188,
    "instructionAddress": 9948216,
    "expectedSize": 1,
    "text": "Stop/disable boy (and SELECT button)"
  },
  {
    "opcode": 188,
    "instructionAddress": 9948354,
    "expectedSize": 1,
    "text": "Stop/disable boy (and SELECT button)"
  },
  {
    "opcode": 188,
    "instructionAddress": 9946726,
    "expectedSize": 1,
    "text": "Stop/disable boy (and SELECT button)"
  },
  {
    "opcode": 188,
    "instructionAddress": 9945519,
    "expectedSize": 1,
    "text": "Stop/disable boy (and SELECT button)"
  },
  {
    "opcode": 188,
    "instructionAddress": 10145909,
    "expectedSize": 1,
    "text": "Stop/disable boy (and SELECT button)"
  },
  {
    "opcode": 188,
    "instructionAddress": 9998414,
    "expectedSize": 1,
    "text": "Stop/disable boy (and SELECT button)"
  },
  {
    "opcode": 188,
    "instructionAddress": 10214711,
    "expectedSize": 1,
    "text": "Stop/disable boy (and SELECT button)"
  }
];

test('opcode corpus 0xbc', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
