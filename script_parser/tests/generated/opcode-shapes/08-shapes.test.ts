import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "if {mem}&{hex} (start pressed in intro) skip {num} (to {hex})",
    "instructionAddress": 9625814,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if signed arg26 & {num} then skip {num} (to {hex})",
    "instructionAddress": 9626248,
    "expectedSize": 15,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (no previous save found) skip {num} (to {hex})",
    "instructionAddress": 9626795,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} skip {num} (to {hex})",
    "instructionAddress": 9668021,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (in animation) skip {num} (to {hex})",
    "instructionAddress": 9670960,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (checked in north jungle) skip {num} (to {hex})",
    "instructionAddress": 9672233,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (thraxx dead) skip {num} (to {hex})",
    "instructionAddress": 9688001,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem} then skip {num} (to {hex})",
    "instructionAddress": 9688089,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if ({mem}&{hex}) == {num} then skip {num} (to {hex})",
    "instructionAddress": 9688207,
    "expectedSize": 9,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (volcano room2/ flag) skip {num} (to {hex})",
    "instructionAddress": 9738750,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (some volcano room2 flag?) skip {num} (to {hex})",
    "instructionAddress": 9738777,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (volcano room2 flag) skip {num} (to {hex})",
    "instructionAddress": 9738816,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (pipe maze raptor shown?) skip {num} (to {hex})",
    "instructionAddress": 9745434,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (magmar dead) skip {num} (to {hex})",
    "instructionAddress": 9747910,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (magmar fight started?) skip {num} (to {hex})",
    "instructionAddress": 9747928,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem} != {hex} skip {num} (to {hex})",
    "instructionAddress": 9752627,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (fe visited pre-thraxx (east exit check)) skip {num} (to {hex})",
    "instructionAddress": 9757847,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (crustacia intro to be shown) skip {num} (to {hex})",
    "instructionAddress": 9798771,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (unknown flag checked below 'mids. levitated?) skip {num} (to {hex})",
    "instructionAddress": 9808108,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (doggo palace cutscene watched) skip {num} (to {hex})",
    "instructionAddress": 9810767,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (market timer expired) skip {num} (to {hex})",
    "instructionAddress": 9816773,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if ({mem}&{hex}) || ({mem}&{hex}) then skip {num} (to {hex})",
    "instructionAddress": 9816842,
    "expectedSize": 11,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (windwalker unlocked) skip {num} (to {hex})",
    "instructionAddress": 9819210,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (in credits) skip {num} (to {hex})",
    "instructionAddress": 9822626,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (vigor defeated) skip {num} (to {hex})",
    "instructionAddress": 9822797,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (dog unavailable) skip {num} (to {hex})",
    "instructionAddress": 9877631,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (unknown flag checked out and inside 'mids. dog freed?) skip {num} (to {hex})",
    "instructionAddress": 9883629,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if ({mem}&{hex}) && ({mem}&{hex}) then skip {num} (to {hex})",
    "instructionAddress": 9887788,
    "expectedSize": 11,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (ruins minitaur defeated) skip {num} (to {hex})",
    "instructionAddress": 9936170,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (bronze spear) skip {num} (to {hex})",
    "instructionAddress": 9937815,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if (({mem})&{hex}) == {hex} then skip {num} (to {hex})",
    "instructionAddress": 9996590,
    "expectedSize": 10,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (queen cutscene below chessboard watched) skip {num} (to {hex})",
    "instructionAddress": 10001600,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (doubles dead) skip {num} (to {hex})",
    "instructionAddress": 10079516,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (timberdrake dead) skip {num} (to {hex})",
    "instructionAddress": 10079731,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (prof. callbeads) skip {num} (to {hex})",
    "instructionAddress": 10082753,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (footknight defeated) skip {num} (to {hex})",
    "instructionAddress": 10082763,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (verminator dead) skip {num} (to {hex})",
    "instructionAddress": 10126173,
    "expectedSize": 6,
    "opcode": 8
  },
  {
    "shape": "if ({mem} will die) || ({mem} will die) then skip {num} (to {hex})",
    "instructionAddress": 10128729,
    "expectedSize": 13,
    "opcode": 8
  },
  {
    "shape": "if rand & {hex} then skip {num} (to {hex})",
    "instructionAddress": 10129129,
    "expectedSize": 8,
    "opcode": 8
  },
  {
    "shape": "if rand & {num} then skip {num} (to {hex})",
    "instructionAddress": 10129137,
    "expectedSize": 7,
    "opcode": 8
  },
  {
    "shape": "if {mem}&{hex} (light in storage room) skip {num} (to {hex})",
    "instructionAddress": 10194201,
    "expectedSize": 6,
    "opcode": 8
  }
];

test('opcode shape corpus 0x08', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
