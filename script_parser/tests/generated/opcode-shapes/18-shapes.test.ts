import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "write {mem} = signed arg0",
    "instructionAddress": 9625871,
    "expectedSize": 5,
    "opcode": 24
  },
  {
    "shape": "write change doggo ({mem}) = regular ({hex})",
    "instructionAddress": 9626813,
    "expectedSize": 4,
    "opcode": 24
  },
  {
    "shape": "write prize {num} qty ({mem}) = {hex}",
    "instructionAddress": 9667878,
    "expectedSize": 4,
    "opcode": 24
  },
  {
    "shape": "write prize {num} rate ({mem}) = {hex}",
    "instructionAddress": 9679308,
    "expectedSize": 4,
    "opcode": 24
  },
  {
    "shape": "write prize {num} drop ({mem}) = {hex}",
    "instructionAddress": 9679320,
    "expectedSize": 6,
    "opcode": 24
  },
  {
    "shape": "write {mem} = {mem}",
    "instructionAddress": 9687929,
    "expectedSize": 11,
    "opcode": 24
  },
  {
    "shape": "write screen shaking magnitude y ({mem}) = {hex}",
    "instructionAddress": 9747942,
    "expectedSize": 4,
    "opcode": 24
  },
  {
    "shape": "write screen shaking magnitude x ({mem}) = {hex}",
    "instructionAddress": 9747946,
    "expectedSize": 4,
    "opcode": 24
  },
  {
    "shape": "write screen shaking magnitude y ({mem}) = {mem}",
    "instructionAddress": 9747963,
    "expectedSize": 6,
    "opcode": 24
  },
  {
    "shape": "write screen shaking magnitude x ({mem}) = {mem}",
    "instructionAddress": 9747969,
    "expectedSize": 6,
    "opcode": 24
  },
  {
    "shape": "write {mem} = signed arg0 + {hex} signed",
    "instructionAddress": 9752115,
    "expectedSize": 9,
    "opcode": 24
  },
  {
    "shape": "write {mem} = signed arg2 + {num}",
    "instructionAddress": 9752124,
    "expectedSize": 8,
    "opcode": 24
  },
  {
    "shape": "write {mem} = {mem} + {hex} signed",
    "instructionAddress": 9752140,
    "expectedSize": 10,
    "opcode": 24
  },
  {
    "shape": "write {mem} = {mem} + {num}",
    "instructionAddress": 9752150,
    "expectedSize": 9,
    "opcode": 24
  },
  {
    "shape": "write {mem} = last entity ({mem})",
    "instructionAddress": 9757411,
    "expectedSize": 4,
    "opcode": 24
  },
  {
    "shape": "write change doggo ({mem}) = wolf ({hex})",
    "instructionAddress": 9758203,
    "expectedSize": 4,
    "opcode": 24
  },
  {
    "shape": "write doggo close ({mem}) = {hex}",
    "instructionAddress": 9812835,
    "expectedSize": 4,
    "opcode": 24
  },
  {
    "shape": "write change doggo ({mem}) = greyhound ({hex})",
    "instructionAddress": 9823494,
    "expectedSize": 4,
    "opcode": 24
  },
  {
    "shape": "write {mem} = rand & {num}",
    "instructionAddress": 9877076,
    "expectedSize": 7,
    "opcode": 24
  },
  {
    "shape": "write change doggo ({mem}) = poodle ({hex})",
    "instructionAddress": 9996640,
    "expectedSize": 4,
    "opcode": 24
  },
  {
    "shape": "write {mem} = *(controlled char + {num})",
    "instructionAddress": 9999673,
    "expectedSize": 8,
    "opcode": 24
  },
  {
    "shape": "write {mem} = {mem} - {hex}",
    "instructionAddress": 9999681,
    "expectedSize": 10,
    "opcode": 24
  },
  {
    "shape": "write map x end ({mem}) = {mem} + {hex}",
    "instructionAddress": 10008714,
    "expectedSize": 11,
    "opcode": 24
  },
  {
    "shape": "write map y end ({mem}) = {mem} + {hex}",
    "instructionAddress": 10008725,
    "expectedSize": 10,
    "opcode": 24
  },
  {
    "shape": "write map x start ({mem}) = {mem}",
    "instructionAddress": 10008749,
    "expectedSize": 6,
    "opcode": 24
  },
  {
    "shape": "write map y start ({mem}) = {mem}",
    "instructionAddress": 10008755,
    "expectedSize": 6,
    "opcode": 24
  },
  {
    "shape": "write map x end ({mem}) = {mem}",
    "instructionAddress": 10008761,
    "expectedSize": 6,
    "opcode": 24
  },
  {
    "shape": "write map y end ({mem}) = {mem}",
    "instructionAddress": 10008767,
    "expectedSize": 6,
    "opcode": 24
  },
  {
    "shape": "write {mem} = {hex}",
    "instructionAddress": 10009534,
    "expectedSize": 4,
    "opcode": 24
  },
  {
    "shape": "write {mem} = {mem}&{hex}",
    "instructionAddress": 10060614,
    "expectedSize": 6,
    "opcode": 24
  },
  {
    "shape": "write {mem} = (signed arg0 + {hex}) - {hex}",
    "instructionAddress": 10128808,
    "expectedSize": 13,
    "opcode": 24
  },
  {
    "shape": "write {mem} = signed arg8 - {hex}",
    "instructionAddress": 10129722,
    "expectedSize": 9,
    "opcode": 24
  },
  {
    "shape": "write {mem} = (signed arg10 - {hex}) - {hex}",
    "instructionAddress": 10129731,
    "expectedSize": 13,
    "opcode": 24
  },
  {
    "shape": "write {mem} = (*(boy + {num}) + {num}) - {hex}",
    "instructionAddress": 10129995,
    "expectedSize": 15,
    "opcode": 24
  },
  {
    "shape": "write change music ({mem}) = {hex}",
    "instructionAddress": 10142621,
    "expectedSize": 4,
    "opcode": 24
  },
  {
    "shape": "write change doggo ({mem}) = toaster ({hex})",
    "instructionAddress": 10214707,
    "expectedSize": 4,
    "opcode": 24
  }
];

test('opcode shape corpus 0x18', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
