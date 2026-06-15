import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../model/rom-script-model.ts';
import { OPCODE_TRUTH } from '../ground-truth.ts';

test('opcode 0x1B WRITE MEMORY decode matches scripts_all', () => {
  const truth = OPCODE_TRUTH.writeMemory1b;
  const decoded = decodeOpcodeAtSnes(truth.address);

  assert.equal(decoded.opcode, truth.opcode);
  assert.equal(decoded.size, truth.size);
  assert.match(decoded.label ?? '', /WRITE/i);
});
