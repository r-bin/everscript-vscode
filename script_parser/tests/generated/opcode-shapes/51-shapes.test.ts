import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "show text 04ef from {hex} compressed windowed",
    "instructionAddress": 9626866,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 04f2 from {hex} uncompressed windowed",
    "instructionAddress": 9626904,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 04f5 from {hex} uncompressed windowed",
    "instructionAddress": 9626942,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 04f8 from {hex} compressed windowed",
    "instructionAddress": 9627023,
    "expectedSize": 4,
    "opcode": 81
  },
  {
    "shape": "show text 04fb from {hex} compressed windowed",
    "instructionAddress": 9627100,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 04fe from {hex} uncompressed windowed",
    "instructionAddress": 9627105,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text {num} from {hex} compressed windowed",
    "instructionAddress": 9627113,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 054c from {hex} compressed windowed",
    "instructionAddress": 9629644,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 054f from {hex} compressed windowed",
    "instructionAddress": 9629662,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 055b from {hex} compressed windowed",
    "instructionAddress": 9629706,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 055e from {hex} compressed windowed",
    "instructionAddress": 9629718,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 07fb from {hex} compressed windowed",
    "instructionAddress": 9752642,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 0bdc from {hex} compressed windowed",
    "instructionAddress": 9816969,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 11f4 from {hex} compressed windowed",
    "instructionAddress": 9877681,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 11f7 from {hex} compressed windowed",
    "instructionAddress": 9877697,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 16fe from {hex} compressed windowed",
    "instructionAddress": 9997045,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 1d8b from {hex} compressed windowed",
    "instructionAddress": 10128585,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 1d91 from {hex} compressed windowed",
    "instructionAddress": 10129549,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 1d94 from {hex} compressed windowed",
    "instructionAddress": 10129564,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 1d97 from {hex} compressed windowed",
    "instructionAddress": 10129847,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 1d9a from {hex} compressed windowed",
    "instructionAddress": 10129950,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 1d9d from {hex} compressed windowed",
    "instructionAddress": 10130035,
    "expectedSize": 3,
    "opcode": 81
  },
  {
    "shape": "show text 1da3 from {hex} compressed windowed",
    "instructionAddress": 10130073,
    "expectedSize": 3,
    "opcode": 81
  }
];

test('opcode shape corpus 0x51', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
