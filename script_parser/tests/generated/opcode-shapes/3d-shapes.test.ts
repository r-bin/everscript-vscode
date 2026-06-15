import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): acid rain guy",
    "instructionAddress": 9678628,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): volcano room1 npc {num}",
    "instructionAddress": 9740576,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): speed dude",
    "instructionAddress": 9740656,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): jaguar ring dude",
    "instructionAddress": 9742444,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): hb guy",
    "instructionAddress": 9742488,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): cave npc {num}",
    "instructionAddress": 9742533,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): drain guy",
    "instructionAddress": 9742677,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): fe village npc1",
    "instructionAddress": 9752236,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): fe village npc2/bee boy",
    "instructionAddress": 9752248,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): fe village npc3",
    "instructionAddress": 9752274,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): fe village npc4",
    "instructionAddress": 9752288,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): fe village npc5",
    "instructionAddress": 9752302,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): fe village npc6",
    "instructionAddress": 9752316,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): fe village npc7",
    "instructionAddress": 9752340,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): fe village npc8",
    "instructionAddress": 9752356,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): fe village npc9",
    "instructionAddress": 9752383,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): fe village npc10",
    "instructionAddress": 9752401,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): fe village npc11",
    "instructionAddress": 9752440,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): fe village npc12",
    "instructionAddress": 9752493,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): hut npc {num}",
    "instructionAddress": 9757291,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): hut npc {num}",
    "instructionAddress": 9757363,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): fire eyes",
    "instructionAddress": 9757642,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): blimp (in hut)",
    "instructionAddress": 9757726,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): defend guy",
    "instructionAddress": 9758115,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): strong heart (inside hut)",
    "instructionAddress": 9758659,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): 'mids [{num}]",
    "instructionAddress": 9802688,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): blimp (in cave)",
    "instructionAddress": 9810781,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): north of market tiny dialog",
    "instructionAddress": 9816882,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): market npc {num}",
    "instructionAddress": 9877366,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): horace camp madronius",
    "instructionAddress": 9887723,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): act2/horace camp inn keeper(s)",
    "instructionAddress": 9887737,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): horace in camp?",
    "instructionAddress": 9887810,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): madronius' brother in ruins",
    "instructionAddress": 9937630,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): fire power dude",
    "instructionAddress": 9996917,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): dog maze lady",
    "instructionAddress": 9999653,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): corrosion guy",
    "instructionAddress": 10007384,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc1",
    "instructionAddress": 10018520,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc2",
    "instructionAddress": 10018528,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc3",
    "instructionAddress": 10018598,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc4",
    "instructionAddress": 10018606,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc5",
    "instructionAddress": 10018676,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc6",
    "instructionAddress": 10018684,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc7",
    "instructionAddress": 10018754,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc8",
    "instructionAddress": 10018762,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc9",
    "instructionAddress": 10018770,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): act3 shop?",
    "instructionAddress": 10018957,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc10",
    "instructionAddress": 10019047,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc11",
    "instructionAddress": 10019108,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): lance dialog",
    "instructionAddress": 10019186,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc13",
    "instructionAddress": 10019249,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc14",
    "instructionAddress": 10019257,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc15",
    "instructionAddress": 10019325,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc16",
    "instructionAddress": 10019424,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc17",
    "instructionAddress": 10019432,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc18",
    "instructionAddress": 10019440,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc19",
    "instructionAddress": 10019448,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): act3 houses npc20",
    "instructionAddress": 10019456,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): regrowth lady",
    "instructionAddress": 10019532,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): tinker",
    "instructionAddress": 10063031,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): dude below chessboard",
    "instructionAddress": 10083295,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): unnamed npc talk script {hex}",
    "instructionAddress": 10134277,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): unnamed npc talk script {hex}",
    "instructionAddress": 10136341,
    "expectedSize": 6,
    "opcode": 61
  },
  {
    "shape": "write last entity ({mem})+x66={hex}, last entity ({mem})+x68={hex} (talk script): naris",
    "instructionAddress": 10140866,
    "expectedSize": 4,
    "opcode": 61
  },
  {
    "shape": "write {mem}+x66={hex}, {mem}+x68={hex} (talk script): prof. ruffelburg",
    "instructionAddress": 10214577,
    "expectedSize": 6,
    "opcode": 61
  }
];

test('opcode shape corpus 0x3d', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
