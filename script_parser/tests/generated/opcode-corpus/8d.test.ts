import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 141,
    "instructionAddress": 9752100,
    "expectedSize": 2,
    "text": "01 Start screen shaking"
  },
  {
    "opcode": 141,
    "instructionAddress": 9752175,
    "expectedSize": 2,
    "text": "00 Stop screen shaking"
  },
  {
    "opcode": 141,
    "instructionAddress": 9747940,
    "expectedSize": 2,
    "text": "01 Start screen shaking"
  },
  {
    "opcode": 141,
    "instructionAddress": 9747988,
    "expectedSize": 2,
    "text": "00 Stop screen shaking"
  },
  {
    "opcode": 141,
    "instructionAddress": 10129831,
    "expectedSize": 2,
    "text": "01 Start screen shaking"
  },
  {
    "opcode": 141,
    "instructionAddress": 10129835,
    "expectedSize": 2,
    "text": "00 Stop screen shaking"
  },
  {
    "opcode": 141,
    "instructionAddress": 10129918,
    "expectedSize": 2,
    "text": "01 Start screen shaking"
  },
  {
    "opcode": 141,
    "instructionAddress": 10129922,
    "expectedSize": 2,
    "text": "00 Stop screen shaking"
  },
  {
    "opcode": 141,
    "instructionAddress": 10130082,
    "expectedSize": 2,
    "text": "01 Start screen shaking"
  },
  {
    "opcode": 141,
    "instructionAddress": 10205701,
    "expectedSize": 2,
    "text": "01 Start screen shaking"
  },
  {
    "opcode": 141,
    "instructionAddress": 10205713,
    "expectedSize": 10,
    "text": "00 Stop screen shaking"
  }
];

test('opcode corpus 0x8d', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
