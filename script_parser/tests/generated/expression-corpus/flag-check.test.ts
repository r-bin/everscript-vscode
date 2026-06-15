import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SAMPLES = [
  {
    "opcode": 93,
    "instructionAddress": 9680914,
    "expectedBytesConsumed": 4,
    "text": "IF $2299 & 0x10 THEN UNLOAD OBJ 18 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9744860,
    "expectedBytesConsumed": 4,
    "text": "IF $22b0 & 0x40 THEN UNLOAD OBJ 8 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 8,
    "instructionAddress": 9667821,
    "expectedBytesConsumed": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 3 (to 0x9384f6)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9668064,
    "expectedBytesConsumed": 4,
    "text": "IF $2269 & 0x02 THEN UNLOAD OBJ 3 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9740668,
    "expectedBytesConsumed": 4,
    "text": "IF $22af & 0x04 THEN UNLOAD OBJ 10 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 8,
    "instructionAddress": 9626000,
    "expectedBytesConsumed": 6,
    "text": "IF $22ea&0x20 SKIP 486 (to 0x92e37c)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10006684,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dd&0x40) NOT(Load east castle) SKIP 20 (to 0x98b0b6)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10060604,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x998346)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757829,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dc&0x08) NOT(windwalker unlocked) SKIP 6 (to 0x94e491)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10145993,
    "expectedBytesConsumed": 9,
    "text": "IF ((($2356)&0xff) == 3) == FALSE THEN SKIP 10 (to 0x9ad0dc)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683850,
    "expectedBytesConsumed": 4,
    "text": "IF $2289 & 0x01 THEN UNLOAD OBJ 4 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9810154,
    "expectedBytesConsumed": 6,
    "text": "IF ($2834&0x80) == FALSE THEN SKIP 76 (to 0x95b13c)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683854,
    "expectedBytesConsumed": 4,
    "text": "IF $2289 & 0x02 THEN UNLOAD OBJ 5 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9678649,
    "expectedBytesConsumed": 4,
    "text": "IF $226c & 0x80 THEN UNLOAD OBJ 0 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9687743,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x93d2c9)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9933016,
    "expectedBytesConsumed": 4,
    "text": "IF $2283 & 0x80 THEN UNLOAD OBJ 8 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9757487,
    "expectedBytesConsumed": 4,
    "text": "IF $2266 & 0x02 THEN UNLOAD OBJ 11 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9877502,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 15 (to 0x96b813)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9668190,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x938668)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10069900,
    "expectedBytesConsumed": 7,
    "text": "IF $22dd&0x02 (Sterling dead) SKIP 21 (to 0x99a7a8)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9668156,
    "expectedBytesConsumed": 4,
    "text": "IF $2290 & 0x80 THEN UNLOAD OBJ 23 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9629753,
    "expectedBytesConsumed": 9,
    "text": "IF ($2836 > 0) == FALSE THEN SKIP 17 (to 0x92f053)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9734422,
    "expectedBytesConsumed": 4,
    "text": "IF $227c & 0x10 THEN UNLOAD OBJ 6 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 10012043,
    "expectedBytesConsumed": 6,
    "text": "IF !($22eb&0x40) SKIP 93 (to 0x98c5ee)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9887623,
    "expectedBytesConsumed": 4,
    "text": "IF $22ba & 0x10 THEN UNLOAD OBJ 16 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 8,
    "instructionAddress": 9745331,
    "expectedBytesConsumed": 6,
    "text": "IF $226a&0x40 SKIP 6 (to 0x94b3bf)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9736704,
    "expectedBytesConsumed": 5,
    "text": "IF $2274 & 0x80 THEN UNLOAD OBJ 0x35 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 10136365,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f5&0x20) SKIP 42 (to 0x9aab5d)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683786,
    "expectedBytesConsumed": 5,
    "text": "IF $229f & 0x10 THEN UNLOAD OBJ 0x22 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757860,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) == 9) == FALSE THEN SKIP 13 (to 0x94e4ba)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9668262,
    "expectedBytesConsumed": 6,
    "text": "IF $22ab&0x40 SKIP 26 (to 0x9386c6)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9739035,
    "expectedBytesConsumed": 4,
    "text": "IF $22ae & 0x01 THEN UNLOAD OBJ 29 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 10018716,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) == 4) == FALSE THEN SKIP 77 (to 0x98dff2)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10134234,
    "expectedBytesConsumed": 7,
    "text": "IF $22dc&0x01 (Pigrace finished) SKIP 40 (to 0x9aa309)"
  },
  {
    "opcode": 93,
    "instructionAddress": 10019552,
    "expectedBytesConsumed": 4,
    "text": "IF $227b & 0x02 THEN UNLOAD OBJ 11 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9951338,
    "expectedBytesConsumed": 4,
    "text": "IF $22be & 0x01 THEN UNLOAD OBJ 12 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10195752,
    "expectedBytesConsumed": 4,
    "text": "IF $22c3 & 0x04 THEN UNLOAD OBJ 20 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9757387,
    "expectedBytesConsumed": 4,
    "text": "IF $2265 & 0x10 THEN UNLOAD OBJ 6 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9802792,
    "expectedBytesConsumed": 4,
    "text": "IF $227d & 0x80 THEN UNLOAD OBJ 26 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9887691,
    "expectedBytesConsumed": 6,
    "text": "IF !($22d9&0x08) NOT(Aegis dead) SKIP 6 (to 0x96dfd7)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9932367,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x978e59)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10001586,
    "expectedBytesConsumed": 10,
    "text": "IF ((($234b)&0xff) == 0x8d) == FALSE THEN SKIP 25 (to 0x989cd5)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9885220,
    "expectedBytesConsumed": 4,
    "text": "IF $22d0 & 0x10 THEN UNLOAD OBJ 8 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9691249,
    "expectedBytesConsumed": 4,
    "text": "IF $22a5 & 0x10 THEN UNLOAD OBJ 23 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 10063084,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ef&0x08) SKIP 38 (to 0x998d18)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9680980,
    "expectedBytesConsumed": 5,
    "text": "IF $229b & 0x10 THEN UNLOAD OBJ 0x22 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683748,
    "expectedBytesConsumed": 4,
    "text": "IF $229e & 0x08 THEN UNLOAD OBJ 25 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9951358,
    "expectedBytesConsumed": 4,
    "text": "IF $22be & 0x20 THEN UNLOAD OBJ 17 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757758,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ee&0x01) NOT(unknown intro/outro? flag in prof. lab) SKIP 16 (to 0x94e454)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9952692,
    "expectedBytesConsumed": 6,
    "text": "IF CHANGE MUSIC ($238d) == 0x00 SKIP 4 (to 0x97ddbe)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9742462,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ee&0x01) NOT(unknown intro/outro? flag in prof. lab) SKIP 12 (to 0x94a890)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9878887,
    "expectedBytesConsumed": 4,
    "text": "IF $22c1 & 0x04 THEN UNLOAD OBJ 7 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9680926,
    "expectedBytesConsumed": 4,
    "text": "IF $2299 & 0x80 THEN UNLOAD OBJ 21 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683901,
    "expectedBytesConsumed": 4,
    "text": "IF $228a & 0x04 THEN UNLOAD OBJ 14 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9951366,
    "expectedBytesConsumed": 4,
    "text": "IF $22be & 0x80 THEN UNLOAD OBJ 19 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9684542,
    "expectedBytesConsumed": 4,
    "text": "IF $22a1 & 0x04 THEN UNLOAD OBJ 8 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 8,
    "instructionAddress": 9758617,
    "expectedBytesConsumed": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x94e7a7)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9937616,
    "expectedBytesConsumed": 6,
    "text": "IF !($2259&0x20) NOT(Fireball) SKIP 14 (to 0x97a2e4)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9998399,
    "expectedBytesConsumed": 11,
    "text": "IF (($22f4&0x02) || ($2261&0x02)) == FALSE THEN SKIP 9 (to 0x989053)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9691329,
    "expectedBytesConsumed": 4,
    "text": "IF $22a8 & 0x01 THEN UNLOAD OBJ 27 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 10064768,
    "expectedBytesConsumed": 6,
    "text": "IF !($22eb&0x08) NOT(debug) SKIP 4 (to 0x99938a)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9745167,
    "expectedBytesConsumed": 6,
    "text": "IF $226a&0x80 SKIP 6 (to 0x94b31b)"
  },
  {
    "opcode": 8,
    "instructionAddress": 9936170,
    "expectedBytesConsumed": 6,
    "text": "IF $22e9&0x40 (Ruins Minitaur defeated) SKIP 22 (to 0x979d46)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9691241,
    "expectedBytesConsumed": 4,
    "text": "IF $22a5 & 0x04 THEN UNLOAD OBJ 10 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9681020,
    "expectedBytesConsumed": 5,
    "text": "IF $229c & 0x10 THEN UNLOAD OBJ 0x2a \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9757317,
    "expectedBytesConsumed": 4,
    "text": "IF $2265 & 0x04 THEN UNLOAD OBJ 4 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9883507,
    "expectedBytesConsumed": 4,
    "text": "IF $22c4 & 0x80 THEN UNLOAD OBJ 27 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9736649,
    "expectedBytesConsumed": 4,
    "text": "IF $228d & 0x20 THEN UNLOAD OBJ 1 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 10195681,
    "expectedBytesConsumed": 7,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x9b92f0)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9752555,
    "expectedBytesConsumed": 4,
    "text": "IF $2294 & 0x08 THEN UNLOAD OBJ 9 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9819934,
    "expectedBytesConsumed": 4,
    "text": "IF $22d1 & 0x04 THEN UNLOAD OBJ 5 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9812717,
    "expectedBytesConsumed": 4,
    "text": "IF $22b5 & 0x01 THEN UNLOAD OBJ 4 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9804598,
    "expectedBytesConsumed": 6,
    "text": "IF !($22e5&0x04) NOT(Unknown 'mids flag) SKIP 8 (to 0x959b44)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9802800,
    "expectedBytesConsumed": 4,
    "text": "IF $227e & 0x02 THEN UNLOAD OBJ 28 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9996714,
    "expectedBytesConsumed": 5,
    "text": "IF $22ce & 0x02 THEN UNLOAD OBJ 0x3d \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683893,
    "expectedBytesConsumed": 4,
    "text": "IF $228a & 0x01 THEN UNLOAD OBJ 12 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10007406,
    "expectedBytesConsumed": 4,
    "text": "IF $2286 & 0x02 THEN UNLOAD OBJ 5 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9680942,
    "expectedBytesConsumed": 4,
    "text": "IF $229a & 0x08 THEN UNLOAD OBJ 25 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10082517,
    "expectedBytesConsumed": 4,
    "text": "IF $22ca & 0x20 THEN UNLOAD OBJ 12 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 10146844,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f8&0x02) SKIP 5 (to 0x9ad427)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9734390,
    "expectedBytesConsumed": 4,
    "text": "IF $22b3 & 0x04 THEN UNLOAD OBJ 2 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9996759,
    "expectedBytesConsumed": 5,
    "text": "IF $22cf & 0x04 THEN UNLOAD OBJ 0x46 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9936118,
    "expectedBytesConsumed": 7,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x979d05)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9680930,
    "expectedBytesConsumed": 4,
    "text": "IF $229a & 0x01 THEN UNLOAD OBJ 22 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 10018881,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ee&0x01) NOT(unknown intro/outro? flag in prof. lab) SKIP 20 (to 0x98e05b)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9816717,
    "expectedBytesConsumed": 4,
    "text": "IF $22b6 & 0x08 THEN UNLOAD OBJ 1 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9739015,
    "expectedBytesConsumed": 4,
    "text": "IF $22ad & 0x08 THEN UNLOAD OBJ 24 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9932417,
    "expectedBytesConsumed": 4,
    "text": "IF $225e & 0x80 THEN UNLOAD OBJ 9 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9672072,
    "expectedBytesConsumed": 4,
    "text": "IF $22a2 & 0x10 THEN UNLOAD OBJ 8 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9679394,
    "expectedBytesConsumed": 4,
    "text": "IF $2295 & 0x80 THEN UNLOAD OBJ 13 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9887619,
    "expectedBytesConsumed": 4,
    "text": "IF $22ba & 0x08 THEN UNLOAD OBJ 17 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683772,
    "expectedBytesConsumed": 4,
    "text": "IF $229f & 0x02 THEN UNLOAD OBJ 31 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683811,
    "expectedBytesConsumed": 5,
    "text": "IF $22a0 & 0x02 THEN UNLOAD OBJ 0x27 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9740744,
    "expectedBytesConsumed": 4,
    "text": "IF $226f & 0x40 THEN UNLOAD OBJ 7 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10195744,
    "expectedBytesConsumed": 4,
    "text": "IF $22c3 & 0x01 THEN UNLOAD OBJ 18 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757450,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) == 5) == FALSE THEN SKIP 43 (to 0x94e33e)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9878875,
    "expectedBytesConsumed": 4,
    "text": "IF $22c0 & 0x80 THEN UNLOAD OBJ 4 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9691281,
    "expectedBytesConsumed": 4,
    "text": "IF $22a6 & 0x10 THEN UNLOAD OBJ 25 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9824639,
    "expectedBytesConsumed": 7,
    "text": "IF $2258&0x02 (Atlas) SKIP 35 (to 0x95e9a9)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9679390,
    "expectedBytesConsumed": 4,
    "text": "IF $2295 & 0x40 THEN UNLOAD OBJ 4 \u001b[91m(TODO: verify this)\u001b[0m"
  }
];

test('expression corpus: flag-check', () => {
  for (const sample of SAMPLES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.size, sample.expectedBytesConsumed);
  }
});
