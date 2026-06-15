import test from 'node:test';
import assert from 'node:assert/strict';

import { parseScript } from '../model/rom-script-model.ts';

const START_SCRIPTS = [0x94E5FB, 0x94E795, 0x93912C];

test('reference scripts reach END opcode 0x00', () => {
  for (const startAddress of START_SCRIPTS) {
    const result = parseScript(startAddress);

    assert.equal(result.terminated, true, `script 0x${startAddress.toString(16)} did not terminate`);
    assert.equal(result.endOpcode, 0x00, `script 0x${startAddress.toString(16)} did not end at opcode 0x00`);
  }
});
