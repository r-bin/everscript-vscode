import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 60,
    "instructionAddress": 9757627,
    "expectedSize": 7,
    "text": "Load NPC 002a>>1 flags/state 0020 at pos 13 65"
  },
  {
    "opcode": 60,
    "instructionAddress": 9734518,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 8400 at pos 0b 05"
  },
  {
    "opcode": 60,
    "instructionAddress": 9952685,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 8400 at pos 23 11"
  },
  {
    "opcode": 60,
    "instructionAddress": 9671051,
    "expectedSize": 7,
    "text": "Load NPC 001a>>1 flags/state 0020 at pos 01 01"
  },
  {
    "opcode": 60,
    "instructionAddress": 9816821,
    "expectedSize": 7,
    "text": "Load NPC 0034>>1 flags/state 0020 at pos 4b 21"
  },
  {
    "opcode": 60,
    "instructionAddress": 9808114,
    "expectedSize": 7,
    "text": "Load NPC 003c>>1 flags/state 0002 at pos 91 51"
  },
  {
    "opcode": 60,
    "instructionAddress": 9671123,
    "expectedSize": 7,
    "text": "Load NPC 0040>>1 flags/state 0022 at pos 13 29"
  },
  {
    "opcode": 60,
    "instructionAddress": 9738766,
    "expectedSize": 7,
    "text": "Load NPC 003c>>1 flags/state 0002 at pos 6c 41"
  },
  {
    "opcode": 60,
    "instructionAddress": 9814634,
    "expectedSize": 7,
    "text": "Load NPC 005c>>1 flags/state 0002 at pos 6f 3f"
  },
  {
    "opcode": 60,
    "instructionAddress": 9672176,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 0400 at pos 03 45"
  },
  {
    "opcode": 60,
    "instructionAddress": 9944795,
    "expectedSize": 7,
    "text": "Load NPC 0038>>1 flags/state 0020 at pos 23 31"
  },
  {
    "opcode": 60,
    "instructionAddress": 9681113,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 8400 at pos a9 55"
  },
  {
    "opcode": 60,
    "instructionAddress": 9738822,
    "expectedSize": 7,
    "text": "Load NPC 003e>>1 flags/state 0002 at pos 59 3d"
  },
  {
    "opcode": 60,
    "instructionAddress": 10011892,
    "expectedSize": 7,
    "text": "Load NPC 00ac>>1 flags/state 0020 at pos 3c 4d"
  },
  {
    "opcode": 60,
    "instructionAddress": 9671013,
    "expectedSize": 7,
    "text": "Load NPC 001a>>1 flags/state 0020 at pos 01 01"
  },
  {
    "opcode": 60,
    "instructionAddress": 9743659,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 8400 at pos 35 89"
  },
  {
    "opcode": 60,
    "instructionAddress": 9667886,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 0400 at pos 11 1f"
  },
  {
    "opcode": 60,
    "instructionAddress": 9814529,
    "expectedSize": 7,
    "text": "Load NPC 004e>>1 flags/state 0002 at pos 0f 51"
  },
  {
    "opcode": 60,
    "instructionAddress": 9672198,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 0400 at pos 5b 33"
  },
  {
    "opcode": 60,
    "instructionAddress": 9822647,
    "expectedSize": 7,
    "text": "Load NPC 008c>>1 flags/state 0020 at pos 28 2f"
  },
  {
    "opcode": 60,
    "instructionAddress": 9822521,
    "expectedSize": 7,
    "text": "Load NPC 0030>>1 flags/state 0020 at pos 2d 43"
  },
  {
    "opcode": 60,
    "instructionAddress": 9822596,
    "expectedSize": 7,
    "text": "Load NPC 0038>>1 flags/state 0020 at pos 2e 4c"
  },
  {
    "opcode": 60,
    "instructionAddress": 9885147,
    "expectedSize": 7,
    "text": "Load NPC 0110>>1 flags/state 0020 at pos a9 53"
  },
  {
    "opcode": 60,
    "instructionAddress": 9672187,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 0400 at pos 39 4b"
  },
  {
    "opcode": 60,
    "instructionAddress": 10198896,
    "expectedSize": 7,
    "text": "Load NPC 009a>>1 flags/state 0002 at pos 12 58"
  },
  {
    "opcode": 60,
    "instructionAddress": 9814572,
    "expectedSize": 7,
    "text": "Load NPC 004e>>1 flags/state 0002 at pos 41 47"
  },
  {
    "opcode": 60,
    "instructionAddress": 9822476,
    "expectedSize": 7,
    "text": "Load NPC 0036>>1 flags/state 0020 at pos 2d 37"
  },
  {
    "opcode": 60,
    "instructionAddress": 9822491,
    "expectedSize": 7,
    "text": "Load NPC 0034>>1 flags/state 0020 at pos 2a 3a"
  },
  {
    "opcode": 60,
    "instructionAddress": 9814764,
    "expectedSize": 7,
    "text": "Load NPC 004e>>1 flags/state 0002 at pos 71 47"
  },
  {
    "opcode": 60,
    "instructionAddress": 10077017,
    "expectedSize": 7,
    "text": "Load NPC 009e>>1 flags/state 0022 at pos 5f 8a"
  },
  {
    "opcode": 60,
    "instructionAddress": 9740649,
    "expectedSize": 7,
    "text": "Load NPC 0024>>1 flags/state 0002 at pos ef 29"
  },
  {
    "opcode": 60,
    "instructionAddress": 9736535,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 8400 at pos 95 af"
  },
  {
    "opcode": 60,
    "instructionAddress": 9738861,
    "expectedSize": 7,
    "text": "Load NPC 003e>>1 flags/state 0002 at pos 53 2b"
  },
  {
    "opcode": 60,
    "instructionAddress": 10134387,
    "expectedSize": 7,
    "text": "Load NPC 0040>>1 flags/state 0020 at pos 2a 01"
  },
  {
    "opcode": 60,
    "instructionAddress": 9667930,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 0400 at pos 75 1d"
  },
  {
    "opcode": 60,
    "instructionAddress": 10011868,
    "expectedSize": 12,
    "text": "Load NPC 00aa>>1 flags/state 0020 at pos 3d 40"
  },
  {
    "opcode": 60,
    "instructionAddress": 9948167,
    "expectedSize": 7,
    "text": "Load NPC 002a>>1 flags/state 0020 at pos 01 33"
  },
  {
    "opcode": 60,
    "instructionAddress": 9667897,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 0400 at pos 11 39"
  },
  {
    "opcode": 60,
    "instructionAddress": 9885169,
    "expectedSize": 7,
    "text": "Load NPC 0110>>1 flags/state 0020 at pos a9 53"
  },
  {
    "opcode": 60,
    "instructionAddress": 10192604,
    "expectedSize": 7,
    "text": "Load NPC 00f4>>1 flags/state 8400 at pos 0f 1f"
  },
  {
    "opcode": 60,
    "instructionAddress": 9738712,
    "expectedSize": 7,
    "text": "Load NPC 003c>>1 flags/state 0002 at pos 5a 8c"
  },
  {
    "opcode": 60,
    "instructionAddress": 9885259,
    "expectedSize": 7,
    "text": "Load NPC 0038>>1 flags/state 0002 at pos 2f 35"
  },
  {
    "opcode": 60,
    "instructionAddress": 9738702,
    "expectedSize": 7,
    "text": "Load NPC 003c>>1 flags/state 0002 at pos 5e 8c"
  },
  {
    "opcode": 60,
    "instructionAddress": 9736579,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 8400 at pos 81 79"
  },
  {
    "opcode": 60,
    "instructionAddress": 10018946,
    "expectedSize": 7,
    "text": "Load NPC 00aa>>1 flags/state 0020 at pos 3b 2a"
  },
  {
    "opcode": 60,
    "instructionAddress": 9671134,
    "expectedSize": 7,
    "text": "Load NPC 0040>>1 flags/state 0022 at pos 29 2b"
  },
  {
    "opcode": 60,
    "instructionAddress": 9936176,
    "expectedSize": 7,
    "text": "Load NPC 0070>>1 flags/state 0010 at pos 16 20"
  },
  {
    "opcode": 60,
    "instructionAddress": 10140947,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 8400 at pos 73 35"
  },
  {
    "opcode": 60,
    "instructionAddress": 10018924,
    "expectedSize": 7,
    "text": "Load NPC 00ac>>1 flags/state 0020 at pos 0b 27"
  },
  {
    "opcode": 60,
    "instructionAddress": 9672209,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 0400 at pos 1d 15"
  },
  {
    "opcode": 60,
    "instructionAddress": 9798760,
    "expectedSize": 7,
    "text": "Load NPC 004e>>1 flags/state 0002 at pos 4f 11"
  },
  {
    "opcode": 60,
    "instructionAddress": 9736590,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 8400 at pos 4d 77"
  },
  {
    "opcode": 60,
    "instructionAddress": 9681091,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 8400 at pos 5f 01"
  },
  {
    "opcode": 60,
    "instructionAddress": 9671032,
    "expectedSize": 7,
    "text": "Load NPC 001a>>1 flags/state 0020 at pos 01 01"
  },
  {
    "opcode": 60,
    "instructionAddress": 9681135,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 8400 at pos 41 5f"
  },
  {
    "opcode": 60,
    "instructionAddress": 10013195,
    "expectedSize": 7,
    "text": "Load NPC 00aa>>1 flags/state 0020 at pos 45 15"
  },
  {
    "opcode": 60,
    "instructionAddress": 9752411,
    "expectedSize": 7,
    "text": "Load NPC 002a>>1 flags/state 0020 at pos 45 57"
  },
  {
    "opcode": 60,
    "instructionAddress": 9822611,
    "expectedSize": 7,
    "text": "Load NPC 003a>>1 flags/state 0020 at pos 29 40"
  },
  {
    "opcode": 60,
    "instructionAddress": 9743645,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 8400 at pos 99 69"
  },
  {
    "opcode": 60,
    "instructionAddress": 10008735,
    "expectedSize": 7,
    "text": "Load NPC 0088>>1 flags/state 0002 at pos 2d 07"
  },
  {
    "opcode": 60,
    "instructionAddress": 9672249,
    "expectedSize": 7,
    "text": "Load NPC 003c>>1 flags/state 0002 at pos 43 15"
  },
  {
    "opcode": 60,
    "instructionAddress": 10079548,
    "expectedSize": 7,
    "text": "Load NPC 009e>>1 flags/state 0020 at pos 11 21"
  },
  {
    "opcode": 60,
    "instructionAddress": 9736546,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 8400 at pos 5d 47"
  },
  {
    "opcode": 60,
    "instructionAddress": 9743666,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 8400 at pos 15 7d"
  },
  {
    "opcode": 60,
    "instructionAddress": 10198879,
    "expectedSize": 7,
    "text": "Load NPC 009a>>1 flags/state 0002 at pos 48 4e"
  },
  {
    "opcode": 60,
    "instructionAddress": 10011901,
    "expectedSize": 12,
    "text": "Load NPC 00aa>>1 flags/state 0020 at pos 4f 52"
  },
  {
    "opcode": 60,
    "instructionAddress": 9944825,
    "expectedSize": 7,
    "text": "Load NPC 0034>>1 flags/state 0020 at pos 17 2f"
  },
  {
    "opcode": 60,
    "instructionAddress": 10011859,
    "expectedSize": 7,
    "text": "Load NPC 00ac>>1 flags/state 0020 at pos 2f 3f"
  },
  {
    "opcode": 60,
    "instructionAddress": 9681102,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 8400 at pos a1 03"
  },
  {
    "opcode": 60,
    "instructionAddress": 9670994,
    "expectedSize": 7,
    "text": "Load NPC 001a>>1 flags/state 0020 at pos 01 01"
  },
  {
    "opcode": 60,
    "instructionAddress": 10079612,
    "expectedSize": 7,
    "text": "Load NPC 009e>>1 flags/state 0020 at pos 19 1f"
  },
  {
    "opcode": 60,
    "instructionAddress": 9812861,
    "expectedSize": 7,
    "text": "Load NPC 002e>>1 flags/state 0020 at pos 21 17"
  },
  {
    "opcode": 60,
    "instructionAddress": 9671145,
    "expectedSize": 7,
    "text": "Load NPC 0040>>1 flags/state 0022 at pos 16 06"
  },
  {
    "opcode": 60,
    "instructionAddress": 10134409,
    "expectedSize": 7,
    "text": "Load NPC 0040>>1 flags/state 0020 at pos 2a 01"
  },
  {
    "opcode": 60,
    "instructionAddress": 9887799,
    "expectedSize": 7,
    "text": "Load NPC 008a>>1 flags/state 0020 at pos 35 25"
  },
  {
    "opcode": 60,
    "instructionAddress": 10198909,
    "expectedSize": 7,
    "text": "Load NPC 009a>>1 flags/state 0002 at pos 25 57"
  },
  {
    "opcode": 60,
    "instructionAddress": 10214747,
    "expectedSize": 7,
    "text": "Load NPC 00be>>1 flags/state 0020 at pos 1a 59"
  },
  {
    "opcode": 60,
    "instructionAddress": 9824650,
    "expectedSize": 7,
    "text": "Load NPC 0046>>1 flags/state 0020 at pos 44 0a"
  },
  {
    "opcode": 60,
    "instructionAddress": 9736568,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 8400 at pos 41 4f"
  },
  {
    "opcode": 60,
    "instructionAddress": 9814679,
    "expectedSize": 7,
    "text": "Load NPC 0060>>1 flags/state 0002 at pos 67 46"
  },
  {
    "opcode": 60,
    "instructionAddress": 9885158,
    "expectedSize": 7,
    "text": "Load NPC 0110>>1 flags/state 0020 at pos a9 53"
  },
  {
    "opcode": 60,
    "instructionAddress": 9946566,
    "expectedSize": 7,
    "text": "Load NPC 008a>>1 flags/state 0020 at pos 1d 00"
  },
  {
    "opcode": 60,
    "instructionAddress": 10077045,
    "expectedSize": 7,
    "text": "Load NPC 009e>>1 flags/state 0022 at pos 8f 4a"
  },
  {
    "opcode": 60,
    "instructionAddress": 9814729,
    "expectedSize": 7,
    "text": "Load NPC 005e>>1 flags/state 0002 at pos 6d 42"
  },
  {
    "opcode": 60,
    "instructionAddress": 9738739,
    "expectedSize": 7,
    "text": "Load NPC 003c>>1 flags/state 0002 at pos 65 5f"
  },
  {
    "opcode": 60,
    "instructionAddress": 9738756,
    "expectedSize": 7,
    "text": "Load NPC 003c>>1 flags/state 0002 at pos 70 41"
  },
  {
    "opcode": 60,
    "instructionAddress": 10134398,
    "expectedSize": 7,
    "text": "Load NPC 0040>>1 flags/state 0020 at pos 2a 01"
  },
  {
    "opcode": 60,
    "instructionAddress": 10076959,
    "expectedSize": 7,
    "text": "Load NPC 009e>>1 flags/state 0022 at pos 8f 4a"
  },
  {
    "opcode": 60,
    "instructionAddress": 9667952,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 0400 at pos 3b 4d"
  },
  {
    "opcode": 60,
    "instructionAddress": 10022862,
    "expectedSize": 7,
    "text": "Load NPC 0098>>1 flags/state 0002 at pos 18 16"
  },
  {
    "opcode": 60,
    "instructionAddress": 10128514,
    "expectedSize": 7,
    "text": "Load NPC 0040>>1 flags/state 0002 at pos 30 11"
  },
  {
    "opcode": 60,
    "instructionAddress": 9738783,
    "expectedSize": 7,
    "text": "Load NPC 003e>>1 flags/state 0002 at pos 47 4b"
  },
  {
    "opcode": 60,
    "instructionAddress": 10079596,
    "expectedSize": 7,
    "text": "Load NPC 009e>>1 flags/state 0020 at pos 15 1b"
  },
  {
    "opcode": 60,
    "instructionAddress": 10007373,
    "expectedSize": 7,
    "text": "Load NPC 0090>>1 flags/state 0002 at pos d1 1b"
  },
  {
    "opcode": 60,
    "instructionAddress": 9744920,
    "expectedSize": 7,
    "text": "Load NPC 001a>>1 flags/state 0020 at pos 0e 23"
  },
  {
    "opcode": 60,
    "instructionAddress": 9814705,
    "expectedSize": 7,
    "text": "Load NPC 0040>>1 flags/state 0002 at pos 5f 40"
  },
  {
    "opcode": 60,
    "instructionAddress": 10018837,
    "expectedSize": 7,
    "text": "Load NPC 00aa>>1 flags/state 0020 at pos 0b 6b"
  },
  {
    "opcode": 60,
    "instructionAddress": 9667941,
    "expectedSize": 7,
    "text": "Load NPC 001e>>1 flags/state 0400 at pos 45 14"
  },
  {
    "opcode": 60,
    "instructionAddress": 10140838,
    "expectedSize": 7,
    "text": "Load NPC 00aa>>1 flags/state 0002 at pos 65 4f"
  },
  {
    "opcode": 60,
    "instructionAddress": 9798793,
    "expectedSize": 7,
    "text": "Load NPC 004e>>1 flags/state 0002 at pos 0d 11"
  }
];

test('opcode corpus 0x3c', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
