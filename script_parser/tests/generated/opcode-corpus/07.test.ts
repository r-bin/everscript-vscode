import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 7,
    "instructionAddress": 9752090,
    "expectedSize": 4,
    "text": "CALL 0x92d92a Outro rain and sky color"
  },
  {
    "opcode": 7,
    "instructionAddress": 9733350,
    "expectedSize": 4,
    "text": "CALL 0x94827e Unnamed ABS script 0x94827e"
  },
  {
    "opcode": 7,
    "instructionAddress": 9733356,
    "expectedSize": 4,
    "text": "CALL 0x9482d5 Unnamed ABS script 0x9482d5"
  },
  {
    "opcode": 7,
    "instructionAddress": 9733852,
    "expectedSize": 4,
    "text": "CALL 0x9485f6 Unnamed ABS script 0x9485f6"
  },
  {
    "opcode": 7,
    "instructionAddress": 9733858,
    "expectedSize": 4,
    "text": "CALL 0x948613 Unnamed ABS script 0x948613"
  },
  {
    "opcode": 7,
    "instructionAddress": 9948122,
    "expectedSize": 4,
    "text": "CALL 0x92d92a Outro rain and sky color"
  },
  {
    "opcode": 7,
    "instructionAddress": 9759640,
    "expectedSize": 4,
    "text": "CALL 0x94e9ac Unnamed ABS script 0x94e9ac"
  },
  {
    "opcode": 7,
    "instructionAddress": 9946537,
    "expectedSize": 4,
    "text": "CALL 0x92d92a Outro rain and sky color"
  },
  {
    "opcode": 7,
    "instructionAddress": 9955633,
    "expectedSize": 4,
    "text": "CALL 0x97e0da Unnamed ABS script 0x97e0da"
  },
  {
    "opcode": 7,
    "instructionAddress": 9955637,
    "expectedSize": 4,
    "text": "CALL 0x97e6a0 Unnamed ABS script 0x97e6a0"
  },
  {
    "opcode": 7,
    "instructionAddress": 9955641,
    "expectedSize": 4,
    "text": "CALL 0x97e6c9 Unnamed ABS script 0x97e6c9"
  },
  {
    "opcode": 7,
    "instructionAddress": 9955645,
    "expectedSize": 4,
    "text": "CALL 0x97e7dd Unnamed ABS script 0x97e7dd"
  },
  {
    "opcode": 7,
    "instructionAddress": 9955649,
    "expectedSize": 4,
    "text": "CALL 0x97e7dd Unnamed ABS script 0x97e7dd"
  },
  {
    "opcode": 7,
    "instructionAddress": 9955653,
    "expectedSize": 4,
    "text": "CALL 0x97e7dd Unnamed ABS script 0x97e7dd"
  },
  {
    "opcode": 7,
    "instructionAddress": 9955657,
    "expectedSize": 4,
    "text": "CALL 0x97e7dd Unnamed ABS script 0x97e7dd"
  },
  {
    "opcode": 7,
    "instructionAddress": 10079753,
    "expectedSize": 4,
    "text": "CALL 0x99cec1 Timberdrake AI?"
  },
  {
    "opcode": 7,
    "instructionAddress": 10077136,
    "expectedSize": 4,
    "text": "CALL 0x99c1a9 Unnamed ABS script 0x99c1a9"
  },
  {
    "opcode": 7,
    "instructionAddress": 10007603,
    "expectedSize": 4,
    "text": "CALL 0x92d52d Unnamed ABS script 0x92d52d"
  },
  {
    "opcode": 7,
    "instructionAddress": 10128652,
    "expectedSize": 4,
    "text": "CALL 0x9a848d Gothica - The Show of Life"
  },
  {
    "opcode": 7,
    "instructionAddress": 10192542,
    "expectedSize": 4,
    "text": "CALL 0x9b87dc Unnamed ABS script 0x9b87dc"
  },
  {
    "opcode": 7,
    "instructionAddress": 10205687,
    "expectedSize": 4,
    "text": "CALL 0x9bb928 Unnamed ABS script 0x9bb928"
  },
  {
    "opcode": 7,
    "instructionAddress": 10205724,
    "expectedSize": 4,
    "text": "CALL 0x9baf4b Unnamed ABS script 0x9baf4b"
  },
  {
    "opcode": 7,
    "instructionAddress": 9626102,
    "expectedSize": 4,
    "text": "CALL 0x92e08e Unnamed ABS script 0x92e08e"
  },
  {
    "opcode": 7,
    "instructionAddress": 9626979,
    "expectedSize": 4,
    "text": "CALL 0x92e401 Intro part? running in BG"
  },
  {
    "opcode": 7,
    "instructionAddress": 9626999,
    "expectedSize": 4,
    "text": "CALL 0x92e3ad Unnamed ABS script 0x92e3ad"
  },
  {
    "opcode": 7,
    "instructionAddress": 9627003,
    "expectedSize": 4,
    "text": "CALL 0x92e414 Unnamed ABS script 0x92e414"
  },
  {
    "opcode": 7,
    "instructionAddress": 9629505,
    "expectedSize": 5,
    "text": "CALL 0x92ed63 Unnamed ABS script 0x92ed63"
  },
  {
    "opcode": 7,
    "instructionAddress": 9685208,
    "expectedSize": 4,
    "text": "CALL 0x93ca9f Thraxx maggot trigger part"
  },
  {
    "opcode": 7,
    "instructionAddress": 9685229,
    "expectedSize": 4,
    "text": "CALL 0x93c95f Unnamed ABS script 0x93c95f"
  }
];

test('opcode corpus 0x07', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
