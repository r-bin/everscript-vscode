import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 155,
    "instructionAddress": 9824677,
    "expectedSize": 4,
    "text": "DESTROY/DEALLOC ENTITY $2838"
  },
  {
    "opcode": 155,
    "instructionAddress": 9953024,
    "expectedSize": 3,
    "text": "DESTROY/DEALLOC ENTITY signed arg0"
  },
  {
    "opcode": 155,
    "instructionAddress": 9808594,
    "expectedSize": 3,
    "text": "DESTROY/DEALLOC ENTITY signed arg0"
  },
  {
    "opcode": 155,
    "instructionAddress": 10129019,
    "expectedSize": 3,
    "text": "DESTROY/DEALLOC ENTITY signed arg14"
  },
  {
    "opcode": 155,
    "instructionAddress": 10129022,
    "expectedSize": 3,
    "text": "DESTROY/DEALLOC ENTITY signed arg16"
  },
  {
    "opcode": 155,
    "instructionAddress": 10129025,
    "expectedSize": 3,
    "text": "DESTROY/DEALLOC ENTITY signed arg18"
  },
  {
    "opcode": 155,
    "instructionAddress": 10129028,
    "expectedSize": 3,
    "text": "DESTROY/DEALLOC ENTITY signed arg20"
  },
  {
    "opcode": 155,
    "instructionAddress": 10129031,
    "expectedSize": 3,
    "text": "DESTROY/DEALLOC ENTITY signed arg22"
  },
  {
    "opcode": 155,
    "instructionAddress": 10129034,
    "expectedSize": 3,
    "text": "DESTROY/DEALLOC ENTITY signed arg24"
  },
  {
    "opcode": 155,
    "instructionAddress": 10129329,
    "expectedSize": 4,
    "text": "DESTROY/DEALLOC ENTITY $2839"
  },
  {
    "opcode": 155,
    "instructionAddress": 10129333,
    "expectedSize": 7,
    "text": "DESTROY/DEALLOC ENTITY $283b"
  },
  {
    "opcode": 155,
    "instructionAddress": 10129965,
    "expectedSize": 4,
    "text": "DESTROY/DEALLOC ENTITY $2835"
  },
  {
    "opcode": 155,
    "instructionAddress": 9626286,
    "expectedSize": 3,
    "text": "DESTROY/DEALLOC ENTITY signed arg30"
  }
];

test('opcode corpus 0x9b', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
