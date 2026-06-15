import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 34,
    "instructionAddress": 9752182,
    "expectedSize": 5,
    "text": "CHANGE MAP = 0x36 @ [ 0x00e8 | 0x0148 ]: \"Prehistoria - Both fire pits (one room)\""
  },
  {
    "opcode": 34,
    "instructionAddress": 9733369,
    "expectedSize": 5,
    "text": "CHANGE MAP = 0x50 @ [ 0x0008 | 0x00d8 ]: \"Prehistoria - Sky above Volcano\""
  },
  {
    "opcode": 34,
    "instructionAddress": 9733871,
    "expectedSize": 5,
    "text": "CHANGE MAP = 0x52 @ [ 0x0008 | 0x00e8 ]: \"Prehistoria - Top of Volcano\""
  },
  {
    "opcode": 34,
    "instructionAddress": 9948451,
    "expectedSize": 5,
    "text": "CHANGE MAP = 0x25 @ [ 0x03e8 | 0x0328 ]: \"Prehistoria - Fire Eyes' Village\""
  },
  {
    "opcode": 34,
    "instructionAddress": 9948511,
    "expectedSize": 5,
    "text": "CHANGE MAP = 0x3a @ [ 0x00e8 | 0x00c8 ]: \"Antiqua - Nobilia, Fire pit\""
  },
  {
    "opcode": 34,
    "instructionAddress": 9946811,
    "expectedSize": 5,
    "text": "CHANGE MAP = 0x08 @ [ 0x02d8 | 0x01b8 ]: \"Antiqua - Nobilia, Square\""
  },
  {
    "opcode": 34,
    "instructionAddress": 9946866,
    "expectedSize": 5,
    "text": "CHANGE MAP = 0x39 @ [ 0x0138 | 0x01d8 ]: \"Gothica - Ebon Keep Fire pit\""
  },
  {
    "opcode": 34,
    "instructionAddress": 10142625,
    "expectedSize": 5,
    "text": "CHANGE MAP = 0x74 @ [ 0x0178 | 0x0068 ]: \"Gothica - Ebon Keep and Ivory Tower dungeon + pipe room\""
  },
  {
    "opcode": 34,
    "instructionAddress": 10130132,
    "expectedSize": 5,
    "text": "CHANGE MAP = 0x78 @ [ 0x0018 | 0x01a8 ]: \"Gothica - Ivor Tower Queen's Room\""
  },
  {
    "opcode": 34,
    "instructionAddress": 9626702,
    "expectedSize": 5,
    "text": "CHANGE MAP = 0x38 @ [ 0x0230 | 0x0448 ]: \"Prehistoria - South jungle / Start\""
  },
  {
    "opcode": 34,
    "instructionAddress": 9627033,
    "expectedSize": 5,
    "text": "CHANGE MAP = 0x02 @ [ 0x0058 | 0x0358 ]: \"Intro - Mansion Exterior 1965\""
  },
  {
    "opcode": 34,
    "instructionAddress": 9627203,
    "expectedSize": 5,
    "text": "CHANGE MAP = 0x32 @ [ 0x0010 | 0x0000 ]: \"Intro - Podunk 1995\""
  },
  {
    "opcode": 34,
    "instructionAddress": 9629782,
    "expectedSize": 5,
    "text": "CHANGE MAP = 0x46 @ [ 0x00d0 | 0x02d8 ]: \"Omnitopia - Professor's lab and ship area, (also?) Intro\""
  }
];

test('opcode corpus 0x22', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
