import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 41,
    "instructionAddress": 9667840,
    "expectedSize": 4,
    "text": "CALL 0x92a3ed Show status bar layer"
  },
  {
    "opcode": 41,
    "instructionAddress": 9736925,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10012131,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9742749,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9933034,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9752611,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9757800,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9740780,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9747906,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10194231,
    "expectedSize": 4,
    "text": "CALL 0x9b8d99 Unnamed ABS script 0x9b8d99"
  },
  {
    "opcode": 41,
    "instructionAddress": 9822780,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9810133,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9672300,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10079628,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10205764,
    "expectedSize": 4,
    "text": "CALL 0x9bbad6 Unnamed ABS script 0x9bbad6"
  },
  {
    "opcode": 41,
    "instructionAddress": 9946513,
    "expectedSize": 4,
    "text": "CALL 0x92a3e7 Hide status bar layer"
  },
  {
    "opcode": 41,
    "instructionAddress": 9745422,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10083387,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10019638,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10013484,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9734561,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9932421,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9627172,
    "expectedSize": 4,
    "text": "CALL 0x92d81c Unnamed ABS script 0x92d81c"
  },
  {
    "opcode": 41,
    "instructionAddress": 9759631,
    "expectedSize": 4,
    "text": "CALL 0x92a3e7 Hide status bar layer"
  },
  {
    "opcode": 41,
    "instructionAddress": 9953038,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10214626,
    "expectedSize": 4,
    "text": "CALL 0x92a3e7 Hide status bar layer"
  },
  {
    "opcode": 41,
    "instructionAddress": 9739156,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9758935,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9822793,
    "expectedSize": 4,
    "text": "CALL 0x92cc6c Unknown script in square"
  },
  {
    "opcode": 41,
    "instructionAddress": 9885303,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9814860,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9880577,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10142617,
    "expectedSize": 4,
    "text": "CALL 0x92a3e7 Hide status bar layer"
  },
  {
    "opcode": 41,
    "instructionAddress": 10069945,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9678035,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10021075,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10079795,
    "expectedSize": 4,
    "text": "CALL 0x99d39c Unknown script in Timberdrake enter"
  },
  {
    "opcode": 41,
    "instructionAddress": 10205796,
    "expectedSize": 4,
    "text": "CALL 0x92de7e Omnitopia hatch fade-in?"
  },
  {
    "opcode": 41,
    "instructionAddress": 9818113,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10064297,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9948130,
    "expectedSize": 4,
    "text": "CALL 0x92a3e7 Hide status bar layer"
  },
  {
    "opcode": 41,
    "instructionAddress": 9823713,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9668268,
    "expectedSize": 4,
    "text": "CALL 0x92c9c5 Unnamed ABS script 0x92c9c5"
  },
  {
    "opcode": 41,
    "instructionAddress": 10087748,
    "expectedSize": 4,
    "text": "CALL 0x92a3e7 Hide status bar layer"
  },
  {
    "opcode": 41,
    "instructionAddress": 9687987,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10064799,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10079791,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9934263,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9997064,
    "expectedSize": 5,
    "text": "CALL 0x92a3e7 Hide status bar layer"
  },
  {
    "opcode": 41,
    "instructionAddress": 10013511,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9883710,
    "expectedSize": 4,
    "text": "CALL 0x92a422 Unnamed ABS script 0x92a422"
  },
  {
    "opcode": 41,
    "instructionAddress": 10195923,
    "expectedSize": 4,
    "text": "CALL 0x9b9692 Unnamed ABS script 0x9b9692"
  },
  {
    "opcode": 41,
    "instructionAddress": 9681338,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9816939,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9935748,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9997131,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9667830,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10009708,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9804612,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10198938,
    "expectedSize": 4,
    "text": "CALL 0x92de7e Omnitopia hatch fade-in?"
  },
  {
    "opcode": 41,
    "instructionAddress": 9998676,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10129485,
    "expectedSize": 4,
    "text": "CALL 0x92d752 Fade to/from/flash white C?"
  },
  {
    "opcode": 41,
    "instructionAddress": 9733296,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9996953,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9946771,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9758253,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9802940,
    "expectedSize": 4,
    "text": "CALL 0x92a422 Unnamed ABS script 0x92a422"
  },
  {
    "opcode": 41,
    "instructionAddress": 9626856,
    "expectedSize": 10,
    "text": "CALL 0x92a3d3 Unknown"
  },
  {
    "opcode": 41,
    "instructionAddress": 10192639,
    "expectedSize": 4,
    "text": "CALL 0x92de7e Omnitopia hatch fade-in?"
  },
  {
    "opcode": 41,
    "instructionAddress": 10006957,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10088153,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10129501,
    "expectedSize": 4,
    "text": "CALL 0x92bf33 Hold up weapon"
  },
  {
    "opcode": 41,
    "instructionAddress": 10190895,
    "expectedSize": 4,
    "text": "CALL 0x9b814e Generate act4 numeric codes"
  },
  {
    "opcode": 41,
    "instructionAddress": 9671168,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10136371,
    "expectedSize": 4,
    "text": "CALL 0x92a3e7 Hide status bar layer"
  },
  {
    "opcode": 41,
    "instructionAddress": 10140432,
    "expectedSize": 4,
    "text": "CALL 0x92c9d9 Unnamed ABS script 0x92c9d9"
  },
  {
    "opcode": 41,
    "instructionAddress": 10013442,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10063216,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9802948,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10195770,
    "expectedSize": 4,
    "text": "CALL 0x9b93ed Unnamed ABS script 0x9b93ed"
  },
  {
    "opcode": 41,
    "instructionAddress": 10012115,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9802888,
    "expectedSize": 4,
    "text": "CALL 0x92a404 Unnamed ABS script 0x92a404"
  },
  {
    "opcode": 41,
    "instructionAddress": 10012065,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10146012,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9758145,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10012090,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9802925,
    "expectedSize": 4,
    "text": "CALL 0x92a422 Unnamed ABS script 0x92a422"
  },
  {
    "opcode": 41,
    "instructionAddress": 9627137,
    "expectedSize": 4,
    "text": "CALL 0x92d7e1 Unnamed ABS script 0x92d7e1"
  },
  {
    "opcode": 41,
    "instructionAddress": 10013528,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9883727,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10191124,
    "expectedSize": 4,
    "text": "CALL 0x9b8189 Unnamed ABS script 0x9b8189"
  },
  {
    "opcode": 41,
    "instructionAddress": 10192378,
    "expectedSize": 4,
    "text": "CALL 0x9b871e Unnamed ABS script 0x9b871e"
  },
  {
    "opcode": 41,
    "instructionAddress": 9819316,
    "expectedSize": 4,
    "text": "CALL 0x92a3e7 Hide status bar layer"
  },
  {
    "opcode": 41,
    "instructionAddress": 10020945,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9804604,
    "expectedSize": 4,
    "text": "CALL 0x92a422 Unnamed ABS script 0x92a422"
  },
  {
    "opcode": 41,
    "instructionAddress": 10193221,
    "expectedSize": 4,
    "text": "CALL 0x92de7e Omnitopia hatch fade-in?"
  },
  {
    "opcode": 41,
    "instructionAddress": 10138523,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9940845,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 10007599,
    "expectedSize": 4,
    "text": "CALL 0x92de75 Some cinematic script (used multiple times)"
  },
  {
    "opcode": 41,
    "instructionAddress": 9627013,
    "expectedSize": 10,
    "text": "CALL 0x92a3d3 Unknown"
  }
];

test('opcode corpus 0x29', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
