import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 67,
    "instructionAddress": 9752159,
    "expectedSize": 8,
    "text": "Teleport boy to x:$23b9, y:$23bb"
  },
  {
    "opcode": 67,
    "instructionAddress": 9752167,
    "expectedSize": 8,
    "text": "Teleport dog to x:$23b9, y:$23bb"
  },
  {
    "opcode": 67,
    "instructionAddress": 9679528,
    "expectedSize": 18,
    "text": "Teleport boy to x:*(controlled char + 26) + 8, y:*(controlled char + 28) + 8"
  },
  {
    "opcode": 67,
    "instructionAddress": 9687891,
    "expectedSize": 15,
    "text": "Teleport boy to x:*(boy + 26) + 8, y:*(boy + 28)"
  },
  {
    "opcode": 67,
    "instructionAddress": 9733840,
    "expectedSize": 4,
    "text": "Teleport boy to x:0, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9733844,
    "expectedSize": 4,
    "text": "Teleport dog to x:0, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9738800,
    "expectedSize": 10,
    "text": "Teleport $2839 to x:0x02c0, y:0x01e0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9738839,
    "expectedSize": 10,
    "text": "Teleport $283b to x:0x0240, y:0x0240"
  },
  {
    "opcode": 67,
    "instructionAddress": 9738878,
    "expectedSize": 10,
    "text": "Teleport $283d to x:0x02a0, y:0x0160"
  },
  {
    "opcode": 67,
    "instructionAddress": 9745463,
    "expectedSize": 9,
    "text": "Teleport $2834 to x:0x70, y:$2836"
  },
  {
    "opcode": 67,
    "instructionAddress": 9745502,
    "expectedSize": 9,
    "text": "Teleport $2834 to x:0x70, y:$2836"
  },
  {
    "opcode": 67,
    "instructionAddress": 9745541,
    "expectedSize": 9,
    "text": "Teleport $2834 to x:0x70, y:$2836"
  },
  {
    "opcode": 67,
    "instructionAddress": 9948190,
    "expectedSize": 8,
    "text": "Teleport boy to x:$24a1, y:$24a3"
  },
  {
    "opcode": 67,
    "instructionAddress": 9948198,
    "expectedSize": 8,
    "text": "Teleport dog to x:$24a1, y:$24a3"
  },
  {
    "opcode": 67,
    "instructionAddress": 9948206,
    "expectedSize": 10,
    "text": "Teleport $2836 to x:$24a1, y:$24a3"
  },
  {
    "opcode": 67,
    "instructionAddress": 9948361,
    "expectedSize": 7,
    "text": "Teleport $2834 to x:signed arg0, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9948368,
    "expectedSize": 5,
    "text": "Teleport boy to x:signed arg0, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9948373,
    "expectedSize": 5,
    "text": "Teleport dog to x:signed arg0, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9759564,
    "expectedSize": 14,
    "text": "Teleport boy to x:$24ab + 6, y:$24af - 16"
  },
  {
    "opcode": 67,
    "instructionAddress": 9759578,
    "expectedSize": 14,
    "text": "Teleport dog to x:$24ab + 6, y:$24af - 16"
  },
  {
    "opcode": 67,
    "instructionAddress": 9759607,
    "expectedSize": 10,
    "text": "Teleport $2838 to x:$24cf, y:$24d1"
  },
  {
    "opcode": 67,
    "instructionAddress": 9946584,
    "expectedSize": 10,
    "text": "Teleport $2838 to x:$24a1, y:$24a3"
  },
  {
    "opcode": 67,
    "instructionAddress": 9946594,
    "expectedSize": 8,
    "text": "Teleport boy to x:$24a1, y:$24a3"
  },
  {
    "opcode": 67,
    "instructionAddress": 9946609,
    "expectedSize": 11,
    "text": "Teleport dog to x:$24a1, y:$24a3 - 2"
  },
  {
    "opcode": 67,
    "instructionAddress": 9946735,
    "expectedSize": 8,
    "text": "Teleport $2834 to x:$23b9, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9946743,
    "expectedSize": 6,
    "text": "Teleport boy to x:$23b9, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9946749,
    "expectedSize": 6,
    "text": "Teleport dog to x:$23b9, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9812885,
    "expectedSize": 14,
    "text": "Teleport $2455 to x:$24ab, y:$24af + 0x40"
  },
  {
    "opcode": 67,
    "instructionAddress": 9812910,
    "expectedSize": 12,
    "text": "Teleport boy to x:$24ab, y:$24af + 0x40"
  },
  {
    "opcode": 67,
    "instructionAddress": 9945526,
    "expectedSize": 7,
    "text": "Teleport $2834 to x:signed arg0, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9945533,
    "expectedSize": 5,
    "text": "Teleport boy to x:signed arg0, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9945538,
    "expectedSize": 5,
    "text": "Teleport dog to x:signed arg0, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9955427,
    "expectedSize": 19,
    "text": "Teleport last entity ($0341) to x:*(last entity ($0341) + 26) - 4, y:*(last entity ($0341) + 28) + 0x62"
  },
  {
    "opcode": 67,
    "instructionAddress": 9955454,
    "expectedSize": 19,
    "text": "Teleport last entity ($0341) to x:*(last entity ($0341) + 26) - 6, y:*(last entity ($0341) + 28) + 0x66"
  },
  {
    "opcode": 67,
    "instructionAddress": 9955481,
    "expectedSize": 19,
    "text": "Teleport last entity ($0341) to x:*(last entity ($0341) + 26) + 0x80, y:*(last entity ($0341) + 28) + 23"
  },
  {
    "opcode": 67,
    "instructionAddress": 9955508,
    "expectedSize": 20,
    "text": "Teleport last entity ($0341) to x:*(last entity ($0341) + 26) - 0x45, y:*(last entity ($0341) + 28) - 0x30"
  },
  {
    "opcode": 67,
    "instructionAddress": 9955536,
    "expectedSize": 15,
    "text": "Teleport last entity ($0341) to x:*(last entity ($0341) + 26), y:*(last entity ($0341) + 28) + 8"
  },
  {
    "opcode": 67,
    "instructionAddress": 10079491,
    "expectedSize": 11,
    "text": "Teleport boy to x:$24ab - 24, y:$24af"
  },
  {
    "opcode": 67,
    "instructionAddress": 10079502,
    "expectedSize": 14,
    "text": "Teleport dog to x:$24ab - 24, y:$24af + 16"
  },
  {
    "opcode": 67,
    "instructionAddress": 10140401,
    "expectedSize": 11,
    "text": "Teleport dog to x:$24ab, y:$24af - 16"
  },
  {
    "opcode": 67,
    "instructionAddress": 10134475,
    "expectedSize": 10,
    "text": "Teleport $2860 to x:$2866, y:$2868"
  },
  {
    "opcode": 67,
    "instructionAddress": 10134485,
    "expectedSize": 10,
    "text": "Teleport $2862 to x:$286a, y:$286c"
  },
  {
    "opcode": 67,
    "instructionAddress": 10134495,
    "expectedSize": 31,
    "text": "Teleport $2864 to x:$286e, y:$2870"
  },
  {
    "opcode": 67,
    "instructionAddress": 10134569,
    "expectedSize": 8,
    "text": "Teleport boy to x:$285c, y:$285e"
  },
  {
    "opcode": 67,
    "instructionAddress": 10134577,
    "expectedSize": 8,
    "text": "Teleport dog to x:$285c, y:$285e"
  },
  {
    "opcode": 67,
    "instructionAddress": 10136383,
    "expectedSize": 8,
    "text": "Teleport dog to x:$23b9, y:$23bb"
  },
  {
    "opcode": 67,
    "instructionAddress": 10136391,
    "expectedSize": 4,
    "text": "Teleport boy to x:0, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 10070062,
    "expectedSize": 14,
    "text": "Teleport boy to x:$24ab - 16, y:$24af - 16"
  },
  {
    "opcode": 67,
    "instructionAddress": 10070078,
    "expectedSize": 14,
    "text": "Teleport boy to x:$24ab + 16, y:$24af - 16"
  },
  {
    "opcode": 67,
    "instructionAddress": 10006810,
    "expectedSize": 7,
    "text": "Teleport dog to x:signed arg0, y:signed arg2"
  },
  {
    "opcode": 67,
    "instructionAddress": 10063068,
    "expectedSize": 16,
    "text": "Teleport $2455 to x:$24ab + 16, y:$24af + 8"
  },
  {
    "opcode": 67,
    "instructionAddress": 10145865,
    "expectedSize": 8,
    "text": "Teleport boy to x:$23b9, y:$23bb"
  },
  {
    "opcode": 67,
    "instructionAddress": 10145873,
    "expectedSize": 8,
    "text": "Teleport dog to x:$23b9, y:$23bb"
  },
  {
    "opcode": 67,
    "instructionAddress": 10145918,
    "expectedSize": 8,
    "text": "Teleport $2835 to x:$23b9, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 10145954,
    "expectedSize": 10,
    "text": "Teleport $2455 to x:$23b9, y:$23bb"
  },
  {
    "opcode": 67,
    "instructionAddress": 10145967,
    "expectedSize": 10,
    "text": "Teleport $2835 to x:$23b9, y:$23bb"
  },
  {
    "opcode": 67,
    "instructionAddress": 10145977,
    "expectedSize": 8,
    "text": "Teleport boy to x:$23b9, y:$23bb"
  },
  {
    "opcode": 67,
    "instructionAddress": 10145985,
    "expectedSize": 8,
    "text": "Teleport dog to x:$23b9, y:$23bb"
  },
  {
    "opcode": 67,
    "instructionAddress": 10146673,
    "expectedSize": 4,
    "text": "Teleport boy to x:0, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9996568,
    "expectedSize": 6,
    "text": "Teleport boy to x:signed arg0, y:signed arg2"
  },
  {
    "opcode": 67,
    "instructionAddress": 9996606,
    "expectedSize": 4,
    "text": "Teleport boy to x:0, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9998415,
    "expectedSize": 4,
    "text": "Teleport boy to x:0, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9998643,
    "expectedSize": 5,
    "text": "Teleport non-controlled char to x:0, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9998664,
    "expectedSize": 5,
    "text": "Teleport non-controlled char to x:0, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9999639,
    "expectedSize": 4,
    "text": "Teleport boy to x:0, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9999659,
    "expectedSize": 6,
    "text": "Teleport $2841 to x:0, y:0"
  },
  {
    "opcode": 67,
    "instructionAddress": 9999691,
    "expectedSize": 8,
    "text": "Teleport dog to x:$24b3, y:$24b5"
  },
  {
    "opcode": 67,
    "instructionAddress": 10008657,
    "expectedSize": 11,
    "text": "Teleport dog to x:$24ab + 16, y:$24af"
  },
  {
    "opcode": 67,
    "instructionAddress": 10128877,
    "expectedSize": 20,
    "text": "Teleport signed arg16 to x:signed arg0 + 16, y:signed arg2 - 0x30"
  },
  {
    "opcode": 67,
    "instructionAddress": 10128900,
    "expectedSize": 21,
    "text": "Teleport signed arg18 to x:signed arg0 + 0x30, y:signed arg2 - 0x30"
  },
  {
    "opcode": 67,
    "instructionAddress": 10128936,
    "expectedSize": 21,
    "text": "Teleport signed arg24 to x:signed arg0 + 0x20, y:signed arg2 - 0x50"
  },
  {
    "opcode": 67,
    "instructionAddress": 10128960,
    "expectedSize": 20,
    "text": "Teleport signed arg14 to x:signed arg0 + 0x20, y:signed arg2 - 24"
  },
  {
    "opcode": 67,
    "instructionAddress": 10128980,
    "expectedSize": 19,
    "text": "Teleport signed arg20 to x:signed arg0 + 24, y:signed arg2 - 8"
  },
  {
    "opcode": 67,
    "instructionAddress": 10128999,
    "expectedSize": 14,
    "text": "Teleport signed arg22 to x:signed arg0 + 0x30, y:signed arg2 - 8"
  },
  {
    "opcode": 67,
    "instructionAddress": 10129624,
    "expectedSize": 15,
    "text": "Teleport $2837 to x:signed arg0, y:signed arg2"
  },
  {
    "opcode": 67,
    "instructionAddress": 10129758,
    "expectedSize": 15,
    "text": "Teleport $2837 to x:signed arg0, y:signed arg2"
  },
  {
    "opcode": 67,
    "instructionAddress": 10129813,
    "expectedSize": 8,
    "text": "Teleport $2837 to x:signed arg8, y:signed arg10"
  },
  {
    "opcode": 67,
    "instructionAddress": 10129881,
    "expectedSize": 12,
    "text": "Teleport $2837 to x:signed arg8, y:signed arg10 + 0x20"
  },
  {
    "opcode": 67,
    "instructionAddress": 10129977,
    "expectedSize": 18,
    "text": "Teleport $2835 to x:*(boy + 26) + 0x90, y:*(boy + 28)"
  },
  {
    "opcode": 67,
    "instructionAddress": 10214803,
    "expectedSize": 11,
    "text": "Teleport boy to x:$24ab + 16, y:$24af"
  },
  {
    "opcode": 67,
    "instructionAddress": 10214816,
    "expectedSize": 14,
    "text": "Teleport dog to x:$24ab + 16, y:$24af + 16"
  },
  {
    "opcode": 67,
    "instructionAddress": 10216274,
    "expectedSize": 6,
    "text": "Teleport boy to x:signed arg0, y:signed arg2"
  },
  {
    "opcode": 67,
    "instructionAddress": 10216282,
    "expectedSize": 9,
    "text": "Teleport dog to x:signed arg0 + 16, y:signed arg2"
  },
  {
    "opcode": 67,
    "instructionAddress": 9625837,
    "expectedSize": 12,
    "text": "Teleport boy to x:$242b - 0x32, y:$242d"
  },
  {
    "opcode": 67,
    "instructionAddress": 9625849,
    "expectedSize": 18,
    "text": "Teleport dog to x:$242b - 0x32, y:$242d"
  },
  {
    "opcode": 67,
    "instructionAddress": 9626138,
    "expectedSize": 100,
    "text": "Teleport signed arg30 to x:signed arg0 + signed arg32, y:signed arg4 + 7"
  },
  {
    "opcode": 67,
    "instructionAddress": 9626298,
    "expectedSize": 24,
    "text": "Teleport signed arg12 to x:$2401 + 0x80, y:$2405 + 0x0100"
  },
  {
    "opcode": 67,
    "instructionAddress": 9626337,
    "expectedSize": 30,
    "text": "Teleport signed arg12 to x:$2401 + 0x80, y:$2405 + 0x70"
  },
  {
    "opcode": 67,
    "instructionAddress": 9626438,
    "expectedSize": 30,
    "text": "Teleport signed arg12 to x:$2401 + 0x80, y:$2405 + 0x70"
  },
  {
    "opcode": 67,
    "instructionAddress": 9626499,
    "expectedSize": 23,
    "text": "Teleport signed arg12 to x:$2401 + 0x80, y:$2405 + 0x70"
  },
  {
    "opcode": 67,
    "instructionAddress": 9626782,
    "expectedSize": 13,
    "text": "Teleport $283a to x:$24ab - 16, y:$24af"
  },
  {
    "opcode": 67,
    "instructionAddress": 9629571,
    "expectedSize": 4,
    "text": "Teleport dog to x:1, y:1"
  }
];

test('opcode corpus 0x43', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
