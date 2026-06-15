import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "teleport both to 1c 0f",
    "instructionAddress": 9626833,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 0b 6b",
    "instructionAddress": 9627039,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} 6b",
    "instructionAddress": 9629464,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} {num}",
    "instructionAddress": 9668040,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 0f 3f",
    "instructionAddress": 9672266,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 0d 0b",
    "instructionAddress": 9680848,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} a1",
    "instructionAddress": 9683656,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} a9",
    "instructionAddress": 9684011,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 1c {num}",
    "instructionAddress": 9684454,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 2f {num}",
    "instructionAddress": 9691169,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} 0b",
    "instructionAddress": 9733800,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 0b b0",
    "instructionAddress": 9736220,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} a7",
    "instructionAddress": 9739130,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to d5 8b",
    "instructionAddress": 9740247,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to eb {num}",
    "instructionAddress": 9740273,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 6f 1b",
    "instructionAddress": 9742476,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to c6 1d",
    "instructionAddress": 9742666,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 1a {num}",
    "instructionAddress": 9744902,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 0f 1b",
    "instructionAddress": 9757176,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 1d {num}",
    "instructionAddress": 9758213,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} 1d",
    "instructionAddress": 9758623,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 0b 0b",
    "instructionAddress": 9758892,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} 0f",
    "instructionAddress": 9759530,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} 5a",
    "instructionAddress": 9798733,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 8a {num}",
    "instructionAddress": 9802610,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to a9 {num}",
    "instructionAddress": 9802674,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} 6c",
    "instructionAddress": 9804303,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to c9 {num}",
    "instructionAddress": 9808084,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 1b 4b",
    "instructionAddress": 9812681,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 4c {num}",
    "instructionAddress": 9816701,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} 3f",
    "instructionAddress": 9819910,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 0d 3b",
    "instructionAddress": 9824544,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} 4b",
    "instructionAddress": 9877047,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 3a {num}",
    "instructionAddress": 9878750,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 3d {num}",
    "instructionAddress": 9883374,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} 2d",
    "instructionAddress": 9887595,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 1e 2a",
    "instructionAddress": 9887757,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 1b 5d",
    "instructionAddress": 9932351,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} 7b",
    "instructionAddress": 9934072,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 3f 0d",
    "instructionAddress": 9934098,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 3f 4d",
    "instructionAddress": 9938942,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 0b 1b",
    "instructionAddress": 9946442,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 2b b7",
    "instructionAddress": 9951425,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 0f 3d",
    "instructionAddress": 9952614,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} 1b",
    "instructionAddress": 9952849,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 0f 5f",
    "instructionAddress": 9998426,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to b7 {num}",
    "instructionAddress": 9999604,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 1f 3b",
    "instructionAddress": 10001547,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} 3d",
    "instructionAddress": 10006905,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} 5f",
    "instructionAddress": 10020886,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 1b 1f",
    "instructionAddress": 10022799,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 0f 1d",
    "instructionAddress": 10063929,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 1b 4f",
    "instructionAddress": 10064763,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} f1",
    "instructionAddress": 10069708,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 1b {num}",
    "instructionAddress": 10079719,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 0f {num}",
    "instructionAddress": 10082485,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} 5b",
    "instructionAddress": 10125745,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 4d {num}",
    "instructionAddress": 10125965,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} c1",
    "instructionAddress": 10134211,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 1d 1f",
    "instructionAddress": 10140356,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 3f {num}",
    "instructionAddress": 10140777,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 1e {num}",
    "instructionAddress": 10142637,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} 3b",
    "instructionAddress": 10145701,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to {num} 1a",
    "instructionAddress": 10190855,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 0f 6d",
    "instructionAddress": 10192328,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 3a 4e",
    "instructionAddress": 10193122,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 0b {num}",
    "instructionAddress": 10205736,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 3e {num}",
    "instructionAddress": 10214515,
    "expectedSize": 3,
    "opcode": 32
  },
  {
    "shape": "teleport both to 3b {num}",
    "instructionAddress": 10216104,
    "expectedSize": 3,
    "opcode": 32
  }
];

test('opcode shape corpus 0x20', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
