import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 8,
    "instructionAddress": 9672233,
    "expectedSize": 6,
    "text": "IF $225e&0x20 (Checked in North Jungle) SKIP 10 (to 0x939639)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10129180,
    "expectedSize": 8,
    "text": "IF RAND & 0x7f THEN SKIP 65 (to 0x9a8f65)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9626248,
    "expectedSize": 15,
    "text": "IF signed arg26 & 1 THEN SKIP 14 (to 0x92e29e)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9818030,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x95cfbc)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9758207,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x94e60d)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9757847,
    "expectedSize": 6,
    "text": "IF $228b&0x01 (FE visited pre-thraxx (East exit check)) SKIP 7 (to 0x94e4a4)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9745167,
    "expectedSize": 6,
    "text": "IF $226a&0x80 SKIP 6 (to 0x94b31b)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9745434,
    "expectedSize": 6,
    "text": "IF $225f&0x10 (Pipe Maze Raptor shown?) SKIP 157 (to 0x94b4bd)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9804532,
    "expectedSize": 6,
    "text": "IF $22e3&0x40 (Unknown flag checked out and inside 'mids. Dog freed?) SKIP 74 (to 0x959b44)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9688089,
    "expectedSize": 6,
    "text": "IF $2859 THEN SKIP 17 (to 0x93d430)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9996590,
    "expectedSize": 10,
    "text": "IF (($234b)&0xff) == 0x64 THEN SKIP 10 (to 0x988942)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9822386,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x95e0c0)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10125870,
    "expectedSize": 6,
    "text": "IF $22dd&0x01 (Verminator dead) SKIP 5 (to 0x9a8239)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9822797,
    "expectedSize": 6,
    "text": "IF $225f&0x20 (Vigor defeated) SKIP 123 (to 0x95e2ce)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9625935,
    "expectedSize": 6,
    "text": "IF $22ea&0x20 SKIP 59 (to 0x92e190)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10079731,
    "expectedSize": 6,
    "text": "IF $22dd&0x04 (Timberdrake dead) SKIP 23 (to 0x99ce10)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9744914,
    "expectedSize": 6,
    "text": "IF $225f&0x10 (Pipe Maze Raptor shown?) SKIP 18 (to 0x94b22a)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10129253,
    "expectedSize": 8,
    "text": "IF RAND & 0xff THEN SKIP 30 (to 0x9a8f8b)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9798727,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x958455)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9745230,
    "expectedSize": 6,
    "text": "IF $226a&0x20 SKIP 6 (to 0x94b35a)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9688043,
    "expectedSize": 6,
    "text": "IF $2855 THEN SKIP 17 (to 0x93d402)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9745015,
    "expectedSize": 6,
    "text": "IF $226a&0x04 SKIP 6 (to 0x94b283)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9752627,
    "expectedSize": 6,
    "text": "IF $245f != 0x00 SKIP 18 (to 0x94d04b)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9738777,
    "expectedSize": 6,
    "text": "IF $225d&0x80 (Some Volcano Room2 flag?) SKIP 30 (to 0x949a3d)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9680842,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x93b7d8)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9822626,
    "expectedSize": 6,
    "text": "IF $22f2&0x01 (In credits) SKIP 30 (to 0x95e1c6)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9667821,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 3 (to 0x9384f6)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10082763,
    "expectedSize": 6,
    "text": "IF $22e6&0x01 (Footknight defeated) SKIP 4 (to 0x99d9d5)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9743589,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x94acf3)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9747928,
    "expectedSize": 6,
    "text": "IF $2260&0x20 (Magmar fight started?) SKIP 6 (to 0x94bde4)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9808108,
    "expectedSize": 6,
    "text": "IF $22e3&0x01 (Unknown flag checked below 'mids. Levitated?) SKIP 10 (to 0x95a8fc)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9745131,
    "expectedSize": 6,
    "text": "IF $226a&0x10 SKIP 6 (to 0x94b2f7)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9670960,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x93913e)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9688112,
    "expectedSize": 6,
    "text": "IF $285b THEN SKIP 17 (to 0x93d447)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9738696,
    "expectedSize": 6,
    "text": "IF $225e&0x04 (Volcano Room2 Flag) SKIP 10 (to 0x9499d8)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9683650,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x93c2d0)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9810733,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x95b33b)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10190889,
    "expectedSize": 6,
    "text": "IF $22e6&0x08 SKIP 4 (to 0x9b8033)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9625814,
    "expectedSize": 6,
    "text": "IF $22eb&0x02 (start pressed in intro) SKIP 712 (to 0x92e3a4)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9819170,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 4 (to 0x95d42c)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9668034,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x9385d0)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9738750,
    "expectedSize": 6,
    "text": "IF $225e&0x10 (Volcano Room2/ Flag) SKIP 10 (to 0x949a0e)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9819210,
    "expectedSize": 6,
    "text": "IF $22dc&0x08 (windwalker unlocked) SKIP 151 (to 0x95d4e7)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9745307,
    "expectedSize": 6,
    "text": "IF $226a&0x40 SKIP 6 (to 0x94b3a7)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10128745,
    "expectedSize": 8,
    "text": "IF RAND & 0xff THEN SKIP 30 (to 0x9a8d8f)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9816773,
    "expectedSize": 6,
    "text": "IF $225d&0x08 (Market timer expired) SKIP 113 (to 0x95cb3c)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9668021,
    "expectedSize": 6,
    "text": "IF $22ab&0x40 SKIP 7 (to 0x9385c2)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9877631,
    "expectedSize": 6,
    "text": "IF $2261&0x01 (Dog unavailable) SKIP 1 (to 0x96b886)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9742242,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x94a7b0)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9752065,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 13 (to 0x94ce14)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9738855,
    "expectedSize": 6,
    "text": "IF $225e&0x02 (Volcano Room2 Flag) SKIP 30 (to 0x949a8b)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10129129,
    "expectedSize": 8,
    "text": "IF RAND & 0xff THEN SKIP 36 (to 0x9a8f15)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9819216,
    "expectedSize": 6,
    "text": "IF $225f&0x20 (Vigor defeated) SKIP 32 (to 0x95d476)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9736214,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x949024)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9678007,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x93acc5)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9758081,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x94e58f)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9691163,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x93e029)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10079516,
    "expectedSize": 6,
    "text": "IF $22df&0x01 (Doubles dead) SKIP 114 (to 0x99cd94)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9679276,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x93b1ba)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9816974,
    "expectedSize": 6,
    "text": "IF $225d&0x08 (Market timer expired) SKIP 5 (to 0x95cb99)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9738723,
    "expectedSize": 6,
    "text": "IF $225e&0x08 (Volcano Room2 Flag) SKIP 10 (to 0x9499f3)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9626795,
    "expectedSize": 6,
    "text": "IF $22ea&0x04 (No previous save found) SKIP 12 (to 0x92e4bd)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9816695,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x95ca85)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10214630,
    "expectedSize": 6,
    "text": "IF $22f1&0x80 SKIP 135 (to 0x9bdd73)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9814392,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x95c186)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9878744,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x96bce6)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10128729,
    "expectedSize": 13,
    "text": "IF ($2839 will die) || ($283b will die) THEN SKIP 3 (to 0x9a8d69)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9883368,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x96cef6)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9678598,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x93af14)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9822414,
    "expectedSize": 11,
    "text": "IF ($225d&0x08) || ($22f2&0x01) THEN SKIP 51 (to 0x95e10c)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9816842,
    "expectedSize": 11,
    "text": "IF ($22d9&0x08) || ($22df&0x10) THEN SKIP 39 (to 0x95cb3c)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9802853,
    "expectedSize": 6,
    "text": "IF $22e3&0x40 (Unknown flag checked out and inside 'mids. Dog freed?) SKIP 70 (to 0x9594b1)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9740237,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 12 (to 0x949fdf)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9823498,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x95e518)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9745182,
    "expectedSize": 6,
    "text": "IF $226a&0x08 SKIP 6 (to 0x94b32a)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9952608,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x97dd6e)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9887788,
    "expectedSize": 11,
    "text": "IF ($22d8&0x80) && ($22d8&0x40) THEN SKIP 21 (to 0x96e04c)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10194201,
    "expectedSize": 6,
    "text": "IF $22e6&0x20 (Light in storage room) SKIP 18 (to 0x9b8d31)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9758886,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x94e8b4)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9937815,
    "expectedSize": 6,
    "text": "IF $22db&0x04 (Bronze Spear) SKIP 15 (to 0x97a3ac)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9684448,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x93c5ee)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9822352,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 9 (to 0x95e09f)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9745331,
    "expectedSize": 6,
    "text": "IF $226a&0x40 SKIP 6 (to 0x94b3bf)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10195774,
    "expectedSize": 6,
    "text": "IF $22e7&0x01 SKIP 22 (to 0x9b935a)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9944748,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x97beba)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9738816,
    "expectedSize": 6,
    "text": "IF $225e&0x01 (Volcano Room2 Flag) SKIP 30 (to 0x949a64)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10142731,
    "expectedSize": 6,
    "text": "IF $22de&0x10 SKIP 7 (to 0x9ac418)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10191077,
    "expectedSize": 6,
    "text": "IF $22f8&0x80 SKIP 17 (to 0x9b80fc)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9752204,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x94ce9a)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9672260,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x939652)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10129137,
    "expectedSize": 7,
    "text": "IF RAND & 3 THEN SKIP 13 (to 0x9a8f05)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9887589,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x96df73)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9744896,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x94b20e)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9798771,
    "expectedSize": 6,
    "text": "IF $22ed&0x08 (crustacia intro to be shown) SKIP 8 (to 0x958481)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9752464,
    "expectedSize": 6,
    "text": "IF $228b&0x01 (FE visited pre-thraxx (East exit check)) SKIP 33 (to 0x94cfb7)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10142757,
    "expectedSize": 6,
    "text": "IF $22de&0x20 SKIP 7 (to 0x9ac432)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9739124,
    "expectedSize": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x949b82)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9810767,
    "expectedSize": 6,
    "text": "IF $225f&0x01 (Doggo palace cutscene watched) SKIP 8 (to 0x95b35d)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10001600,
    "expectedSize": 6,
    "text": "IF $22de&0x04 (Queen cutscene below chessboard watched) SKIP 10 (to 0x989cd0)"
  },
  {
    "opcode": 8,
    "instructionAddress": 10128656,
    "expectedSize": 13,
    "text": "IF ($2839 will die) || ($283b will die) THEN SKIP 3 (to 0x9a8d20)"
  }
];

test('opcode corpus 0x08', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
