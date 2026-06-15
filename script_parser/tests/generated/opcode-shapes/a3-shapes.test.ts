import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "call \"attraction mode, after thraxx\" ({hex})",
    "instructionAddress": 9679583,
    "expectedSize": 2,
    "opcode": 163
  },
  {
    "shape": "call \"fade-in / start music\" ({hex})",
    "instructionAddress": 9691387,
    "expectedSize": 2,
    "opcode": 163
  },
  {
    "shape": "call \"unnamed global script {hex}\" ({hex})",
    "instructionAddress": 9877546,
    "expectedSize": 2,
    "opcode": 163
  },
  {
    "shape": "call \"open message box?\" ({hex})",
    "instructionAddress": 9877679,
    "expectedSize": 2,
    "opcode": 163
  },
  {
    "shape": "call \"prepare room change? west exit/east entrance outdoor-outdoor?\" ({hex})",
    "instructionAddress": 9946809,
    "expectedSize": 2,
    "opcode": 163
  },
  {
    "shape": "call \"prepare room change? south exit/north entrance outdoor-outdoor?\" ({hex})",
    "instructionAddress": 9948449,
    "expectedSize": 2,
    "opcode": 163
  },
  {
    "shape": "call \"fade-out / stop music\" ({hex})",
    "instructionAddress": 10129489,
    "expectedSize": 2,
    "opcode": 163
  }
];

test('opcode shape corpus 0xa3', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
