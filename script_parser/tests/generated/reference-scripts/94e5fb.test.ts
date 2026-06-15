import test from 'node:test';
import assert from 'node:assert/strict';

import { dumpScript } from '../../../model/rom-script-model.ts';

const EXPECTED = {
  "startAddress": 9758203,
  "endAddress": 9758262,
  "instructionCount": 18,
  "opcodeSequence": [
    24,
    8,
    32,
    163,
    4,
    12,
    27,
    27,
    27,
    27,
    9,
    51,
    163,
    24,
    41,
    167,
    134,
    0
  ]
};

test('reference script 0x94e5fb', () => {
  const parsed = dumpScript(EXPECTED.startAddress);

  assert.ok(parsed.length > 0, 'no parsed instructions');
  assert.equal(parsed[0].snesAddress, EXPECTED.startAddress);
  assert.equal(parsed[parsed.length - 1].snesAddress, EXPECTED.endAddress);
  assert.equal(parsed.length, EXPECTED.instructionCount);
  assert.deepEqual(parsed.map((i) => i.opcode), EXPECTED.opcodeSequence);
});
