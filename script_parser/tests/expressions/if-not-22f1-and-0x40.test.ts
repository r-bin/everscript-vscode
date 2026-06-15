import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../model/rom-script-model.ts';

test('expression IF !($22f1 & 0x40) matches scripts_all semantics', () => {
  const decoded = decodeOpcodeAtSnes(0x9384D9);

  assert.equal(decoded.opcode, 0x09);
  assert.match(decoded.label ?? '', /\!\(\$22f1&0x40\)/i);
});
