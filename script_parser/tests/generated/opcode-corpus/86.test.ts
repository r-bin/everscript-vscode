import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 134,
    "instructionAddress": 9758259,
    "expectedSize": 3,
    "text": "SET AUDIO volume to 0x64"
  },
  {
    "opcode": 134,
    "instructionAddress": 9758685,
    "expectedSize": 3,
    "text": "SET AUDIO volume to 0x64"
  },
  {
    "opcode": 134,
    "instructionAddress": 9671187,
    "expectedSize": 3,
    "text": "SET AUDIO volume to signed arg0"
  },
  {
    "opcode": 134,
    "instructionAddress": 9757869,
    "expectedSize": 3,
    "text": "SET AUDIO volume to 0x64"
  },
  {
    "opcode": 134,
    "instructionAddress": 9757893,
    "expectedSize": 3,
    "text": "SET AUDIO volume to 0x64"
  },
  {
    "opcode": 134,
    "instructionAddress": 9758151,
    "expectedSize": 3,
    "text": "SET AUDIO volume to 0x64"
  },
  {
    "opcode": 134,
    "instructionAddress": 9678671,
    "expectedSize": 3,
    "text": "SET AUDIO volume to 0x78"
  },
  {
    "opcode": 134,
    "instructionAddress": 9822790,
    "expectedSize": 3,
    "text": "SET AUDIO volume to 0x64"
  },
  {
    "opcode": 134,
    "instructionAddress": 9885242,
    "expectedSize": 3,
    "text": "SET AUDIO volume to 0x96"
  },
  {
    "opcode": 134,
    "instructionAddress": 9816982,
    "expectedSize": 3,
    "text": "SET AUDIO volume to 0x64"
  },
  {
    "opcode": 134,
    "instructionAddress": 10129448,
    "expectedSize": 3,
    "text": "SET AUDIO volume to 0xff"
  },
  {
    "opcode": 134,
    "instructionAddress": 10130063,
    "expectedSize": 3,
    "text": "SET AUDIO volume to 0x64"
  },
  {
    "opcode": 134,
    "instructionAddress": 10130079,
    "expectedSize": 3,
    "text": "SET AUDIO volume to 0x96"
  },
  {
    "opcode": 134,
    "instructionAddress": 9625834,
    "expectedSize": 3,
    "text": "SET AUDIO volume to 0xff"
  }
];

test('opcode corpus 0x86', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
