import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 152,
    "instructionAddress": 9819207,
    "expectedSize": 2,
    "text": "SWITCH CHAR TO boy"
  },
  {
    "opcode": 152,
    "instructionAddress": 10134591,
    "expectedSize": 7,
    "text": "SWITCH CHAR TO dog"
  },
  {
    "opcode": 152,
    "instructionAddress": 10136395,
    "expectedSize": 2,
    "text": "SWITCH CHAR TO dog"
  },
  {
    "opcode": 152,
    "instructionAddress": 10142615,
    "expectedSize": 2,
    "text": "SWITCH CHAR TO boy"
  },
  {
    "opcode": 152,
    "instructionAddress": 9999643,
    "expectedSize": 2,
    "text": "SWITCH CHAR TO dog"
  }
];

test('opcode corpus 0x98', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
