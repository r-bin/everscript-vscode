import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "teleport boy to ff, ff",
    "instructionAddress": 9629495,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport dog to 6b, {num}",
    "instructionAddress": 9629499,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport boy to 6b, {num}",
    "instructionAddress": 9629557,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport boy to 1d, {num}",
    "instructionAddress": 9733279,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport dog to 1d, {num}",
    "instructionAddress": 9733283,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport {mem} to {num}, 6e",
    "instructionAddress": 9742499,
    "expectedSize": 6,
    "opcode": 66
  },
  {
    "shape": "teleport non-controlled char to {num}, c2",
    "instructionAddress": 9744967,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport non-controlled char to 1f, {num}",
    "instructionAddress": 9744983,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport non-controlled char to 1b, {num}",
    "instructionAddress": 9744990,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport boy to {num}, af",
    "instructionAddress": 9745371,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport dog to {num}, b1",
    "instructionAddress": 9745375,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport boy to {num}, 5a",
    "instructionAddress": 9757343,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport dog to 1a, 5a",
    "instructionAddress": 9757347,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport dog to 6a, {num}",
    "instructionAddress": 9757768,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport boy to {num}, {num}",
    "instructionAddress": 9758905,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport boy to 5d, {num}",
    "instructionAddress": 9808513,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport dog to 5d, {num}",
    "instructionAddress": 9808517,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport signed arg0 to 5d, {num}",
    "instructionAddress": 9808521,
    "expectedSize": 21,
    "opcode": 66
  },
  {
    "shape": "teleport dog to {num}, 2b",
    "instructionAddress": 9810842,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport {mem} to {num}, 0d",
    "instructionAddress": 9810861,
    "expectedSize": 6,
    "opcode": 66
  },
  {
    "shape": "teleport dog to {num}, 1d",
    "instructionAddress": 9814497,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport dog to 0f, {num}",
    "instructionAddress": 9818104,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport dog to {num},{num} (hidden)",
    "instructionAddress": 9822770,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport dog to {num}, {num}",
    "instructionAddress": 9824625,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport boy to 2a, 1e",
    "instructionAddress": 9887760,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport dog to 2a, 3c",
    "instructionAddress": 9887827,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport boy to a1, b9",
    "instructionAddress": 9937846,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport dog to a1, b5",
    "instructionAddress": 9937850,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport controlled char to {num}, {num}",
    "instructionAddress": 9944883,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport non-controlled char to {num}, {num}",
    "instructionAddress": 9944887,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport dog to 2e, {num}",
    "instructionAddress": 9946761,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport signed arg0 to {num}, {num}",
    "instructionAddress": 9952951,
    "expectedSize": 21,
    "opcode": 66
  },
  {
    "shape": "teleport boy to 0f, 0b",
    "instructionAddress": 10008646,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport boy to 6f, 0b",
    "instructionAddress": 10018895,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport boy to {num}, 0f",
    "instructionAddress": 10018984,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport {mem} to {num}, 1b",
    "instructionAddress": 10022890,
    "expectedSize": 6,
    "opcode": 66
  },
  {
    "shape": "teleport dog to {num}, 1f",
    "instructionAddress": 10063096,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport {mem} to 0f, {num}",
    "instructionAddress": 10063111,
    "expectedSize": 6,
    "opcode": 66
  },
  {
    "shape": "teleport boy to 0e, 1d",
    "instructionAddress": 10063177,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport boy to 1f, {num}",
    "instructionAddress": 10205664,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport dog to 1f, {num}",
    "instructionAddress": 10205668,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport boy to {num}, 3e",
    "instructionAddress": 10214713,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport dog to {num}, 3e",
    "instructionAddress": 10214717,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport boy to 3b, {num}",
    "instructionAddress": 10214728,
    "expectedSize": 4,
    "opcode": 66
  },
  {
    "shape": "teleport dog to 3b, {num}",
    "instructionAddress": 10214732,
    "expectedSize": 4,
    "opcode": 66
  }
];

test('opcode shape corpus 0x42', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
