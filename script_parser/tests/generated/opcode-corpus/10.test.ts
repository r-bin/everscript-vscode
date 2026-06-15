import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 16,
    "instructionAddress": 9948155,
    "expectedSize": 9,
    "text": "WRITE $22fe = (($22fe)&0xff) + 1"
  },
  {
    "opcode": 16,
    "instructionAddress": 9758927,
    "expectedSize": 4,
    "text": "WRITE $22fa = 0x0010"
  },
  {
    "opcode": 16,
    "instructionAddress": 9758931,
    "expectedSize": 4,
    "text": "WRITE $22fb = 0x0014"
  },
  {
    "opcode": 16,
    "instructionAddress": 10087704,
    "expectedSize": 4,
    "text": "WRITE $22fa = 0x0010"
  },
  {
    "opcode": 16,
    "instructionAddress": 10087708,
    "expectedSize": 4,
    "text": "WRITE $22fb = 0x0008"
  },
  {
    "opcode": 16,
    "instructionAddress": 9946554,
    "expectedSize": 9,
    "text": "WRITE $22fe = (($22fe)&0xff) + 1"
  },
  {
    "opcode": 16,
    "instructionAddress": 9626817,
    "expectedSize": 4,
    "text": "WRITE $22fa = 0x0016"
  },
  {
    "opcode": 16,
    "instructionAddress": 9626821,
    "expectedSize": 4,
    "text": "WRITE $22fb = 0x0014"
  }
];

test('opcode corpus 0x10', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
