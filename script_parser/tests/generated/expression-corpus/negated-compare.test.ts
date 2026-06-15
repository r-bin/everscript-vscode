import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SAMPLES = [
  {
    "opcode": 9,
    "instructionAddress": 9948042,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f1&0x40) NOT(Inside outro?) SKIP 7 (to 0x97cb97)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9816861,
    "expectedBytesConsumed": 6,
    "text": "IF !($22df&0x08) SKIP 25 (to 0x95cb3c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10191031,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f9&0x02) SKIP 3 (to 0x9b80c0)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9804598,
    "expectedBytesConsumed": 6,
    "text": "IF !($22e5&0x04) NOT(Unknown 'mids flag) SKIP 8 (to 0x959b44)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10192362,
    "expectedBytesConsumed": 6,
    "text": "IF !($22e6&0x40) SKIP 4 (to 0x9b85f4)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9824619,
    "expectedBytesConsumed": 6,
    "text": "IF !($2261&0x01) NOT(Dog unavailable) SKIP 10 (to 0x95e97b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9934049,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f3&0x80) SKIP 10 (to 0x9794f1)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9733287,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dc&0x08) NOT(windwalker unlocked) SKIP 3 (to 0x9484b0)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9752615,
    "expectedBytesConsumed": 12,
    "text": "IF (($2260&0x10) && (!($225f&0x80))) == FALSE THEN SKIP 24 (to 0x94d04b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9945566,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dc&0x08) NOT(windwalker unlocked) SKIP 49 (to 0x97c215)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9819956,
    "expectedBytesConsumed": 6,
    "text": "IF !($2261&0x01) NOT(Dog unavailable) SKIP 8 (to 0x95d742)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9683999,
    "expectedBytesConsumed": 12,
    "text": "IF !($22eb&0x04) NOT(running showcase) SKIP 34 (to 0x93c447)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9937616,
    "expectedBytesConsumed": 6,
    "text": "IF !($2259&0x20) NOT(Fireball) SKIP 14 (to 0x97a2e4)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9742652,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ee&0x01) NOT(unknown intro/outro? flag in prof. lab) SKIP 11 (to 0x94a94d)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10020908,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dc&0x08) NOT(windwalker unlocked) SKIP 4 (to 0x98e836)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10018881,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ee&0x01) NOT(unknown intro/outro? flag in prof. lab) SKIP 20 (to 0x98e05b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9742551,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ee&0x01) NOT(unknown intro/outro? flag in prof. lab) SKIP 11 (to 0x94a8e8)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10136365,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f5&0x20) SKIP 42 (to 0x9aab5d)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10011664,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dd&0x40) NOT(Load east castle) SKIP 16 (to 0x98c426)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9877536,
    "expectedBytesConsumed": 6,
    "text": "IF !($2261&0x01) NOT(Dog unavailable) SKIP 10 (to 0x96b830)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10192632,
    "expectedBytesConsumed": 7,
    "text": "IF !($22f8&0x04) SKIP 12 (to 0x9b870a)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10138464,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f2&0x01) NOT(In credits) SKIP 3 (to 0x9ab369)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757813,
    "expectedBytesConsumed": 12,
    "text": "IF (($2260&0x10) && (!($225f&0x80))) == FALSE THEN SKIP 22 (to 0x94e497)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9804561,
    "expectedBytesConsumed": 6,
    "text": "IF !($22e5&0x02) NOT(Unknown 'mids flag) SKIP 8 (to 0x959b1f)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9742753,
    "expectedBytesConsumed": 15,
    "text": "IF (((($234d)&0xff) == 2) && (!($225a&0x02))) == FALSE THEN SKIP 4 (to 0x94a9b4)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10064768,
    "expectedBytesConsumed": 6,
    "text": "IF !($22eb&0x08) NOT(debug) SKIP 4 (to 0x99938a)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9687850,
    "expectedBytesConsumed": 13,
    "text": "IF !($22eb&0x04) NOT(running showcase) SKIP 131 (to 0x93d3b3)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10013125,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dd&0x40) NOT(Load east castle) SKIP 16 (to 0x98c9db)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9679294,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f2&0x01) NOT(In credits) SKIP 2 (to 0x93b1c6)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9883658,
    "expectedBytesConsumed": 6,
    "text": "IF !($22e5&0x02) NOT(Unknown 'mids flag) SKIP 8 (to 0x96d018)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9948022,
    "expectedBytesConsumed": 6,
    "text": "IF !($22eb&0x08) NOT(debug) SKIP 8 (to 0x97cb84)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9736869,
    "expectedBytesConsumed": 6,
    "text": "IF !($22b2&0x20) SKIP 15 (to 0x9492ba)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10022815,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dc&0x08) NOT(windwalker unlocked) SKIP 4 (to 0x98efa9)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10195917,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f9&0x40) SKIP 5 (to 0x9b93d8)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9887703,
    "expectedBytesConsumed": 12,
    "text": "IF (($22d9&0x01) && (!($22d9&0x08))) == FALSE THEN SKIP 14 (to 0x96dff1)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10018532,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dd&0x40) NOT(Load east castle) SKIP 11 (to 0x98def5)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9948427,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f1&0x40) NOT(Inside outro?) SKIP 84 (to 0x97cd65)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9736822,
    "expectedBytesConsumed": 6,
    "text": "IF !($22b2&0x08) SKIP 20 (to 0x949290)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9948378,
    "expectedBytesConsumed": 6,
    "text": "IF !($2261&0x01) NOT(Dog unavailable) SKIP 10 (to 0x97ccea)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9740259,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ee&0x01) NOT(unknown intro/outro? flag in prof. lab) SKIP 11 (to 0x949ff4)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9683816,
    "expectedBytesConsumed": 12,
    "text": "IF (($22dc&0x08) && (!($22e9&0x04))) == FALSE THEN SKIP 6 (to 0x93c37a)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9679482,
    "expectedBytesConsumed": 6,
    "text": "IF !($2260&0x10) NOT(Thraxx dead) SKIP 4 (to 0x93b284)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10192654,
    "expectedBytesConsumed": 6,
    "text": "IF !($22eb&0x08) NOT(debug) SKIP 9 (to 0x9b871d)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10192372,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f8&0x08) SKIP 4 (to 0x9b85fe)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9819350,
    "expectedBytesConsumed": 6,
    "text": "IF !($225f&0x20) NOT(Vigor defeated) SKIP 6 (to 0x95d4e2)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9883635,
    "expectedBytesConsumed": 9,
    "text": "IF ((($2357)&0xff) != 0) == FALSE THEN SKIP 10 (to 0x96d006)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9798936,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ed&0x08) NOT(crustacia intro to be shown) SKIP 5 (to 0x958523)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9948256,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dc&0x08) NOT(windwalker unlocked) SKIP 116 (to 0x97ccda)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9997019,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dc&0x02) SKIP 35 (to 0x988b04)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9822755,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f2&0x01) NOT(In credits) SKIP 3 (to 0x95e22c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10064785,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f1&0x40) NOT(Inside outro?) SKIP 16 (to 0x9993a7)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10194928,
    "expectedBytesConsumed": 7,
    "text": "IF !($22f8&0x04) SKIP 10 (to 0x9b9000)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9880571,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f1&0x40) NOT(Inside outro?) SKIP 7 (to 0x96c408)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9887782,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ed&0x80) NOT(Falling into a pit) SKIP 93 (to 0x96e089)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9739104,
    "expectedBytesConsumed": 6,
    "text": "IF !($225e&0x40) NOT(Volcano - Viper commander spawn?) SKIP 14 (to 0x949b74)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9946454,
    "expectedBytesConsumed": 6,
    "text": "IF !($22eb&0x08) NOT(debug) SKIP 8 (to 0x97c564)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9681270,
    "expectedBytesConsumed": 6,
    "text": "IF !($2260&0x10) NOT(Thraxx dead) SKIP 24 (to 0x93b994)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9887743,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ee&0x01) NOT(unknown intro/outro? flag in prof. lab) SKIP 19 (to 0x96e018)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9679513,
    "expectedBytesConsumed": 12,
    "text": "IF !($22eb&0x04) NOT(running showcase) SKIP 67 (to 0x93b2e2)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10079770,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dd&0x04) NOT(Timberdrake dead) SKIP 7 (to 0x99ce27)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9798804,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ed&0x08) NOT(crustacia intro to be shown) SKIP 4 (to 0x95849e)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10214836,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ec&0x20) NOT(unknown intro/outro? flag in prof. lab) SKIP 4 (to 0x9bddbe)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9738894,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dc&0x08) NOT(windwalker unlocked) SKIP 7 (to 0x949a9b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10125895,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dd&0x01) NOT(Verminator dead) SKIP 4 (to 0x9a8251)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9996600,
    "expectedBytesConsumed": 6,
    "text": "IF !($2261&0x02) NOT(Boy unavailable) SKIP 4 (to 0x988942)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9883718,
    "expectedBytesConsumed": 6,
    "text": "IF !($22e4&0x10) SKIP 3 (to 0x96d04f)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9752195,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f2&0x01) NOT(In credits) SKIP 3 (to 0x94ce8c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10019355,
    "expectedBytesConsumed": 6,
    "text": "IF !($227b&0x40) SKIP 6 (to 0x98e227)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9946775,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f1&0x40) NOT(Inside outro?) SKIP 91 (to 0x97c6f8)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9802896,
    "expectedBytesConsumed": 9,
    "text": "IF ((($2358)&0xff) != 1) == FALSE THEN SKIP 10 (to 0x9594a3)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10205758,
    "expectedBytesConsumed": 6,
    "text": "IF !($22e6&0x04) SKIP 7 (to 0x9bba4b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9818094,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ee&0x01) NOT(unknown intro/outro? flag in prof. lab) SKIP 30 (to 0x95d012)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9810190,
    "expectedBytesConsumed": 17,
    "text": "IF (($2835 > $284b) && (!($22d8&0x40))) == FALSE THEN SKIP 7 (to 0x95b126)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10083263,
    "expectedBytesConsumed": 6,
    "text": "IF !($22eb&0x04) NOT(running showcase) SKIP 8 (to 0x99dbcd)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9946638,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dc&0x08) NOT(windwalker unlocked) SKIP 111 (to 0x97c683)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9814469,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ee&0x01) NOT(unknown intro/outro? flag in prof. lab) SKIP 28 (to 0x95c1e7)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10013270,
    "expectedBytesConsumed": 6,
    "text": "IF !($22de&0x02) SKIP 4 (to 0x98ca60)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9687756,
    "expectedBytesConsumed": 12,
    "text": "IF ((!($22e8&0x40)) && ($22dc&0x08)) == FALSE THEN SKIP 78 (to 0x93d326)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10018610,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dd&0x40) NOT(Load east castle) SKIP 11 (to 0x98df43)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10018774,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dd&0x40) NOT(Load east castle) SKIP 11 (to 0x98dfe7)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10214559,
    "expectedBytesConsumed": 6,
    "text": "IF !($2287&0x20) NOT(Opened Laser Lance Gourd) SKIP 4 (to 0x9bdca9)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10006684,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dd&0x40) NOT(Load east castle) SKIP 20 (to 0x98b0b6)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10013414,
    "expectedBytesConsumed": 6,
    "text": "IF !($22eb&0x40) SKIP 119 (to 0x98cb63)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9946716,
    "expectedBytesConsumed": 6,
    "text": "IF !($22e5&0x08) NOT(WW Landing (set before loading fire pit from OW)) SKIP 33 (to 0x97c683)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10063193,
    "expectedBytesConsumed": 7,
    "text": "IF (!(($2356)&0xff)) == FALSE THEN SKIP 26 (to 0x998d7a)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9937836,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ee&0x01) NOT(unknown intro/outro? flag in prof. lab) SKIP 22 (to 0x97a3c8)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9878949,
    "expectedBytesConsumed": 6,
    "text": "IF !($2261&0x01) NOT(Dog unavailable) SKIP 8 (to 0x96bdb3)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9802622,
    "expectedBytesConsumed": 6,
    "text": "IF !($22e3&0x40) NOT(Unknown flag checked out and inside 'mids. Dog freed?) SKIP 32 (to 0x9593a4)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9745357,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ee&0x01) NOT(unknown intro/outro? flag in prof. lab) SKIP 21 (to 0x94b3e8)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9948437,
    "expectedBytesConsumed": 6,
    "text": "IF !($22e5&0x08) NOT(WW Landing (set before loading fire pit from OW)) SKIP 16 (to 0x97cd2b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9752059,
    "expectedBytesConsumed": 6,
    "text": "IF !($22eb&0x08) NOT(debug) SKIP 19 (to 0x94ce14)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10019192,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dd&0x40) NOT(Load east castle) SKIP 11 (to 0x98e189)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9946797,
    "expectedBytesConsumed": 6,
    "text": "IF !($22e5&0x08) NOT(WW Landing (set before loading fire pit from OW)) SKIP 16 (to 0x97c6c3)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10012043,
    "expectedBytesConsumed": 6,
    "text": "IF !($22eb&0x40) SKIP 93 (to 0x98c5ee)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9683866,
    "expectedBytesConsumed": 6,
    "text": "IF !($2289&0x10) SKIP 6 (to 0x93c3a6)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9945509,
    "expectedBytesConsumed": 6,
    "text": "IF !($22e5&0x08) NOT(WW Landing (set before loading fire pit from OW)) SKIP 31 (to 0x97c1ca)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9877606,
    "expectedBytesConsumed": 12,
    "text": "IF (($225d&0x08) && (!($22ef&0x02))) == FALSE THEN SKIP 12 (to 0x96b87e)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10198931,
    "expectedBytesConsumed": 7,
    "text": "IF !($22f8&0x04) SKIP 10 (to 0x9b9fa3)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9736734,
    "expectedBytesConsumed": 6,
    "text": "IF !($22b2&0x02) SKIP 56 (to 0x94925c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9802660,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ee&0x01) NOT(unknown intro/outro? flag in prof. lab) SKIP 11 (to 0x9593b5)"
  }
];

test('expression corpus: negated-compare', () => {
  for (const sample of SAMPLES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.size, sample.expectedBytesConsumed);
  }
});
