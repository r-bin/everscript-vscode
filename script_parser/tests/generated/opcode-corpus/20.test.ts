import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 32,
    "instructionAddress": 9739130,
    "expectedSize": 3,
    "text": "Teleport both to 51 a7"
  },
  {
    "opcode": 32,
    "instructionAddress": 9814398,
    "expectedSize": 3,
    "text": "Teleport both to 0f 1d"
  },
  {
    "opcode": 32,
    "instructionAddress": 9668040,
    "expectedSize": 3,
    "text": "Teleport both to 46 89"
  },
  {
    "opcode": 32,
    "instructionAddress": 9802610,
    "expectedSize": 3,
    "text": "Teleport both to 8a 87"
  },
  {
    "opcode": 32,
    "instructionAddress": 9740247,
    "expectedSize": 3,
    "text": "Teleport both to d5 8b"
  },
  {
    "opcode": 32,
    "instructionAddress": 9626833,
    "expectedSize": 3,
    "text": "Teleport both to 1c 0f"
  },
  {
    "opcode": 32,
    "instructionAddress": 9752071,
    "expectedSize": 3,
    "text": "Teleport both to 59 69"
  },
  {
    "opcode": 32,
    "instructionAddress": 9934098,
    "expectedSize": 3,
    "text": "Teleport both to 3f 0d"
  },
  {
    "opcode": 32,
    "instructionAddress": 9752210,
    "expectedSize": 3,
    "text": "Teleport both to 59 69"
  },
  {
    "opcode": 32,
    "instructionAddress": 9948010,
    "expectedSize": 3,
    "text": "Teleport both to 1d 29"
  },
  {
    "opcode": 32,
    "instructionAddress": 10194157,
    "expectedSize": 3,
    "text": "Teleport both to 0f 25"
  },
  {
    "opcode": 32,
    "instructionAddress": 10134211,
    "expectedSize": 3,
    "text": "Teleport both to 27 c1"
  },
  {
    "opcode": 32,
    "instructionAddress": 9945363,
    "expectedSize": 3,
    "text": "Teleport both to 09 19"
  },
  {
    "opcode": 32,
    "instructionAddress": 10146684,
    "expectedSize": 3,
    "text": "Teleport both to 07 27"
  },
  {
    "opcode": 32,
    "instructionAddress": 10146790,
    "expectedSize": 3,
    "text": "Teleport both to 12 12"
  },
  {
    "opcode": 32,
    "instructionAddress": 9818036,
    "expectedSize": 3,
    "text": "Teleport both to 14 13"
  },
  {
    "opcode": 32,
    "instructionAddress": 9951425,
    "expectedSize": 3,
    "text": "Teleport both to 2b b7"
  },
  {
    "opcode": 32,
    "instructionAddress": 10064763,
    "expectedSize": 3,
    "text": "Teleport both to 1b 4f"
  },
  {
    "opcode": 32,
    "instructionAddress": 9934072,
    "expectedSize": 3,
    "text": "Teleport both to 29 7b"
  },
  {
    "opcode": 32,
    "instructionAddress": 9691169,
    "expectedSize": 3,
    "text": "Teleport both to 2f 59"
  },
  {
    "opcode": 32,
    "instructionAddress": 9812681,
    "expectedSize": 3,
    "text": "Teleport both to 1b 4b"
  },
  {
    "opcode": 32,
    "instructionAddress": 9946442,
    "expectedSize": 3,
    "text": "Teleport both to 0b 1b"
  },
  {
    "opcode": 32,
    "instructionAddress": 10009422,
    "expectedSize": 3,
    "text": "Teleport both to 37 57"
  },
  {
    "opcode": 32,
    "instructionAddress": 9627039,
    "expectedSize": 3,
    "text": "Teleport both to 0b 6b"
  },
  {
    "opcode": 32,
    "instructionAddress": 9672266,
    "expectedSize": 3,
    "text": "Teleport both to 0f 3f"
  },
  {
    "opcode": 32,
    "instructionAddress": 10192328,
    "expectedSize": 3,
    "text": "Teleport both to 0f 6d"
  },
  {
    "opcode": 32,
    "instructionAddress": 9998426,
    "expectedSize": 3,
    "text": "Teleport both to 0f 5f"
  },
  {
    "opcode": 32,
    "instructionAddress": 9822392,
    "expectedSize": 3,
    "text": "Teleport both to 05 13"
  },
  {
    "opcode": 32,
    "instructionAddress": 9744902,
    "expectedSize": 3,
    "text": "Teleport both to 1a 29"
  },
  {
    "opcode": 32,
    "instructionAddress": 9679525,
    "expectedSize": 3,
    "text": "Teleport both to 01 37"
  },
  {
    "opcode": 32,
    "instructionAddress": 10063929,
    "expectedSize": 3,
    "text": "Teleport both to 0f 1d"
  },
  {
    "opcode": 32,
    "instructionAddress": 10008606,
    "expectedSize": 3,
    "text": "Teleport both to 19 09"
  },
  {
    "opcode": 32,
    "instructionAddress": 10013096,
    "expectedSize": 3,
    "text": "Teleport both to 41 1b"
  },
  {
    "opcode": 32,
    "instructionAddress": 9742248,
    "expectedSize": 3,
    "text": "Teleport both to 18 23"
  },
  {
    "opcode": 32,
    "instructionAddress": 10011646,
    "expectedSize": 3,
    "text": "Teleport both to 1d 53"
  },
  {
    "opcode": 32,
    "instructionAddress": 10006717,
    "expectedSize": 3,
    "text": "Teleport both to 52 1b"
  },
  {
    "opcode": 32,
    "instructionAddress": 9952614,
    "expectedSize": 3,
    "text": "Teleport both to 0f 3d"
  },
  {
    "opcode": 32,
    "instructionAddress": 9740273,
    "expectedSize": 3,
    "text": "Teleport both to eb 29"
  },
  {
    "opcode": 32,
    "instructionAddress": 9678604,
    "expectedSize": 3,
    "text": "Teleport both to 09 18"
  },
  {
    "opcode": 32,
    "instructionAddress": 9809922,
    "expectedSize": 3,
    "text": "Teleport both to 21 38"
  },
  {
    "opcode": 32,
    "instructionAddress": 9824544,
    "expectedSize": 3,
    "text": "Teleport both to 0d 3b"
  },
  {
    "opcode": 32,
    "instructionAddress": 9935520,
    "expectedSize": 3,
    "text": "Teleport both to 75 a7"
  },
  {
    "opcode": 32,
    "instructionAddress": 9684454,
    "expectedSize": 3,
    "text": "Teleport both to 1c 55"
  },
  {
    "opcode": 32,
    "instructionAddress": 9883374,
    "expectedSize": 3,
    "text": "Teleport both to 3d 71"
  },
  {
    "opcode": 32,
    "instructionAddress": 9819184,
    "expectedSize": 3,
    "text": "Teleport both to 43 01"
  },
  {
    "opcode": 32,
    "instructionAddress": 10195688,
    "expectedSize": 3,
    "text": "Teleport both to 0f 27"
  },
  {
    "opcode": 32,
    "instructionAddress": 9932917,
    "expectedSize": 3,
    "text": "Teleport both to 35 41"
  },
  {
    "opcode": 32,
    "instructionAddress": 10064407,
    "expectedSize": 3,
    "text": "Teleport both to 21 0f"
  },
  {
    "opcode": 32,
    "instructionAddress": 9877047,
    "expectedSize": 3,
    "text": "Teleport both to 07 4b"
  },
  {
    "opcode": 32,
    "instructionAddress": 10007353,
    "expectedSize": 3,
    "text": "Teleport both to 49 1b"
  },
  {
    "opcode": 32,
    "instructionAddress": 9757176,
    "expectedSize": 3,
    "text": "Teleport both to 0f 1b"
  },
  {
    "opcode": 32,
    "instructionAddress": 10145701,
    "expectedSize": 3,
    "text": "Teleport both to 27 3b"
  },
  {
    "opcode": 32,
    "instructionAddress": 9810739,
    "expectedSize": 3,
    "text": "Teleport both to 13 17"
  },
  {
    "opcode": 32,
    "instructionAddress": 9759530,
    "expectedSize": 3,
    "text": "Teleport both to 61 0f"
  },
  {
    "opcode": 32,
    "instructionAddress": 9679282,
    "expectedSize": 3,
    "text": "Teleport both to 09 37"
  },
  {
    "opcode": 32,
    "instructionAddress": 10214515,
    "expectedSize": 3,
    "text": "Teleport both to 3e 25"
  },
  {
    "opcode": 32,
    "instructionAddress": 10216104,
    "expectedSize": 3,
    "text": "Teleport both to 3b 43"
  },
  {
    "opcode": 32,
    "instructionAddress": 9629464,
    "expectedSize": 3,
    "text": "Teleport both to 01 6b"
  },
  {
    "opcode": 32,
    "instructionAddress": 9887757,
    "expectedSize": 3,
    "text": "Teleport both to 1e 2a"
  },
  {
    "opcode": 32,
    "instructionAddress": 10076924,
    "expectedSize": 3,
    "text": "Teleport both to 10 27"
  },
  {
    "opcode": 32,
    "instructionAddress": 10140777,
    "expectedSize": 3,
    "text": "Teleport both to 3f 29"
  },
  {
    "opcode": 32,
    "instructionAddress": 10079462,
    "expectedSize": 3,
    "text": "Teleport both to 05 20"
  },
  {
    "opcode": 32,
    "instructionAddress": 10020886,
    "expectedSize": 3,
    "text": "Teleport both to 19 5f"
  },
  {
    "opcode": 32,
    "instructionAddress": 9938942,
    "expectedSize": 3,
    "text": "Teleport both to 3f 4d"
  },
  {
    "opcode": 32,
    "instructionAddress": 9952849,
    "expectedSize": 3,
    "text": "Teleport both to 15 1b"
  },
  {
    "opcode": 32,
    "instructionAddress": 10022799,
    "expectedSize": 3,
    "text": "Teleport both to 1b 1f"
  },
  {
    "opcode": 32,
    "instructionAddress": 10128415,
    "expectedSize": 3,
    "text": "Teleport both to 1e 25"
  },
  {
    "opcode": 32,
    "instructionAddress": 10125965,
    "expectedSize": 3,
    "text": "Teleport both to 4d 69"
  },
  {
    "opcode": 32,
    "instructionAddress": 9742565,
    "expectedSize": 3,
    "text": "Teleport both to 99 19"
  },
  {
    "opcode": 32,
    "instructionAddress": 9629004,
    "expectedSize": 3,
    "text": "Teleport both to 02 00"
  },
  {
    "opcode": 32,
    "instructionAddress": 10003262,
    "expectedSize": 3,
    "text": "Teleport both to 12 11"
  },
  {
    "opcode": 32,
    "instructionAddress": 10128547,
    "expectedSize": 4,
    "text": "Teleport both to 39 24"
  },
  {
    "opcode": 32,
    "instructionAddress": 9678013,
    "expectedSize": 3,
    "text": "Teleport both to 09 25"
  },
  {
    "opcode": 32,
    "instructionAddress": 9944754,
    "expectedSize": 3,
    "text": "Teleport both to 21 41"
  },
  {
    "opcode": 32,
    "instructionAddress": 10136303,
    "expectedSize": 3,
    "text": "Teleport both to 54 43"
  },
  {
    "opcode": 32,
    "instructionAddress": 10087973,
    "expectedSize": 3,
    "text": "Teleport both to 13 45"
  },
  {
    "opcode": 32,
    "instructionAddress": 9683656,
    "expectedSize": 3,
    "text": "Teleport both to 31 a1"
  },
  {
    "opcode": 32,
    "instructionAddress": 10198842,
    "expectedSize": 3,
    "text": "Teleport both to 54 50"
  },
  {
    "opcode": 32,
    "instructionAddress": 9758623,
    "expectedSize": 3,
    "text": "Teleport both to 13 1d"
  },
  {
    "opcode": 32,
    "instructionAddress": 10070021,
    "expectedSize": 3,
    "text": "Teleport both to 09 15"
  },
  {
    "opcode": 32,
    "instructionAddress": 10079719,
    "expectedSize": 3,
    "text": "Teleport both to 1b 29"
  },
  {
    "opcode": 32,
    "instructionAddress": 10082485,
    "expectedSize": 3,
    "text": "Teleport both to 0f 45"
  },
  {
    "opcode": 32,
    "instructionAddress": 9742666,
    "expectedSize": 3,
    "text": "Teleport both to c6 1d"
  },
  {
    "opcode": 32,
    "instructionAddress": 9687593,
    "expectedSize": 3,
    "text": "Teleport both to 17 35"
  },
  {
    "opcode": 32,
    "instructionAddress": 9742476,
    "expectedSize": 3,
    "text": "Teleport both to 6f 1b"
  },
  {
    "opcode": 32,
    "instructionAddress": 10125745,
    "expectedSize": 3,
    "text": "Teleport both to 15 5b"
  },
  {
    "opcode": 32,
    "instructionAddress": 9736220,
    "expectedSize": 3,
    "text": "Teleport both to 0b b0"
  },
  {
    "opcode": 32,
    "instructionAddress": 10205636,
    "expectedSize": 3,
    "text": "Teleport both to 14 25"
  },
  {
    "opcode": 32,
    "instructionAddress": 9819910,
    "expectedSize": 3,
    "text": "Teleport both to 16 3f"
  },
  {
    "opcode": 32,
    "instructionAddress": 9798733,
    "expectedSize": 3,
    "text": "Teleport both to 31 5a"
  },
  {
    "opcode": 32,
    "instructionAddress": 9936125,
    "expectedSize": 3,
    "text": "Teleport both to 09 23"
  },
  {
    "opcode": 32,
    "instructionAddress": 10138449,
    "expectedSize": 3,
    "text": "Teleport both to 1c 17"
  },
  {
    "opcode": 32,
    "instructionAddress": 9758087,
    "expectedSize": 3,
    "text": "Teleport both to 13 15"
  },
  {
    "opcode": 32,
    "instructionAddress": 9668027,
    "expectedSize": 3,
    "text": "Teleport both to 43 93"
  },
  {
    "opcode": 32,
    "instructionAddress": 9758213,
    "expectedSize": 3,
    "text": "Teleport both to 1d 15"
  },
  {
    "opcode": 32,
    "instructionAddress": 10126304,
    "expectedSize": 3,
    "text": "Teleport both to 09 19"
  },
  {
    "opcode": 32,
    "instructionAddress": 9670966,
    "expectedSize": 3,
    "text": "Teleport both to 1d 27"
  },
  {
    "opcode": 32,
    "instructionAddress": 9823504,
    "expectedSize": 3,
    "text": "Teleport both to 43 39"
  },
  {
    "opcode": 32,
    "instructionAddress": 9758892,
    "expectedSize": 3,
    "text": "Teleport both to 0b 0b"
  },
  {
    "opcode": 32,
    "instructionAddress": 9885135,
    "expectedSize": 3,
    "text": "Teleport both to 06 16"
  }
];

test('opcode corpus 0x20', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
