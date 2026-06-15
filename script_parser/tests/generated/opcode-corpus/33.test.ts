import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 51,
    "instructionAddress": 10013158,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x6a"
  },
  {
    "opcode": 51,
    "instructionAddress": 9819948,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x56"
  },
  {
    "opcode": 51,
    "instructionAddress": 10129581,
    "expectedSize": 7,
    "text": "PLAY MUSIC 0x52"
  },
  {
    "opcode": 51,
    "instructionAddress": 9691385,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x2a"
  },
  {
    "opcode": 51,
    "instructionAddress": 10018457,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x6a"
  },
  {
    "opcode": 51,
    "instructionAddress": 10136357,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x76"
  },
  {
    "opcode": 51,
    "instructionAddress": 9752096,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x8e"
  },
  {
    "opcode": 51,
    "instructionAddress": 10006778,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x72"
  },
  {
    "opcode": 51,
    "instructionAddress": 10069937,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x68"
  },
  {
    "opcode": 51,
    "instructionAddress": 9759623,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x64"
  },
  {
    "opcode": 51,
    "instructionAddress": 9936153,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x5a"
  },
  {
    "opcode": 51,
    "instructionAddress": 9629484,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x00"
  },
  {
    "opcode": 51,
    "instructionAddress": 9823705,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x68"
  },
  {
    "opcode": 51,
    "instructionAddress": 9933026,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x5e"
  },
  {
    "opcode": 51,
    "instructionAddress": 9736917,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x0c"
  },
  {
    "opcode": 51,
    "instructionAddress": 10129497,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x36"
  },
  {
    "opcode": 51,
    "instructionAddress": 10083370,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x6c"
  },
  {
    "opcode": 51,
    "instructionAddress": 9684641,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x14"
  },
  {
    "opcode": 51,
    "instructionAddress": 9818054,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x02"
  },
  {
    "opcode": 51,
    "instructionAddress": 9878917,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x3a"
  },
  {
    "opcode": 51,
    "instructionAddress": 9757226,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x12"
  },
  {
    "opcode": 51,
    "instructionAddress": 9740771,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x5c"
  },
  {
    "opcode": 51,
    "instructionAddress": 9679498,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x0a"
  },
  {
    "opcode": 51,
    "instructionAddress": 9812806,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x3a"
  },
  {
    "opcode": 51,
    "instructionAddress": 10077062,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x68"
  },
  {
    "opcode": 51,
    "instructionAddress": 9932373,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x0c"
  },
  {
    "opcode": 51,
    "instructionAddress": 9668196,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x0a"
  },
  {
    "opcode": 51,
    "instructionAddress": 9877519,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x2e"
  },
  {
    "opcode": 51,
    "instructionAddress": 10013142,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x62"
  },
  {
    "opcode": 51,
    "instructionAddress": 10193152,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x88"
  },
  {
    "opcode": 51,
    "instructionAddress": 10008628,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x56"
  },
  {
    "opcode": 51,
    "instructionAddress": 10205785,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x1c"
  },
  {
    "opcode": 51,
    "instructionAddress": 9887774,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x22"
  },
  {
    "opcode": 51,
    "instructionAddress": 10205648,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x24"
  },
  {
    "opcode": 51,
    "instructionAddress": 9687749,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x04"
  },
  {
    "opcode": 51,
    "instructionAddress": 9824599,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x42"
  },
  {
    "opcode": 51,
    "instructionAddress": 10079528,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x5a"
  },
  {
    "opcode": 51,
    "instructionAddress": 10145745,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x84"
  },
  {
    "opcode": 51,
    "instructionAddress": 9798942,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x3a"
  },
  {
    "opcode": 51,
    "instructionAddress": 10214550,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x8e"
  },
  {
    "opcode": 51,
    "instructionAddress": 10192623,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x0a"
  },
  {
    "opcode": 51,
    "instructionAddress": 9672292,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x7a"
  },
  {
    "opcode": 51,
    "instructionAddress": 9952698,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x46"
  },
  {
    "opcode": 51,
    "instructionAddress": 10146764,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x82"
  },
  {
    "opcode": 51,
    "instructionAddress": 9757207,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x28"
  },
  {
    "opcode": 51,
    "instructionAddress": 9742725,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x26"
  },
  {
    "opcode": 51,
    "instructionAddress": 10001573,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x18"
  },
  {
    "opcode": 51,
    "instructionAddress": 10018478,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x6a"
  },
  {
    "opcode": 51,
    "instructionAddress": 9758923,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x64"
  },
  {
    "opcode": 51,
    "instructionAddress": 9946476,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x84"
  },
  {
    "opcode": 51,
    "instructionAddress": 9938960,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x24"
  },
  {
    "opcode": 51,
    "instructionAddress": 9936158,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x1e"
  },
  {
    "opcode": 51,
    "instructionAddress": 9802832,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x20"
  },
  {
    "opcode": 51,
    "instructionAddress": 10013137,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x6a"
  },
  {
    "opcode": 51,
    "instructionAddress": 9745414,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x86"
  },
  {
    "opcode": 51,
    "instructionAddress": 10145758,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x70"
  },
  {
    "opcode": 51,
    "instructionAddress": 9945381,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x3a"
  },
  {
    "opcode": 51,
    "instructionAddress": 10018462,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x62"
  },
  {
    "opcode": 51,
    "instructionAddress": 9678663,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x46"
  },
  {
    "opcode": 51,
    "instructionAddress": 10126179,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x66"
  },
  {
    "opcode": 51,
    "instructionAddress": 9946489,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x40"
  },
  {
    "opcode": 51,
    "instructionAddress": 9996989,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x82"
  },
  {
    "opcode": 51,
    "instructionAddress": 9822747,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x40"
  },
  {
    "opcode": 51,
    "instructionAddress": 9951698,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x44"
  },
  {
    "opcode": 51,
    "instructionAddress": 9822375,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x8e"
  },
  {
    "opcode": 51,
    "instructionAddress": 9997031,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x82"
  },
  {
    "opcode": 51,
    "instructionAddress": 10142713,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x74"
  },
  {
    "opcode": 51,
    "instructionAddress": 9757221,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x0c"
  },
  {
    "opcode": 51,
    "instructionAddress": 9734553,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x0c"
  },
  {
    "opcode": 51,
    "instructionAddress": 10195766,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x88"
  },
  {
    "opcode": 51,
    "instructionAddress": 9814827,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x2c"
  },
  {
    "opcode": 51,
    "instructionAddress": 10013153,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x62"
  },
  {
    "opcode": 51,
    "instructionAddress": 9733832,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x26"
  },
  {
    "opcode": 51,
    "instructionAddress": 10088093,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x62"
  },
  {
    "opcode": 51,
    "instructionAddress": 10020904,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x6e"
  },
  {
    "opcode": 51,
    "instructionAddress": 9671162,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x0a"
  },
  {
    "opcode": 51,
    "instructionAddress": 10011681,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x62"
  },
  {
    "opcode": 51,
    "instructionAddress": 10125876,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x66"
  },
  {
    "opcode": 51,
    "instructionAddress": 9739148,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x08"
  },
  {
    "opcode": 51,
    "instructionAddress": 9627129,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x52"
  },
  {
    "opcode": 51,
    "instructionAddress": 10006953,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x5c"
  },
  {
    "opcode": 51,
    "instructionAddress": 9998448,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x82"
  },
  {
    "opcode": 51,
    "instructionAddress": 10126395,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x5c"
  },
  {
    "opcode": 51,
    "instructionAddress": 9809946,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x24"
  },
  {
    "opcode": 51,
    "instructionAddress": 10070100,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x46"
  },
  {
    "opcode": 51,
    "instructionAddress": 9687842,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x04"
  },
  {
    "opcode": 51,
    "instructionAddress": 9819199,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x4a"
  },
  {
    "opcode": 51,
    "instructionAddress": 9940837,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x66"
  },
  {
    "opcode": 51,
    "instructionAddress": 9808487,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x20"
  },
  {
    "opcode": 51,
    "instructionAddress": 10140968,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x6e"
  },
  {
    "opcode": 51,
    "instructionAddress": 9758245,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x12"
  },
  {
    "opcode": 51,
    "instructionAddress": 10087740,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x54"
  },
  {
    "opcode": 51,
    "instructionAddress": 9885238,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x4a"
  },
  {
    "opcode": 51,
    "instructionAddress": 9742720,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x5c"
  },
  {
    "opcode": 51,
    "instructionAddress": 9883583,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x40"
  },
  {
    "opcode": 51,
    "instructionAddress": 9997116,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x82"
  },
  {
    "opcode": 51,
    "instructionAddress": 9758671,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x26"
  },
  {
    "opcode": 51,
    "instructionAddress": 10063159,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x70"
  },
  {
    "opcode": 51,
    "instructionAddress": 10205515,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x3c"
  },
  {
    "opcode": 51,
    "instructionAddress": 10198868,
    "expectedSize": 2,
    "text": "PLAY MUSIC 0x88"
  }
];

test('opcode corpus 0x33', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
