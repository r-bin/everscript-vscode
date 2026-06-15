import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 165,
    "instructionAddress": 9667834,
    "expectedSize": 2,
    "text": "RCALL -83 (to 0x9384a7): Unknown"
  },
  {
    "opcode": 165,
    "instructionAddress": 9679300,
    "expectedSize": 2,
    "text": "RCALL -186 (to 0x93b10a): Unknown"
  },
  {
    "opcode": 165,
    "instructionAddress": 9678039,
    "expectedSize": 2,
    "text": "RCALL -233 (to 0x93abee): Unknown"
  },
  {
    "opcode": 165,
    "instructionAddress": 9683832,
    "expectedSize": 2,
    "text": "RCALL -247 (to 0x93c281): Unknown"
  },
  {
    "opcode": 165,
    "instructionAddress": 9678689,
    "expectedSize": 2,
    "text": "RCALL -223 (to 0x93ae82): Acid rain dialog"
  },
  {
    "opcode": 165,
    "instructionAddress": 9694499,
    "expectedSize": 2,
    "text": "RCALL -215 (to 0x93ec4c): Unknown"
  },
  {
    "opcode": 165,
    "instructionAddress": 9747938,
    "expectedSize": 2,
    "text": "RCALL -162 (to 0x94bd40): Unknown"
  },
  {
    "opcode": 165,
    "instructionAddress": 9758940,
    "expectedSize": 2,
    "text": "RCALL -251 (to 0x94e7e1): Unknown"
  },
  {
    "opcode": 165,
    "instructionAddress": 9944899,
    "expectedSize": 2,
    "text": "RCALL -254 (to 0x97be45): Unknown"
  },
  {
    "opcode": 165,
    "instructionAddress": 9930194,
    "expectedSize": 2,
    "text": "RCALL -207 (to 0x978503): Unknown"
  },
  {
    "opcode": 165,
    "instructionAddress": 9880581,
    "expectedSize": 2,
    "text": "RCALL -197 (to 0x96c340): Unknown"
  },
  {
    "opcode": 165,
    "instructionAddress": 9938999,
    "expectedSize": 2,
    "text": "RCALL -89 (to 0x97a7de): Unknown"
  },
  {
    "opcode": 165,
    "instructionAddress": 10069726,
    "expectedSize": 2,
    "text": "RCALL -218 (to 0x99a604): Gomi's tower part [1]"
  },
  {
    "opcode": 165,
    "instructionAddress": 10060602,
    "expectedSize": 2,
    "text": "RCALL -237 (to 0x99824d): Unknown"
  },
  {
    "opcode": 165,
    "instructionAddress": 10062987,
    "expectedSize": 2,
    "text": "RCALL -86 (to 0x998c35): Tinker part [1]"
  },
  {
    "opcode": 165,
    "instructionAddress": 10063015,
    "expectedSize": 2,
    "text": "RCALL -114 (to 0x998c35): Tinker part [1]"
  },
  {
    "opcode": 165,
    "instructionAddress": 9626684,
    "expectedSize": 2,
    "text": "RCALL -30 (to 0x92e41e): Unknown"
  }
];

test('opcode corpus 0xa5', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
