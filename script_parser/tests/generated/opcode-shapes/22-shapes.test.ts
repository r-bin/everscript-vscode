import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const SHAPES = [
  {
    "shape": "change map = {hex} @ [ {hex} | {hex} ]: \"prehistoria - south jungle / start\"",
    "instructionAddress": 9626702,
    "expectedSize": 5,
    "opcode": 34
  },
  {
    "shape": "change map = {hex} @ [ {hex} | {hex} ]: \"intro - mansion exterior {num}\"",
    "instructionAddress": 9627033,
    "expectedSize": 5,
    "opcode": 34
  },
  {
    "shape": "change map = {hex} @ [ {hex} | {hex} ]: \"intro - podunk {num}\"",
    "instructionAddress": 9627203,
    "expectedSize": 5,
    "opcode": 34
  },
  {
    "shape": "change map = {hex} @ [ {hex} | {hex} ]: \"omnitopia - professor's lab and ship area, (also?) intro\"",
    "instructionAddress": 9629782,
    "expectedSize": 5,
    "opcode": 34
  },
  {
    "shape": "change map = {hex} @ [ {hex} | {hex} ]: \"prehistoria - sky above volcano\"",
    "instructionAddress": 9733369,
    "expectedSize": 5,
    "opcode": 34
  },
  {
    "shape": "change map = {hex} @ [ {hex} | {hex} ]: \"prehistoria - top of volcano\"",
    "instructionAddress": 9733871,
    "expectedSize": 5,
    "opcode": 34
  },
  {
    "shape": "change map = {hex} @ [ {hex} | {hex} ]: \"prehistoria - both fire pits (one room)\"",
    "instructionAddress": 9752182,
    "expectedSize": 5,
    "opcode": 34
  },
  {
    "shape": "change map = {hex} @ [ {hex} | {hex} ]: \"antiqua - nobilia, square\"",
    "instructionAddress": 9946811,
    "expectedSize": 5,
    "opcode": 34
  },
  {
    "shape": "change map = {hex} @ [ {hex} | {hex} ]: \"gothica - ebon keep fire pit\"",
    "instructionAddress": 9946866,
    "expectedSize": 5,
    "opcode": 34
  },
  {
    "shape": "change map = {hex} @ [ {hex} | {hex} ]: \"prehistoria - fire eyes' village\"",
    "instructionAddress": 9948451,
    "expectedSize": 5,
    "opcode": 34
  },
  {
    "shape": "change map = {hex} @ [ {hex} | {hex} ]: \"antiqua - nobilia, fire pit\"",
    "instructionAddress": 9948511,
    "expectedSize": 5,
    "opcode": 34
  },
  {
    "shape": "change map = {hex} @ [ {hex} | {hex} ]: \"gothica - ivor tower queen's room\"",
    "instructionAddress": 10130132,
    "expectedSize": 5,
    "opcode": 34
  },
  {
    "shape": "change map = {hex} @ [ {hex} | {hex} ]: \"gothica - ebon keep and ivory tower dungeon + pipe room\"",
    "instructionAddress": 10142625,
    "expectedSize": 5,
    "opcode": 34
  }
];

test('opcode shape corpus 0x22', () => {
  for (const sample of SHAPES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
