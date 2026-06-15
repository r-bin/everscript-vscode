import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 61,
    "instructionAddress": 10019186,
    "expectedSize": 6,
    "text": "WRITE $2455+x66=0x1a07, $2455+x68=0x0040 (talk script): Lance dialog"
  },
  {
    "opcode": 61,
    "instructionAddress": 9877282,
    "expectedSize": 6,
    "text": "WRITE $2843+x66=0x1929, $2843+x68=0x0040 (talk script): Market NPC 5"
  },
  {
    "opcode": 61,
    "instructionAddress": 9752236,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1842, last entity ($0341)+x68=0x0040 (talk script): FE Village NPC1"
  },
  {
    "opcode": 61,
    "instructionAddress": 10134375,
    "expectedSize": 6,
    "text": "WRITE $2834+x66=0x1ab5, $2834+x68=0x0040 (talk script): Unnamed NPC talk script 0x1ab5"
  },
  {
    "opcode": 61,
    "instructionAddress": 9934189,
    "expectedSize": 6,
    "text": "WRITE $283b+x66=0x1986, $283b+x68=0x0040 (talk script): Unnamed NPC talk script 0x1986"
  },
  {
    "opcode": 61,
    "instructionAddress": 9885285,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1965, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x1965"
  },
  {
    "opcode": 61,
    "instructionAddress": 10134333,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1aa9, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x1aa9"
  },
  {
    "opcode": 61,
    "instructionAddress": 9738794,
    "expectedSize": 6,
    "text": "WRITE $2839+x66=0x17fa, $2839+x68=0x0040 (talk script): Unnamed NPC talk script 0x17fa"
  },
  {
    "opcode": 61,
    "instructionAddress": 9822437,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x18f9, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x18f9"
  },
  {
    "opcode": 61,
    "instructionAddress": 10134301,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1a97, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x1a97"
  },
  {
    "opcode": 61,
    "instructionAddress": 10019448,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1a2e, last entity ($0341)+x68=0x0040 (talk script): Act3 Houses NPC19"
  },
  {
    "opcode": 61,
    "instructionAddress": 10018684,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1a13, last entity ($0341)+x68=0x0040 (talk script): Act3 Houses NPC6"
  },
  {
    "opcode": 61,
    "instructionAddress": 9757672,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x185a, last entity ($0341)+x68=0x0040 (talk script): Hut NPC 7"
  },
  {
    "opcode": 61,
    "instructionAddress": 9740576,
    "expectedSize": 6,
    "text": "WRITE $2455+x66=0x1806, $2455+x68=0x0040 (talk script): Volcano Room1 NPC 1"
  },
  {
    "opcode": 61,
    "instructionAddress": 9752493,
    "expectedSize": 6,
    "text": "WRITE $283b+x66=0x1821, $283b+x68=0x0040 (talk script): FE Village NPC12"
  },
  {
    "opcode": 61,
    "instructionAddress": 9887737,
    "expectedSize": 6,
    "text": "WRITE $2835+x66=0x196e, $2835+x68=0x0040 (talk script): Act2/Horace camp Inn keeper(s)"
  },
  {
    "opcode": 61,
    "instructionAddress": 9814465,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x18db, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x18db"
  },
  {
    "opcode": 61,
    "instructionAddress": 9757726,
    "expectedSize": 6,
    "text": "WRITE $245b+x66=0x185d, $245b+x68=0x0040 (talk script): Blimp (in hut)"
  },
  {
    "opcode": 61,
    "instructionAddress": 9822445,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x18fc, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x18fc"
  },
  {
    "opcode": 61,
    "instructionAddress": 10011790,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x19e0, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x19e0"
  },
  {
    "opcode": 61,
    "instructionAddress": 10083295,
    "expectedSize": 6,
    "text": "WRITE $2455+x66=0x1a73, $2455+x68=0x0040 (talk script): Dude below chessboard"
  },
  {
    "opcode": 61,
    "instructionAddress": 9798767,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1866, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x1866"
  },
  {
    "opcode": 61,
    "instructionAddress": 9814647,
    "expectedSize": 6,
    "text": "WRITE $2836+x66=0x18c3, $2836+x68=0x0040 (talk script): Unnamed NPC talk script 0x18c3"
  },
  {
    "opcode": 61,
    "instructionAddress": 10011806,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x19e6, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x19e6"
  },
  {
    "opcode": 61,
    "instructionAddress": 9822904,
    "expectedSize": 6,
    "text": "WRITE $2836+x66=0x191a, $2836+x68=0x0040 (talk script): Unnamed NPC talk script 0x191a"
  },
  {
    "opcode": 61,
    "instructionAddress": 9822919,
    "expectedSize": 6,
    "text": "WRITE $283c+x66=0x1917, $283c+x68=0x0040 (talk script): Unnamed NPC talk script 0x1917"
  },
  {
    "opcode": 61,
    "instructionAddress": 9822453,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x18ff, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x18ff"
  },
  {
    "opcode": 61,
    "instructionAddress": 10136341,
    "expectedSize": 6,
    "text": "WRITE $2835+x66=0x1ac7, $2835+x68=0x0040 (talk script): Unnamed NPC talk script 0x1ac7"
  },
  {
    "opcode": 61,
    "instructionAddress": 9757363,
    "expectedSize": 6,
    "text": "WRITE $2837+x66=0x184b, $2837+x68=0x0040 (talk script): Hut NPC 3"
  },
  {
    "opcode": 61,
    "instructionAddress": 9877296,
    "expectedSize": 6,
    "text": "WRITE $2845+x66=0x192c, $2845+x68=0x0040 (talk script): Market NPC 6"
  },
  {
    "opcode": 61,
    "instructionAddress": 10018606,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1a1c, last entity ($0341)+x68=0x0040 (talk script): Act3 Houses NPC4"
  },
  {
    "opcode": 61,
    "instructionAddress": 10011758,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x19d7, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x19d7"
  },
  {
    "opcode": 61,
    "instructionAddress": 9877310,
    "expectedSize": 6,
    "text": "WRITE $2847+x66=0x194d, $2847+x68=0x0040 (talk script): Market NPC 7"
  },
  {
    "opcode": 61,
    "instructionAddress": 10011822,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x19ec, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x19ec"
  },
  {
    "opcode": 61,
    "instructionAddress": 9752383,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x183f, last entity ($0341)+x68=0x0040 (talk script): FE Village NPC9"
  },
  {
    "opcode": 61,
    "instructionAddress": 10134317,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1aa0, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x1aa0"
  },
  {
    "opcode": 61,
    "instructionAddress": 10134325,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1aa6, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x1aa6"
  },
  {
    "opcode": 61,
    "instructionAddress": 10018520,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1a22, last entity ($0341)+x68=0x0040 (talk script): Act3 Houses NPC1"
  },
  {
    "opcode": 61,
    "instructionAddress": 9758115,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1860, last entity ($0341)+x68=0x0040 (talk script): Defend Guy"
  },
  {
    "opcode": 61,
    "instructionAddress": 9877496,
    "expectedSize": 6,
    "text": "WRITE $2839+x66=0x1926, $2839+x68=0x0040 (talk script): Market NPC 18"
  },
  {
    "opcode": 61,
    "instructionAddress": 9814628,
    "expectedSize": 6,
    "text": "WRITE $2834+x66=0x18c0, $2834+x68=0x0040 (talk script): Unnamed NPC talk script 0x18c0"
  },
  {
    "opcode": 61,
    "instructionAddress": 9757415,
    "expectedSize": 6,
    "text": "WRITE $2455+x66=0x184e, $2455+x68=0x0040 (talk script): Hut NPC 4"
  },
  {
    "opcode": 61,
    "instructionAddress": 9887723,
    "expectedSize": 6,
    "text": "WRITE $2455+x66=0x196b, $2455+x68=0x0040 (talk script): Horace Camp Madronius"
  },
  {
    "opcode": 61,
    "instructionAddress": 10013210,
    "expectedSize": 6,
    "text": "WRITE $2834+x66=0x19f2, $2834+x68=0x0040 (talk script): Unnamed NPC talk script 0x19f2"
  },
  {
    "opcode": 61,
    "instructionAddress": 9742488,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1809, last entity ($0341)+x68=0x0040 (talk script): HB Guy"
  },
  {
    "opcode": 61,
    "instructionAddress": 9814699,
    "expectedSize": 6,
    "text": "WRITE $283c+x66=0x18c9, $283c+x68=0x0040 (talk script): Unnamed NPC talk script 0x18c9"
  },
  {
    "opcode": 61,
    "instructionAddress": 10070037,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1a55, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x1a55"
  },
  {
    "opcode": 61,
    "instructionAddress": 10013244,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x19fe, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x19fe"
  },
  {
    "opcode": 61,
    "instructionAddress": 9877408,
    "expectedSize": 6,
    "text": "WRITE $2859+x66=0x1953, $2859+x68=0x0040 (talk script): Market NPC 14"
  },
  {
    "opcode": 61,
    "instructionAddress": 9814808,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x18d8, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x18d8"
  },
  {
    "opcode": 61,
    "instructionAddress": 9877254,
    "expectedSize": 6,
    "text": "WRITE $283d+x66=0x1923, $283d+x68=0x0040 (talk script): Market NPC 4"
  },
  {
    "opcode": 61,
    "instructionAddress": 9822469,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1905, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x1905"
  },
  {
    "opcode": 61,
    "instructionAddress": 9996917,
    "expectedSize": 6,
    "text": "WRITE $2455+x66=0x19b3, $2455+x68=0x0040 (talk script): Fire Power Dude"
  },
  {
    "opcode": 61,
    "instructionAddress": 9822856,
    "expectedSize": 6,
    "text": "WRITE $2846+x66=0x190e, $2846+x68=0x0040 (talk script): Unnamed NPC talk script 0x190e"
  },
  {
    "opcode": 61,
    "instructionAddress": 9877352,
    "expectedSize": 6,
    "text": "WRITE $284f+x66=0x1947, $284f+x68=0x0040 (talk script): Market NPC 10"
  },
  {
    "opcode": 61,
    "instructionAddress": 9757515,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1854, last entity ($0341)+x68=0x0040 (talk script): Hut NPC 6"
  },
  {
    "opcode": 61,
    "instructionAddress": 9877444,
    "expectedSize": 6,
    "text": "WRITE $284b+x66=0x193e, $284b+x68=0x0040 (talk script): Market NPC 16"
  },
  {
    "opcode": 61,
    "instructionAddress": 10011798,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x19e3, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x19e3"
  },
  {
    "opcode": 61,
    "instructionAddress": 10019249,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1a3a, last entity ($0341)+x68=0x0040 (talk script): Act3 Houses NPC13"
  },
  {
    "opcode": 61,
    "instructionAddress": 10134349,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1ab2, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x1ab2"
  },
  {
    "opcode": 61,
    "instructionAddress": 9877212,
    "expectedSize": 6,
    "text": "WRITE $2835+x66=0x191d, $2835+x68=0x0040 (talk script): Market NPC 1"
  },
  {
    "opcode": 61,
    "instructionAddress": 10134285,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1a8e, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x1a8e"
  },
  {
    "opcode": 61,
    "instructionAddress": 10019440,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1a34, last entity ($0341)+x68=0x0040 (talk script): Act3 Houses NPC18"
  },
  {
    "opcode": 61,
    "instructionAddress": 10011742,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x19d1, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x19d1"
  },
  {
    "opcode": 61,
    "instructionAddress": 10013236,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x19fb, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x19fb"
  },
  {
    "opcode": 61,
    "instructionAddress": 9877394,
    "expectedSize": 6,
    "text": "WRITE $2855+x66=0x1938, $2855+x68=0x0040 (talk script): Market NPC 13"
  },
  {
    "opcode": 61,
    "instructionAddress": 9877240,
    "expectedSize": 6,
    "text": "WRITE $283b+x66=0x1944, $283b+x68=0x0040 (talk script): Market NPC 3"
  },
  {
    "opcode": 61,
    "instructionAddress": 9745353,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x181b, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x181b"
  },
  {
    "opcode": 61,
    "instructionAddress": 9810781,
    "expectedSize": 6,
    "text": "WRITE $2455+x66=0x18bd, $2455+x68=0x0040 (talk script): Blimp (in cave)"
  },
  {
    "opcode": 61,
    "instructionAddress": 9752356,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x182d, last entity ($0341)+x68=0x0040 (talk script): FE Village NPC8"
  },
  {
    "opcode": 61,
    "instructionAddress": 9877268,
    "expectedSize": 6,
    "text": "WRITE $2841+x66=0x194a, $2841+x68=0x0040 (talk script): Unnamed NPC talk script 0x194a"
  },
  {
    "opcode": 61,
    "instructionAddress": 9742533,
    "expectedSize": 6,
    "text": "WRITE $2455+x66=0x180f, $2455+x68=0x0040 (talk script): Cave NPC 3"
  },
  {
    "opcode": 61,
    "instructionAddress": 10013220,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x19f5, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x19f5"
  },
  {
    "opcode": 61,
    "instructionAddress": 9738833,
    "expectedSize": 6,
    "text": "WRITE $283b+x66=0x17fd, $283b+x68=0x0040 (talk script): Unnamed NPC talk script 0x17fd"
  },
  {
    "opcode": 61,
    "instructionAddress": 9937630,
    "expectedSize": 6,
    "text": "WRITE $2835+x66=0x1992, $2835+x68=0x0040 (talk script): Madronius' Brother in Ruins"
  },
  {
    "opcode": 61,
    "instructionAddress": 9822880,
    "expectedSize": 6,
    "text": "WRITE $284a+x66=0x1911, $284a+x68=0x0040 (talk script): Unnamed NPC talk script 0x1911"
  },
  {
    "opcode": 61,
    "instructionAddress": 9885270,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1962, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x1962"
  },
  {
    "opcode": 61,
    "instructionAddress": 9742576,
    "expectedSize": 6,
    "text": "WRITE $2839+x66=0x1812, $2839+x68=0x0040 (talk script): Cave NPC 4"
  },
  {
    "opcode": 61,
    "instructionAddress": 9802688,
    "expectedSize": 6,
    "text": "WRITE $283c+x66=0x187b, $283c+x68=0x0040 (talk script): 'mids [1]"
  },
  {
    "opcode": 61,
    "instructionAddress": 10134309,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1a9a, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x1a9a"
  },
  {
    "opcode": 61,
    "instructionAddress": 9816882,
    "expectedSize": 6,
    "text": "WRITE $2837+x66=0x18f3, $2837+x68=0x0040 (talk script): North of Market Tiny dialog"
  },
  {
    "opcode": 61,
    "instructionAddress": 10011750,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x19d4, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x19d4"
  },
  {
    "opcode": 61,
    "instructionAddress": 10019108,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1a16, last entity ($0341)+x68=0x0040 (talk script): Act3 Houses NPC11"
  },
  {
    "opcode": 61,
    "instructionAddress": 9999653,
    "expectedSize": 6,
    "text": "WRITE $2841+x66=0x19b6, $2841+x68=0x0040 (talk script): Dog Maze Lady"
  },
  {
    "opcode": 61,
    "instructionAddress": 9877338,
    "expectedSize": 6,
    "text": "WRITE $284d+x66=0x1932, $284d+x68=0x0040 (talk script): Market NPC 9"
  },
  {
    "opcode": 61,
    "instructionAddress": 9814771,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x18d5, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x18d5"
  },
  {
    "opcode": 61,
    "instructionAddress": 10140866,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1ad3, last entity ($0341)+x68=0x0040 (talk script): Naris"
  },
  {
    "opcode": 61,
    "instructionAddress": 10013252,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1a01, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x1a01"
  },
  {
    "opcode": 61,
    "instructionAddress": 10019424,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1a1f, last entity ($0341)+x68=0x0040 (talk script): Act3 Houses NPC16"
  },
  {
    "opcode": 61,
    "instructionAddress": 9752316,
    "expectedSize": 6,
    "text": "WRITE $2841+x66=0x1836, $2841+x68=0x0040 (talk script): FE Village NPC6"
  },
  {
    "opcode": 61,
    "instructionAddress": 10134269,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1aa3, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x1aa3"
  },
  {
    "opcode": 61,
    "instructionAddress": 9814673,
    "expectedSize": 6,
    "text": "WRITE $283a+x66=0x18c6, $283a+x68=0x0040 (talk script): Unnamed NPC talk script 0x18c6"
  },
  {
    "opcode": 61,
    "instructionAddress": 9814583,
    "expectedSize": 6,
    "text": "WRITE $284c+x66=0x18e1, $284c+x68=0x0040 (talk script): Unnamed NPC talk script 0x18e1"
  },
  {
    "opcode": 61,
    "instructionAddress": 10018676,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1a0d, last entity ($0341)+x68=0x0040 (talk script): Act3 Houses NPC5"
  },
  {
    "opcode": 61,
    "instructionAddress": 10214577,
    "expectedSize": 6,
    "text": "WRITE $285b+x66=0x1b72, $285b+x68=0x0040 (talk script): Prof. Ruffelburg"
  },
  {
    "opcode": 61,
    "instructionAddress": 9740656,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1803, last entity ($0341)+x68=0x0040 (talk script): Speed dude"
  },
  {
    "opcode": 61,
    "instructionAddress": 9757291,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x1848, last entity ($0341)+x68=0x0040 (talk script): Hut NPC 2"
  },
  {
    "opcode": 61,
    "instructionAddress": 9887810,
    "expectedSize": 6,
    "text": "WRITE $2837+x66=0x1968, $2837+x68=0x0040 (talk script): Horace in Camp?"
  },
  {
    "opcode": 61,
    "instructionAddress": 9816801,
    "expectedSize": 6,
    "text": "WRITE $2845+x66=0x18e7, $2845+x68=0x0040 (talk script): Unnamed NPC talk script 0x18e7"
  },
  {
    "opcode": 61,
    "instructionAddress": 10013228,
    "expectedSize": 4,
    "text": "WRITE last entity ($0341)+x66=0x19f8, last entity ($0341)+x68=0x0040 (talk script): Unnamed NPC talk script 0x19f8"
  }
];

test('opcode corpus 0x3d', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
