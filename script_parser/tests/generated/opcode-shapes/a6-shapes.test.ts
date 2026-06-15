import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "rcall -{num} (to {hex}): thraxx enter part [{num}]",
    "instructionAddress": 9688049,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): hardball dialog",
    "instructionAddress": 9742768,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): magmar intro part [{num}]",
    "instructionAddress": 9748072,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): fe village call outro",
    "instructionAddress": 9752177,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): fe village credits",
    "instructionAddress": 9752201,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): fe cutscene {num}",
    "instructionAddress": 9757841,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): fe first encounter",
    "instructionAddress": 9757857,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): blimp in hut after salabog?",
    "instructionAddress": 9757879,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): crustacia intro",
    "instructionAddress": 9798961,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): blimp's cave",
    "instructionAddress": 9810907,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): crush dialog",
    "instructionAddress": 9812960,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): palace cutscene part [{num}]",
    "instructionAddress": 9819356,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): square outro cutscene",
    "instructionAddress": 9822379,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): sacred dog cutscene",
    "instructionAddress": 9822809,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): unknown",
    "instructionAddress": 9885310,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): horace pit cutscene",
    "instructionAddress": 9887877,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): queen below chessboard pt2",
    "instructionAddress": 10001610,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): ebon keep throne room outro",
    "instructionAddress": 10022837,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): ebon keep throne room credits",
    "instructionAddress": 10022859,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): ebon keep throne room cutscene",
    "instructionAddress": 10022905,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): tinker part [{num}]",
    "instructionAddress": 10063037,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): tinker part [{num}] (rocket done?)",
    "instructionAddress": 10063251,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): gomi's tower part [{num}]",
    "instructionAddress": 10069928,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): doubles room enter part [{num}]",
    "instructionAddress": 10079632,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): vigor enter part [{num}] / script / animation",
    "instructionAddress": 10087852,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): puppet show [{num}] (fight)",
    "instructionAddress": 10129541,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): banquet cutscene {num}",
    "instructionAddress": 10142741,
    "expectedSize": 3,
    "opcode": 166
  },
  {
    "shape": "rcall -{num} (to {hex}): prof. lab part [{num}]",
    "instructionAddress": 10214614,
    "expectedSize": 3,
    "opcode": 166
  }
];

test('opcode shape corpus 0xa6', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
