import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 39,
    "instructionAddress": 9733362,
    "expectedSize": 1,
    "text": "Fade-out screen (WRITE $0b83=0x8000)"
  },
  {
    "opcode": 39,
    "instructionAddress": 9733864,
    "expectedSize": 1,
    "text": "Fade-out screen (WRITE $0b83=0x8000)"
  },
  {
    "opcode": 39,
    "instructionAddress": 10130123,
    "expectedSize": 1,
    "text": "Fade-out screen (WRITE $0b83=0x8000)"
  },
  {
    "opcode": 39,
    "instructionAddress": 9625906,
    "expectedSize": 1,
    "text": "Fade-out screen (WRITE $0b83=0x8000)"
  },
  {
    "opcode": 39,
    "instructionAddress": 9625978,
    "expectedSize": 1,
    "text": "Fade-out screen (WRITE $0b83=0x8000)"
  },
  {
    "opcode": 39,
    "instructionAddress": 9626524,
    "expectedSize": 1,
    "text": "Fade-out screen (WRITE $0b83=0x8000)"
  },
  {
    "opcode": 39,
    "instructionAddress": 9626901,
    "expectedSize": 1,
    "text": "Fade-out screen (WRITE $0b83=0x8000)"
  },
  {
    "opcode": 39,
    "instructionAddress": 9626939,
    "expectedSize": 1,
    "text": "Fade-out screen (WRITE $0b83=0x8000)"
  },
  {
    "opcode": 39,
    "instructionAddress": 9627010,
    "expectedSize": 1,
    "text": "Fade-out screen (WRITE $0b83=0x8000)"
  },
  {
    "opcode": 39,
    "instructionAddress": 9627029,
    "expectedSize": 1,
    "text": "Fade-out screen (WRITE $0b83=0x8000)"
  },
  {
    "opcode": 39,
    "instructionAddress": 9627196,
    "expectedSize": 1,
    "text": "Fade-out screen (WRITE $0b83=0x8000)"
  },
  {
    "opcode": 39,
    "instructionAddress": 9627200,
    "expectedSize": 1,
    "text": "Fade-out screen (WRITE $0b83=0x8000)"
  },
  {
    "opcode": 39,
    "instructionAddress": 9629781,
    "expectedSize": 1,
    "text": "Fade-out screen (WRITE $0b83=0x8000)"
  }
];

test('opcode corpus 0x27', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
