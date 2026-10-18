// Ownership: public API of the script VM decoder, written from the game's interpreter at
// $8C:D0A6 (docs/game-research/script-vm/). Pure: takes the user's ROM, returns data.

export { SCRIPT_BANK, SCRIPT_HEADER, pack, unpack, advance, distance, ScriptRom } from './address';
export { OPCODES, SUB_OPS, smallConstant } from './spec';
export type { OpcodeSpec, SubOpSpec, SubOpKind, Flow, OperandToken } from './spec';
export { readExpression, tree, constantValue, ExpressionError } from './expression';
export type { Expression, Term, Node } from './expression';
export { decodeAt, successors, callee, DecodeError } from './decode';
export type { Instruction, Operand } from './decode';
export { walk, scriptInstructions } from './walk';
export { roomScripts, roomCount, allEntries } from './rooms';
export type { RoomScripts, Trigger } from './rooms';
export type { Walk } from './walk';
