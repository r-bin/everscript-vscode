import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "write boy+x68={hex}, boy+x66={hex} (set script): unnamed npc kill script {hex}",
    "instructionAddress": 9668015,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write {mem}+x68={hex}, {mem}+x66={hex} (set script): raptors kill",
    "instructionAddress": 9671024,
    "expectedSize": 8,
    "opcode": 63
  },
  {
    "shape": "write {mem}+{num}={hex}, {mem}+{num}={hex} (unknown): unknown 0eac+{num} (set in lots of places)?",
    "instructionAddress": 9679302,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write {mem}+{num}={hex}, {mem}+{num}={hex} (unknown): bbm wings?",
    "instructionAddress": 9683668,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write last entity ({mem})+x68={hex}, last entity ({mem})+x66={hex} (set script): thraxx damage/kill",
    "instructionAddress": 9687716,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write last entity ({mem})+x68={hex}, last entity ({mem})+x66={hex} (set script): unnamed npc kill script {hex}",
    "instructionAddress": 9687785,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write last entity ({mem})+x68={hex}, last entity ({mem})+x66={hex} (set script): unnamed npc script {hex}",
    "instructionAddress": 9687809,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write {mem}+x68={hex}, {mem}+x66={hex} (set script): unnamed npc kill script {hex}",
    "instructionAddress": 9688058,
    "expectedSize": 8,
    "opcode": 63
  },
  {
    "shape": "write last entity ({mem})+x68={hex}, last entity ({mem})+x66={hex} (set script): viper commander kill",
    "instructionAddress": 9739114,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write last entity ({mem})+x68={hex}, last entity ({mem})+x66={hex} (set script): cave raptors kill",
    "instructionAddress": 9742624,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write {mem}+{num}={hex}, {mem}+{num}={hex} (unknown): unnamed short script {hex}?",
    "instructionAddress": 9743607,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write last entity ({mem})+x68={hex}, last entity ({mem})+x66={hex} (set script): magmar damage",
    "instructionAddress": 9747994,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write {mem}+{num}={hex}, {mem}+{num}={hex} (unknown): 'mids [{num}]?",
    "instructionAddress": 9802694,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write {mem}+{num}={hex}, {mem}+{num}={hex} (unknown): tiny wings?",
    "instructionAddress": 9808071,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write last entity ({mem})+x68={hex}, last entity ({mem})+x66={hex} (set script): rimsala kill",
    "instructionAddress": 9809958,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write last entity ({mem})+x68={hex}, last entity ({mem})+x66={hex} (set script): unnamed npc damage script {hex}",
    "instructionAddress": 9810040,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write {mem}+x68={hex}, {mem}+x66={hex} (set script): unnamed npc script {hex}",
    "instructionAddress": 9936187,
    "expectedSize": 8,
    "opcode": 63
  },
  {
    "shape": "write {mem}+{num}={hex}, {mem}+{num}={hex} (unknown): halls wings?",
    "instructionAddress": 9937587,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write {mem}+{num}={hex}, {mem}+{num}={hex} (unknown): unknown script in halls ne?",
    "instructionAddress": 9937801,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write last entity ({mem})+x68={hex}, last entity ({mem})+x66={hex} (set script): halls mad monk kill",
    "instructionAddress": 9937830,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write {mem}+x68={hex}, {mem}+x66={hex} (set script): megataur kill",
    "instructionAddress": 9938987,
    "expectedSize": 8,
    "opcode": 63
  },
  {
    "shape": "write last entity ({mem})+x68={hex}, last entity ({mem})+x66={hex} (set script): aquagoth",
    "instructionAddress": 9955555,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write dog+x68={hex}, dog+x66={hex} (set script): doggo dies in prison?",
    "instructionAddress": 10006667,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write {mem}+x68={hex}, {mem}+x66={hex} (set script): sterling",
    "instructionAddress": 10069915,
    "expectedSize": 13,
    "opcode": 63
  },
  {
    "shape": "write {mem}+x68={hex}, {mem}+x66={hex} (set script): timberdrake kill",
    "instructionAddress": 10079745,
    "expectedSize": 8,
    "opcode": 63
  },
  {
    "shape": "write {mem}+x68={hex}, {mem}+x66={hex} (set script): vigor damage",
    "instructionAddress": 10087800,
    "expectedSize": 8,
    "opcode": 63
  },
  {
    "shape": "write last entity ({mem})+x68={hex}, last entity ({mem})+x66={hex} (set script): puppet damage/kill",
    "instructionAddress": 10128699,
    "expectedSize": 11,
    "opcode": 63
  },
  {
    "shape": "write last entity ({mem})+x68={hex}, last entity ({mem})+x66={hex} (set script): mungola? damage/kill",
    "instructionAddress": 10129091,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write {mem}+x68={hex}, {mem}+x66={hex} (set script): unnamed npc damage script {hex}",
    "instructionAddress": 10192412,
    "expectedSize": 8,
    "opcode": 63
  },
  {
    "shape": "write {mem}+x68={hex}, {mem}+x66={hex} (set script): unnamed npc talk script {hex}",
    "instructionAddress": 10195791,
    "expectedSize": 8,
    "opcode": 63
  },
  {
    "shape": "write last entity ({mem})+x68={hex}, last entity ({mem})+x66={hex} (set script): unnamed npc talk script {hex}",
    "instructionAddress": 10198916,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write {mem}+{num}={hex}, {mem}+{num}={hex} (unknown): boss rush loot script?",
    "instructionAddress": 10205652,
    "expectedSize": 6,
    "opcode": 63
  },
  {
    "shape": "write {mem}+x68={hex}, {mem}+x66={hex} (set script): junkyard robot / reflect",
    "instructionAddress": 10216233,
    "expectedSize": 8,
    "opcode": 63
  }
];

test('opcode shape corpus 0x3f', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
