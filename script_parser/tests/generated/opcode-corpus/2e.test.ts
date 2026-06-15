import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 46,
    "instructionAddress": 9668228,
    "expectedSize": 2,
    "text": "Wait for boy (d0) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9668230,
    "expectedSize": 2,
    "text": "Wait for dog (d1) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9668249,
    "expectedSize": 2,
    "text": "Wait for boy (d0) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9758169,
    "expectedSize": 2,
    "text": "Wait for controlled char (d2) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9679571,
    "expectedSize": 2,
    "text": "Wait for boy (d0) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9684030,
    "expectedSize": 2,
    "text": "Wait for boy (d0) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9687916,
    "expectedSize": 2,
    "text": "Wait for boy (d0) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9687965,
    "expectedSize": 2,
    "text": "Wait for dog (d1) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9745573,
    "expectedSize": 4,
    "text": "Wait for entity from *$2834 to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9745584,
    "expectedSize": 2,
    "text": "Wait for boy (d0) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9745593,
    "expectedSize": 4,
    "text": "Wait for entity from *$2834 to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9747897,
    "expectedSize": 2,
    "text": "Wait for character #2 ?! to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9877604,
    "expectedSize": 2,
    "text": "Wait for entity attached to script? (ae) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9877625,
    "expectedSize": 2,
    "text": "Wait for non-controlled char (d3) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9822972,
    "expectedSize": 4,
    "text": "Wait for entity attached to script? (ae) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9822990,
    "expectedSize": 2,
    "text": "Wait for dog (d1) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9822996,
    "expectedSize": 2,
    "text": "Wait for boy (d0) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9824673,
    "expectedSize": 4,
    "text": "Wait for entity from *$2838 to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9816962,
    "expectedSize": 2,
    "text": "Wait for controlled char (d2) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9952989,
    "expectedSize": 9,
    "text": "Wait for character from sub-instr 92 00 to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9953002,
    "expectedSize": 2,
    "text": "Wait for boy (d0) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9953021,
    "expectedSize": 3,
    "text": "Wait for character from sub-instr 92 00 to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9953033,
    "expectedSize": 2,
    "text": "Wait for dog (d1) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9808559,
    "expectedSize": 9,
    "text": "Wait for character from sub-instr 92 00 to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9808572,
    "expectedSize": 2,
    "text": "Wait for boy (d0) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9808591,
    "expectedSize": 3,
    "text": "Wait for character from sub-instr 92 00 to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9808603,
    "expectedSize": 2,
    "text": "Wait for dog (d1) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10006831,
    "expectedSize": 2,
    "text": "Wait for controlled char (d2) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10006844,
    "expectedSize": 2,
    "text": "Wait for controlled char (d2) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10006846,
    "expectedSize": 2,
    "text": "Wait for non-controlled char (d3) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9999763,
    "expectedSize": 2,
    "text": "Wait for dog (d1) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10128561,
    "expectedSize": 2,
    "text": "Wait for controlled char (d2) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10128563,
    "expectedSize": 2,
    "text": "Wait for non-controlled char (d3) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10128576,
    "expectedSize": 4,
    "text": "Wait for entity from *$2837 to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10128603,
    "expectedSize": 2,
    "text": "Wait for boy (d0) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10128605,
    "expectedSize": 2,
    "text": "Wait for dog (d1) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10128830,
    "expectedSize": 2,
    "text": "Wait for character #2 ?! to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10129013,
    "expectedSize": 4,
    "text": "Wait for character #4 ?! to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10129530,
    "expectedSize": 2,
    "text": "Wait for controlled char (d2) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10129532,
    "expectedSize": 9,
    "text": "Wait for non-controlled char (d3) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10129557,
    "expectedSize": 2,
    "text": "Wait for controlled char (d2) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10129930,
    "expectedSize": 7,
    "text": "Wait for boy (d0) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10129963,
    "expectedSize": 2,
    "text": "Wait for boy (d0) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10130029,
    "expectedSize": 4,
    "text": "Wait for entity from *$2835 to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10130107,
    "expectedSize": 4,
    "text": "Wait for entity from *$2835 to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10130119,
    "expectedSize": 2,
    "text": "Wait for boy (d0) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 10130121,
    "expectedSize": 2,
    "text": "Wait for dog (d1) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9625925,
    "expectedSize": 4,
    "text": "Wait for character #4 ?! to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9625929,
    "expectedSize": 3,
    "text": "Wait for character #2 ?! to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9625990,
    "expectedSize": 4,
    "text": "Wait for character #4 ?! to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9625994,
    "expectedSize": 3,
    "text": "Wait for character #2 ?! to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9627063,
    "expectedSize": 2,
    "text": "Wait for character #2 ?! to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9627074,
    "expectedSize": 2,
    "text": "Wait for character #2 ?! to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9627088,
    "expectedSize": 2,
    "text": "Wait for character #2 ?! to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9629539,
    "expectedSize": 2,
    "text": "Wait for dog (d1) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9629569,
    "expectedSize": 2,
    "text": "Wait for dog (d1) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9629575,
    "expectedSize": 2,
    "text": "Wait for boy (d0) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9629629,
    "expectedSize": 2,
    "text": "Wait for boy (d0) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9629631,
    "expectedSize": 2,
    "text": "Wait for character #2 ?! to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9629658,
    "expectedSize": 2,
    "text": "Wait for character #2 ?! to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9629660,
    "expectedSize": 2,
    "text": "Wait for boy (d0) to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9629672,
    "expectedSize": 2,
    "text": "Wait for character #2 ?! to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9629686,
    "expectedSize": 2,
    "text": "Wait for character #2 ?! to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9629716,
    "expectedSize": 2,
    "text": "Wait for character #2 ?! to reach destination"
  },
  {
    "opcode": 46,
    "instructionAddress": 9629737,
    "expectedSize": 2,
    "text": "Wait for character #2 ?! to reach destination"
  }
];

test('opcode corpus 0x2e', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
