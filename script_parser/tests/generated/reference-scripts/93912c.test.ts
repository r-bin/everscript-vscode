import test from 'node:test';
import assert from 'node:assert/strict';

import { dumpScript } from '../../../model/rom-script-model.ts';

const EXPECTED = {
  "startAddress": 9670956,
  "endAddress": 9671203,
  "instructionCount": 48,
  "opcodeSequence": [
    24,
    8,
    32,
    163,
    4,
    12,
    93,
    93,
    93,
    93,
    60,
    25,
    63,
    60,
    25,
    63,
    60,
    25,
    63,
    60,
    25,
    122,
    63,
    60,
    25,
    63,
    12,
    60,
    25,
    60,
    25,
    60,
    25,
    60,
    25,
    60,
    25,
    9,
    51,
    24,
    41,
    135,
    9,
    134,
    58,
    5,
    166,
    0
  ]
};

test('reference script 0x93912c', () => {
  const parsed = dumpScript(EXPECTED.startAddress);

  assert.ok(parsed.length > 0, 'no parsed instructions');
  assert.equal(parsed[0].snesAddress, EXPECTED.startAddress);
  assert.equal(parsed[parsed.length - 1].snesAddress, EXPECTED.endAddress);
  assert.equal(parsed.length, EXPECTED.instructionCount);
  assert.deepEqual(parsed.map((i) => i.opcode), EXPECTED.opcodeSequence);
});
