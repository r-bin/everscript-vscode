import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../model/rom-script-model.ts';

test('expression sleep(0d14) literal timing matches scripts_all line SLEEP 14 TICKS', () => {
  const decoded = decodeOpcodeAtSnes(0x94E631);

  assert.equal(decoded.opcode, 0xA7);
  assert.equal(decoded.size, 2);
  assert.equal(decoded.operands[0], 0x14);
});
