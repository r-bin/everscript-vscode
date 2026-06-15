import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 66,
    "instructionAddress": 9757343,
    "expectedSize": 4,
    "text": "Teleport boy to 14, 5a"
  },
  {
    "opcode": 66,
    "instructionAddress": 9757347,
    "expectedSize": 4,
    "text": "Teleport dog to 1a, 5a"
  },
  {
    "opcode": 66,
    "instructionAddress": 9757764,
    "expectedSize": 4,
    "text": "Teleport boy to 64, 58"
  },
  {
    "opcode": 66,
    "instructionAddress": 9757768,
    "expectedSize": 4,
    "text": "Teleport dog to 6a, 52"
  },
  {
    "opcode": 66,
    "instructionAddress": 9733279,
    "expectedSize": 4,
    "text": "Teleport boy to 1d, 01"
  },
  {
    "opcode": 66,
    "instructionAddress": 9733283,
    "expectedSize": 4,
    "text": "Teleport dog to 1d, 01"
  },
  {
    "opcode": 66,
    "instructionAddress": 9744967,
    "expectedSize": 4,
    "text": "Teleport non-controlled char to 23, c2"
  },
  {
    "opcode": 66,
    "instructionAddress": 9744983,
    "expectedSize": 4,
    "text": "Teleport non-controlled char to 1f, 84"
  },
  {
    "opcode": 66,
    "instructionAddress": 9744990,
    "expectedSize": 4,
    "text": "Teleport non-controlled char to 1b, 72"
  },
  {
    "opcode": 66,
    "instructionAddress": 9745371,
    "expectedSize": 4,
    "text": "Teleport boy to 25, af"
  },
  {
    "opcode": 66,
    "instructionAddress": 9745375,
    "expectedSize": 4,
    "text": "Teleport dog to 27, b1"
  },
  {
    "opcode": 66,
    "instructionAddress": 9948384,
    "expectedSize": 4,
    "text": "Teleport dog to 33, 01"
  },
  {
    "opcode": 66,
    "instructionAddress": 9758905,
    "expectedSize": 4,
    "text": "Teleport boy to 00, 11"
  },
  {
    "opcode": 66,
    "instructionAddress": 9758909,
    "expectedSize": 4,
    "text": "Teleport dog to 00, 11"
  },
  {
    "opcode": 66,
    "instructionAddress": 9877542,
    "expectedSize": 4,
    "text": "Teleport dog to 1,1 (hidden)"
  },
  {
    "opcode": 66,
    "instructionAddress": 9822770,
    "expectedSize": 4,
    "text": "Teleport dog to 1,1 (hidden)"
  },
  {
    "opcode": 66,
    "instructionAddress": 9944870,
    "expectedSize": 4,
    "text": "Teleport controlled char to 33, 19"
  },
  {
    "opcode": 66,
    "instructionAddress": 9944883,
    "expectedSize": 4,
    "text": "Teleport controlled char to 41, 21"
  },
  {
    "opcode": 66,
    "instructionAddress": 9944887,
    "expectedSize": 4,
    "text": "Teleport non-controlled char to 41, 21"
  },
  {
    "opcode": 66,
    "instructionAddress": 9818100,
    "expectedSize": 4,
    "text": "Teleport boy to 13, 14"
  },
  {
    "opcode": 66,
    "instructionAddress": 9818104,
    "expectedSize": 4,
    "text": "Teleport dog to 0f, 14"
  },
  {
    "opcode": 66,
    "instructionAddress": 9819962,
    "expectedSize": 4,
    "text": "Teleport dog to 1,1 (hidden)"
  },
  {
    "opcode": 66,
    "instructionAddress": 9819298,
    "expectedSize": 4,
    "text": "Teleport boy to 01, 37"
  },
  {
    "opcode": 66,
    "instructionAddress": 9946761,
    "expectedSize": 4,
    "text": "Teleport dog to 2e, 01"
  },
  {
    "opcode": 66,
    "instructionAddress": 9824625,
    "expectedSize": 4,
    "text": "Teleport dog to 01, 05"
  },
  {
    "opcode": 66,
    "instructionAddress": 9816929,
    "expectedSize": 4,
    "text": "Teleport dog to 1,1 (hidden)"
  },
  {
    "opcode": 66,
    "instructionAddress": 9878955,
    "expectedSize": 4,
    "text": "Teleport dog to 1,1 (hidden)"
  },
  {
    "opcode": 66,
    "instructionAddress": 9812922,
    "expectedSize": 4,
    "text": "Teleport dog to 1,1 (hidden)"
  },
  {
    "opcode": 66,
    "instructionAddress": 9810825,
    "expectedSize": 4,
    "text": "Teleport boy to 13, 17"
  },
  {
    "opcode": 66,
    "instructionAddress": 9810842,
    "expectedSize": 4,
    "text": "Teleport dog to 21, 2b"
  },
  {
    "opcode": 66,
    "instructionAddress": 9810850,
    "expectedSize": 4,
    "text": "Teleport dog to 15, 19"
  },
  {
    "opcode": 66,
    "instructionAddress": 9810861,
    "expectedSize": 6,
    "text": "Teleport $2455 to 13, 0d"
  },
  {
    "opcode": 66,
    "instructionAddress": 9814479,
    "expectedSize": 4,
    "text": "Teleport boy to 24, 19"
  },
  {
    "opcode": 66,
    "instructionAddress": 9814497,
    "expectedSize": 4,
    "text": "Teleport dog to 24, 1d"
  },
  {
    "opcode": 66,
    "instructionAddress": 9814851,
    "expectedSize": 4,
    "text": "Teleport dog to 01, 41"
  },
  {
    "opcode": 66,
    "instructionAddress": 9945552,
    "expectedSize": 4,
    "text": "Teleport dog to 34, 01"
  },
  {
    "opcode": 66,
    "instructionAddress": 9887760,
    "expectedSize": 4,
    "text": "Teleport boy to 2a, 1e"
  },
  {
    "opcode": 66,
    "instructionAddress": 9887764,
    "expectedSize": 4,
    "text": "Teleport dog to 26, 21"
  },
  {
    "opcode": 66,
    "instructionAddress": 9887821,
    "expectedSize": 4,
    "text": "Teleport boy to 28, 33"
  },
  {
    "opcode": 66,
    "instructionAddress": 9887827,
    "expectedSize": 4,
    "text": "Teleport dog to 2a, 3c"
  },
  {
    "opcode": 66,
    "instructionAddress": 9952943,
    "expectedSize": 4,
    "text": "Teleport boy to 12, 17"
  },
  {
    "opcode": 66,
    "instructionAddress": 9952947,
    "expectedSize": 4,
    "text": "Teleport dog to 12, 17"
  },
  {
    "opcode": 66,
    "instructionAddress": 9952951,
    "expectedSize": 21,
    "text": "Teleport signed arg0 to 12, 17"
  },
  {
    "opcode": 66,
    "instructionAddress": 9808513,
    "expectedSize": 4,
    "text": "Teleport boy to 5d, 81"
  },
  {
    "opcode": 66,
    "instructionAddress": 9808517,
    "expectedSize": 4,
    "text": "Teleport dog to 5d, 81"
  },
  {
    "opcode": 66,
    "instructionAddress": 9808521,
    "expectedSize": 21,
    "text": "Teleport signed arg0 to 5d, 81"
  },
  {
    "opcode": 66,
    "instructionAddress": 9937846,
    "expectedSize": 4,
    "text": "Teleport boy to a1, b9"
  },
  {
    "opcode": 66,
    "instructionAddress": 9937850,
    "expectedSize": 4,
    "text": "Teleport dog to a1, b5"
  },
  {
    "opcode": 66,
    "instructionAddress": 9742499,
    "expectedSize": 6,
    "text": "Teleport $2455 to 19, 6e"
  },
  {
    "opcode": 66,
    "instructionAddress": 10064791,
    "expectedSize": 4,
    "text": "Teleport boy to 47, 19"
  },
  {
    "opcode": 66,
    "instructionAddress": 10064795,
    "expectedSize": 4,
    "text": "Teleport dog to 47, 19"
  },
  {
    "opcode": 66,
    "instructionAddress": 10140388,
    "expectedSize": 4,
    "text": "Teleport boy to 37, 27"
  },
  {
    "opcode": 66,
    "instructionAddress": 10018895,
    "expectedSize": 4,
    "text": "Teleport boy to 6f, 0b"
  },
  {
    "opcode": 66,
    "instructionAddress": 10018899,
    "expectedSize": 4,
    "text": "Teleport dog to 69, 11"
  },
  {
    "opcode": 66,
    "instructionAddress": 10018984,
    "expectedSize": 4,
    "text": "Teleport boy to 25, 0f"
  },
  {
    "opcode": 66,
    "instructionAddress": 10018988,
    "expectedSize": 4,
    "text": "Teleport dog to 22, 11"
  },
  {
    "opcode": 66,
    "instructionAddress": 10022890,
    "expectedSize": 6,
    "text": "Teleport $2836 to 13, 1b"
  },
  {
    "opcode": 66,
    "instructionAddress": 10063090,
    "expectedSize": 4,
    "text": "Teleport boy to 0e, 1d"
  },
  {
    "opcode": 66,
    "instructionAddress": 10063096,
    "expectedSize": 4,
    "text": "Teleport dog to 15, 1f"
  },
  {
    "opcode": 66,
    "instructionAddress": 10063111,
    "expectedSize": 6,
    "text": "Teleport $2455 to 0f, 23"
  },
  {
    "opcode": 66,
    "instructionAddress": 10063177,
    "expectedSize": 4,
    "text": "Teleport boy to 0e, 1d"
  },
  {
    "opcode": 66,
    "instructionAddress": 10063183,
    "expectedSize": 4,
    "text": "Teleport dog to 0f, 23"
  },
  {
    "opcode": 66,
    "instructionAddress": 10008646,
    "expectedSize": 4,
    "text": "Teleport boy to 0f, 0b"
  },
  {
    "opcode": 66,
    "instructionAddress": 10214713,
    "expectedSize": 4,
    "text": "Teleport boy to 14, 3e"
  },
  {
    "opcode": 66,
    "instructionAddress": 10214717,
    "expectedSize": 4,
    "text": "Teleport dog to 14, 3e"
  },
  {
    "opcode": 66,
    "instructionAddress": 10214728,
    "expectedSize": 4,
    "text": "Teleport boy to 3b, 01"
  },
  {
    "opcode": 66,
    "instructionAddress": 10214732,
    "expectedSize": 4,
    "text": "Teleport dog to 3b, 01"
  },
  {
    "opcode": 66,
    "instructionAddress": 10205664,
    "expectedSize": 4,
    "text": "Teleport boy to 1f, 12"
  },
  {
    "opcode": 66,
    "instructionAddress": 10205668,
    "expectedSize": 4,
    "text": "Teleport dog to 1f, 16"
  },
  {
    "opcode": 66,
    "instructionAddress": 9629495,
    "expectedSize": 4,
    "text": "Teleport boy to ff, ff"
  },
  {
    "opcode": 66,
    "instructionAddress": 9629499,
    "expectedSize": 4,
    "text": "Teleport dog to 6b, 01"
  },
  {
    "opcode": 66,
    "instructionAddress": 9629557,
    "expectedSize": 4,
    "text": "Teleport boy to 6b, 01"
  }
];

test('opcode corpus 0x42', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
