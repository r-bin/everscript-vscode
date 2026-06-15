import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SAMPLES = [
  {
    "opcode": 93,
    "instructionAddress": 9752539,
    "expectedBytesConsumed": 4,
    "text": "IF $2293 & 0x80 THEN UNLOAD OBJ 7 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9668108,
    "expectedBytesConsumed": 4,
    "text": "IF $2292 & 0x04 THEN UNLOAD OBJ 22 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 8,
    "instructionAddress": 9745167,
    "expectedBytesConsumed": 6,
    "text": "IF $226a&0x80 SKIP 6 (to 0x94b31b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10006921,
    "expectedBytesConsumed": 6,
    "text": "IF !($22e5&0x40) NOT(West castle collapsed) SKIP 20 (to 0x98b1a3)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9948003,
    "expectedBytesConsumed": 7,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x97cb72)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9742326,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234e)&0xff) == 2) == FALSE THEN SKIP 17 (to 0x94a810)"
  },
  {
    "opcode": 93,
    "instructionAddress": 10082505,
    "expectedBytesConsumed": 4,
    "text": "IF $22ca & 0x04 THEN UNLOAD OBJ 8 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 8,
    "instructionAddress": 9679276,
    "expectedBytesConsumed": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x93b1ba)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9816943,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ec&0x20) NOT(unknown intro/outro? flag in prof. lab) SKIP 25 (to 0x95cb8e)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9691309,
    "expectedBytesConsumed": 4,
    "text": "IF $22a7 & 0x08 THEN UNLOAD OBJ 6 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9885212,
    "expectedBytesConsumed": 4,
    "text": "IF $22d0 & 0x04 THEN UNLOAD OBJ 6 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683712,
    "expectedBytesConsumed": 4,
    "text": "IF $229d & 0x04 THEN UNLOAD OBJ 16 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9691225,
    "expectedBytesConsumed": 4,
    "text": "IF $22a4 & 0x40 THEN UNLOAD OBJ 30 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9798936,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ed&0x08) NOT(crustacia intro to be shown) SKIP 5 (to 0x958523)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9668100,
    "expectedBytesConsumed": 4,
    "text": "IF $2292 & 0x01 THEN UNLOAD OBJ 20 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9880571,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f1&0x40) NOT(Inside outro?) SKIP 7 (to 0x96c408)"
  },
  {
    "opcode": 93,
    "instructionAddress": 10195740,
    "expectedBytesConsumed": 4,
    "text": "IF $22c2 & 0x80 THEN UNLOAD OBJ 17 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9668116,
    "expectedBytesConsumed": 4,
    "text": "IF $228f & 0x20 THEN UNLOAD OBJ 9 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9736609,
    "expectedBytesConsumed": 4,
    "text": "IF $228c & 0x08 THEN UNLOAD OBJ 6 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9877536,
    "expectedBytesConsumed": 6,
    "text": "IF !($2261&0x01) NOT(Dog unavailable) SKIP 10 (to 0x96b830)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9668160,
    "expectedBytesConsumed": 4,
    "text": "IF $2291 & 0x01 THEN UNLOAD OBJ 24 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9932385,
    "expectedBytesConsumed": 4,
    "text": "IF $225e & 0x80 THEN UNLOAD OBJ 1 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9734410,
    "expectedBytesConsumed": 4,
    "text": "IF $22b3 & 0x80 THEN UNLOAD OBJ 12 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9752531,
    "expectedBytesConsumed": 4,
    "text": "IF $2293 & 0x20 THEN UNLOAD OBJ 2 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9816721,
    "expectedBytesConsumed": 4,
    "text": "IF $22b6 & 0x10 THEN UNLOAD OBJ 2 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9802882,
    "expectedBytesConsumed": 6,
    "text": "IF !($22e5&0x02) NOT(Unknown 'mids flag) SKIP 8 (to 0x959490)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10125885,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dc&0x08) NOT(windwalker unlocked) SKIP 4 (to 0x9a8247)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9739096,
    "expectedBytesConsumed": 4,
    "text": "IF $226e & 0x20 THEN UNLOAD OBJ 10 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757333,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ee&0x01) NOT(unknown intro/outro? flag in prof. lab) SKIP 16 (to 0x94e2ab)"
  },
  {
    "opcode": 9,
    "instructionAddress": 9946797,
    "expectedBytesConsumed": 6,
    "text": "IF !($22e5&0x08) NOT(WW Landing (set before loading fire pit from OW)) SKIP 16 (to 0x97c6c3)"
  },
  {
    "opcode": 93,
    "instructionAddress": 10009510,
    "expectedBytesConsumed": 4,
    "text": "IF $22c7 & 0x08 THEN UNLOAD OBJ 14 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 12,
    "instructionAddress": 10140859,
    "expectedBytesConsumed": 7,
    "text": "$22f5 |= 0x40 if (!$22f5 & 0x40) else $22f5 &= ~0x40"
  },
  {
    "opcode": 93,
    "instructionAddress": 9744864,
    "expectedBytesConsumed": 4,
    "text": "IF $22b0 & 0x80 THEN UNLOAD OBJ 9 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9823524,
    "expectedBytesConsumed": 4,
    "text": "IF $22b8 & 0x08 THEN UNLOAD OBJ 2 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9744880,
    "expectedBytesConsumed": 4,
    "text": "IF $22b1 & 0x08 THEN UNLOAD OBJ 13 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9822954,
    "expectedBytesConsumed": 7,
    "text": "IF $2261&0x01 (Dog unavailable) SKIP 4 (to 0x95e2f5)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9816761,
    "expectedBytesConsumed": 4,
    "text": "IF $22b7 & 0x40 THEN UNLOAD OBJ 12 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9822755,
    "expectedBytesConsumed": 6,
    "text": "IF !($22f2&0x01) NOT(In credits) SKIP 3 (to 0x95e22c)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9951382,
    "expectedBytesConsumed": 4,
    "text": "IF $22bf & 0x08 THEN UNLOAD OBJ 23 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 8,
    "instructionAddress": 9752204,
    "expectedBytesConsumed": 6,
    "text": "IF $22eb&0x20 (in animation) SKIP 8 (to 0x94ce9a)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9804426,
    "expectedBytesConsumed": 4,
    "text": "IF $227f & 0x08 THEN UNLOAD OBJ 6 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9736665,
    "expectedBytesConsumed": 4,
    "text": "IF $228e & 0x02 THEN UNLOAD OBJ 13 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9818094,
    "expectedBytesConsumed": 6,
    "text": "IF !($22ee&0x01) NOT(unknown intro/outro? flag in prof. lab) SKIP 30 (to 0x95d012)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9818074,
    "expectedBytesConsumed": 4,
    "text": "IF $2271 & 0x01 THEN UNLOAD OBJ 5 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9752577,
    "expectedBytesConsumed": 6,
    "text": "IF !($2292&0x10) NOT(Sniffed Ash in Fire Eyes' Village (#20)) SKIP 9 (to 0x94d010)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9740712,
    "expectedBytesConsumed": 4,
    "text": "IF $22b0 & 0x20 THEN UNLOAD OBJ 20 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9752607,
    "expectedBytesConsumed": 4,
    "text": "IF $2292 & 0x80 THEN UNLOAD OBJ 16 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9734398,
    "expectedBytesConsumed": 4,
    "text": "IF $22b3 & 0x10 THEN UNLOAD OBJ 8 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9883658,
    "expectedBytesConsumed": 6,
    "text": "IF !($22e5&0x02) NOT(Unknown 'mids flag) SKIP 8 (to 0x96d018)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9681010,
    "expectedBytesConsumed": 5,
    "text": "IF $229c & 0x04 THEN UNLOAD OBJ 0x29 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683720,
    "expectedBytesConsumed": 4,
    "text": "IF $229d & 0x10 THEN UNLOAD OBJ 18 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 10011847,
    "expectedBytesConsumed": 12,
    "text": "IF ((!($22dc&0x01)) || ($22dc&0x08)) == FALSE THEN SKIP 9 (to 0x98c4dc)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9739092,
    "expectedBytesConsumed": 4,
    "text": "IF $226e & 0x10 THEN UNLOAD OBJ 8 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9757387,
    "expectedBytesConsumed": 4,
    "text": "IF $2265 & 0x10 THEN UNLOAD OBJ 6 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9672060,
    "expectedBytesConsumed": 4,
    "text": "IF $22a2 & 0x02 THEN UNLOAD OBJ 5 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9736669,
    "expectedBytesConsumed": 4,
    "text": "IF $228e & 0x04 THEN UNLOAD OBJ 14 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9878863,
    "expectedBytesConsumed": 4,
    "text": "IF $22c0 & 0x10 THEN UNLOAD OBJ 1 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9757324,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) == 3) == FALSE THEN SKIP 65 (to 0x94e2d6)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10019003,
    "expectedBytesConsumed": 9,
    "text": "IF ((($234b)&0xff) == 6) == FALSE THEN SKIP 120 (to 0x98e13c)"
  },
  {
    "opcode": 93,
    "instructionAddress": 10069828,
    "expectedBytesConsumed": 4,
    "text": "IF $22d6 & 0x40 THEN UNLOAD OBJ 21 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9672076,
    "expectedBytesConsumed": 4,
    "text": "IF $22a2 & 0x20 THEN UNLOAD OBJ 9 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683748,
    "expectedBytesConsumed": 4,
    "text": "IF $229e & 0x08 THEN UNLOAD OBJ 25 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 8,
    "instructionAddress": 9668021,
    "expectedBytesConsumed": 6,
    "text": "IF $22ab&0x40 SKIP 7 (to 0x9385c2)"
  },
  {
    "opcode": 93,
    "instructionAddress": 10019615,
    "expectedBytesConsumed": 4,
    "text": "IF $227b & 0x10 THEN UNLOAD OBJ 3 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9684526,
    "expectedBytesConsumed": 4,
    "text": "IF $22a0 & 0x40 THEN UNLOAD OBJ 4 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9883471,
    "expectedBytesConsumed": 4,
    "text": "IF $22c3 & 0x40 THEN UNLOAD OBJ 18 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9668164,
    "expectedBytesConsumed": 4,
    "text": "IF $2291 & 0x02 THEN UNLOAD OBJ 27 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9738971,
    "expectedBytesConsumed": 4,
    "text": "IF $22ac & 0x01 THEN UNLOAD OBJ 13 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9752515,
    "expectedBytesConsumed": 4,
    "text": "IF $2293 & 0x02 THEN UNLOAD OBJ 6 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 10146828,
    "expectedBytesConsumed": 11,
    "text": "IF (($2264&0x20) || ($22f9&0x20)) == FALSE THEN SKIP 5 (to 0x9ad41c)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683768,
    "expectedBytesConsumed": 4,
    "text": "IF $229f & 0x01 THEN UNLOAD OBJ 30 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9680985,
    "expectedBytesConsumed": 5,
    "text": "IF $229b & 0x20 THEN UNLOAD OBJ 0x24 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9668124,
    "expectedBytesConsumed": 4,
    "text": "IF $228f & 0x80 THEN UNLOAD OBJ 10 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9996679,
    "expectedBytesConsumed": 5,
    "text": "IF $22cd & 0x20 THEN UNLOAD OBJ 0x39 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683897,
    "expectedBytesConsumed": 4,
    "text": "IF $228a & 0x02 THEN UNLOAD OBJ 13 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9738979,
    "expectedBytesConsumed": 4,
    "text": "IF $22ac & 0x04 THEN UNLOAD OBJ 15 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 10145833,
    "expectedBytesConsumed": 9,
    "text": "IF ((($2355)&0xff) == 2) == FALSE THEN SKIP 57 (to 0x9ad06b)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9684542,
    "expectedBytesConsumed": 4,
    "text": "IF $22a1 & 0x04 THEN UNLOAD OBJ 8 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9996649,
    "expectedBytesConsumed": 5,
    "text": "IF $22cd & 0x02 THEN UNLOAD OBJ 0x35 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9948437,
    "expectedBytesConsumed": 6,
    "text": "IF !($22e5&0x08) NOT(WW Landing (set before loading fire pit from OW)) SKIP 16 (to 0x97cd2b)"
  },
  {
    "opcode": 9,
    "instructionAddress": 10214559,
    "expectedBytesConsumed": 6,
    "text": "IF !($2287&0x20) NOT(Opened Laser Lance Gourd) SKIP 4 (to 0x9bdca9)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9734394,
    "expectedBytesConsumed": 4,
    "text": "IF $22b3 & 0x08 THEN UNLOAD OBJ 3 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9752651,
    "expectedBytesConsumed": 12,
    "text": "IF (($22ec&0x20) && (!($22dc&0x08))) == FALSE THEN SKIP 3 (to 0x94d05a)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9757690,
    "expectedBytesConsumed": 4,
    "text": "IF $2267 & 0x02 THEN UNLOAD OBJ 18 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 10019093,
    "expectedBytesConsumed": 11,
    "text": "IF (($22dd&0x40) == ($22dc&0x08)) == FALSE THEN SKIP 8 (to 0x98e128)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9878879,
    "expectedBytesConsumed": 4,
    "text": "IF $22c1 & 0x01 THEN UNLOAD OBJ 5 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683744,
    "expectedBytesConsumed": 4,
    "text": "IF $229e & 0x04 THEN UNLOAD OBJ 24 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9819922,
    "expectedBytesConsumed": 4,
    "text": "IF $22d0 & 0x80 THEN UNLOAD OBJ 7 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10019559,
    "expectedBytesConsumed": 4,
    "text": "IF $2277 & 0x10 THEN UNLOAD OBJ 4 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 10018451,
    "expectedBytesConsumed": 6,
    "text": "IF !($22dc&0x08) NOT(windwalker unlocked) SKIP 5 (to 0x98de9e)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9951294,
    "expectedBytesConsumed": 4,
    "text": "IF $22bc & 0x20 THEN UNLOAD OBJ 1 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9736657,
    "expectedBytesConsumed": 4,
    "text": "IF $228d & 0x80 THEN UNLOAD OBJ 8 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9812693,
    "expectedBytesConsumed": 4,
    "text": "IF $225f & 0x01 THEN UNLOAD OBJ 0 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 9,
    "instructionAddress": 9625948,
    "expectedBytesConsumed": 21,
    "text": "IF (($242b == $2401) && ($242d == $2405)) == FALSE THEN SKIP 3 (to 0x92e174)"
  },
  {
    "opcode": 93,
    "instructionAddress": 9679362,
    "expectedBytesConsumed": 4,
    "text": "IF $2294 & 0x80 THEN UNLOAD OBJ 5 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9691273,
    "expectedBytesConsumed": 4,
    "text": "IF $22a6 & 0x04 THEN UNLOAD OBJ 18 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9672092,
    "expectedBytesConsumed": 4,
    "text": "IF $22a3 & 0x02 THEN UNLOAD OBJ 13 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9823516,
    "expectedBytesConsumed": 4,
    "text": "IF $22b8 & 0x02 THEN UNLOAD OBJ 0 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9802788,
    "expectedBytesConsumed": 4,
    "text": "IF $227d & 0x40 THEN UNLOAD OBJ 25 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9996724,
    "expectedBytesConsumed": 5,
    "text": "IF $22ce & 0x08 THEN UNLOAD OBJ 0x3f \u001b[91m(TODO: verify this)\u001b[0m"
  }
];

test('expression corpus: bitmask', () => {
  for (const sample of SAMPLES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.size, sample.expectedBytesConsumed);
  }
});
