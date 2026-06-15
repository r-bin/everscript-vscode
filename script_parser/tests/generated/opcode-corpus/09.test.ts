import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 9,
    "instructionAddress": 9752577,
    "expectedSize": 6,
    "text": "IF !($2292&0x10) NOT(Sniffed Ash in Fire Eyes' Village (#20)) SKIP 9 (to 0x94d010)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9937836,
    "expectedSize": 6,
    "text": "IF !($22ee&0x01) NOT(unknown intro/outro? flag in prof. lab) SKIP 22 (to 0x97a3c8)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10018802,
    "expectedSize": 9,
    "text": "IF ((($234b)&0xff) == 5) == FALSE THEN SKIP 192 (to 0x98e0bb)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10194910,
    "expectedSize": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x9b8fe8)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9877502,
    "expectedSize": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 15 (to 0x96b813)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9810154,
    "expectedSize": 6,
    "text": "IF ($2834&0x80) == FALSE THEN SKIP 76 (to 0x95b13c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9759617,
    "expectedSize": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x94eb8b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9740380,
    "expectedSize": 9,
    "text": "IF ((($234b)&0xff) == 5) == FALSE THEN SKIP 17 (to 0x94a076)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9951692,
    "expectedSize": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x97d9d6)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10192321,
    "expectedSize": 7,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x9b85d0)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9742603,
    "expectedSize": 7,
    "text": "IF $22df&0x80 (Cave raptors killed) SKIP 30 (to 0x94a930)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9742753,
    "expectedSize": 15,
    "text": "IF (((($234d)&0xff) == 2) && (!($225a&0x02))) == FALSE THEN SKIP 4 (to 0x94a9b4)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757324,
    "expectedSize": 9,
    "text": "IF ((($234b)&0xff) == 3) == FALSE THEN SKIP 65 (to 0x94e2d6)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9679513,
    "expectedSize": 12,
    "text": "IF !($22eb&0x04) NOT(running showcase) SKIP 67 (to 0x93b2e2)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9887782,
    "expectedSize": 6,
    "text": "IF !($22ed&0x80) NOT(Falling into a pit) SKIP 93 (to 0x96e089)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9691379,
    "expectedSize": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x93e0fd)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9745116,
    "expectedSize": 9,
    "text": "IF ($24c3 == 4) == FALSE THEN SKIP 33 (to 0x94b306)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9936118,
    "expectedSize": 7,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x979d05)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9681270,
    "expectedSize": 6,
    "text": "IF !($2260&0x10) NOT(Thraxx dead) SKIP 24 (to 0x93b994)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9687743,
    "expectedSize": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x93d2c9)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9814778,
    "expectedSize": 9,
    "text": "IF ((($234c)&0xff) == 5) == FALSE THEN SKIP 25 (to 0x95c31c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10001540,
    "expectedSize": 7,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x989c93)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9752425,
    "expectedSize": 7,
    "text": "IF $22dc&0x08 (windwalker unlocked) SKIP 28 (to 0x94cf8c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10063084,
    "expectedSize": 6,
    "text": "IF !($22ef&0x08) SKIP 38 (to 0x998d18)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9683866,
    "expectedSize": 6,
    "text": "IF !($2289&0x10) SKIP 6 (to 0x93c3a6)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9740536,
    "expectedSize": 9,
    "text": "IF ((($234b)&0xff) == 11) == FALSE THEN SKIP 14 (to 0x94a10f)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9814485,
    "expectedSize": 12,
    "text": "IF (!(($2261&0x01) || (($2350)&0xff))) == FALSE THEN SKIP 6 (to 0x95c1e7)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9955382,
    "expectedSize": 7,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x97e845)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10195681,
    "expectedSize": 7,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x9b92f0)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9802603,
    "expectedSize": 7,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x95937a)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9752059,
    "expectedSize": 6,
    "text": "IF !($22eb&0x08) NOT(debug) SKIP 19 (to 0x94ce14)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9948378,
    "expectedSize": 6,
    "text": "IF !($2261&0x01) NOT(Dog unavailable) SKIP 10 (to 0x97ccea)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9887743,
    "expectedSize": 6,
    "text": "IF !($22ee&0x01) NOT(unknown intro/outro? flag in prof. lab) SKIP 19 (to 0x96e018)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10006606,
    "expectedSize": 11,
    "text": "IF (($22dd&0x40) && ($22dd&0x01)) == FALSE THEN SKIP 4 (to 0x98b05d)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9687611,
    "expectedSize": 12,
    "text": "IF (($2260&0x10) && (!($22dc&0x08))) == FALSE THEN SKIP 19 (to 0x93d25a)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9736869,
    "expectedSize": 6,
    "text": "IF !($22b2&0x20) SKIP 15 (to 0x9492ba)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757198,
    "expectedSize": 9,
    "text": "IF ((($234b)&0xff) == 7) == FALSE THEN SKIP 5 (to 0x94e21c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10022879,
    "expectedSize": 7,
    "text": "IF $22df&0x40 SKIP 23 (to 0x98effd)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9736822,
    "expectedSize": 6,
    "text": "IF !($22b2&0x08) SKIP 20 (to 0x949290)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10190899,
    "expectedSize": 6,
    "text": "IF !($22e6&0x10) SKIP 126 (to 0x9b80b7)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9687586,
    "expectedSize": 7,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x93d231)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9687756,
    "expectedSize": 12,
    "text": "IF ((!($22e8&0x40)) && ($22dc&0x08)) == FALSE THEN SKIP 78 (to 0x93d326)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9679492,
    "expectedSize": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x93b28e)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10138464,
    "expectedSize": 6,
    "text": "IF !($22f2&0x01) NOT(In credits) SKIP 3 (to 0x9ab369)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757398,
    "expectedSize": 9,
    "text": "IF ((($234b)&0xff) == 4) == FALSE THEN SKIP 43 (to 0x94e30a)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9626911,
    "expectedSize": 9,
    "text": "IF ($2834 < 16) == FALSE THEN SKIP 17 (to 0x92e539)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757780,
    "expectedSize": 14,
    "text": "IF (($22ed&0x04) && ((($234b)&0xff) == 3)) == FALSE THEN SKIP 6 (to 0x94e468)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9951706,
    "expectedSize": 6,
    "text": "IF !($22f4&0x01) SKIP 32 (to 0x97da00)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9736734,
    "expectedSize": 6,
    "text": "IF !($22b2&0x02) SKIP 56 (to 0x94925c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10142707,
    "expectedSize": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x9ac3fd)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757567,
    "expectedSize": 12,
    "text": "IF (($2260&0x10) && (!($225f&0x80))) == FALSE THEN SKIP 31 (to 0x94e3aa)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10011664,
    "expectedSize": 6,
    "text": "IF !($22dd&0x40) NOT(Load east castle) SKIP 16 (to 0x98c426)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10082725,
    "expectedSize": 6,
    "text": "IF !($22dd&0x40) NOT(Load east castle) SKIP 6 (to 0x99d9b1)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757212,
    "expectedSize": 9,
    "text": "IF ((($234b)&0xff) == 9) == FALSE THEN SKIP 5 (to 0x94e22a)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10134234,
    "expectedSize": 7,
    "text": "IF $22dc&0x01 (Pigrace finished) SKIP 40 (to 0x9aa309)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9936141,
    "expectedSize": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 15 (to 0x979d22)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10013307,
    "expectedSize": 7,
    "text": "IF $22dc&0x08 (windwalker unlocked) SKIP 81 (to 0x98cad3)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10012043,
    "expectedSize": 6,
    "text": "IF !($22eb&0x40) SKIP 93 (to 0x98c5ee)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9685214,
    "expectedSize": 11,
    "text": "IF ($283f >= $2841) == FALSE THEN SKIP 4 (to 0x93c8ed)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10128431,
    "expectedSize": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 15 (to 0x9a8c44)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9742516,
    "expectedSize": 9,
    "text": "IF ((($234d)&0xff) == 3) == FALSE THEN SKIP 17 (to 0x94a8ce)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9812814,
    "expectedSize": 11,
    "text": "IF (($22df&0x10) && ($22df&0x20)) == FALSE THEN SKIP 3 (to 0x95bb5c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757230,
    "expectedSize": 9,
    "text": "IF ((($234b)&0xff) == 1) == FALSE THEN SKIP 39 (to 0x94e25e)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9736848,
    "expectedSize": 6,
    "text": "IF !($22b2&0x10) SKIP 15 (to 0x9492a5)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9759523,
    "expectedSize": 7,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x94eb32)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9688014,
    "expectedSize": 14,
    "text": "IF (($2260&0x08) && ($285d < 2)) == FALSE THEN SKIP 122 (to 0x93d456)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10019141,
    "expectedSize": 6,
    "text": "IF !($22ec&0x10) SKIP 73 (to 0x98e194)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9996577,
    "expectedSize": 10,
    "text": "IF ((($234b)&0xff) == 0x60) == FALSE THEN SKIP 3 (to 0x98892e)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10011686,
    "expectedSize": 6,
    "text": "IF !($22dc&0x08) NOT(windwalker unlocked) SKIP 5 (to 0x98c431)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9742492,
    "expectedSize": 7,
    "text": "IF $225a&0x02 (Hard Ball) SKIP 14 (to 0x94a8b1)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9687850,
    "expectedSize": 13,
    "text": "IF !($22eb&0x04) NOT(running showcase) SKIP 131 (to 0x93d3b3)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10019112,
    "expectedSize": 6,
    "text": "IF !($22dd&0x40) NOT(Load east castle) SKIP 7 (to 0x98e135)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10128398,
    "expectedSize": 7,
    "text": "IF $22eb&0x20 (in animation) SKIP 18 (to 0x9a8c27)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9743673,
    "expectedSize": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x94ad43)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9734547,
    "expectedSize": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x94899d)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9824593,
    "expectedSize": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x95e95b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9996600,
    "expectedSize": 6,
    "text": "IF !($2261&0x02) NOT(Boy unavailable) SKIP 4 (to 0x988942)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10079522,
    "expectedSize": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x99cd2c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9734442,
    "expectedSize": 6,
    "text": "IF !($22dc&0x08) NOT(windwalker unlocked) SKIP 7 (to 0x948937)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10076998,
    "expectedSize": 10,
    "text": "IF ($24f7 == 0xa9) == FALSE THEN SKIP 19 (to 0x99c363)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9740756,
    "expectedSize": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 18 (to 0x94a1ec)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10019234,
    "expectedSize": 11,
    "text": "IF (($22dd&0x40) == ($22dc&0x08)) == FALSE THEN SKIP 16 (to 0x98e1bd)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10079712,
    "expectedSize": 7,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x99cdef)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10060577,
    "expectedSize": 7,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x998330)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9822926,
    "expectedSize": 6,
    "text": "IF !($22eb&0x40) SKIP 81 (to 0x95e325)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9752563,
    "expectedSize": 14,
    "text": "IF ((GameTimer&0xffff) <= ($254f + 0x0258)) == FALSE THEN SKIP 18 (to 0x94d013)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9740484,
    "expectedSize": 9,
    "text": "IF ((($234b)&0xff) == 9) == FALSE THEN SKIP 17 (to 0x94a0de)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9744958,
    "expectedSize": 9,
    "text": "IF ($24c3 == 5) == FALSE THEN SKIP 7 (to 0x94b24e)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9946775,
    "expectedSize": 6,
    "text": "IF !($22f1&0x40) NOT(Inside outro?) SKIP 91 (to 0x97c6f8)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10001577,
    "expectedSize": 6,
    "text": "IF !($22ee&0x80) SKIP 3 (to 0x989cb2)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9747859,
    "expectedSize": 13,
    "text": "IF !($22eb&0x04) NOT(running showcase) SKIP 41 (to 0x94bdc2)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9883737,
    "expectedSize": 17,
    "text": "IF ((($22e3&0x40) && ($22d8&0x40)) && (!($22e4&0x02))) == FALSE THEN SKIP 7 (to 0x96d071)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9668208,
    "expectedSize": 12,
    "text": "IF !($22eb&0x04) NOT(running showcase) SKIP 48 (to 0x9386a6)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10013395,
    "expectedSize": 11,
    "text": "IF (($22dd&0x40) != ($22dc&0x08)) == FALSE THEN SKIP 8 (to 0x98cae6)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757860,
    "expectedSize": 9,
    "text": "IF ((($234b)&0xff) == 9) == FALSE THEN SKIP 13 (to 0x94e4ba)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10129373,
    "expectedSize": 8,
    "text": "IF (signed arg6 < 4) == FALSE THEN SKIP 11 (to 0x9a8ff0)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9687672,
    "expectedSize": 7,
    "text": "IF $2260&0x10 (Thraxx dead) SKIP 77 (to 0x93d2cc)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9738894,
    "expectedSize": 6,
    "text": "IF !($22dc&0x08) NOT(windwalker unlocked) SKIP 7 (to 0x949a9b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9667801,
    "expectedSize": 6,
    "text": "IF !($22f1&0x40) NOT(Inside outro?) SKIP 29 (to 0x9384fc)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10145723,
    "expectedSize": 6,
    "text": "IF !($22eb&0x08) NOT(debug) SKIP 8 (to 0x9acfc9)"
  }
];

test('opcode corpus 0x09', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
