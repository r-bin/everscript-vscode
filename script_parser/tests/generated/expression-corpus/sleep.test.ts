import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SAMPLES = [
  {
    "opcode": 168,
    "instructionAddress": 9748022,
    "expectedBytesConsumed": 3,
    "text": "SLEEP 899 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626983,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 103 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629581,
    "expectedBytesConsumed": 8,
    "text": "SLEEP 7 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9733856,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 17 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629743,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629535,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129017,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9627201,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 14 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626296,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 44 TICKS"
  },
  {
    "opcode": 59,
    "instructionAddress": 9955676,
    "expectedBytesConsumed": 10,
    "text": "SLEEP 0x3f + (RAND & 0x7f) TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626924,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 3 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626902,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 63 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9733865,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9934273,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9877569,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 4 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9687954,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 9 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9758683,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 14 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9627030,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10205711,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 7 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129218,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9679565,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9819337,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 3 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9687910,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 7 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9951723,
    "expectedBytesConsumed": 7,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129893,
    "expectedBytesConsumed": 9,
    "text": "SLEEP 69 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10087835,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 3 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9877742,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9951734,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9952972,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9758149,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 14 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626937,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 183 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9759647,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 19 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9668243,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9953014,
    "expectedBytesConsumed": 7,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9816980,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 14 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9810152,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9733850,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129559,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626416,
    "expectedBytesConsumed": 13,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9810894,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 3 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626854,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 63 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9812928,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9951738,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 89 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629697,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9818118,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 179 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626522,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 149 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9887845,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 14 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10130061,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 5 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629638,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129924,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626940,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 63 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129453,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 9 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129920,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 89 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129524,
    "expectedBytesConsumed": 6,
    "text": "SLEEP 14 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9877573,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129043,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 89 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129432,
    "expectedBytesConsumed": 9,
    "text": "SLEEP 9 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10130051,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 103 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626899,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 183 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9625979,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 14 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629677,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9627090,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 179 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9733354,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 19 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629619,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10006856,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 9 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9748108,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9687963,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629577,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 7 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129850,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 79 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129491,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 49 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129853,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 39 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129505,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 239 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9944897,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 7 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9747899,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 119 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10128607,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 119 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9944901,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129944,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129937,
    "expectedBytesConsumed": 7,
    "text": "SLEEP 9 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629624,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 27 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629633,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10128555,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9733862,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 92 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9679557,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629551,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629728,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9877644,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 24 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9745445,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9627072,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 129 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626886,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 3 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9627027,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 119 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9688150,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129518,
    "expectedBytesConsumed": 6,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10130055,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10128801,
    "expectedBytesConsumed": 7,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9747975,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9627194,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 119 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9758257,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 14 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9887864,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 3 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9747888,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629701,
    "expectedBytesConsumed": 2,
    "text": "SLEEP 29 TICKS"
  }
];

test('expression corpus: sleep', () => {
  for (const sample of SAMPLES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.size, sample.expectedBytesConsumed);
  }
});
