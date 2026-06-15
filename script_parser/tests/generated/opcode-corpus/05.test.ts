import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 5,
    "instructionAddress": 9671198,
    "expectedSize": 2,
    "text": "SKIP -20 (to 0x93920a)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9688233,
    "expectedSize": 2,
    "text": "SKIP -226 (to 0x93d3c7)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9745482,
    "expectedSize": 2,
    "text": "SKIP -29 (to 0x94b42d)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9745521,
    "expectedSize": 2,
    "text": "SKIP -30 (to 0x94b453)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9745560,
    "expectedSize": 2,
    "text": "SKIP -29 (to 0x94b47b)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9747986,
    "expectedSize": 2,
    "text": "SKIP -32 (to 0x94bdf2)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9748110,
    "expectedSize": 2,
    "text": "SKIP -72 (to 0x94be46)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9877744,
    "expectedSize": 2,
    "text": "SKIP -23 (to 0x96b8d9)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9877771,
    "expectedSize": 2,
    "text": "SKIP -25 (to 0x96b8f2)"
  },
  {
    "opcode": 5,
    "instructionAddress": 10087846,
    "expectedSize": 2,
    "text": "SKIP -24 (to 0x99ed8e)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9885313,
    "expectedSize": 2,
    "text": "SKIP -3 (to 0x96d67e)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9819348,
    "expectedSize": 2,
    "text": "SKIP -24 (to 0x95d4bc)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9812958,
    "expectedSize": 2,
    "text": "SKIP -24 (to 0x95bbc6)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9810905,
    "expectedSize": 2,
    "text": "SKIP -24 (to 0x95b3c1)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9887875,
    "expectedSize": 2,
    "text": "SKIP -24 (to 0x96e06b)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9810236,
    "expectedSize": 2,
    "text": "SKIP -91 (to 0x95b0e1)"
  },
  {
    "opcode": 5,
    "instructionAddress": 10128673,
    "expectedSize": 2,
    "text": "SKIP -17 (to 0x9a8d10)"
  },
  {
    "opcode": 5,
    "instructionAddress": 10128784,
    "expectedSize": 2,
    "text": "SKIP -55 (to 0x9a8d59)"
  },
  {
    "opcode": 5,
    "instructionAddress": 10129299,
    "expectedSize": 2,
    "text": "SKIP -189 (to 0x9a8ed6)"
  },
  {
    "opcode": 5,
    "instructionAddress": 10129441,
    "expectedSize": 2,
    "text": "SKIP -101 (to 0x9a8fbc)"
  },
  {
    "opcode": 5,
    "instructionAddress": 10129661,
    "expectedSize": 2,
    "text": "SKIP -46 (to 0x9a90cf)"
  },
  {
    "opcode": 5,
    "instructionAddress": 10129811,
    "expectedSize": 2,
    "text": "SKIP -62 (to 0x9a9155)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9625933,
    "expectedSize": 2,
    "text": "SKIP -57 (to 0x92e114)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9625998,
    "expectedSize": 2,
    "text": "SKIP -50 (to 0x92e15c)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9626246,
    "expectedSize": 2,
    "text": "SKIP -117 (to 0x92e211)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9626284,
    "expectedSize": 2,
    "text": "SKIP -171 (to 0x92e201)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9626375,
    "expectedSize": 2,
    "text": "SKIP -47 (to 0x92e2d8)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9626414,
    "expectedSize": 2,
    "text": "SKIP -31 (to 0x92e30f)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9626476,
    "expectedSize": 2,
    "text": "SKIP -47 (to 0x92e33d)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9626897,
    "expectedSize": 2,
    "text": "SKIP -24 (to 0x92e4f9)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9626935,
    "expectedSize": 2,
    "text": "SKIP -24 (to 0x92e51f)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9626977,
    "expectedSize": 2,
    "text": "SKIP -24 (to 0x92e549)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9627166,
    "expectedSize": 2,
    "text": "SKIP -20 (to 0x92e60a)"
  },
  {
    "opcode": 5,
    "instructionAddress": 9629777,
    "expectedSize": 2,
    "text": "SKIP -24 (to 0x92f039)"
  }
];

test('opcode corpus 0x05', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
