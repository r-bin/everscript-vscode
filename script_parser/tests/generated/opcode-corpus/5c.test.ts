import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 92,
    "instructionAddress": 9745063,
    "expectedSize": 3,
    "text": "SET OBJ 2 STATE = val:0 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10013368,
    "expectedSize": 3,
    "text": "SET OBJ 22 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10145809,
    "expectedSize": 3,
    "text": "SET OBJ 1 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10013350,
    "expectedSize": 3,
    "text": "SET OBJ 16 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10013480,
    "expectedSize": 4,
    "text": "SET OBJ 0x20 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9736880,
    "expectedSize": 5,
    "text": "SET OBJ 0x2d STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9745179,
    "expectedSize": 3,
    "text": "SET OBJ 0 STATE = val:2 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10006939,
    "expectedSize": 4,
    "text": "SET OBJ 3 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9745267,
    "expectedSize": 3,
    "text": "SET OBJ 0 STATE = val:0 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9736752,
    "expectedSize": 4,
    "text": "SET OBJ 26 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9998527,
    "expectedSize": 4,
    "text": "SET OBJ 17 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10191063,
    "expectedSize": 4,
    "text": "SET OBJ 7 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9681309,
    "expectedSize": 3,
    "text": "SET OBJ 1 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9946497,
    "expectedSize": 3,
    "text": "SET OBJ 1 STATE = val:0 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9946695,
    "expectedSize": 3,
    "text": "SET OBJ 0 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10013289,
    "expectedSize": 4,
    "text": "SET OBJ 0 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10146839,
    "expectedSize": 5,
    "text": "SET OBJ 0x40 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10012009,
    "expectedSize": 3,
    "text": "SET OBJ 17 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9736776,
    "expectedSize": 5,
    "text": "SET OBJ 0x20 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9745057,
    "expectedSize": 3,
    "text": "SET OBJ 0 STATE = val:0 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9683878,
    "expectedSize": 3,
    "text": "SET OBJ 8 STATE = val:0 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9822662,
    "expectedSize": 3,
    "text": "SET OBJ 5 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9687623,
    "expectedSize": 5,
    "text": "SET OBJ $249b STATE = val:2 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9745152,
    "expectedSize": 3,
    "text": "SET OBJ 5 STATE = val:0 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9745033,
    "expectedSize": 3,
    "text": "SET OBJ 2 STATE = val:0 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10011973,
    "expectedSize": 3,
    "text": "SET OBJ 5 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10088138,
    "expectedSize": 4,
    "text": "SET OBJ 0 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9736833,
    "expectedSize": 5,
    "text": "SET OBJ 0x28 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9808145,
    "expectedSize": 4,
    "text": "SET OBJ 4 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10011925,
    "expectedSize": 3,
    "text": "SET OBJ 0 STATE = val:2 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9948113,
    "expectedSize": 3,
    "text": "SET OBJ 1 STATE = val:0 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10214651,
    "expectedSize": 3,
    "text": "SET OBJ 11 STATE = val:2 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9752583,
    "expectedSize": 3,
    "text": "SET OBJ 18 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10214657,
    "expectedSize": 3,
    "text": "SET OBJ 16 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10011985,
    "expectedSize": 3,
    "text": "SET OBJ 9 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9996831,
    "expectedSize": 4,
    "text": "SET OBJ 31 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9736786,
    "expectedSize": 5,
    "text": "SET OBJ 0x22 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9736906,
    "expectedSize": 5,
    "text": "SET OBJ 0x30 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10128921,
    "expectedSize": 3,
    "text": "SET OBJ 9 STATE = val:2 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10019518,
    "expectedSize": 4,
    "text": "SET OBJ 0x22 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9877108,
    "expectedSize": 4,
    "text": "SET OBJ 0x27 STATE = val:2 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9681318,
    "expectedSize": 3,
    "text": "SET OBJ 4 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10011960,
    "expectedSize": 3,
    "text": "SET OBJ 26 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10190944,
    "expectedSize": 3,
    "text": "SET OBJ 3 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10011991,
    "expectedSize": 3,
    "text": "SET OBJ 11 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9937857,
    "expectedSize": 3,
    "text": "SET OBJ 3 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9745003,
    "expectedSize": 3,
    "text": "SET OBJ 6 STATE = val:3 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10019340,
    "expectedSize": 3,
    "text": "SET OBJ 28 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10006676,
    "expectedSize": 4,
    "text": "SET OBJ 9 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9808165,
    "expectedSize": 4,
    "text": "SET OBJ 6 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9736828,
    "expectedSize": 5,
    "text": "SET OBJ 0x27 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10145812,
    "expectedSize": 3,
    "text": "SET OBJ 2 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9736896,
    "expectedSize": 5,
    "text": "SET OBJ 0x2e STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10011928,
    "expectedSize": 3,
    "text": "SET OBJ 3 STATE = val:2 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10013532,
    "expectedSize": 3,
    "text": "SET OBJ 1 STATE = val:0 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9745000,
    "expectedSize": 3,
    "text": "SET OBJ 17 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9736854,
    "expectedSize": 5,
    "text": "SET OBJ 0x2a STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9822680,
    "expectedSize": 3,
    "text": "SET OBJ 0 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10128468,
    "expectedSize": 3,
    "text": "SET OBJ 7 STATE = val:3 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9745027,
    "expectedSize": 3,
    "text": "SET OBJ 0 STATE = val:2 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9629621,
    "expectedSize": 3,
    "text": "SET OBJ 1 STATE = val:6 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10064290,
    "expectedSize": 3,
    "text": "SET OBJ 8 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10195802,
    "expectedSize": 4,
    "text": "SET OBJ 3 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10069757,
    "expectedSize": 3,
    "text": "SET OBJ 6 STATE = val:0 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10214669,
    "expectedSize": 3,
    "text": "SET OBJ 14 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9745343,
    "expectedSize": 3,
    "text": "SET OBJ 2 STATE = val:2 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9948107,
    "expectedSize": 3,
    "text": "SET OBJ 2 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10011916,
    "expectedSize": 3,
    "text": "SET OBJ 26 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9745313,
    "expectedSize": 3,
    "text": "SET OBJ 2 STATE = val:0 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10020938,
    "expectedSize": 3,
    "text": "SET OBJ 4 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9681321,
    "expectedSize": 3,
    "text": "SET OBJ 5 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10011979,
    "expectedSize": 3,
    "text": "SET OBJ 7 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10003308,
    "expectedSize": 4,
    "text": "SET OBJ 6 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9996813,
    "expectedSize": 5,
    "text": "SET OBJ 0x25 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9745194,
    "expectedSize": 3,
    "text": "SET OBJ 1 STATE = val:2 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10082759,
    "expectedSize": 4,
    "text": "SET OBJ 1 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9946500,
    "expectedSize": 3,
    "text": "SET OBJ 0 STATE = val:0 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9996897,
    "expectedSize": 5,
    "text": "SET OBJ 0x29 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10012135,
    "expectedSize": 3,
    "text": "SET OBJ 3 STATE = val:0 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9745227,
    "expectedSize": 3,
    "text": "SET OBJ 2 STATE = val:0 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9745224,
    "expectedSize": 3,
    "text": "SET OBJ 1 STATE = val:0 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9736807,
    "expectedSize": 5,
    "text": "SET OBJ 0x25 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9736838,
    "expectedSize": 5,
    "text": "SET OBJ 0x29 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10012012,
    "expectedSize": 3,
    "text": "SET OBJ 18 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9744947,
    "expectedSize": 3,
    "text": "SET OBJ 7 STATE = val:2 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9822668,
    "expectedSize": 3,
    "text": "SET OBJ 6 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10013410,
    "expectedSize": 4,
    "text": "SET OBJ 0x20 STATE = val:2 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9996818,
    "expectedSize": 4,
    "text": "SET OBJ 27 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10191093,
    "expectedSize": 4,
    "text": "SET OBJ 9 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9798927,
    "expectedSize": 3,
    "text": "SET OBJ 1 STATE = val:0 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10214663,
    "expectedSize": 3,
    "text": "SET OBJ 18 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10145845,
    "expectedSize": 3,
    "text": "SET OBJ 2 STATE = val:2 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9745137,
    "expectedSize": 3,
    "text": "SET OBJ 2 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9808155,
    "expectedSize": 4,
    "text": "SET OBJ 5 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9996892,
    "expectedSize": 5,
    "text": "SET OBJ 0x23 STATE = val:0x7e (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10012015,
    "expectedSize": 3,
    "text": "SET OBJ 19 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 9996957,
    "expectedSize": 3,
    "text": "SET OBJ 6 STATE = val:0 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10013374,
    "expectedSize": 3,
    "text": "SET OBJ 24 STATE = val:1 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10214645,
    "expectedSize": 3,
    "text": "SET OBJ 9 STATE = val:2 (load/unload)"
  },
  {
    "opcode": 92,
    "instructionAddress": 10012119,
    "expectedSize": 3,
    "text": "SET OBJ 2 STATE = val:0 (load/unload)"
  }
];

test('opcode corpus 0x5c', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
