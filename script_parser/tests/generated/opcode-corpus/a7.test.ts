import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 167,
    "instructionAddress": 10129505,
    "expectedSize": 2,
    "text": "SLEEP 239 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9758257,
    "expectedSize": 2,
    "text": "SLEEP 14 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9627127,
    "expectedSize": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629535,
    "expectedSize": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9688150,
    "expectedSize": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9752633,
    "expectedSize": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9759647,
    "expectedSize": 2,
    "text": "SLEEP 19 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9733363,
    "expectedSize": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9687910,
    "expectedSize": 2,
    "text": "SLEEP 7 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9818118,
    "expectedSize": 2,
    "text": "SLEEP 179 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629677,
    "expectedSize": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629614,
    "expectedSize": 2,
    "text": "SLEEP 73 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9819337,
    "expectedSize": 2,
    "text": "SLEEP 3 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9685206,
    "expectedSize": 2,
    "text": "SLEEP 21 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9668239,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9687954,
    "expectedSize": 2,
    "text": "SLEEP 9 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9627011,
    "expectedSize": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129017,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9951730,
    "expectedSize": 2,
    "text": "SLEEP 89 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9627141,
    "expectedSize": 5,
    "text": "SLEEP 104 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629693,
    "expectedSize": 2,
    "text": "SLEEP 14 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9944897,
    "expectedSize": 2,
    "text": "SLEEP 7 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9733360,
    "expectedSize": 2,
    "text": "SLEEP 14 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9877573,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9877569,
    "expectedSize": 2,
    "text": "SLEEP 4 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629642,
    "expectedSize": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9687940,
    "expectedSize": 7,
    "text": "SLEEP 39 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129453,
    "expectedSize": 2,
    "text": "SLEEP 9 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9679561,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9877742,
    "expectedSize": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10128555,
    "expectedSize": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9822941,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129559,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129518,
    "expectedSize": 6,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629723,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129524,
    "expectedSize": 6,
    "text": "SLEEP 14 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9747899,
    "expectedSize": 2,
    "text": "SLEEP 119 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129037,
    "expectedSize": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626886,
    "expectedSize": 2,
    "text": "SLEEP 3 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9685212,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9808584,
    "expectedSize": 7,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626983,
    "expectedSize": 2,
    "text": "SLEEP 103 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9733862,
    "expectedSize": 2,
    "text": "SLEEP 92 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9627201,
    "expectedSize": 2,
    "text": "SLEEP 14 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9932425,
    "expectedSize": 2,
    "text": "SLEEP 14 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10130055,
    "expectedSize": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9627030,
    "expectedSize": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10128801,
    "expectedSize": 7,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9877769,
    "expectedSize": 2,
    "text": "SLEEP 89 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626854,
    "expectedSize": 2,
    "text": "SLEEP 63 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9953014,
    "expectedSize": 7,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629514,
    "expectedSize": 2,
    "text": "SLEEP 31 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9679557,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629619,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129937,
    "expectedSize": 7,
    "text": "SLEEP 9 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9951734,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9808552,
    "expectedSize": 7,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10128565,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9627090,
    "expectedSize": 2,
    "text": "SLEEP 179 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626296,
    "expectedSize": 2,
    "text": "SLEEP 44 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10130061,
    "expectedSize": 2,
    "text": "SLEEP 5 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129853,
    "expectedSize": 2,
    "text": "SLEEP 39 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9678669,
    "expectedSize": 2,
    "text": "SLEEP 7 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9627178,
    "expectedSize": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10006856,
    "expectedSize": 2,
    "text": "SLEEP 9 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9687947,
    "expectedSize": 7,
    "text": "SLEEP 39 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9733850,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9997069,
    "expectedSize": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9687974,
    "expectedSize": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129444,
    "expectedSize": 2,
    "text": "SLEEP 15 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9627194,
    "expectedSize": 2,
    "text": "SLEEP 119 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629624,
    "expectedSize": 2,
    "text": "SLEEP 27 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626966,
    "expectedSize": 2,
    "text": "SLEEP 3 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129893,
    "expectedSize": 9,
    "text": "SLEEP 69 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9627197,
    "expectedSize": 2,
    "text": "SLEEP 31 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629510,
    "expectedSize": 2,
    "text": "SLEEP 31 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9816980,
    "expectedSize": 2,
    "text": "SLEEP 14 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9823005,
    "expectedSize": 2,
    "text": "SLEEP 49 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629555,
    "expectedSize": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9687980,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9745484,
    "expectedSize": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129924,
    "expectedSize": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9733300,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9627123,
    "expectedSize": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129579,
    "expectedSize": 2,
    "text": "SLEEP 14 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10205691,
    "expectedSize": 10,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9951738,
    "expectedSize": 2,
    "text": "SLEEP 89 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626522,
    "expectedSize": 2,
    "text": "SLEEP 149 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9745445,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9668243,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129837,
    "expectedSize": 2,
    "text": "SLEEP 44 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9629697,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9747975,
    "expectedSize": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129911,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9812947,
    "expectedSize": 2,
    "text": "SLEEP 3 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9626006,
    "expectedSize": 60,
    "text": "SLEEP 89 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129483,
    "expectedSize": 2,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 10129944,
    "expectedSize": 2,
    "text": "SLEEP 59 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9952982,
    "expectedSize": 7,
    "text": "SLEEP 29 TICKS"
  },
  {
    "opcode": 167,
    "instructionAddress": 9733354,
    "expectedSize": 2,
    "text": "SLEEP 19 TICKS"
  }
];

test('opcode corpus 0xa7', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
