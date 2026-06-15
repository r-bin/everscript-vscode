import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 186,
    "instructionAddress": 10018766,
    "expectedSize": 4,
    "text": "LOAD NPC 55 at b7 47"
  },
  {
    "opcode": 186,
    "instructionAddress": 9672152,
    "expectedSize": 4,
    "text": "LOAD NPC 0c at 49 33"
  },
  {
    "opcode": 186,
    "instructionAddress": 9816807,
    "expectedSize": 4,
    "text": "LOAD NPC 19 at 29 19"
  },
  {
    "opcode": 186,
    "instructionAddress": 9878925,
    "expectedSize": 4,
    "text": "LOAD NPC 27 at 11 2d"
  },
  {
    "opcode": 186,
    "instructionAddress": 9752379,
    "expectedSize": 4,
    "text": "LOAD NPC 09 at 17 1f"
  },
  {
    "opcode": 186,
    "instructionAddress": 10018672,
    "expectedSize": 4,
    "text": "LOAD NPC 55 at b1 49"
  },
  {
    "opcode": 186,
    "instructionAddress": 9822872,
    "expectedSize": 4,
    "text": "LOAD NPC 1d at 29 40"
  },
  {
    "opcode": 186,
    "instructionAddress": 9816779,
    "expectedSize": 4,
    "text": "LOAD NPC 18 at 51 25"
  },
  {
    "opcode": 186,
    "instructionAddress": 9752294,
    "expectedSize": 4,
    "text": "LOAD NPC 09 at 61 51"
  },
  {
    "opcode": 186,
    "instructionAddress": 9745109,
    "expectedSize": 4,
    "text": "LOAD NPC 2b at 4f 19"
  },
  {
    "opcode": 186,
    "instructionAddress": 9752240,
    "expectedSize": 4,
    "text": "LOAD NPC 05 at 47 41"
  },
  {
    "opcode": 186,
    "instructionAddress": 9948327,
    "expectedSize": 4,
    "text": "LOAD NPC 20 at 17 1f"
  },
  {
    "opcode": 186,
    "instructionAddress": 9739110,
    "expectedSize": 4,
    "text": "LOAD NPC 2a at 49 67"
  },
  {
    "opcode": 186,
    "instructionAddress": 9734487,
    "expectedSize": 4,
    "text": "LOAD NPC 0c at 05 2b"
  },
  {
    "opcode": 186,
    "instructionAddress": 10019321,
    "expectedSize": 4,
    "text": "LOAD NPC 51 at c7 19"
  },
  {
    "opcode": 186,
    "instructionAddress": 9672156,
    "expectedSize": 4,
    "text": "LOAD NPC 0c at 1d 2d"
  },
  {
    "opcode": 186,
    "instructionAddress": 10145815,
    "expectedSize": 4,
    "text": "LOAD NPC 20 at 19 3f"
  },
  {
    "opcode": 186,
    "instructionAddress": 9736498,
    "expectedSize": 4,
    "text": "LOAD NPC 21 at 7d 33"
  },
  {
    "opcode": 186,
    "instructionAddress": 10194239,
    "expectedSize": 4,
    "text": "LOAD NPC 69 at 30 25"
  },
  {
    "opcode": 186,
    "instructionAddress": 9757287,
    "expectedSize": 4,
    "text": "LOAD NPC 08 at 33 11"
  },
  {
    "opcode": 186,
    "instructionAddress": 9822911,
    "expectedSize": 4,
    "text": "LOAD NPC 19 at 30 43"
  },
  {
    "opcode": 186,
    "instructionAddress": 9877480,
    "expectedSize": 4,
    "text": "LOAD NPC 1c at 0b 57"
  },
  {
    "opcode": 186,
    "instructionAddress": 9758651,
    "expectedSize": 4,
    "text": "LOAD NPC 7e at 13 11"
  },
  {
    "opcode": 186,
    "instructionAddress": 9822824,
    "expectedSize": 4,
    "text": "LOAD NPC 1a at 2a 3a"
  },
  {
    "opcode": 186,
    "instructionAddress": 9667999,
    "expectedSize": 4,
    "text": "LOAD NPC 0b at 45 3b"
  },
  {
    "opcode": 186,
    "instructionAddress": 10128691,
    "expectedSize": 4,
    "text": "LOAD NPC 67 at 23 0f"
  },
  {
    "opcode": 186,
    "instructionAddress": 9667959,
    "expectedSize": 4,
    "text": "LOAD NPC 0b at 49 79"
  },
  {
    "opcode": 186,
    "instructionAddress": 9945486,
    "expectedSize": 4,
    "text": "LOAD NPC 20 at 19 1f"
  },
  {
    "opcode": 186,
    "instructionAddress": 9752352,
    "expectedSize": 4,
    "text": "LOAD NPC 07 at 3f 3f"
  },
  {
    "opcode": 186,
    "instructionAddress": 9955419,
    "expectedSize": 4,
    "text": "LOAD NPC 3f at 12 32"
  },
  {
    "opcode": 186,
    "instructionAddress": 10011810,
    "expectedSize": 4,
    "text": "LOAD NPC 52 at 31 1f"
  },
  {
    "opcode": 186,
    "instructionAddress": 10018750,
    "expectedSize": 4,
    "text": "LOAD NPC 53 at cd 33"
  },
  {
    "opcode": 186,
    "instructionAddress": 9758111,
    "expectedSize": 4,
    "text": "LOAD NPC 09 at 0b 13"
  },
  {
    "opcode": 186,
    "instructionAddress": 10013216,
    "expectedSize": 4,
    "text": "LOAD NPC 55 at 2d 6b"
  },
  {
    "opcode": 186,
    "instructionAddress": 10019452,
    "expectedSize": 4,
    "text": "LOAD NPC 54 at 8b 2b"
  },
  {
    "opcode": 186,
    "instructionAddress": 9667971,
    "expectedSize": 4,
    "text": "LOAD NPC 0b at 45 4d"
  },
  {
    "opcode": 186,
    "instructionAddress": 9667975,
    "expectedSize": 4,
    "text": "LOAD NPC 0b at 19 53"
  },
  {
    "opcode": 186,
    "instructionAddress": 9877330,
    "expectedSize": 4,
    "text": "LOAD NPC 1a at 25 8d"
  },
  {
    "opcode": 186,
    "instructionAddress": 9757407,
    "expectedSize": 4,
    "text": "LOAD NPC 07 at 11 3d"
  },
  {
    "opcode": 186,
    "instructionAddress": 9759592,
    "expectedSize": 4,
    "text": "LOAD NPC 20 at 63 0d"
  },
  {
    "opcode": 186,
    "instructionAddress": 9952912,
    "expectedSize": 4,
    "text": "LOAD NPC 6e at 21 1b"
  },
  {
    "opcode": 186,
    "instructionAddress": 10019104,
    "expectedSize": 4,
    "text": "LOAD NPC 56 at 73 5f"
  },
  {
    "opcode": 186,
    "instructionAddress": 10126377,
    "expectedSize": 4,
    "text": "LOAD NPC 42 at 09 17"
  },
  {
    "opcode": 186,
    "instructionAddress": 9878941,
    "expectedSize": 4,
    "text": "LOAD NPC 23 at 32 1b"
  },
  {
    "opcode": 186,
    "instructionAddress": 9810759,
    "expectedSize": 4,
    "text": "LOAD NPC 17 at 11 0f"
  },
  {
    "opcode": 186,
    "instructionAddress": 10192436,
    "expectedSize": 4,
    "text": "LOAD NPC 6a at 30 31"
  },
  {
    "opcode": 186,
    "instructionAddress": 9752266,
    "expectedSize": 4,
    "text": "LOAD NPC 08 at 61 61"
  },
  {
    "opcode": 186,
    "instructionAddress": 9742480,
    "expectedSize": 4,
    "text": "LOAD NPC 12 at 6f 17"
  },
  {
    "opcode": 186,
    "instructionAddress": 10134265,
    "expectedSize": 4,
    "text": "LOAD NPC 55 at 29 1b"
  },
  {
    "opcode": 186,
    "instructionAddress": 9747990,
    "expectedSize": 4,
    "text": "LOAD NPC 35 at 05 19"
  },
  {
    "opcode": 186,
    "instructionAddress": 10134297,
    "expectedSize": 4,
    "text": "LOAD NPC 52 at 0f b9"
  },
  {
    "opcode": 186,
    "instructionAddress": 10128867,
    "expectedSize": 7,
    "text": "LOAD NPC 20 at 1a 0e"
  },
  {
    "opcode": 186,
    "instructionAddress": 9798777,
    "expectedSize": 4,
    "text": "LOAD NPC 1a at 2d 2d"
  },
  {
    "opcode": 186,
    "instructionAddress": 9946668,
    "expectedSize": 4,
    "text": "LOAD NPC 20 at 1d 19"
  },
  {
    "opcode": 186,
    "instructionAddress": 9752452,
    "expectedSize": 4,
    "text": "LOAD NPC 03 at 39 5b"
  },
  {
    "opcode": 186,
    "instructionAddress": 10018594,
    "expectedSize": 4,
    "text": "LOAD NPC 55 at cb 39"
  },
  {
    "opcode": 186,
    "instructionAddress": 9934207,
    "expectedSize": 4,
    "text": "LOAD NPC 5e at 34 24"
  },
  {
    "opcode": 186,
    "instructionAddress": 10018680,
    "expectedSize": 4,
    "text": "LOAD NPC 56 at cf 42"
  },
  {
    "opcode": 186,
    "instructionAddress": 9626066,
    "expectedSize": 7,
    "text": "LOAD NPC 20 at 58 15"
  },
  {
    "opcode": 186,
    "instructionAddress": 9940827,
    "expectedSize": 4,
    "text": "LOAD NPC 76 at 69 9b"
  },
  {
    "opcode": 186,
    "instructionAddress": 10013232,
    "expectedSize": 4,
    "text": "LOAD NPC 55 at 6d 6b"
  },
  {
    "opcode": 186,
    "instructionAddress": 9742669,
    "expectedSize": 4,
    "text": "LOAD NPC 32 at bd 15"
  },
  {
    "opcode": 186,
    "instructionAddress": 10191083,
    "expectedSize": 4,
    "text": "LOAD NPC 69 at 50 1d"
  },
  {
    "opcode": 186,
    "instructionAddress": 9877218,
    "expectedSize": 4,
    "text": "LOAD NPC 1c at 4b 31"
  },
  {
    "opcode": 186,
    "instructionAddress": 9798827,
    "expectedSize": 4,
    "text": "LOAD NPC 20 at 1f 54"
  },
  {
    "opcode": 186,
    "instructionAddress": 9808506,
    "expectedSize": 7,
    "text": "LOAD NPC 20 at 00 00"
  },
  {
    "opcode": 186,
    "instructionAddress": 10191046,
    "expectedSize": 4,
    "text": "LOAD NPC 69 at 50 17"
  },
  {
    "opcode": 186,
    "instructionAddress": 9878937,
    "expectedSize": 4,
    "text": "LOAD NPC 23 at 19 49"
  },
  {
    "opcode": 186,
    "instructionAddress": 10193168,
    "expectedSize": 4,
    "text": "LOAD NPC 7d at 09 11"
  },
  {
    "opcode": 186,
    "instructionAddress": 10018602,
    "expectedSize": 4,
    "text": "LOAD NPC 56 at cf 39"
  },
  {
    "opcode": 186,
    "instructionAddress": 9736414,
    "expectedSize": 4,
    "text": "LOAD NPC 21 at 83 5d"
  },
  {
    "opcode": 186,
    "instructionAddress": 9999645,
    "expectedSize": 4,
    "text": "LOAD NPC 53 at f7 0d"
  },
  {
    "opcode": 186,
    "instructionAddress": 9948294,
    "expectedSize": 4,
    "text": "LOAD NPC 20 at 17 1f"
  },
  {
    "opcode": 186,
    "instructionAddress": 10018758,
    "expectedSize": 4,
    "text": "LOAD NPC 52 at af 37"
  },
  {
    "opcode": 186,
    "instructionAddress": 9955532,
    "expectedSize": 4,
    "text": "LOAD NPC 3e at 1a 33"
  },
  {
    "opcode": 186,
    "instructionAddress": 9955473,
    "expectedSize": 4,
    "text": "LOAD NPC 3f at 1a 33"
  },
  {
    "opcode": 186,
    "instructionAddress": 9798882,
    "expectedSize": 4,
    "text": "LOAD NPC 20 at 1f 17"
  },
  {
    "opcode": 186,
    "instructionAddress": 10018516,
    "expectedSize": 4,
    "text": "LOAD NPC 55 at ad 47"
  },
  {
    "opcode": 186,
    "instructionAddress": 9734471,
    "expectedSize": 4,
    "text": "LOAD NPC 21 at 4d 39"
  },
  {
    "opcode": 186,
    "instructionAddress": 9887729,
    "expectedSize": 4,
    "text": "LOAD NPC 1b at 19 29"
  },
  {
    "opcode": 186,
    "instructionAddress": 9672168,
    "expectedSize": 4,
    "text": "LOAD NPC 0c at 55 13"
  },
  {
    "opcode": 186,
    "instructionAddress": 9878814,
    "expectedSize": 4,
    "text": "LOAD NPC 20 at 11 0f"
  },
  {
    "opcode": 186,
    "instructionAddress": 9877400,
    "expectedSize": 4,
    "text": "LOAD NPC 19 at 3d 8f"
  },
  {
    "opcode": 186,
    "instructionAddress": 10079737,
    "expectedSize": 4,
    "text": "LOAD NPC 43 at 07 21"
  },
  {
    "opcode": 186,
    "instructionAddress": 9667963,
    "expectedSize": 4,
    "text": "LOAD NPC 0b at 6b 81"
  },
  {
    "opcode": 186,
    "instructionAddress": 9877232,
    "expectedSize": 4,
    "text": "LOAD NPC 1c at 41 77"
  },
  {
    "opcode": 186,
    "instructionAddress": 9822896,
    "expectedSize": 4,
    "text": "LOAD NPC 18 at 2d 43"
  },
  {
    "opcode": 186,
    "instructionAddress": 9809990,
    "expectedSize": 4,
    "text": "LOAD NPC 5b at 19 10"
  },
  {
    "opcode": 186,
    "instructionAddress": 9734495,
    "expectedSize": 4,
    "text": "LOAD NPC 0c at 2a 10"
  },
  {
    "opcode": 186,
    "instructionAddress": 9672132,
    "expectedSize": 4,
    "text": "LOAD NPC 0c at 0f 35"
  },
  {
    "opcode": 186,
    "instructionAddress": 9672136,
    "expectedSize": 4,
    "text": "LOAD NPC 0c at 21 45"
  },
  {
    "opcode": 186,
    "instructionAddress": 9745396,
    "expectedSize": 4,
    "text": "LOAD NPC 0f at 63 0f"
  },
  {
    "opcode": 186,
    "instructionAddress": 9734455,
    "expectedSize": 4,
    "text": "LOAD NPC 21 at 27 1b"
  },
  {
    "opcode": 186,
    "instructionAddress": 9810059,
    "expectedSize": 4,
    "text": "LOAD NPC 5b at 2b 10"
  },
  {
    "opcode": 186,
    "instructionAddress": 10011818,
    "expectedSize": 4,
    "text": "LOAD NPC 51 at 37 23"
  },
  {
    "opcode": 186,
    "instructionAddress": 10134257,
    "expectedSize": 4,
    "text": "LOAD NPC 56 at 0f 9b"
  },
  {
    "opcode": 186,
    "instructionAddress": 9952677,
    "expectedSize": 4,
    "text": "LOAD NPC 28 at 11 37"
  },
  {
    "opcode": 186,
    "instructionAddress": 9757355,
    "expectedSize": 4,
    "text": "LOAD NPC 09 at 4f 13"
  },
  {
    "opcode": 186,
    "instructionAddress": 10083287,
    "expectedSize": 4,
    "text": "LOAD NPC 32 at 71 65"
  },
  {
    "opcode": 186,
    "instructionAddress": 9822425,
    "expectedSize": 4,
    "text": "LOAD NPC 18 at 15 15"
  }
];

test('opcode corpus 0xba', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
