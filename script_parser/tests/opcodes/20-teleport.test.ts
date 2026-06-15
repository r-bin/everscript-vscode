import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../model/rom-script-model.ts';
import { OPCODE_TRUTH } from '../ground-truth.ts';

test('opcode 0x20 TELEPORT decode matches scripts_all', () => {
  const truth = OPCODE_TRUTH.teleport20;
  const decoded = decodeOpcodeAtSnes(truth.address);

  assert.equal(decoded.opcode, truth.opcode);
  assert.equal(decoded.size, truth.size);
  assert.deepEqual(decoded.operands, truth.operands);
  assert.match(decoded.label ?? '', /Teleport both to 1d 15/i);
});
