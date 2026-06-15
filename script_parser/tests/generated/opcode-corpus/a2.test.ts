import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 162,
    "instructionAddress": 10087782,
    "expectedSize": 14,
    "text": "SPAWN NPC 0x007a>>1, flags 0x00, x:$24ab + 16, y:$24af"
  }
];

test('opcode corpus 0xa2', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
