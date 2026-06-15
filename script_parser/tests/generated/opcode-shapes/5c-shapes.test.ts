import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "set obj {num} state = val:signed arg28 + {num} (load/unload)",
    "instructionAddress": 9626263,
    "expectedSize": 21,
    "opcode": 92
  },
  {
    "shape": "set obj {num} state = val:{num} (load/unload)",
    "instructionAddress": 9681315,
    "expectedSize": 3,
    "opcode": 92
  },
  {
    "shape": "set obj {mem} state = val:{num} (load/unload)",
    "instructionAddress": 9687623,
    "expectedSize": 5,
    "opcode": 92
  },
  {
    "shape": "set obj {num} state = val:{hex} (load/unload)",
    "instructionAddress": 9736744,
    "expectedSize": 4,
    "opcode": 92
  },
  {
    "shape": "set obj {hex} state = val:{hex} (load/unload)",
    "instructionAddress": 9736828,
    "expectedSize": 5,
    "opcode": 92
  },
  {
    "shape": "set obj {hex} state = val:{num} (load/unload)",
    "instructionAddress": 9877108,
    "expectedSize": 4,
    "opcode": 92
  },
  {
    "shape": "set obj {mem} state = val:signed arg28 + (signed arg6 & {num}) (load/unload)",
    "instructionAddress": 10129419,
    "expectedSize": 13,
    "opcode": 92
  }
];

test('opcode shape corpus 0x5c', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
