import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../model/rom-script-model.ts';
import { OPCODE_TRUTH } from '../ground-truth.ts';

test('opcode 0xA5 RCALL decode matches scripts_all', () => {
  const truth = OPCODE_TRUTH.rcallA5;
  const decoded = decodeOpcodeAtSnes(truth.address);

  assert.equal(decoded.opcode, truth.opcode);
  assert.equal(decoded.size, truth.size);
  assert.equal(decoded.branchTarget, truth.branchTarget);
  assert.match(decoded.label ?? '', /RCALL/i);
});
