import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 194,
    "instructionAddress": 9937763,
    "expectedSize": 4,
    "text": "Add NPC 0x71 spawner at 0x5f,0x49\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9940747,
    "expectedSize": 4,
    "text": "Add NPC 0x71 spawner at 0x4b,0x6b\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9736394,
    "expectedSize": 4,
    "text": "Add NPC 0x22 spawner at 0x27,0x5d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9738923,
    "expectedSize": 4,
    "text": "Add NPC 0x29 spawner at 0x29,0x67\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9736382,
    "expectedSize": 4,
    "text": "Add NPC 0x21 spawner at 0x1f,0x6d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9681250,
    "expectedSize": 4,
    "text": "Add NPC 0x0a spawner at 0x61,0x69\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9681226,
    "expectedSize": 4,
    "text": "Add NPC 0x0e spawner at 0x49,0x5b\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9808413,
    "expectedSize": 4,
    "text": "Add NPC 0x3a spawner at 0x5d,0x41\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10126135,
    "expectedSize": 4,
    "text": "Add NPC 0x7c spawner at 0x61,0x41\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9683949,
    "expectedSize": 4,
    "text": "Add NPC 0x0e spawner at 0x1d,0x5f\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10216184,
    "expectedSize": 4,
    "text": "Add NPC 0x42 spawner at 0x1b,0x3f\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10064165,
    "expectedSize": 4,
    "text": "Add NPC 0x42 spawner at 0x23,0x47\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9808477,
    "expectedSize": 4,
    "text": "Add NPC 0x3a spawner at 0xa7,0x1d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9935714,
    "expectedSize": 4,
    "text": "Add NPC 0x7c spawner at 0x65,0x65\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9683925,
    "expectedSize": 4,
    "text": "Add NPC 0x0a spawner at 0x43,0x31\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9736470,
    "expectedSize": 4,
    "text": "Add NPC 0x22 spawner at 0x13,0x21\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9940811,
    "expectedSize": 4,
    "text": "Add NPC 0x7c spawner at 0x93,0x79\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9808397,
    "expectedSize": 4,
    "text": "Add NPC 0x3a spawner at 0x4b,0x45\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10009570,
    "expectedSize": 4,
    "text": "Add NPC 0x50 spawner at 0x55,0x79\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9736280,
    "expectedSize": 4,
    "text": "Add NPC 0x22 spawner at 0x5f,0x9f\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9684594,
    "expectedSize": 4,
    "text": "Add NPC 0x0e spawner at 0x0d,0x39\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10064157,
    "expectedSize": 4,
    "text": "Add NPC 0x42 spawner at 0x8d,0x37\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9937731,
    "expectedSize": 4,
    "text": "Add NPC 0x76 spawner at 0x2f,0xab\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9738939,
    "expectedSize": 4,
    "text": "Add NPC 0x29 spawner at 0x8b,0x55\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9736292,
    "expectedSize": 4,
    "text": "Add NPC 0x21 spawner at 0x79,0xb1\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9681206,
    "expectedSize": 4,
    "text": "Add NPC 0x0e spawner at 0x61,0x27\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9740641,
    "expectedSize": 4,
    "text": "Add NPC 0x29 spawner at 0x1f,0x9f\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9934125,
    "expectedSize": 4,
    "text": "Add NPC 0x76 spawner at 0x18,0x0d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9736424,
    "expectedSize": 4,
    "text": "Add NPC 0x21 spawner at 0x8d,0x43\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9736358,
    "expectedSize": 4,
    "text": "Add NPC 0x21 spawner at 0x5f,0x6f\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9951632,
    "expectedSize": 4,
    "text": "Add NPC 0x42 spawner at 0x25,0xc5\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9823623,
    "expectedSize": 4,
    "text": "Add NPC 0x28 spawner at 0x3d,0x0d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9679474,
    "expectedSize": 4,
    "text": "Add NPC 0x26 spawner at 0x57,0x25\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9934161,
    "expectedSize": 4,
    "text": "Add NPC 0x7c spawner at 0x35,0x4f\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10140912,
    "expectedSize": 4,
    "text": "Add NPC 0x42 spawner at 0x1d,0x0f\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10009618,
    "expectedSize": 4,
    "text": "Add NPC 0x50 spawner at 0x21,0x1d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9736406,
    "expectedSize": 4,
    "text": "Add NPC 0x21 spawner at 0x6d,0x51\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9684570,
    "expectedSize": 4,
    "text": "Add NPC 0x0e spawner at 0x1b,0x33\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9808313,
    "expectedSize": 4,
    "text": "Add NPC 0x6e spawner at 0x45,0x65\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9740633,
    "expectedSize": 4,
    "text": "Add NPC 0x29 spawner at 0x19,0x55\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9691201,
    "expectedSize": 4,
    "text": "Add NPC 0x22 spawner at 0x2f,0x3d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9683909,
    "expectedSize": 4,
    "text": "Add NPC 0x0a spawner at 0x3f,0x83\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10194275,
    "expectedSize": 4,
    "text": "Add NPC 0x4d spawner at 0x31,0x3d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10083308,
    "expectedSize": 4,
    "text": "Add NPC 0x74 spawner at 0x1b,0x16\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9691193,
    "expectedSize": 4,
    "text": "Add NPC 0x22 spawner at 0x57,0x45\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9808429,
    "expectedSize": 4,
    "text": "Add NPC 0x3a spawner at 0x67,0x65\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9681210,
    "expectedSize": 4,
    "text": "Add NPC 0x0e spawner at 0x5f,0x59\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9684602,
    "expectedSize": 4,
    "text": "Add NPC 0x0e spawner at 0x0d,0x1b\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9681186,
    "expectedSize": 4,
    "text": "Add NPC 0x0e spawner at 0x33,0x6d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10082664,
    "expectedSize": 4,
    "text": "Add NPC 0x82 spawner at 0x71,0x55\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9736312,
    "expectedSize": 4,
    "text": "Add NPC 0x22 spawner at 0x4b,0x8b\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9684574,
    "expectedSize": 4,
    "text": "Add NPC 0x0e spawner at 0x09,0x21\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10082644,
    "expectedSize": 4,
    "text": "Add NPC 0x82 spawner at 0x49,0x2d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9684578,
    "expectedSize": 4,
    "text": "Add NPC 0x0e spawner at 0x27,0x1f\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9740617,
    "expectedSize": 4,
    "text": "Add NPC 0x29 spawner at 0xc9,0x61\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9935626,
    "expectedSize": 4,
    "text": "Add NPC 0x70 spawner at 0x57,0x49\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9932996,
    "expectedSize": 4,
    "text": "Add NPC 0x7c spawner at 0x0b,0x47\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9738915,
    "expectedSize": 4,
    "text": "Add NPC 0x29 spawner at 0x59,0x93\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9738943,
    "expectedSize": 4,
    "text": "Add NPC 0x29 spawner at 0x73,0x47\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9684586,
    "expectedSize": 4,
    "text": "Add NPC 0x0e spawner at 0x23,0x31\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9935610,
    "expectedSize": 4,
    "text": "Add NPC 0x70 spawner at 0x41,0xa1\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9691185,
    "expectedSize": 4,
    "text": "Add NPC 0x22 spawner at 0x27,0x53\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9951576,
    "expectedSize": 4,
    "text": "Add NPC 0x6e spawner at 0x29,0xe9\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9808329,
    "expectedSize": 4,
    "text": "Add NPC 0x6e spawner at 0xa5,0x59\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9935622,
    "expectedSize": 4,
    "text": "Add NPC 0x70 spawner at 0x31,0x6d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9684598,
    "expectedSize": 4,
    "text": "Add NPC 0x0e spawner at 0x2b,0x27\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9683981,
    "expectedSize": 4,
    "text": "Add NPC 0x0e spawner at 0x47,0x15\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9937715,
    "expectedSize": 4,
    "text": "Add NPC 0x76 spawner at 0x3d,0x45\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9935630,
    "expectedSize": 4,
    "text": "Add NPC 0x70 spawner at 0x6b,0x21\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10082640,
    "expectedSize": 4,
    "text": "Add NPC 0x82 spawner at 0x59,0x23\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9740593,
    "expectedSize": 4,
    "text": "Add NPC 0x29 spawner at 0x0d,0x25\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10007497,
    "expectedSize": 4,
    "text": "Add NPC 0x42 spawner at 0x7f,0x1d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10126055,
    "expectedSize": 4,
    "text": "Add NPC 0x7c spawner at 0x1b,0x45\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9935730,
    "expectedSize": 4,
    "text": "Add NPC 0x70 spawner at 0x73,0x11\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10126063,
    "expectedSize": 4,
    "text": "Add NPC 0x7c spawner at 0x1f,0x41\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9808281,
    "expectedSize": 4,
    "text": "Add NPC 0x6e spawner at 0x8d,0x51\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10140924,
    "expectedSize": 4,
    "text": "Add NPC 0x42 spawner at 0x3b,0x4d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10009658,
    "expectedSize": 4,
    "text": "Add NPC 0x71 spawner at 0x39,0x55\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9951552,
    "expectedSize": 4,
    "text": "Add NPC 0x6e spawner at 0x6d,0xa1\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9738927,
    "expectedSize": 4,
    "text": "Add NPC 0x29 spawner at 0x19,0x5d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9937739,
    "expectedSize": 4,
    "text": "Add NPC 0x76 spawner at 0x19,0x8d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9951660,
    "expectedSize": 4,
    "text": "Add NPC 0x74 spawner at 0x91,0x27\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10007561,
    "expectedSize": 4,
    "text": "Add NPC 0x42 spawner at 0x63,0x7d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9738955,
    "expectedSize": 4,
    "text": "Add NPC 0x29 spawner at 0x29,0x49\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9935618,
    "expectedSize": 4,
    "text": "Add NPC 0x70 spawner at 0x75,0x7d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9940819,
    "expectedSize": 4,
    "text": "Add NPC 0x7c spawner at 0x7f,0x9b\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9684606,
    "expectedSize": 4,
    "text": "Add NPC 0x0e spawner at 0x1b,0x0d\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9937723,
    "expectedSize": 4,
    "text": "Add NPC 0x76 spawner at 0x6f,0x77\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9681242,
    "expectedSize": 4,
    "text": "Add NPC 0x0a spawner at 0x0d,0x35\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9935694,
    "expectedSize": 4,
    "text": "Add NPC 0x7c spawner at 0x5b,0xab\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9736300,
    "expectedSize": 4,
    "text": "Add NPC 0x21 spawner at 0x79,0x97\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9808365,
    "expectedSize": 4,
    "text": "Add NPC 0x3a spawner at 0x35,0x13\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10082688,
    "expectedSize": 4,
    "text": "Add NPC 0x82 spawner at 0x19,0x15\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9935666,
    "expectedSize": 4,
    "text": "Add NPC 0x7c spawner at 0x49,0x6b\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10083324,
    "expectedSize": 4,
    "text": "Add NPC 0x74 spawner at 0x35,0x67\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9935642,
    "expectedSize": 4,
    "text": "Add NPC 0x7c spawner at 0x67,0xbd\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9683917,
    "expectedSize": 4,
    "text": "Add NPC 0x0a spawner at 0x17,0x57\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10009690,
    "expectedSize": 4,
    "text": "Add NPC 0x71 spawner at 0x0f,0x4b\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 10082696,
    "expectedSize": 4,
    "text": "Add NPC 0x82 spawner at 0x4f,0x13\u001b[0m"
  },
  {
    "opcode": 194,
    "instructionAddress": 9736486,
    "expectedSize": 4,
    "text": "Add NPC 0x22 spawner at 0x49,0x21\u001b[0m"
  }
];

test('opcode corpus 0xc2', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
