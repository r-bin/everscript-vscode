import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 81,
    "instructionAddress": 9752642,
    "expectedSize": 3,
    "text": "SHOW TEXT 07fb FROM 0x91d7fb compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9877681,
    "expectedSize": 3,
    "text": "SHOW TEXT 11f4 FROM 0x91e1f4 compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9877697,
    "expectedSize": 3,
    "text": "SHOW TEXT 11f7 FROM 0x91e1f7 compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9816969,
    "expectedSize": 3,
    "text": "SHOW TEXT 0bdc FROM 0x91dbdc compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9997045,
    "expectedSize": 3,
    "text": "SHOW TEXT 16fe FROM 0x91e6fe compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 10128585,
    "expectedSize": 3,
    "text": "SHOW TEXT 1d8b FROM 0x91ed8b compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 10129549,
    "expectedSize": 3,
    "text": "SHOW TEXT 1d91 FROM 0x91ed91 compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 10129564,
    "expectedSize": 3,
    "text": "SHOW TEXT 1d94 FROM 0x91ed94 compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 10129847,
    "expectedSize": 3,
    "text": "SHOW TEXT 1d97 FROM 0x91ed97 compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 10129950,
    "expectedSize": 3,
    "text": "SHOW TEXT 1d9a FROM 0x91ed9a compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 10130035,
    "expectedSize": 3,
    "text": "SHOW TEXT 1d9d FROM 0x91ed9d compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 10130073,
    "expectedSize": 3,
    "text": "SHOW TEXT 1da3 FROM 0x91eda3 compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9626866,
    "expectedSize": 3,
    "text": "SHOW TEXT 04ef FROM 0x91d4ef compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9626904,
    "expectedSize": 3,
    "text": "SHOW TEXT 04f2 FROM 0x91d4f2 uncompressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9626942,
    "expectedSize": 3,
    "text": "SHOW TEXT 04f5 FROM 0x91d4f5 uncompressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9627023,
    "expectedSize": 4,
    "text": "SHOW TEXT 04f8 FROM 0x91d4f8 compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9627100,
    "expectedSize": 3,
    "text": "SHOW TEXT 04fb FROM 0x91d4fb compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9627105,
    "expectedSize": 3,
    "text": "SHOW TEXT 04fe FROM 0x91d4fe uncompressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9627108,
    "expectedSize": 3,
    "text": "SHOW TEXT 0501 FROM 0x91d501 compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9627113,
    "expectedSize": 3,
    "text": "SHOW TEXT 0504 FROM 0x91d504 compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9627190,
    "expectedSize": 4,
    "text": "SHOW TEXT 0507 FROM 0x91d507 compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9629589,
    "expectedSize": 3,
    "text": "SHOW TEXT 0546 FROM 0x91d546 compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9629635,
    "expectedSize": 3,
    "text": "SHOW TEXT 0549 FROM 0x91d549 compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9629644,
    "expectedSize": 3,
    "text": "SHOW TEXT 054c FROM 0x91d54c compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9629662,
    "expectedSize": 3,
    "text": "SHOW TEXT 054f FROM 0x91d54f compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9629674,
    "expectedSize": 3,
    "text": "SHOW TEXT 0552 FROM 0x91d552 compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9629688,
    "expectedSize": 3,
    "text": "SHOW TEXT 0555 FROM 0x91d555 compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9629703,
    "expectedSize": 3,
    "text": "SHOW TEXT 0558 FROM 0x91d558 compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9629706,
    "expectedSize": 3,
    "text": "SHOW TEXT 055b FROM 0x91d55b compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9629718,
    "expectedSize": 3,
    "text": "SHOW TEXT 055e FROM 0x91d55e compressed WINDOWED"
  },
  {
    "opcode": 81,
    "instructionAddress": 9629725,
    "expectedSize": 3,
    "text": "SHOW TEXT 0561 FROM 0x91d561 compressed WINDOWED"
  }
];

test('opcode corpus 0x51', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
