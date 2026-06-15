import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "teleport boy to x:{mem} - {hex}, y:{mem}",
    "instructionAddress": 9625837,
    "expectedSize": 12,
    "opcode": 67
  },
  {
    "shape": "teleport dog to x:{mem} - {hex}, y:{mem}",
    "instructionAddress": 9625849,
    "expectedSize": 18,
    "opcode": 67
  },
  {
    "shape": "teleport signed arg30 to x:signed arg0 + signed arg32, y:signed arg4 + {num}",
    "instructionAddress": 9626138,
    "expectedSize": 100,
    "opcode": 67
  },
  {
    "shape": "teleport signed arg12 to x:{mem} + {hex}, y:{mem} + {hex}",
    "instructionAddress": 9626337,
    "expectedSize": 30,
    "opcode": 67
  },
  {
    "shape": "teleport {mem} to x:{mem} - {num}, y:{mem}",
    "instructionAddress": 9626782,
    "expectedSize": 13,
    "opcode": 67
  },
  {
    "shape": "teleport boy to x:*(controlled char + {num}) + {num}, y:*(controlled char + {num}) + {num}",
    "instructionAddress": 9679528,
    "expectedSize": 18,
    "opcode": 67
  },
  {
    "shape": "teleport boy to x:*(boy + {num}) + {num}, y:*(boy + {num})",
    "instructionAddress": 9687891,
    "expectedSize": 15,
    "opcode": 67
  },
  {
    "shape": "teleport boy to x:{num}, y:{num}",
    "instructionAddress": 9733840,
    "expectedSize": 4,
    "opcode": 67
  },
  {
    "shape": "teleport dog to x:{num}, y:{num}",
    "instructionAddress": 9733844,
    "expectedSize": 4,
    "opcode": 67
  },
  {
    "shape": "teleport {mem} to x:{hex}, y:{hex}",
    "instructionAddress": 9738839,
    "expectedSize": 10,
    "opcode": 67
  },
  {
    "shape": "teleport {mem} to x:{hex}, y:{mem}",
    "instructionAddress": 9745502,
    "expectedSize": 9,
    "opcode": 67
  },
  {
    "shape": "teleport boy to x:{mem}, y:{mem}",
    "instructionAddress": 9752159,
    "expectedSize": 8,
    "opcode": 67
  },
  {
    "shape": "teleport boy to x:{mem} + {num}, y:{mem} - {num}",
    "instructionAddress": 9759564,
    "expectedSize": 14,
    "opcode": 67
  },
  {
    "shape": "teleport dog to x:{mem} + {num}, y:{mem} - {num}",
    "instructionAddress": 9759578,
    "expectedSize": 14,
    "opcode": 67
  },
  {
    "shape": "teleport {mem} to x:{mem}, y:{mem} + {hex}",
    "instructionAddress": 9812885,
    "expectedSize": 14,
    "opcode": 67
  },
  {
    "shape": "teleport boy to x:{mem}, y:{mem} + {hex}",
    "instructionAddress": 9812910,
    "expectedSize": 12,
    "opcode": 67
  },
  {
    "shape": "teleport dog to x:{mem}, y:{mem} - {num}",
    "instructionAddress": 9946609,
    "expectedSize": 11,
    "opcode": 67
  },
  {
    "shape": "teleport {mem} to x:{mem}, y:{num}",
    "instructionAddress": 9946735,
    "expectedSize": 8,
    "opcode": 67
  },
  {
    "shape": "teleport boy to x:{mem}, y:{num}",
    "instructionAddress": 9946743,
    "expectedSize": 6,
    "opcode": 67
  },
  {
    "shape": "teleport dog to x:{mem}, y:{num}",
    "instructionAddress": 9946749,
    "expectedSize": 6,
    "opcode": 67
  },
  {
    "shape": "teleport {mem} to x:{mem}, y:{mem}",
    "instructionAddress": 9948206,
    "expectedSize": 10,
    "opcode": 67
  },
  {
    "shape": "teleport {mem} to x:signed arg0, y:{num}",
    "instructionAddress": 9948361,
    "expectedSize": 7,
    "opcode": 67
  },
  {
    "shape": "teleport boy to x:signed arg0, y:{num}",
    "instructionAddress": 9948368,
    "expectedSize": 5,
    "opcode": 67
  },
  {
    "shape": "teleport dog to x:signed arg0, y:{num}",
    "instructionAddress": 9948373,
    "expectedSize": 5,
    "opcode": 67
  },
  {
    "shape": "teleport last entity ({mem}) to x:*(last entity ({mem}) + {num}) - {num}, y:*(last entity ({mem}) + {num}) + {hex}",
    "instructionAddress": 9955427,
    "expectedSize": 19,
    "opcode": 67
  },
  {
    "shape": "teleport last entity ({mem}) to x:*(last entity ({mem}) + {num}) + {hex}, y:*(last entity ({mem}) + {num}) + {num}",
    "instructionAddress": 9955481,
    "expectedSize": 19,
    "opcode": 67
  },
  {
    "shape": "teleport last entity ({mem}) to x:*(last entity ({mem}) + {num}) - {hex}, y:*(last entity ({mem}) + {num}) - {hex}",
    "instructionAddress": 9955508,
    "expectedSize": 20,
    "opcode": 67
  },
  {
    "shape": "teleport last entity ({mem}) to x:*(last entity ({mem}) + {num}), y:*(last entity ({mem}) + {num}) + {num}",
    "instructionAddress": 9955536,
    "expectedSize": 15,
    "opcode": 67
  },
  {
    "shape": "teleport boy to x:signed arg0, y:signed arg2",
    "instructionAddress": 9996568,
    "expectedSize": 6,
    "opcode": 67
  },
  {
    "shape": "teleport non-controlled char to x:{num}, y:{num}",
    "instructionAddress": 9998643,
    "expectedSize": 5,
    "opcode": 67
  },
  {
    "shape": "teleport {mem} to x:{num}, y:{num}",
    "instructionAddress": 9999659,
    "expectedSize": 6,
    "opcode": 67
  },
  {
    "shape": "teleport dog to x:{mem}, y:{mem}",
    "instructionAddress": 9999691,
    "expectedSize": 8,
    "opcode": 67
  },
  {
    "shape": "teleport dog to x:signed arg0, y:signed arg2",
    "instructionAddress": 10006810,
    "expectedSize": 7,
    "opcode": 67
  },
  {
    "shape": "teleport dog to x:{mem} + {num}, y:{mem}",
    "instructionAddress": 10008657,
    "expectedSize": 11,
    "opcode": 67
  },
  {
    "shape": "teleport {mem} to x:{mem} + {num}, y:{mem} + {num}",
    "instructionAddress": 10063068,
    "expectedSize": 16,
    "opcode": 67
  },
  {
    "shape": "teleport boy to x:{mem} - {num}, y:{mem} - {num}",
    "instructionAddress": 10070062,
    "expectedSize": 14,
    "opcode": 67
  },
  {
    "shape": "teleport boy to x:{mem} - {num}, y:{mem}",
    "instructionAddress": 10079491,
    "expectedSize": 11,
    "opcode": 67
  },
  {
    "shape": "teleport dog to x:{mem} - {num}, y:{mem} + {num}",
    "instructionAddress": 10079502,
    "expectedSize": 14,
    "opcode": 67
  },
  {
    "shape": "teleport signed arg16 to x:signed arg0 + {num}, y:signed arg2 - {hex}",
    "instructionAddress": 10128877,
    "expectedSize": 20,
    "opcode": 67
  },
  {
    "shape": "teleport signed arg18 to x:signed arg0 + {hex}, y:signed arg2 - {hex}",
    "instructionAddress": 10128900,
    "expectedSize": 21,
    "opcode": 67
  },
  {
    "shape": "teleport signed arg24 to x:signed arg0 + {hex}, y:signed arg2 - {hex}",
    "instructionAddress": 10128936,
    "expectedSize": 21,
    "opcode": 67
  },
  {
    "shape": "teleport signed arg14 to x:signed arg0 + {hex}, y:signed arg2 - {num}",
    "instructionAddress": 10128960,
    "expectedSize": 20,
    "opcode": 67
  },
  {
    "shape": "teleport signed arg20 to x:signed arg0 + {num}, y:signed arg2 - {num}",
    "instructionAddress": 10128980,
    "expectedSize": 19,
    "opcode": 67
  },
  {
    "shape": "teleport signed arg22 to x:signed arg0 + {hex}, y:signed arg2 - {num}",
    "instructionAddress": 10128999,
    "expectedSize": 14,
    "opcode": 67
  },
  {
    "shape": "teleport {mem} to x:signed arg0, y:signed arg2",
    "instructionAddress": 10129624,
    "expectedSize": 15,
    "opcode": 67
  },
  {
    "shape": "teleport {mem} to x:signed arg8, y:signed arg10",
    "instructionAddress": 10129813,
    "expectedSize": 8,
    "opcode": 67
  },
  {
    "shape": "teleport {mem} to x:signed arg8, y:signed arg10 + {hex}",
    "instructionAddress": 10129881,
    "expectedSize": 12,
    "opcode": 67
  },
  {
    "shape": "teleport {mem} to x:*(boy + {num}) + {hex}, y:*(boy + {num})",
    "instructionAddress": 10129977,
    "expectedSize": 18,
    "opcode": 67
  },
  {
    "shape": "teleport boy to x:{mem} + {num}, y:{mem}",
    "instructionAddress": 10214803,
    "expectedSize": 11,
    "opcode": 67
  },
  {
    "shape": "teleport dog to x:{mem} + {num}, y:{mem} + {num}",
    "instructionAddress": 10214816,
    "expectedSize": 14,
    "opcode": 67
  },
  {
    "shape": "teleport dog to x:signed arg0 + {num}, y:signed arg2",
    "instructionAddress": 10216282,
    "expectedSize": 9,
    "opcode": 67
  }
];

test('opcode shape corpus 0x43', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
