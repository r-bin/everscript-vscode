import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "load npc {num} at {num} 0a",
    "instructionAddress": 9626080,
    "expectedSize": 7,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 1e 5f",
    "instructionAddress": 9627042,
    "expectedSize": 9,
    "opcode": 186
  },
  {
    "shape": "load npc 0b at 6b {num}",
    "instructionAddress": 9667963,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0b at {num} {num}",
    "instructionAddress": 9667967,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0b at {num} 4d",
    "instructionAddress": 9667971,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0b at {num} 3d",
    "instructionAddress": 9667979,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0b at 2d {num}",
    "instructionAddress": 9667983,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0b at {num} 7d",
    "instructionAddress": 9667987,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0b at 1d {num}",
    "instructionAddress": 9667991,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0c at 0f {num}",
    "instructionAddress": 9672132,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0c at {num} {num}",
    "instructionAddress": 9672140,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0c at {num} 2f",
    "instructionAddress": 9672148,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0c at 1d 2d",
    "instructionAddress": 9672156,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0c at 0b {num}",
    "instructionAddress": 9672164,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0b at 0f 3f",
    "instructionAddress": 9679410,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0b at {num} 3b",
    "instructionAddress": 9679414,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 1d 0e",
    "instructionAddress": 9687698,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} 0e",
    "instructionAddress": 9687777,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} 1b",
    "instructionAddress": 9734455,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 2d 3d",
    "instructionAddress": 9734463,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 3d 2f",
    "instructionAddress": 9734467,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 4d {num}",
    "instructionAddress": 9734471,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0c at 0d 1b",
    "instructionAddress": 9734483,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0c at {num} 2b",
    "instructionAddress": 9734487,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0c at 2a {num}",
    "instructionAddress": 9734495,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0c at {num} 3f",
    "instructionAddress": 9734499,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} 5d",
    "instructionAddress": 9736414,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 2d {num}",
    "instructionAddress": 9736448,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 7d {num}",
    "instructionAddress": 9736498,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 2a at {num} {num}",
    "instructionAddress": 9739110,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} 9f",
    "instructionAddress": 9740568,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 6f {num}",
    "instructionAddress": 9742480,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 2b at 3b {num}",
    "instructionAddress": 9742610,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 2b at {num} 1f",
    "instructionAddress": 9742630,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at bd {num}",
    "instructionAddress": 9742669,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 2b at {num} 1d",
    "instructionAddress": 9745105,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 2b at 4f {num}",
    "instructionAddress": 9745109,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 2b at 4b {num}",
    "instructionAddress": 9745251,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0f at {num} 0f",
    "instructionAddress": 9745388,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0f at {num} 1b",
    "instructionAddress": 9745392,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0f at 8b {num}",
    "instructionAddress": 9745400,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 0f at {num} {num}",
    "instructionAddress": 9745404,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 2f {num}",
    "instructionAddress": 9752280,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 5d 5a",
    "instructionAddress": 9752308,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 3f 3f",
    "instructionAddress": 9752352,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} 5b",
    "instructionAddress": 9752452,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 0f 0f",
    "instructionAddress": 9757239,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 4f {num}",
    "instructionAddress": 9757355,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} 3d",
    "instructionAddress": 9757407,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 4b 3d",
    "instructionAddress": 9757511,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 0d 5d",
    "instructionAddress": 9757616,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 0b {num}",
    "instructionAddress": 9758111,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 7e at {num} {num}",
    "instructionAddress": 9758651,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} 0d",
    "instructionAddress": 9759592,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1a at 2d 2d",
    "instructionAddress": 9798777,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1a at 0f 2d",
    "instructionAddress": 9798785,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 1f {num}",
    "instructionAddress": 9798827,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 1f 3f",
    "instructionAddress": 9798839,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 3b at {num} 0f",
    "instructionAddress": 9809954,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 3c at {num} {num}",
    "instructionAddress": 9809977,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 5b at {num} {num}",
    "instructionAddress": 9810013,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 5b at 2b {num}",
    "instructionAddress": 9810059,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 5b at 3b {num}",
    "instructionAddress": 9810105,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1e at {num} {num}",
    "instructionAddress": 9816853,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1a at {num} 2d",
    "instructionAddress": 9822441,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1b at {num} {num}",
    "instructionAddress": 9822449,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1c at {num} 4b",
    "instructionAddress": 9822457,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1b at {num} 5f",
    "instructionAddress": 9822465,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1a at 2a 3a",
    "instructionAddress": 9822824,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1c at 2e 3e",
    "instructionAddress": 9822848,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 0a {num}",
    "instructionAddress": 9824603,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1c at {num} {num}",
    "instructionAddress": 9877204,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1c at 4b {num}",
    "instructionAddress": 9877218,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1d at {num} {num}",
    "instructionAddress": 9877246,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1d at {num} 2d",
    "instructionAddress": 9877260,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1b at 4d 8f",
    "instructionAddress": 9877274,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1b at 4d {num}",
    "instructionAddress": 9877302,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1a at {num} 6d",
    "instructionAddress": 9877316,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1a at {num} 8d",
    "instructionAddress": 9877330,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1a at {num} 1b",
    "instructionAddress": 9877344,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 3d 8f",
    "instructionAddress": 9877400,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} 4b",
    "instructionAddress": 9877414,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1a at 3f {num}",
    "instructionAddress": 9877436,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1c at 0b {num}",
    "instructionAddress": 9877480,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} 2d",
    "instructionAddress": 9878925,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 3f {num}",
    "instructionAddress": 9887715,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 1b at 3d 0b",
    "instructionAddress": 9934181,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 5e at 3f 0d",
    "instructionAddress": 9934195,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 5e at {num} {num}",
    "instructionAddress": 9934203,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at b9 a7",
    "instructionAddress": 9937622,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 5e at 7a 4a",
    "instructionAddress": 9937797,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 6f 9d",
    "instructionAddress": 9940823,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} 9b",
    "instructionAddress": 9940827,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} 1f",
    "instructionAddress": 9945453,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 1d {num}",
    "instructionAddress": 9946701,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 0f {num}",
    "instructionAddress": 9952673,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 6e at 0b 1b",
    "instructionAddress": 9952904,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 6e at {num} {num}",
    "instructionAddress": 9952908,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 6e at {num} 1b",
    "instructionAddress": 9952912,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 3f at {num} {num}",
    "instructionAddress": 9955446,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 3f at 1a {num}",
    "instructionAddress": 9955473,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 3e at 1a {num}",
    "instructionAddress": 9955532,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at f7 0d",
    "instructionAddress": 9999645,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 1b 4f",
    "instructionAddress": 10011754,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 6b {num}",
    "instructionAddress": 10011778,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at b3 4d",
    "instructionAddress": 10011786,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at a5 {num}",
    "instructionAddress": 10011802,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 2d 6b",
    "instructionAddress": 10013216,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at b3 6b",
    "instructionAddress": 10013224,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 6d 6b",
    "instructionAddress": 10013232,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 7b {num}",
    "instructionAddress": 10013240,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} 6b",
    "instructionAddress": 10013248,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 9b {num}",
    "instructionAddress": 10013256,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at ad {num}",
    "instructionAddress": 10018516,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at c6 3a",
    "instructionAddress": 10018524,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at cb {num}",
    "instructionAddress": 10018594,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at b1 {num}",
    "instructionAddress": 10018672,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at cf {num}",
    "instructionAddress": 10018680,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at cd {num}",
    "instructionAddress": 10018750,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at af {num}",
    "instructionAddress": 10018758,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at b7 {num}",
    "instructionAddress": 10018766,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at b7 1b",
    "instructionAddress": 10019043,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} 5f",
    "instructionAddress": 10019104,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 6d {num}",
    "instructionAddress": 10019245,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 8f 5f",
    "instructionAddress": 10019253,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at c7 {num}",
    "instructionAddress": 10019321,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 6f 2b",
    "instructionAddress": 10019420,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 8f 2b",
    "instructionAddress": 10019444,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 8b 2b",
    "instructionAddress": 10019452,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 2b 1d",
    "instructionAddress": 10069907,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 4b {num}",
    "instructionAddress": 10083342,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 1f 1d",
    "instructionAddress": 10126385,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} 0f",
    "instructionAddress": 10128710,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 1a 0e",
    "instructionAddress": 10128832,
    "expectedSize": 7,
    "opcode": 186
  },
  {
    "shape": "load npc 6c at 1e {num}",
    "instructionAddress": 10129083,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} 3b",
    "instructionAddress": 10134241,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 0f 9b",
    "instructionAddress": 10134257,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 2b 9b",
    "instructionAddress": 10134273,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} {num}",
    "instructionAddress": 10134281,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 2b {num}",
    "instructionAddress": 10134289,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 0f b9",
    "instructionAddress": 10134297,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 2b ab",
    "instructionAddress": 10134313,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at 0f 8b",
    "instructionAddress": 10134329,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} 3f",
    "instructionAddress": 10145884,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at {num} 1d",
    "instructionAddress": 10191083,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 6a at 1b {num}",
    "instructionAddress": 10192404,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 6a at {num} {num}",
    "instructionAddress": 10192420,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 7d at {num} {num}",
    "instructionAddress": 10193184,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc {num} at b5 {num}",
    "instructionAddress": 10195863,
    "expectedSize": 4,
    "opcode": 186
  },
  {
    "shape": "load npc 6f at 9f {num}",
    "instructionAddress": 10195882,
    "expectedSize": 4,
    "opcode": 186
  }
];

test('opcode shape corpus 0xba', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
