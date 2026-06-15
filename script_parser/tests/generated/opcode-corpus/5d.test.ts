import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 93,
    "instructionAddress": 9668056,
    "expectedSize": 4,
    "text": "IF $2268 & 0x80 THEN UNLOAD OBJ 1 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9740720,
    "expectedSize": 4,
    "text": "IF $226f & 0x01 THEN UNLOAD OBJ 1 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10021057,
    "expectedSize": 4,
    "text": "IF $2288 & 0x02 THEN UNLOAD OBJ 0 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9996669,
    "expectedSize": 5,
    "text": "IF $22cc & 0x08 THEN UNLOAD OBJ 0x2f \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10195728,
    "expectedSize": 4,
    "text": "IF $22c2 & 0x10 THEN UNLOAD OBJ 14 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9734374,
    "expectedSize": 4,
    "text": "IF $228f & 0x04 THEN UNLOAD OBJ 0 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9668080,
    "expectedSize": 4,
    "text": "IF $2291 & 0x08 THEN UNLOAD OBJ 11 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9823576,
    "expectedSize": 4,
    "text": "IF $22ba & 0x01 THEN UNLOAD OBJ 15 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10063945,
    "expectedSize": 4,
    "text": "IF $2286 & 0x40 THEN UNLOAD OBJ 10 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9740712,
    "expectedSize": 4,
    "text": "IF $22b0 & 0x20 THEN UNLOAD OBJ 20 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9738999,
    "expectedSize": 4,
    "text": "IF $22ac & 0x80 THEN UNLOAD OBJ 20 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9734386,
    "expectedSize": 4,
    "text": "IF $22b3 & 0x02 THEN UNLOAD OBJ 1 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9681005,
    "expectedSize": 5,
    "text": "IF $229c & 0x02 THEN UNLOAD OBJ 0x28 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10019209,
    "expectedSize": 4,
    "text": "IF $2277 & 0x02 THEN UNLOAD OBJ 7 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9739007,
    "expectedSize": 4,
    "text": "IF $22ad & 0x02 THEN UNLOAD OBJ 22 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9672092,
    "expectedSize": 4,
    "text": "IF $22a3 & 0x02 THEN UNLOAD OBJ 13 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9739039,
    "expectedSize": 4,
    "text": "IF $22ae & 0x02 THEN UNLOAD OBJ 30 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9802780,
    "expectedSize": 4,
    "text": "IF $227d & 0x10 THEN UNLOAD OBJ 23 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9752460,
    "expectedSize": 4,
    "text": "IF $22ed & 0x40 THEN UNLOAD OBJ 17 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10069844,
    "expectedSize": 4,
    "text": "IF $22d7 & 0x04 THEN UNLOAD OBJ 25 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9752531,
    "expectedSize": 4,
    "text": "IF $2293 & 0x20 THEN UNLOAD OBJ 2 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10009486,
    "expectedSize": 4,
    "text": "IF $22c6 & 0x20 THEN UNLOAD OBJ 8 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10082537,
    "expectedSize": 4,
    "text": "IF $22cb & 0x04 THEN UNLOAD OBJ 16 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9691301,
    "expectedSize": 4,
    "text": "IF $22a7 & 0x02 THEN UNLOAD OBJ 14 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10069804,
    "expectedSize": 4,
    "text": "IF $22d6 & 0x01 THEN UNLOAD OBJ 15 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10009474,
    "expectedSize": 4,
    "text": "IF $22c6 & 0x04 THEN UNLOAD OBJ 5 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10195712,
    "expectedSize": 4,
    "text": "IF $22c2 & 0x01 THEN UNLOAD OBJ 10 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9681150,
    "expectedSize": 4,
    "text": "IF $2270 & 0x02 THEN UNLOAD OBJ 8 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10063134,
    "expectedSize": 4,
    "text": "IF $22db & 0x01 THEN UNLOAD OBJ 0 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9752523,
    "expectedSize": 4,
    "text": "IF $2293 & 0x08 THEN UNLOAD OBJ 12 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9691281,
    "expectedSize": 4,
    "text": "IF $22a6 & 0x10 THEN UNLOAD OBJ 25 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9738991,
    "expectedSize": 4,
    "text": "IF $22ac & 0x20 THEN UNLOAD OBJ 18 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9740716,
    "expectedSize": 4,
    "text": "IF $226e & 0x80 THEN UNLOAD OBJ 0 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10195720,
    "expectedSize": 4,
    "text": "IF $22c2 & 0x04 THEN UNLOAD OBJ 12 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10069808,
    "expectedSize": 4,
    "text": "IF $22d6 & 0x02 THEN UNLOAD OBJ 16 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10019559,
    "expectedSize": 4,
    "text": "IF $2277 & 0x10 THEN UNLOAD OBJ 4 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9878863,
    "expectedSize": 4,
    "text": "IF $22c0 & 0x10 THEN UNLOAD OBJ 1 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10064429,
    "expectedSize": 4,
    "text": "IF $2272 & 0x40 THEN UNLOAD OBJ 0 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10069840,
    "expectedSize": 4,
    "text": "IF $22d7 & 0x02 THEN UNLOAD OBJ 24 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9951382,
    "expectedSize": 4,
    "text": "IF $22bf & 0x08 THEN UNLOAD OBJ 23 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10009506,
    "expectedSize": 4,
    "text": "IF $22c7 & 0x04 THEN UNLOAD OBJ 13 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9734406,
    "expectedSize": 4,
    "text": "IF $22b3 & 0x40 THEN UNLOAD OBJ 11 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9934233,
    "expectedSize": 4,
    "text": "IF $228a & 0x80 THEN UNLOAD OBJ 9 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9812733,
    "expectedSize": 4,
    "text": "IF $22b5 & 0x10 THEN UNLOAD OBJ 8 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9752515,
    "expectedSize": 4,
    "text": "IF $2293 & 0x02 THEN UNLOAD OBJ 6 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683781,
    "expectedSize": 5,
    "text": "IF $229f & 0x08 THEN UNLOAD OBJ 0x21 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9757495,
    "expectedSize": 4,
    "text": "IF $2266 & 0x08 THEN UNLOAD OBJ 12 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10019057,
    "expectedSize": 4,
    "text": "IF $2279 & 0x40 THEN UNLOAD OBJ 7 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9744860,
    "expectedSize": 4,
    "text": "IF $22b0 & 0x40 THEN UNLOAD OBJ 8 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9948077,
    "expectedSize": 4,
    "text": "IF $22d3 & 0x04 THEN UNLOAD OBJ 5 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683764,
    "expectedSize": 4,
    "text": "IF $229e & 0x80 THEN UNLOAD OBJ 29 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9752535,
    "expectedSize": 4,
    "text": "IF $2293 & 0x40 THEN UNLOAD OBJ 5 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9883495,
    "expectedSize": 4,
    "text": "IF $22c4 & 0x10 THEN UNLOAD OBJ 24 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9757487,
    "expectedSize": 4,
    "text": "IF $2266 & 0x02 THEN UNLOAD OBJ 11 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9940699,
    "expectedSize": 5,
    "text": "IF $2284 & 0x01 THEN UNLOAD OBJ 0x20 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9739031,
    "expectedSize": 4,
    "text": "IF $22ad & 0x80 THEN UNLOAD OBJ 28 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9668152,
    "expectedSize": 4,
    "text": "IF $2290 & 0x40 THEN UNLOAD OBJ 7 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9740688,
    "expectedSize": 4,
    "text": "IF $22af & 0x80 THEN UNLOAD OBJ 15 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9883523,
    "expectedSize": 4,
    "text": "IF $22c5 & 0x08 THEN UNLOAD OBJ 31 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10019373,
    "expectedSize": 4,
    "text": "IF $227a & 0x80 THEN UNLOAD OBJ 7 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10019198,
    "expectedSize": 4,
    "text": "IF $227a & 0x02 THEN UNLOAD OBJ 7 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10194189,
    "expectedSize": 4,
    "text": "IF $2284 & 0x40 THEN UNLOAD OBJ 4 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10069824,
    "expectedSize": 4,
    "text": "IF $22d6 & 0x20 THEN UNLOAD OBJ 20 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9757439,
    "expectedSize": 4,
    "text": "IF $2265 & 0x80 THEN UNLOAD OBJ 9 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9932377,
    "expectedSize": 4,
    "text": "IF $225e & 0x80 THEN UNLOAD OBJ 7 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9887627,
    "expectedSize": 4,
    "text": "IF $22ba & 0x20 THEN UNLOAD OBJ 2 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9752539,
    "expectedSize": 4,
    "text": "IF $2293 & 0x80 THEN UNLOAD OBJ 7 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9680950,
    "expectedSize": 4,
    "text": "IF $229a & 0x20 THEN UNLOAD OBJ 27 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9668160,
    "expectedSize": 4,
    "text": "IF $2291 & 0x01 THEN UNLOAD OBJ 24 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10018549,
    "expectedSize": 4,
    "text": "IF $2275 & 0x20 THEN UNLOAD OBJ 9 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9878903,
    "expectedSize": 4,
    "text": "IF $22c1 & 0x40 THEN UNLOAD OBJ 11 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9679366,
    "expectedSize": 4,
    "text": "IF $2295 & 0x01 THEN UNLOAD OBJ 6 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9883499,
    "expectedSize": 4,
    "text": "IF $22c4 & 0x20 THEN UNLOAD OBJ 25 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9757694,
    "expectedSize": 4,
    "text": "IF $2267 & 0x04 THEN UNLOAD OBJ 19 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683740,
    "expectedSize": 4,
    "text": "IF $229e & 0x02 THEN UNLOAD OBJ 23 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9808213,
    "expectedSize": 4,
    "text": "IF $2282 & 0x04 THEN UNLOAD OBJ 11 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10018795,
    "expectedSize": 4,
    "text": "IF $2276 & 0x10 THEN UNLOAD OBJ 10 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9679374,
    "expectedSize": 4,
    "text": "IF $2295 & 0x04 THEN UNLOAD OBJ 0 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9736669,
    "expectedSize": 4,
    "text": "IF $228e & 0x04 THEN UNLOAD OBJ 14 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9683893,
    "expectedSize": 4,
    "text": "IF $228a & 0x01 THEN UNLOAD OBJ 12 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9672100,
    "expectedSize": 4,
    "text": "IF $22a3 & 0x08 THEN UNLOAD OBJ 15 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9736633,
    "expectedSize": 4,
    "text": "IF $228d & 0x02 THEN UNLOAD OBJ 19 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9757383,
    "expectedSize": 4,
    "text": "IF $2265 & 0x08 THEN UNLOAD OBJ 5 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9808221,
    "expectedSize": 4,
    "text": "IF $2282 & 0x10 THEN UNLOAD OBJ 13 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9670982,
    "expectedSize": 4,
    "text": "IF $22b4 & 0x04 THEN UNLOAD OBJ 8 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10082529,
    "expectedSize": 4,
    "text": "IF $22cb & 0x01 THEN UNLOAD OBJ 14 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9668072,
    "expectedSize": 4,
    "text": "IF $2269 & 0x08 THEN UNLOAD OBJ 5 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9679406,
    "expectedSize": 4,
    "text": "IF $2296 & 0x04 THEN UNLOAD OBJ 10 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9757652,
    "expectedSize": 4,
    "text": "IF $2267 & 0x01 THEN UNLOAD OBJ 16 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9823556,
    "expectedSize": 4,
    "text": "IF $22b9 & 0x08 THEN UNLOAD OBJ 10 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9932397,
    "expectedSize": 4,
    "text": "IF $225e & 0x80 THEN UNLOAD OBJ 4 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10009530,
    "expectedSize": 4,
    "text": "IF $22c8 & 0x01 THEN UNLOAD OBJ 19 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9672124,
    "expectedSize": 4,
    "text": "IF $22a4 & 0x02 THEN UNLOAD OBJ 21 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9816737,
    "expectedSize": 4,
    "text": "IF $22b7 & 0x01 THEN UNLOAD OBJ 6 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10082541,
    "expectedSize": 4,
    "text": "IF $22cb & 0x08 THEN UNLOAD OBJ 17 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9996689,
    "expectedSize": 5,
    "text": "IF $22cd & 0x80 THEN UNLOAD OBJ 0x3b \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 10007402,
    "expectedSize": 4,
    "text": "IF $2286 & 0x01 THEN UNLOAD OBJ 4 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9681015,
    "expectedSize": 5,
    "text": "IF $229c & 0x08 THEN UNLOAD OBJ 0x23 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9951302,
    "expectedSize": 4,
    "text": "IF $22bc & 0x80 THEN UNLOAD OBJ 3 \u001b[91m(TODO: verify this)\u001b[0m"
  },
  {
    "opcode": 93,
    "instructionAddress": 9802816,
    "expectedSize": 5,
    "text": "IF $227e & 0x20 THEN UNLOAD OBJ 0x20 \u001b[91m(TODO: verify this)\u001b[0m"
  }
];

test('opcode corpus 0x5d', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
