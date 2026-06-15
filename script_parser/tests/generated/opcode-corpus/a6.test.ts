import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeOpcodeAtSnes } from '../../../model/rom-script-model.ts';

const CASES = [
  {
    "opcode": 166,
    "instructionAddress": 9997040,
    "expectedSize": 3,
    "text": "RCALL -507 (to 0x9888f5): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9798961,
    "expectedSize": 3,
    "text": "RCALL -860 (to 0x9581d5): Crustacia intro"
  },
  {
    "opcode": 166,
    "instructionAddress": 9819362,
    "expectedSize": 3,
    "text": "RCALL -1149 (to 0x95d065): Palace cutscene part [2]"
  },
  {
    "opcode": 166,
    "instructionAddress": 9948466,
    "expectedSize": 11,
    "text": "RCALL -559 (to 0x97cb03): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9687956,
    "expectedSize": 3,
    "text": "RCALL -2347 (to 0x93ca69): Thraxx enter part [2]"
  },
  {
    "opcode": 166,
    "instructionAddress": 10134607,
    "expectedSize": 3,
    "text": "RCALL -1908 (to 0x9a9cdb): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9936195,
    "expectedSize": 3,
    "text": "RCALL -396 (to 0x979bb7): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9997071,
    "expectedSize": 3,
    "text": "RCALL -538 (to 0x9888f5): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9748019,
    "expectedSize": 3,
    "text": "RCALL -796 (to 0x94bb17): Magmar intro part [1]"
  },
  {
    "opcode": 166,
    "instructionAddress": 9996587,
    "expectedSize": 3,
    "text": "RCALL -7585 (to 0x97eb8a): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9812960,
    "expectedSize": 3,
    "text": "RCALL -417 (to 0x95ba3f): Crush dialog"
  },
  {
    "opcode": 166,
    "instructionAddress": 9688049,
    "expectedSize": 3,
    "text": "RCALL -3066 (to 0x93c7f7): Thraxx enter part [3]"
  },
  {
    "opcode": 166,
    "instructionAddress": 9748072,
    "expectedSize": 3,
    "text": "RCALL -849 (to 0x94bb17): Magmar intro part [1]"
  },
  {
    "opcode": 166,
    "instructionAddress": 10146006,
    "expectedSize": 3,
    "text": "RCALL -2921 (to 0x9ac56d): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10022859,
    "expectedSize": 3,
    "text": "RCALL -1190 (to 0x98eb25): Ebon Keep throne room credits"
  },
  {
    "opcode": 166,
    "instructionAddress": 9804407,
    "expectedSize": 3,
    "text": "RCALL -529 (to 0x959866): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10129541,
    "expectedSize": 3,
    "text": "RCALL -3113 (to 0x9a845c): Puppet show [1] (fight)"
  },
  {
    "opcode": 166,
    "instructionAddress": 10064287,
    "expectedSize": 3,
    "text": "RCALL -1032 (to 0x998d97): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9668287,
    "expectedSize": 3,
    "text": "RCALL -868 (to 0x93835b): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10214842,
    "expectedSize": 3,
    "text": "RCALL -8417 (to 0x9bbcd9): Prof. Lab part [3]"
  },
  {
    "opcode": 166,
    "instructionAddress": 10063210,
    "expectedSize": 3,
    "text": "RCALL -1702 (to 0x9986c4): Tinker part [3]"
  },
  {
    "opcode": 166,
    "instructionAddress": 10214765,
    "expectedSize": 3,
    "text": "RCALL -3321 (to 0x9bd074): Prof. Lab part [2]"
  },
  {
    "opcode": 166,
    "instructionAddress": 9752663,
    "expectedSize": 3,
    "text": "RCALL -1976 (to 0x94c89f): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10087849,
    "expectedSize": 3,
    "text": "RCALL -4413 (to 0x99dc6c): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9877533,
    "expectedSize": 3,
    "text": "RCALL -627 (to 0x96b5aa): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9997082,
    "expectedSize": 3,
    "text": "RCALL -7722 (to 0x97ecf0): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9759649,
    "expectedSize": 3,
    "text": "RCALL -457 (to 0x94e9d8): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9810207,
    "expectedSize": 3,
    "text": "RCALL -470 (to 0x95af49): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10064803,
    "expectedSize": 3,
    "text": "RCALL -345 (to 0x99924a): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9748087,
    "expectedSize": 3,
    "text": "RCALL -599 (to 0x94bc20): Magmar intro part [2]"
  },
  {
    "opcode": 166,
    "instructionAddress": 9998670,
    "expectedSize": 3,
    "text": "RCALL -696 (to 0x988e96): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9822379,
    "expectedSize": 3,
    "text": "RCALL -966 (to 0x95dce5): Square outro cutscene"
  },
  {
    "opcode": 166,
    "instructionAddress": 9883574,
    "expectedSize": 3,
    "text": "RCALL -589 (to 0x96cd69): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9887877,
    "expectedSize": 3,
    "text": "RCALL -2486 (to 0x96d6cf): Horace pit cutscene"
  },
  {
    "opcode": 166,
    "instructionAddress": 9944891,
    "expectedSize": 3,
    "text": "RCALL -3979 (to 0x97afb0): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10087852,
    "expectedSize": 3,
    "text": "RCALL -458 (to 0x99ebe2): Vigor enter part [2] / script / animation"
  },
  {
    "opcode": 166,
    "instructionAddress": 9688118,
    "expectedSize": 3,
    "text": "RCALL -3135 (to 0x93c7f7): Thraxx enter part [3]"
  },
  {
    "opcode": 166,
    "instructionAddress": 10140436,
    "expectedSize": 3,
    "text": "RCALL -1617 (to 0x9ab4c3): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10136409,
    "expectedSize": 3,
    "text": "RCALL -261 (to 0x9aaa54): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9802909,
    "expectedSize": 3,
    "text": "RCALL -1107 (to 0x95904a): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10003344,
    "expectedSize": 3,
    "text": "RCALL -346 (to 0x98a236): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10060626,
    "expectedSize": 3,
    "text": "RCALL -779 (to 0x998047): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9688095,
    "expectedSize": 3,
    "text": "RCALL -3112 (to 0x93c7f7): Thraxx enter part [3]"
  },
  {
    "opcode": 166,
    "instructionAddress": 10063220,
    "expectedSize": 3,
    "text": "RCALL -2585 (to 0x99835b): Tinker part [4]"
  },
  {
    "opcode": 166,
    "instructionAddress": 9752177,
    "expectedSize": 3,
    "text": "RCALL -336 (to 0x94cd21): FE Village call outro"
  },
  {
    "opcode": 166,
    "instructionAddress": 10138461,
    "expectedSize": 3,
    "text": "RCALL -1918 (to 0x9aabdf): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9688147,
    "expectedSize": 3,
    "text": "RCALL -2526 (to 0x93ca75): Thraxx enter part [1]"
  },
  {
    "opcode": 166,
    "instructionAddress": 10138470,
    "expectedSize": 3,
    "text": "RCALL -287 (to 0x9ab247): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9757835,
    "expectedSize": 3,
    "text": "RCALL -3717 (to 0x94d606): FE Cutscene 2"
  },
  {
    "opcode": 166,
    "instructionAddress": 10082779,
    "expectedSize": 3,
    "text": "RCALL -1101 (to 0x99d58e): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10003357,
    "expectedSize": 3,
    "text": "RCALL -656 (to 0x98a10d): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9810907,
    "expectedSize": 3,
    "text": "RCALL -605 (to 0x95b17e): Blimp's cave"
  },
  {
    "opcode": 166,
    "instructionAddress": 9757841,
    "expectedSize": 3,
    "text": "RCALL -2596 (to 0x94da6d): FE Cutscene 3"
  },
  {
    "opcode": 166,
    "instructionAddress": 10069928,
    "expectedSize": 3,
    "text": "RCALL -1073 (to 0x99a377): Gomi's tower part [2]"
  },
  {
    "opcode": 166,
    "instructionAddress": 10063251,
    "expectedSize": 3,
    "text": "RCALL -1007 (to 0x9989a4): Tinker part [5] (Rocket done?)"
  },
  {
    "opcode": 166,
    "instructionAddress": 9804588,
    "expectedSize": 3,
    "text": "RCALL -681 (to 0x959883): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9946819,
    "expectedSize": 11,
    "text": "RCALL -459 (to 0x97c4f8): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9748025,
    "expectedSize": 3,
    "text": "RCALL -537 (to 0x94bc20): Magmar intro part [2]"
  },
  {
    "opcode": 166,
    "instructionAddress": 10001583,
    "expectedSize": 3,
    "text": "RCALL -1656 (to 0x989637): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10079632,
    "expectedSize": 3,
    "text": "RCALL -2449 (to 0x99c3ff): Doubles room enter part [1]"
  },
  {
    "opcode": 166,
    "instructionAddress": 9688216,
    "expectedSize": 3,
    "text": "RCALL -2607 (to 0x93ca69): Thraxx enter part [2]"
  },
  {
    "opcode": 166,
    "instructionAddress": 9629019,
    "expectedSize": 3,
    "text": "RCALL -1049 (to 0x92e942): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9802745,
    "expectedSize": 3,
    "text": "RCALL -748 (to 0x95910d): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10063037,
    "expectedSize": 3,
    "text": "RCALL -891 (to 0x998942): Tinker part [2]"
  },
  {
    "opcode": 166,
    "instructionAddress": 9998649,
    "expectedSize": 3,
    "text": "RCALL -680 (to 0x988e91): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9877198,
    "expectedSize": 3,
    "text": "RCALL -14030 (to 0x968000): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9804404,
    "expectedSize": 3,
    "text": "RCALL -302 (to 0x959946): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9802842,
    "expectedSize": 3,
    "text": "RCALL -1104 (to 0x95900a): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9946806,
    "expectedSize": 3,
    "text": "RCALL -796 (to 0x97c39a): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9752201,
    "expectedSize": 3,
    "text": "RCALL -356 (to 0x94cd25): FE Village credits"
  },
  {
    "opcode": 166,
    "instructionAddress": 9877766,
    "expectedSize": 3,
    "text": "RCALL -19953 (to 0x95eb15): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10082750,
    "expectedSize": 3,
    "text": "RCALL -400 (to 0x99d82e): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10129905,
    "expectedSize": 3,
    "text": "RCALL -3439 (to 0x9a8482): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10146774,
    "expectedSize": 3,
    "text": "RCALL -314 (to 0x9ad29c): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10083384,
    "expectedSize": 3,
    "text": "RCALL -287 (to 0x99db19): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9999699,
    "expectedSize": 3,
    "text": "RCALL -287 (to 0x989434): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9687734,
    "expectedSize": 9,
    "text": "RCALL -2113 (to 0x93ca75): Thraxx enter part [1]"
  },
  {
    "opcode": 166,
    "instructionAddress": 9877763,
    "expectedSize": 3,
    "text": "RCALL -19795 (to 0x95ebb0): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9948446,
    "expectedSize": 3,
    "text": "RCALL -952 (to 0x97c966): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9742768,
    "expectedSize": 3,
    "text": "RCALL -1622 (to 0x94a35a): Hardball dialog"
  },
  {
    "opcode": 166,
    "instructionAddress": 9883758,
    "expectedSize": 3,
    "text": "RCALL -1104 (to 0x96cc1e): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9883648,
    "expectedSize": 3,
    "text": "RCALL -1447 (to 0x96ca59): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10134381,
    "expectedSize": 3,
    "text": "RCALL -2242 (to 0x9a9aab): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10129902,
    "expectedSize": 3,
    "text": "RCALL -3436 (to 0x9a8482): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9671200,
    "expectedSize": 3,
    "text": "RCALL -387 (to 0x93909d): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9688028,
    "expectedSize": 15,
    "text": "RCALL -2419 (to 0x93ca69): Thraxx enter part [2]"
  },
  {
    "opcode": 166,
    "instructionAddress": 9688072,
    "expectedSize": 3,
    "text": "RCALL -3089 (to 0x93c7f7): Thraxx enter part [3]"
  },
  {
    "opcode": 166,
    "instructionAddress": 9822809,
    "expectedSize": 3,
    "text": "RCALL -2172 (to 0x95d9dd): Sacred dog cutscene"
  },
  {
    "opcode": 166,
    "instructionAddress": 10128567,
    "expectedSize": 3,
    "text": "RCALL -2139 (to 0x9a845c): Puppet show [1] (fight)"
  },
  {
    "opcode": 166,
    "instructionAddress": 10022905,
    "expectedSize": 3,
    "text": "RCALL -1049 (to 0x98ebe0): Ebon Keep throne room cutscene"
  },
  {
    "opcode": 166,
    "instructionAddress": 9885310,
    "expectedSize": 3,
    "text": "RCALL -1367 (to 0x96d127): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9757879,
    "expectedSize": 3,
    "text": "RCALL -1996 (to 0x94dceb): Blimp in Hut after Salabog?"
  },
  {
    "opcode": 166,
    "instructionAddress": 9810233,
    "expectedSize": 3,
    "text": "RCALL -1046 (to 0x95ad23): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 10214614,
    "expectedSize": 3,
    "text": "RCALL -525 (to 0x9bdac9): Prof. Lab part [1]"
  },
  {
    "opcode": 166,
    "instructionAddress": 9948443,
    "expectedSize": 3,
    "text": "RCALL -1053 (to 0x97c8fe): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9757794,
    "expectedSize": 3,
    "text": "RCALL -4351 (to 0x94d363): FE Cutscene 1"
  },
  {
    "opcode": 166,
    "instructionAddress": 9757857,
    "expectedSize": 3,
    "text": "RCALL -3160 (to 0x94d849): FE First Encounter"
  },
  {
    "opcode": 166,
    "instructionAddress": 9629454,
    "expectedSize": 3,
    "text": "RCALL -310 (to 0x92edd8): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9946803,
    "expectedSize": 3,
    "text": "RCALL -879 (to 0x97c344): Unknown"
  },
  {
    "opcode": 166,
    "instructionAddress": 9759644,
    "expectedSize": 3,
    "text": "RCALL -701 (to 0x94e8df): Unknown"
  }
];

test('opcode corpus 0xa6', () => {
  for (const sample of CASES) {
    const decoded = decodeOpcodeAtSnes(sample.instructionAddress);
    assert.equal(decoded.opcode, sample.opcode);
    assert.equal(decoded.size, sample.expectedSize);
  }
});
