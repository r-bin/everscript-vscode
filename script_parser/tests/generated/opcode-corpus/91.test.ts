import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 145,
    "instructionAddress": 9678667,
    "expectedSize": 2,
    "text": "Sets brightness to 0"
  },
  {
    "opcode": 145,
    "instructionAddress": 9944881,
    "expectedSize": 2,
    "text": "Sets brightness to 0"
  },
  {
    "opcode": 145,
    "instructionAddress": 10087816,
    "expectedSize": 2,
    "text": "Sets brightness to 0"
  },
  {
    "opcode": 145,
    "instructionAddress": 10087831,
    "expectedSize": 4,
    "text": "Sets brightness to $2837"
  },
  {
    "opcode": 145,
    "instructionAddress": 9819272,
    "expectedSize": 2,
    "text": "Sets brightness to 0"
  },
  {
    "opcode": 145,
    "instructionAddress": 9819333,
    "expectedSize": 4,
    "text": "Sets brightness to $2836"
  },
  {
    "opcode": 145,
    "instructionAddress": 9812926,
    "expectedSize": 2,
    "text": "Sets brightness to 0"
  },
  {
    "opcode": 145,
    "instructionAddress": 9812943,
    "expectedSize": 4,
    "text": "Sets brightness to $2835"
  },
  {
    "opcode": 145,
    "instructionAddress": 9810875,
    "expectedSize": 2,
    "text": "Sets brightness to 0"
  },
  {
    "opcode": 145,
    "instructionAddress": 9810890,
    "expectedSize": 4,
    "text": "Sets brightness to $2834"
  },
  {
    "opcode": 145,
    "instructionAddress": 9887843,
    "expectedSize": 2,
    "text": "Sets brightness to 0"
  },
  {
    "opcode": 145,
    "instructionAddress": 9887860,
    "expectedSize": 4,
    "text": "Sets brightness to $2839"
  },
  {
    "opcode": 145,
    "instructionAddress": 9626852,
    "expectedSize": 2,
    "text": "Sets brightness to 0"
  },
  {
    "opcode": 145,
    "instructionAddress": 9626882,
    "expectedSize": 4,
    "text": "Sets brightness to $2834"
  },
  {
    "opcode": 145,
    "instructionAddress": 9626920,
    "expectedSize": 4,
    "text": "Sets brightness to $2834"
  },
  {
    "opcode": 145,
    "instructionAddress": 9626962,
    "expectedSize": 4,
    "text": "Sets brightness to $2834"
  },
  {
    "opcode": 145,
    "instructionAddress": 9627154,
    "expectedSize": 3,
    "text": "Sets brightness to signed arg0"
  },
  {
    "opcode": 145,
    "instructionAddress": 9629503,
    "expectedSize": 2,
    "text": "Sets brightness to 0"
  },
  {
    "opcode": 145,
    "instructionAddress": 9629762,
    "expectedSize": 4,
    "text": "Sets brightness to $2836"
  }
];

test('opcode corpus 0x91', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
