import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../model/rom-script-model.ts';

test('expression IF $22eb & 0x20 matches scripts_all semantics', () => {
  const decoded = decodeOpcodeAtSnes(0x94E5FF);

  assert.equal(decoded.opcode, 0x08);
  assert.match(decoded.label ?? '', /\$22eb&0x20/i);
});
