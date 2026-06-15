import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 175,
    "instructionAddress": 9948407,
    "expectedSize": 13,
    "text": "CALL Absolute (24bit) script 0x92d93e (\"Unnamed ABS script 0x92d93e\")"
  },
  {
    "opcode": 175,
    "instructionAddress": 9945596,
    "expectedSize": 16,
    "text": "CALL Absolute (24bit) script 0x92dd6e (\"Unnamed ABS script 0x92dd6e\")"
  },
  {
    "opcode": 175,
    "instructionAddress": 9999616,
    "expectedSize": 7,
    "text": "CALL Absolute (24bit) script 0x92d8ff (\"Unnamed ABS script 0x92d8ff\")"
  },
  {
    "opcode": 175,
    "instructionAddress": 10125977,
    "expectedSize": 7,
    "text": "CALL Absolute (24bit) script 0x92d8ff (\"Unnamed ABS script 0x92d8ff\")"
  },
  {
    "opcode": 175,
    "instructionAddress": 10125984,
    "expectedSize": 7,
    "text": "CALL Absolute (24bit) script 0x92d8e9 (\"Unnamed ABS script 0x92d8e9\")"
  },
  {
    "opcode": 175,
    "instructionAddress": 10192549,
    "expectedSize": 7,
    "text": "CALL Absolute (24bit) script 0x92d8e9 (\"Unnamed ABS script 0x92d8e9\")"
  },
  {
    "opcode": 175,
    "instructionAddress": 10192556,
    "expectedSize": 7,
    "text": "CALL Absolute (24bit) script 0x92d8ff (\"Unnamed ABS script 0x92d8ff\")"
  },
  {
    "opcode": 175,
    "instructionAddress": 10193200,
    "expectedSize": 7,
    "text": "CALL Absolute (24bit) script 0x92d8e9 (\"Unnamed ABS script 0x92d8e9\")"
  },
  {
    "opcode": 175,
    "instructionAddress": 10193207,
    "expectedSize": 7,
    "text": "CALL Absolute (24bit) script 0x92d8ff (\"Unnamed ABS script 0x92d8ff\")"
  },
  {
    "opcode": 175,
    "instructionAddress": 10194211,
    "expectedSize": 7,
    "text": "CALL Absolute (24bit) script 0x92d8e9 (\"Unnamed ABS script 0x92d8e9\")"
  },
  {
    "opcode": 175,
    "instructionAddress": 10194218,
    "expectedSize": 7,
    "text": "CALL Absolute (24bit) script 0x92d8ff (\"Unnamed ABS script 0x92d8ff\")"
  },
  {
    "opcode": 175,
    "instructionAddress": 10216241,
    "expectedSize": 7,
    "text": "CALL Absolute (24bit) script 0x92d8e9 (\"Unnamed ABS script 0x92d8e9\")"
  },
  {
    "opcode": 175,
    "instructionAddress": 10216248,
    "expectedSize": 7,
    "text": "CALL Absolute (24bit) script 0x92d8ff (\"Unnamed ABS script 0x92d8ff\")"
  }
];

test('opcode corpus 0xaf', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
