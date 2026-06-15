import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SAMPLES = [
  {
    "opcode": 9,
    "instructionAddress": 9948036,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 17 (to 0x97cb9b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757278,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) == 2) == FALSE THEN SKIP 37 (to 0x94e28c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9745078,
    "expectedBytesConsumed": 9,
    "text": "IF ($24c3 == 3) == FALSE THEN SKIP 29 (to 0x94b2dc)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10063153,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x998d3b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9683985,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x93c41b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9758099,
    "expectedBytesConsumed": 12,
    "text": "IF (($2260&0x10) && (!($2288&0x08))) == FALSE THEN SKIP 8 (to 0x94e5a7)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10013162,
    "expectedBytesConsumed": 11,
    "text": "IF (($22dd&0x40) == ($22dc&0x08)) == FALSE THEN SKIP 7 (to 0x98c9fc)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9878911,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x96bd89)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9745006,
    "expectedBytesConsumed": 9,
    "text": "IF ($24c3 == 1) == FALSE THEN SKIP 33 (to 0x94b298)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757860,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) == 9) == FALSE THEN SKIP 13 (to 0x94e4ba)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9814549,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234c)&0xff) == 3) == FALSE THEN SKIP 34 (to 0x95c240)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9999702,
    "expectedBytesConsumed": 9,
    "text": "IF ($238f == 1) == FALSE THEN SKIP 7 (to 0x989566)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10022843,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x98efc5)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10006496,
    "expectedBytesConsumed": 22,
    "text": "IF (((!($22dd&0x40)) && (($2351)&0xff)) || (($22dd&0x40) && (($234f)&0xff))) == FALSE THEN SKIP 106 (to 0x98b060)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757398,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) == 4) == FALSE THEN SKIP 43 (to 0x94e30a)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9683816,
    "expectedBytesConsumed": 12,
    "text": "IF (($22dc&0x08) && (!($22e9&0x04))) == FALSE THEN SKIP 6 (to 0x93c37a)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10129615,
    "expectedBytesConsumed": 9,
    "text": "IF (signed arg0 < signed arg8) == FALSE THEN SKIP 39 (to 0x9a90ff)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9740458,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) == 8) == FALSE THEN SKIP 17 (to 0x94a0c4)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9798930,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 15 (to 0x958527)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757198,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) == 7) == FALSE THEN SKIP 5 (to 0x94e21c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10138473,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x9ab373)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10129773,
    "expectedBytesConsumed": 11,
    "text": "IF (signed arg12 == 4) == FALSE THEN SKIP 6 (to 0x9a917b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9802826,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x959454)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9688014,
    "expectedBytesConsumed": 14,
    "text": "IF (($2260&0x08) && ($285d < 2)) == FALSE THEN SKIP 122 (to 0x93d456)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9688186,
    "expectedBytesConsumed": 17,
    "text": "IF ((($2834&0x02) == 1) && ($2867 > 30)) == FALSE THEN SKIP 30 (to 0x93d4a9)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9734426,
    "expectedBytesConsumed": 12,
    "text": "IF (($22f2&0x02) && (!($22dc&0x08))) == FALSE THEN SKIP 4 (to 0x94892a)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9946541,
    "expectedBytesConsumed": 9,
    "text": "IF ((($22fe)&0xff) == 1) == FALSE THEN SKIP 16 (to 0x97c5c6)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10140962,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x9abd2c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10018716,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) == 4) == FALSE THEN SKIP 77 (to 0x98dff2)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9748078,
    "expectedBytesConsumed": 9,
    "text": "IF ($284a >= 20) == FALSE THEN SKIP 7 (to 0x94be7e)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757709,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) == 9) == FALSE THEN SKIP 62 (to 0x94e454)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9804575,
    "expectedBytesConsumed": 9,
    "text": "IF ((($2358)&0xff) != 2) == FALSE THEN SKIP 10 (to 0x959b32)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9742729,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234d)&0xff) == 5) == FALSE THEN SKIP 7 (to 0x94a999)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9822725,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 20 (to 0x95e21f)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10190905,
    "expectedBytesConsumed": 9,
    "text": "IF ($236d == 1) == FALSE THEN SKIP 6 (to 0x9b8048)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9687756,
    "expectedBytesConsumed": 12,
    "text": "IF ((!($22e8&0x40)) && ($22dc&0x08)) == FALSE THEN SKIP 78 (to 0x93d326)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9952927,
    "expectedBytesConsumed": 9,
    "text": "IF ($238f == 5) == FALSE THEN SKIP 102 (to 0x97df0e)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9808481,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x95aa6b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757804,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) == 7) == FALSE THEN SKIP 47 (to 0x94e4a4)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9678657,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 11 (to 0x93af52)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9822731,
    "expectedBytesConsumed": 11,
    "text": "IF (($225d&0x08) || ($22f2&0x01)) == FALSE THEN SKIP 5 (to 0x95e21b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9814818,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234c)&0xff) == 4) == FALSE THEN SKIP 5 (to 0x95c330)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9740406,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) == 6) == FALSE THEN SKIP 17 (to 0x94a090)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9740354,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) == 4) == FALSE THEN SKIP 17 (to 0x94a05c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10019032,
    "expectedBytesConsumed": 11,
    "text": "IF (($22dd&0x40) == ($22dc&0x08)) == FALSE THEN SKIP 8 (to 0x98e0eb)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10077109,
    "expectedBytesConsumed": 9,
    "text": "IF (signed arg0 == 0x77) == FALSE THEN SKIP 6 (to 0x99c3c4)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10076943,
    "expectedBytesConsumed": 9,
    "text": "IF ($24f7 == -6) == FALSE THEN SKIP 17 (to 0x99c329)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9743673,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x94ad43)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10013119,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 37 (to 0x98c9ea)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9687743,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x93d2c9)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10128493,
    "expectedBytesConsumed": 12,
    "text": "IF ((!($22dc&0x08)) && ($22dd&0x02)) == FALSE THEN SKIP 1633 (to 0x9a92da)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9740510,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) == 10) == FALSE THEN SKIP 17 (to 0x94a0f8)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9745453,
    "expectedBytesConsumed": 10,
    "text": "IF ($2836 > 0xf8) == FALSE THEN SKIP 21 (to 0x94b44c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9758131,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x94e5bd)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757813,
    "expectedBytesConsumed": 12,
    "text": "IF (($2260&0x10) && (!($225f&0x80))) == FALSE THEN SKIP 22 (to 0x94e497)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9877115,
    "expectedBytesConsumed": 9,
    "text": "IF ($236b == 3) == FALSE THEN SKIP 4 (to 0x96b688)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10077027,
    "expectedBytesConsumed": 10,
    "text": "IF ($24f7 == 0x92) == FALSE THEN SKIP 15 (to 0x99c37c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10079522,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x99cd2c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9742404,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234e)&0xff) == 5) == FALSE THEN SKIP 14 (to 0x94a85b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9745531,
    "expectedBytesConsumed": 10,
    "text": "IF ($2836 > 0xfa) == FALSE THEN SKIP 21 (to 0x94b49a)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9742687,
    "expectedBytesConsumed": 33,
    "text": "IF (((((($234d)&0xff) == 1) || ((($234d)&0xff) == 3)) || ((($234d)&0xff) == 4)) || ((($234d)&0xff) == 5)) == FALSE THEN SKIP 5 (to 0x94a985)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757884,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) != 7) == FALSE THEN SKIP 3 (to 0x94e4c8)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9671156,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 2 (to 0x9391fc)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9999750,
    "expectedBytesConsumed": 9,
    "text": "IF ($238f == 4) == FALSE THEN SKIP 4 (to 0x989593)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9952692,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x97ddbe)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10146735,
    "expectedBytesConsumed": 9,
    "text": "IF (arg0 == 0xb0) == FALSE THEN SKIP 14 (to 0x9ad3c6)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10129354,
    "expectedBytesConsumed": 8,
    "text": "IF (signed arg6 < 2) == FALSE THEN SKIP 11 (to 0x9a8fdd)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9822863,
    "expectedBytesConsumed": 9,
    "text": "IF ($2515 < 5) == FALSE THEN SKIP 15 (to 0x95e2a7)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9802929,
    "expectedBytesConsumed": 11,
    "text": "IF (($22e5&0x04) && ($22e4&0x04)) == FALSE THEN SKIP 8 (to 0x9594c4)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9748094,
    "expectedBytesConsumed": 10,
    "text": "IF ($284c > 0x50) == FALSE THEN SKIP 4 (to 0x94be8c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9744958,
    "expectedBytesConsumed": 9,
    "text": "IF ($24c3 == 5) == FALSE THEN SKIP 7 (to 0x94b24e)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9997088,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x988b2a)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9887851,
    "expectedBytesConsumed": 9,
    "text": "IF ($2839 < 16) == FALSE THEN SKIP 17 (to 0x96e085)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10082708,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x99d99e)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10011727,
    "expectedBytesConsumed": 11,
    "text": "IF (($22dd&0x40) == ($22dc&0x08)) == FALSE THEN SKIP 178 (to 0x98c50c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9952916,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x97de9e)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9740484,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) == 9) == FALSE THEN SKIP 17 (to 0x94a0de)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10001567,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x989ca9)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9937787,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x97a385)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9804538,
    "expectedBytesConsumed": 9,
    "text": "IF ((($2357)&0xff) != 2) == FALSE THEN SKIP 10 (to 0x959b0d)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9999623,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x989511)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10195826,
    "expectedBytesConsumed": 9,
    "text": "IF ($283b == 3) == FALSE THEN SKIP 11 (to 0x9b9386)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9688170,
    "expectedBytesConsumed": 9,
    "text": "IF ($2865 > 25) == FALSE THEN SKIP 7 (to 0x93d47a)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9747954,
    "expectedBytesConsumed": 9,
    "text": "IF ($2854 <= 4) == FALSE THEN SKIP 25 (to 0x94be14)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9687642,
    "expectedBytesConsumed": 11,
    "text": "IF (($22dc&0x08) && ($22e8&0x40)) == FALSE THEN SKIP 19 (to 0x93d278)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9687611,
    "expectedBytesConsumed": 12,
    "text": "IF (($2260&0x10) && (!($22dc&0x08))) == FALSE THEN SKIP 19 (to 0x93d25a)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9812934,
    "expectedBytesConsumed": 9,
    "text": "IF ($2835 < 16) == FALSE THEN SKIP 17 (to 0x95bbe0)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9802859,
    "expectedBytesConsumed": 9,
    "text": "IF ((($2357)&0xff) != 1) == FALSE THEN SKIP 10 (to 0x95947e)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9877652,
    "expectedBytesConsumed": 12,
    "text": "IF (($225d&0x08) && (!($22ef&0x02))) == FALSE THEN SKIP 40 (to 0x96b8c8)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9877128,
    "expectedBytesConsumed": 17,
    "text": "IF ((($22d8&0x80) && ($22d8&0x40)) && (!($22d9&0x08))) == FALSE THEN SKIP 8 (to 0x96b6a1)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10193146,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x9b8904)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9944766,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x97bec8)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10129373,
    "expectedBytesConsumed": 8,
    "text": "IF (signed arg6 < 4) == FALSE THEN SKIP 11 (to 0x9a8ff0)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9877606,
    "expectedBytesConsumed": 12,
    "text": "IF (($225d&0x08) && (!($22ef&0x02))) == FALSE THEN SKIP 12 (to 0x96b87e)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9818048,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x95cfca)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9814840,
    "expectedBytesConsumed": 11,
    "text": "IF (($2261&0x01) || (($2350)&0xff)) == FALSE THEN SKIP 9 (to 0x95c34c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9740756,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 18 (to 0x94a1ec)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10011847,
    "expectedBytesConsumed": 12,
    "text": "IF ((!($22dc&0x01)) || ($22dc&0x08)) == FALSE THEN SKIP 9 (to 0x98c4dc)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9808497,
    "expectedBytesConsumed": 9,
    "text": "IF ($238f == 5) == FALSE THEN SKIP 99 (to 0x95aadd)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9742643,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234d)&0xff) == 6) == FALSE THEN SKIP 29 (to 0x94a959)"
  }
];

test('expression corpus: memory-compare', () => {
  for (const sample of SAMPLES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.size, sample.expectedBytesConsumed);
  }
});
