import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 4,
    "instructionAddress": 10011678,
    "expectedSize": 3,
    "text": "SKIP 2 (to 0x98c423)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10011683,
    "expectedSize": 3,
    "text": "SKIP 13 (to 0x98c433)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9877685,
    "expectedSize": 3,
    "text": "SKIP 14 (to 0x96b8c6)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10088119,
    "expectedSize": 3,
    "text": "SKIP 20 (to 0x99eece)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9946816,
    "expectedSize": 3,
    "text": "SKIP 52 (to 0x97c6f7)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10128742,
    "expectedSize": 3,
    "text": "SKIP 41 (to 0x9a8d92)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10018464,
    "expectedSize": 3,
    "text": "SKIP 13 (to 0x98deb0)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9745316,
    "expectedSize": 3,
    "text": "SKIP 3 (to 0x94b3aa)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9670971,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x939142)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9883651,
    "expectedSize": 3,
    "text": "SKIP 27 (to 0x96d021)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9822473,
    "expectedSize": 3,
    "text": "SKIP 219 (to 0x95e1e7)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10077106,
    "expectedSize": 3,
    "text": "SKIP 27 (to 0x99c3d0)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9742375,
    "expectedSize": 3,
    "text": "SKIP 49 (to 0x94a85b)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9740377,
    "expectedSize": 3,
    "text": "SKIP 179 (to 0x94a10f)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10018459,
    "expectedSize": 3,
    "text": "SKIP 2 (to 0x98dea0)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9932922,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x979081)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9885140,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x96d5db)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10216109,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x9be2b4)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9810744,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x95b33f)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9999747,
    "expectedSize": 3,
    "text": "SKIP 13 (to 0x989593)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9802912,
    "expectedSize": 3,
    "text": "SKIP 14 (to 0x9594b1)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9740533,
    "expectedSize": 3,
    "text": "SKIP 23 (to 0x94a10f)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10018475,
    "expectedSize": 3,
    "text": "SKIP 2 (to 0x98deb0)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10018428,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x98de83)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10129389,
    "expectedSize": 3,
    "text": "SKIP 27 (to 0x9a900b)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10003331,
    "expectedSize": 3,
    "text": "SKIP 13 (to 0x98a393)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9822744,
    "expectedSize": 3,
    "text": "SKIP 2 (to 0x95e21d)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9736225,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x949028)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10195823,
    "expectedSize": 3,
    "text": "SKIP 37 (to 0x9b9397)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10125750,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x9a81bd)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9998673,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x989158)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9745024,
    "expectedSize": 3,
    "text": "SKIP 3 (to 0x94b286)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9757395,
    "expectedSize": 3,
    "text": "SKIP 382 (to 0x94e454)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9814503,
    "expectedSize": 3,
    "text": "SKIP 306 (to 0x95c31c)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10077082,
    "expectedSize": 3,
    "text": "SKIP 6 (to 0x99c3a3)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9742742,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x94a99d)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9814589,
    "expectedSize": 3,
    "text": "SKIP 220 (to 0x95c31c)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9733805,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x9486b4)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9745045,
    "expectedSize": 3,
    "text": "SKIP 298 (to 0x94b3c2)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9738709,
    "expectedSize": 3,
    "text": "SKIP 7 (to 0x9499df)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9687753,
    "expectedSize": 3,
    "text": "SKIP 90 (to 0x93d326)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9757223,
    "expectedSize": 3,
    "text": "SKIP 2 (to 0x94e22c)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9757447,
    "expectedSize": 3,
    "text": "SKIP 330 (to 0x94e454)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9935525,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x979aac)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9757600,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x94e3a7)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9739135,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x949b86)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10191001,
    "expectedSize": 3,
    "text": "SKIP 27 (to 0x9b80b7)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9738888,
    "expectedSize": 3,
    "text": "SKIP 3 (to 0x949a8e)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10006910,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x98b185)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9752422,
    "expectedSize": 3,
    "text": "SKIP 35 (to 0x94cf8c)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9740325,
    "expectedSize": 3,
    "text": "SKIP 231 (to 0x94a10f)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9946563,
    "expectedSize": 3,
    "text": "SKIP 58 (to 0x97c600)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10011651,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x98c40a)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10193127,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x9b88ee)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9626489,
    "expectedSize": 3,
    "text": "SKIP 32 (to 0x92e39c)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9738810,
    "expectedSize": 3,
    "text": "SKIP 3 (to 0x949a40)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10009427,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x98bb5a)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10001613,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x989cd4)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9752592,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x94d017)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10018788,
    "expectedSize": 3,
    "text": "SKIP 8 (to 0x98dfef)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9742323,
    "expectedSize": 3,
    "text": "SKIP 101 (to 0x94a85b)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9752215,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x94ce9e)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10006833,
    "expectedSize": 3,
    "text": "SKIP 22 (to 0x98b14a)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9822993,
    "expectedSize": 3,
    "text": "SKIP 3 (to 0x95e317)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9748029,
    "expectedSize": 9,
    "text": "SKIP 0 (to 0x94be40)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10088184,
    "expectedSize": 3,
    "text": "SKIP 12 (to 0x99ef07)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9742349,
    "expectedSize": 3,
    "text": "SKIP 75 (to 0x94a85b)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9802615,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x95937e)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9952619,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x97dd72)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10128669,
    "expectedSize": 3,
    "text": "SKIP 3 (to 0x9a8d23)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10013155,
    "expectedSize": 3,
    "text": "SKIP 2 (to 0x98c9e8)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10082734,
    "expectedSize": 3,
    "text": "SKIP 3 (to 0x99d9b4)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9740351,
    "expectedSize": 3,
    "text": "SKIP 205 (to 0x94a10f)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10076936,
    "expectedSize": 3,
    "text": "SKIP 113 (to 0x99c37c)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9691174,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x93e02d)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9745176,
    "expectedSize": 3,
    "text": "SKIP 3 (to 0x94b31e)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9678609,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x93af18)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10138520,
    "expectedSize": 3,
    "text": "SKIP 6 (to 0x9ab3a1)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9877597,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x96b864)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9934062,
    "expectedSize": 3,
    "text": "SKIP 19 (to 0x979504)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9996633,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x988960)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10134384,
    "expectedSize": 3,
    "text": "SKIP 142 (to 0x9aa401)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9998652,
    "expectedSize": 3,
    "text": "SKIP 25 (to 0x989158)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10022804,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x98ef9b)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10077024,
    "expectedSize": 3,
    "text": "SKIP 25 (to 0x99c37c)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9809927,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x95b00e)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10012036,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x98c58b)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10006722,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x98b0c9)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9997107,
    "expectedSize": 3,
    "text": "SKIP 25 (to 0x988b4f)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9822812,
    "expectedSize": 3,
    "text": "SKIP 111 (to 0x95e2ce)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10195799,
    "expectedSize": 3,
    "text": "SKIP 61 (to 0x9b9397)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10022840,
    "expectedSize": 3,
    "text": "SKIP 10 (to 0x98efc5)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10019278,
    "expectedSize": 3,
    "text": "SKIP 353 (to 0x98e332)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9798944,
    "expectedSize": 3,
    "text": "SKIP 2 (to 0x958525)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9745075,
    "expectedSize": 3,
    "text": "SKIP 268 (to 0x94b3c2)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10069713,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x99a6d8)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10076995,
    "expectedSize": 3,
    "text": "SKIP 54 (to 0x99c37c)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9745155,
    "expectedSize": 3,
    "text": "SKIP 188 (to 0x94b3c2)"
  },
  {
    "opcode": 4,
    "instructionAddress": 10019122,
    "expectedSize": 3,
    "text": "SKIP 4 (to 0x98e139)"
  },
  {
    "opcode": 4,
    "instructionAddress": 9945543,
    "expectedSize": 3,
    "text": "SKIP 0 (to 0x97c1ca)"
  }
];

test('opcode corpus 0x04', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
