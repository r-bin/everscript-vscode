import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 82,
    "instructionAddress": 10129206,
    "expectedSize": 3,
    "text": "SHOW TEXT 1d8e FROM 0x91ed8e compressed UNWINDOWED"
  },
  {
    "opcode": 82,
    "instructionAddress": 10130048,
    "expectedSize": 3,
    "text": "SHOW TEXT 1da0 FROM 0x91eda0 compressed UNWINDOWED"
  },
  {
    "opcode": 82,
    "instructionAddress": 10192666,
    "expectedSize": 3,
    "text": "SHOW TEXT 20fd FROM 0x91f0fd compressed UNWINDOWED"
  }
];

test('opcode corpus 0x52', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
