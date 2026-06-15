import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "call {hex} showcase thraxx",
    "instructionAddress": 9626692,
    "expectedSize": 4,
    "opcode": 41
  },
  {
    "shape": "call {hex} intro part?",
    "instructionAddress": 9626945,
    "expectedSize": 4,
    "opcode": 41
  },
  {
    "shape": "call {hex} unknown",
    "instructionAddress": 9627013,
    "expectedSize": 10,
    "opcode": 41
  },
  {
    "shape": "call {hex} show status bar layer",
    "instructionAddress": 9667840,
    "expectedSize": 4,
    "opcode": 41
  },
  {
    "shape": "call {hex} hide status bar layer",
    "instructionAddress": 9759631,
    "expectedSize": 4,
    "opcode": 41
  },
  {
    "shape": "call {hex} unknown script in square",
    "instructionAddress": 9822793,
    "expectedSize": 4,
    "opcode": 41
  },
  {
    "shape": "call {hex} some cinematic script (used multiple times)",
    "instructionAddress": 10007599,
    "expectedSize": 4,
    "opcode": 41
  },
  {
    "shape": "call {hex} unknown script in timberdrake enter",
    "instructionAddress": 10079795,
    "expectedSize": 4,
    "opcode": 41
  },
  {
    "shape": "call {hex} fade to/from/flash white b?",
    "instructionAddress": 10129459,
    "expectedSize": 4,
    "opcode": 41
  },
  {
    "shape": "call {hex} fade to/from/flash white c?",
    "instructionAddress": 10129485,
    "expectedSize": 4,
    "opcode": 41
  },
  {
    "shape": "call {hex} hold up weapon",
    "instructionAddress": 10129501,
    "expectedSize": 4,
    "opcode": 41
  },
  {
    "shape": "call {hex} generate act4 numeric codes",
    "instructionAddress": 10190895,
    "expectedSize": 4,
    "opcode": 41
  },
  {
    "shape": "call {hex} unnamed abs script {hex}",
    "instructionAddress": 10195923,
    "expectedSize": 4,
    "opcode": 41
  },
  {
    "shape": "call {hex} omnitopia hatch fade-in?",
    "instructionAddress": 10198938,
    "expectedSize": 4,
    "opcode": 41
  }
];

test('opcode shape corpus 0x29', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
