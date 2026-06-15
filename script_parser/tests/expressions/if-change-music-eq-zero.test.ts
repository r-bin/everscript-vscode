import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../model/rom-script-model.ts';

test('expression CHANGE MUSIC == 0x00 matches scripts_all semantics', () => {
  const decoded = decodeOpcodeAtSnes(0x94E61F);

  assert.equal(decoded.opcode, 0x09);
  assert.match(decoded.label ?? '', /CHANGE MUSIC/i);
});
