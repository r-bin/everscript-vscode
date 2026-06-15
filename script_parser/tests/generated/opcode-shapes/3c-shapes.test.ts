import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos {num} 1f",
    "instructionAddress": 9667886,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos 2d 7d",
    "instructionAddress": 9667908,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos {num} 1d",
    "instructionAddress": 9667930,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos 3b 4d",
    "instructionAddress": 9667952,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001a>>{num} flags/state {num} at pos {num} {num}",
    "instructionAddress": 9671051,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos {num} 1b",
    "instructionAddress": 9671112,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos {num} 2b",
    "instructionAddress": 9671134,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos {num} 4b",
    "instructionAddress": 9672187,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos 5b {num}",
    "instructionAddress": 9672198,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos 1d {num}",
    "instructionAddress": 9672209,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos 5b 1f",
    "instructionAddress": 9672220,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos 2b 0b",
    "instructionAddress": 9681069,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos {num} 5d",
    "instructionAddress": 9681080,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos 5f {num}",
    "instructionAddress": 9681091,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos a1 {num}",
    "instructionAddress": 9681102,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos a9 {num}",
    "instructionAddress": 9681113,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos {num} 5f",
    "instructionAddress": 9681135,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos {num} 0b",
    "instructionAddress": 9684614,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos 0b {num}",
    "instructionAddress": 9734518,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos 4f {num}",
    "instructionAddress": 9734529,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos 2f {num}",
    "instructionAddress": 9736524,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos {num} af",
    "instructionAddress": 9736535,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos 5d {num}",
    "instructionAddress": 9736546,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos {num} 4f",
    "instructionAddress": 9736568,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos 4d {num}",
    "instructionAddress": 9736590,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 003c>>{num} flags/state {num} at pos 5e 8c",
    "instructionAddress": 9738702,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 003c>>{num} flags/state {num} at pos 5a 8c",
    "instructionAddress": 9738712,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 003c>>{num} flags/state {num} at pos {num} 5f",
    "instructionAddress": 9738739,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 003c>>{num} flags/state {num} at pos 6c {num}",
    "instructionAddress": 9738766,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 003e>>{num} flags/state {num} at pos {num} 4b",
    "instructionAddress": 9738783,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 003e>>{num} flags/state {num} at pos {num} 3d",
    "instructionAddress": 9738822,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 003e>>{num} flags/state {num} at pos {num} 2b",
    "instructionAddress": 9738861,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos ef {num}",
    "instructionAddress": 9740649,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos 1b {num}",
    "instructionAddress": 9743617,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos 4f 2d",
    "instructionAddress": 9743624,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos {num} {num}",
    "instructionAddress": 9743659,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001e>>{num} flags/state {num} at pos {num} 7d",
    "instructionAddress": 9743666,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 001a>>{num} flags/state {num} at pos 0e {num}",
    "instructionAddress": 9744920,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 000e>>{num} flags/state {num} at pos {num} {num}",
    "instructionAddress": 9752470,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 002a>>{num} flags/state {num} at pos 0d 5d",
    "instructionAddress": 9757579,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 002a>>{num} flags/state {num} at pos {num} {num}",
    "instructionAddress": 9757627,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 004e>>{num} flags/state {num} at pos 2b {num}",
    "instructionAddress": 9798745,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 004e>>{num} flags/state {num} at pos 4f {num}",
    "instructionAddress": 9798760,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 004e>>{num} flags/state {num} at pos 0d {num}",
    "instructionAddress": 9798793,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos ad {num}",
    "instructionAddress": 9802677,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 003c>>{num} flags/state {num} at pos {num} {num}",
    "instructionAddress": 9808114,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 002e>>{num} flags/state {num} at pos {num} {num}",
    "instructionAddress": 9812861,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 004e>>{num} flags/state {num} at pos 0f {num}",
    "instructionAddress": 9814529,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 004e>>{num} flags/state {num} at pos {num} {num}",
    "instructionAddress": 9814572,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 005a>>{num} flags/state {num} at pos 6b 3f",
    "instructionAddress": 9814615,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 005c>>{num} flags/state {num} at pos 6f 3f",
    "instructionAddress": 9814634,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 005e>>{num} flags/state {num} at pos {num} {num}",
    "instructionAddress": 9814653,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos 5f {num}",
    "instructionAddress": 9814705,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 005e>>{num} flags/state {num} at pos 6d {num}",
    "instructionAddress": 9814729,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos 4b {num}",
    "instructionAddress": 9816821,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 008c>>{num} flags/state {num} at pos 5a {num}",
    "instructionAddress": 9816867,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos 3d {num}",
    "instructionAddress": 9819254,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos 2a 3a",
    "instructionAddress": 9822491,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos 2e 3e",
    "instructionAddress": 9822506,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos 2d {num}",
    "instructionAddress": 9822521,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos 2c {num}",
    "instructionAddress": 9822551,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos 2b 4b",
    "instructionAddress": 9822581,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos 2e 4c",
    "instructionAddress": 9822596,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos 2b 2a",
    "instructionAddress": 9822632,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 008c>>{num} flags/state {num} at pos {num} 2f",
    "instructionAddress": 9822647,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos {num} 0a",
    "instructionAddress": 9824650,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos a9 {num}",
    "instructionAddress": 9885158,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 008a>>{num} flags/state {num} at pos {num} {num}",
    "instructionAddress": 9887799,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 003a>>{num} flags/state {num} at pos {num} {num}",
    "instructionAddress": 9944780,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos {num} 2f",
    "instructionAddress": 9944825,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00c4>>{num} flags/state {num} at pos {num} 1e",
    "instructionAddress": 9944855,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 008a>>{num} flags/state {num} at pos 1d {num}",
    "instructionAddress": 9946566,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos d1 1b",
    "instructionAddress": 10007373,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00a6>>{num} flags/state {num} at pos {num} 3f",
    "instructionAddress": 10011838,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00ac>>{num} flags/state {num} at pos 2f 3f",
    "instructionAddress": 10011859,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00aa>>{num} flags/state {num} at pos 3d {num}",
    "instructionAddress": 10011868,
    "expectedSize": 12,
    "opcode": 60
  },
  {
    "shape": "load npc 00aa>>{num} flags/state {num} at pos 4b {num}",
    "instructionAddress": 10011880,
    "expectedSize": 12,
    "opcode": 60
  },
  {
    "shape": "load npc 00ac>>{num} flags/state {num} at pos 3c 4d",
    "instructionAddress": 10011892,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00aa>>{num} flags/state {num} at pos 4f {num}",
    "instructionAddress": 10011901,
    "expectedSize": 12,
    "opcode": 60
  },
  {
    "shape": "load npc 00aa>>{num} flags/state {num} at pos {num} {num}",
    "instructionAddress": 10013195,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00aa>>{num} flags/state {num} at pos 0b 6b",
    "instructionAddress": 10018837,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00ac>>{num} flags/state {num} at pos 0b {num}",
    "instructionAddress": 10018924,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00aa>>{num} flags/state {num} at pos 3b 2a",
    "instructionAddress": 10018946,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00b0>>{num} flags/state {num} at pos {num} {num}",
    "instructionAddress": 10063020,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 009e>>{num} flags/state {num} at pos 8f 4a",
    "instructionAddress": 10076959,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 009e>>{num} flags/state {num} at pos 5f 8a",
    "instructionAddress": 10077017,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 009e>>{num} flags/state {num} at pos 0b 1b",
    "instructionAddress": 10079532,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 009e>>{num} flags/state {num} at pos {num} {num}",
    "instructionAddress": 10079548,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 009e>>{num} flags/state {num} at pos {num} 1d",
    "instructionAddress": 10079580,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 009e>>{num} flags/state {num} at pos {num} 1b",
    "instructionAddress": 10079596,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 009e>>{num} flags/state {num} at pos {num} 1f",
    "instructionAddress": 10079612,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos {num} {num}",
    "instructionAddress": 10128514,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00ac>>{num} flags/state {num} at pos {num} 1f",
    "instructionAddress": 10134360,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos 2a {num}",
    "instructionAddress": 10134398,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc {num}>>{num} flags/state {num} at pos 2f {num}",
    "instructionAddress": 10136326,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00aa>>{num} flags/state {num} at pos {num} 4f",
    "instructionAddress": 10140838,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00a2>>{num} flags/state {num} at pos {num} 4f",
    "instructionAddress": 10140852,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00b0>>{num} flags/state {num} at pos {num} 3f",
    "instructionAddress": 10145935,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00f4>>{num} flags/state {num} at pos {num} 3d",
    "instructionAddress": 10192571,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00f4>>{num} flags/state {num} at pos {num} 5d",
    "instructionAddress": 10192582,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00f4>>{num} flags/state {num} at pos {num} 3b",
    "instructionAddress": 10192593,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00f4>>{num} flags/state {num} at pos 0f 1f",
    "instructionAddress": 10192604,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 009c>>{num} flags/state {num} at pos b5 {num}",
    "instructionAddress": 10195780,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 009a>>{num} flags/state {num} at pos {num} 4e",
    "instructionAddress": 10198879,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 009a>>{num} flags/state {num} at pos {num} {num}",
    "instructionAddress": 10198896,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 00be>>{num} flags/state {num} at pos 1a {num}",
    "instructionAddress": 10214747,
    "expectedSize": 7,
    "opcode": 60
  },
  {
    "shape": "load npc 009c>>{num} flags/state {num} at pos 6e {num}",
    "instructionAddress": 10216222,
    "expectedSize": 7,
    "opcode": 60
  }
];

test('opcode shape corpus 0x3c', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
