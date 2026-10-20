// Ownership: what each script opcode and expression sub-op reads and where control goes after
// it, written from the game's interpreter (docs/game-research/script-vm/opcodes.md). Pure data.
//
// Operand tokens:
//   u8 u16           immediate byte / little-endian word
//   u24              packed script pointer (u16 low, u8 high; see address.ts)
//   E                one expression (expression.ts)
//   A                arguments: a count byte n (never 0), then n expressions
//   Z                expressions up to one that is the constant 0
//   r16              jump: signed word, counted from the end of the operand
//   rb               jump back: opcode address - (256 - byte)
//   cb / c16         call back: packed(opcode) - (256 - byte) / packed(opcode) + word - $10000
//   skip             one byte the handler steps over
// Flow:
//   next      the handler returns with carry set: the next instruction runs in the same turn
//   yield     carry clear: the thread's turn ends; it resumes at the next instruction
//   branch    either the next instruction or the jump target
//   jump      only the target
//   call      a script runs in this thread; this one resumes at the next instruction (yields)
//   start     a script starts as a parallel thread; this one continues
//   end       the script ends (a called one returns to its caller)
//   reset     the game resets

export type OperandToken = 'u8' | 'u16' | 'u24' | 'E' | 'A' | 'Z' | 'r16' | 'rb' | 'cb' | 'c16' | 'skip';
export type Flow = 'next' | 'yield' | 'branch' | 'jump' | 'call' | 'start' | 'end' | 'reset';

export interface OpcodeSpec {
    operands: readonly OperandToken[];
    flow: Flow;
    /** Our name, or '' while only the operands are known. */
    name: string;
}

const op = (operands: string, flow: Flow, name = ''): OpcodeSpec =>
    ({ operands: operands ? operands.split(' ') as OperandToken[] : [], flow, name });

/** Every opcode the dispatch table at $8C:E8BD sends to a handler; the others stop the CPU. */
export const OPCODES: ReadonlyMap<number, OpcodeSpec> = new Map<number, OpcodeSpec>([
    [0x00, op('', 'end', 'end')],
    [0x04, op('r16', 'jump', 'jump')],
    [0x05, op('rb', 'jump', 'jump_back')],
    [0x07, op('u24', 'start', 'start_thread')],
    [0x08, op('E r16', 'branch', 'jump_if_true')],
    [0x09, op('E r16', 'branch', 'jump_if_false')],
    [0x0A, op('E u16 u8 r16', 'branch', 'jump_if_amount_at_least')],
    [0x0B, op('E u16 u8 r16', 'branch', 'jump_if_amount_below')],
    [0x0C, op('u16 E', 'next', 'set_flag')],
    [0x0D, op('u16 E', 'next', 'set_temp_flag')],
    [0x0E, op('u8 E', 'next', 'set_local_flag')],
    [0x10, op('u16 E', 'next', 'write_byte')],
    [0x11, op('u16 E', 'next', 'write_temp_byte')],
    [0x12, op('u8 E', 'next', 'write_local_byte')],
    [0x14, op('u16 E', 'next', 'write_byte')],
    [0x15, op('u16 E', 'next', 'write_temp_byte')],
    [0x16, op('u8 E', 'next', 'write_local_byte')],
    [0x17, op('u16 u16', 'next', 'write_word_immediate')],
    [0x18, op('u16 E', 'next', 'write_word')],
    [0x19, op('u16 E', 'next', 'write_temp_word')],
    [0x1A, op('u8 E', 'next', 'write_local_word')],
    [0x1B, op('u16 u16 u8 u8', 'next', 'write_tile_pair')],
    [0x1C, op('u16 E', 'next', 'write_word')],
    [0x1D, op('u16 E', 'next', 'write_temp_word')],
    [0x1E, op('u8 E', 'next', 'write_local_word')],
    [0x20, op('u8 u8', 'next', 'place_camera_tile')],
    [0x21, op('u8 u8', 'end', 'warp_in_room')],
    [0x22, op('u8 u8 u16', 'end', 'change_map')],
    [0x23, op('u16', 'next', 'set_0e6e')],
    [0x26, op('', 'next', 'fade_in')],
    [0x27, op('', 'next', 'fade_out')],
    [0x29, op('u24', 'call', 'call')],
    [0x2A, op('E', 'next', 'freeze_entity')],
    [0x2B, op('E', 'next', 'unfreeze_entity')],
    [0x2C, op('u8', 'next')],
    [0x2D, op('u8', 'next')],
    [0x2E, op('E', 'yield', 'wait')],
    [0x30, op('u8', 'next', 'sound')],
    [0x31, op('u8', 'next', 'sound')],
    [0x32, op('u8', 'next', 'sound')],
    [0x33, op('u8', 'next', 'music')],
    [0x38, op('', 'yield', 'yield')],
    [0x39, op('E', 'yield', 'sleep')],
    [0x3A, op('', 'yield', 'yield')],
    [0x3B, op('E', 'yield', 'sleep')],
    [0x3C, op('u16 u16 u8 u8', 'next', 'spawn')],
    [0x3D, op('E u16', 'next')],
    [0x3F, op('E u16 u16', 'next')],
    [0x42, op('E u16', 'next')],
    [0x43, op('E E E', 'next')],
    [0x44, op('u8 u8 u8 u8 u8', 'next', 'open_message_box')],
    [0x45, op('u8 u8 u8 u8 u8', 'next', 'open_message_box')],
    [0x46, op('u8 u8 u8 u8 u8', 'next', 'open_message_box')],
    [0x47, op('u8 u8 u8 u8 u8', 'next', 'open_message_box')],
    [0x48, op('', 'next', 'text_start')],
    [0x49, op('', 'next', 'text_start')],
    [0x4A, op('', 'next', 'text_start')],
    [0x4B, op('', 'next', 'text_start')],
    [0x4C, op('skip', 'next', 'skip_byte')],
    [0x4D, op('', 'next', 'nop')],
    [0x4E, op('E', 'next', 'bind_entity')],
    [0x50, op('u8 u16', 'next', 'text_in_window')],
    [0x51, op('u16', 'next', 'text')],
    [0x52, op('u16', 'next', 'message')],
    [0x54, op('u8', 'next')],
    [0x55, op('', 'next')],
    [0x58, op('', 'next')],
    [0x59, op('', 'next')],
    [0x5A, op('', 'next')],
    [0x5B, op('', 'next')],
    [0x5C, op('E E', 'next', 'object')],
    [0x5D, op('E u16', 'next', 'object_state_by_flag')],
    [0x5E, op('E u16', 'next', 'object_state_unless_flag')],
    [0x5F, op('E u16', 'next', 'add_object_state')],
    [0x60, op('E', 'next', 'next_object_state')],
    [0x61, op('E', 'next', 'previous_object_state')],
    [0x62, op('u8 u16 u16', 'next')],
    [0x63, op('', 'next')],
    [0x64, op('E', 'next')],
    [0x65, op('', 'next')],
    [0x66, op('', 'next')],
    [0x68, op('E', 'next')],
    [0x69, op('', 'next')],
    [0x6A, op('', 'next')],
    [0x6C, op('E u8 u8', 'next')],
    [0x6D, op('E E E', 'next')],
    [0x6E, op('E u8 u8', 'next')],
    [0x6F, op('E E E', 'next')],
    [0x70, op('E E', 'next')],
    [0x71, op('E E', 'next')],
    [0x73, op('E E E', 'next')],
    [0x74, op('E', 'next', 'face_north')],
    [0x75, op('E', 'next', 'face_south')],
    [0x76, op('E', 'next', 'face_west')],
    [0x77, op('E', 'next', 'face_east')],
    [0x78, op('E u16 E', 'next')],
    [0x79, op('E u16 E', 'yield')],
    [0x7A, op('E E', 'next')],
    [0x7B, op('E E', 'next')],
    [0x7C, op('E u16 u8', 'next')],
    [0x7D, op('E u16 u8', 'next')],
    [0x7E, op('E E E E', 'next')],
    [0x7F, op('u16', 'next')],
    [0x80, op('', 'next')],
    [0x81, op('', 'next')],
    [0x82, op('', 'next')],
    [0x83, op('', 'next')],
    [0x84, op('E E', 'next')],
    [0x85, op('E E', 'next')],
    [0x86, op('E', 'next')],
    [0x87, op('E', 'next')],
    [0x88, op('', 'next')],
    [0x89, op('E E', 'next')],
    [0x8A, op('E', 'next')],
    [0x8C, op('u16', 'next')],
    [0x8D, op('u8', 'next')],
    [0x8E, op('E E r16', 'branch')],
    [0x8F, op('E E r16', 'branch')],
    [0x90, op('E', 'next', 'fade_to')],
    [0x91, op('E', 'next', 'set_brightness')],
    [0x92, op('E E', 'next')],
    [0x93, op('E E', 'next')],
    [0x94, op('E E', 'next')],
    [0x95, op('E E', 'next')],
    [0x96, op('E E', 'next')],
    [0x97, op('E E E E E E E', 'next')],
    [0x98, op('E', 'next')],
    [0x99, op('E E E E E E', 'next')],
    [0x9A, op('E', 'next')],
    [0x9B, op('E', 'next')],
    [0x9C, op('E', 'next')],
    [0x9D, op('E E E', 'next', 'teleport')],
    [0x9E, op('E E E Z', 'next')],
    [0x9F, op('', 'next')],
    [0xA0, op('', 'next')],
    [0xA1, op('', 'next')],
    [0xA2, op('u16 u16 E E', 'next', 'spawn_at')],
    [0xA3, op('u8', 'call', 'call_global')],
    [0xA4, op('u16', 'call', 'call_trigger')],
    [0xA5, op('cb', 'call', 'call_back')],
    [0xA6, op('c16', 'call', 'call_back_far')],
    [0xA7, op('u8', 'yield', 'sleep')],
    [0xA8, op('u16', 'yield', 'sleep')],
    [0xA9, op('E E', 'next')],
    [0xAA, op('', 'next', 'call_helper_for_boy_and_dog')],
    [0xAB, op('', 'reset', 'reset_game')],
    [0xAC, op('E E E Z', 'next')],
    [0xAD, op('u16 u16 u8 u8', 'next', 'write_temp_tile_pair')],
    [0xAE, op('u8 u8 u8 u8', 'next', 'write_local_tile_pair')],
    [0xAF, op('A u24', 'call', 'call_with_args')],
    [0xB0, op('A u8', 'call', 'call_global_with_args')],
    [0xB1, op('A u16', 'call', 'call_trigger_with_args')],
    [0xB2, op('A cb', 'call', 'call_back_with_args')],
    [0xB3, op('A c16', 'call', 'call_back_far_with_args')],
    [0xB4, op('A u24', 'start', 'start_thread_with_args')],
    [0xB5, op('E E E E E E E E', 'next')],
    [0xB6, op('E E E E', 'next')],
    [0xB7, op('E', 'next')],
    [0xB9, op('E E E', 'next')],
    [0xBA, op('u8 u8 u8', 'next', 'spawn')],
    [0xBB, op('E E', 'next')],
    [0xBC, op('', 'next', 'freeze_boy')],
    [0xBD, op('', 'next', 'unfreeze_boy')],
    [0xBE, op('', 'next', 'freeze_dog')],
    [0xBF, op('', 'next', 'unfreeze_dog')],
    [0xC0, op('', 'next', 'freeze_boy_and_dog')],
    [0xC1, op('', 'next', 'unfreeze_boy_and_dog')],
    [0xC2, op('u8 u8 u8', 'next', 'add_enemy_spawner')],
]);

/** What an expression sub-op (the low 7 bits of an expression byte) does. */
export type SubOpKind = 'end' | 'const' | 'read' | 'flag' | 'unary' | 'binary' | 'push' | 'value';

export interface SubOpSpec {
    kind: SubOpKind;
    /** Immediate bytes after the sub-op byte. */
    size: 0 | 1 | 2;
    /** Our spelling: the operator, or what is read or produced. */
    name: string;
    /** Where a read or flag test looks: the save area, the temp area or the slot's local bytes. */
    area?: 'save' | 'temp' | 'local';
    /** Width of a read in bytes, and whether it is sign-extended. */
    width?: 1 | 2;
    signed?: boolean;
}

const sub = (kind: SubOpKind, size: 0 | 1 | 2, name: string, more: Partial<SubOpSpec> = {}): SubOpSpec => ({ kind, size, name, ...more });

/**
 * Expression sub-ops, from the table at $8C:F041 (one word per sub-op, $00-$6F). $19, $2F and
 * $5D-$5F loop forever (BRA to itself); $70-$7F index past the table.
 */
export const SUB_OPS: ReadonlyMap<number, SubOpSpec> = (() => {
    const m = new Map<number, SubOpSpec>([
        [0x00, sub('end', 0, 'end')],
        [0x01, sub('const', 1, 'negative byte', { signed: true })],
        [0x02, sub('const', 1, 'byte')],
        [0x03, sub('const', 2, 'negative word', { signed: true })],
        [0x04, sub('const', 2, 'word')],
        [0x05, sub('flag', 2, 'flag', { area: 'save' })],
        [0x06, sub('read', 2, 'byte', { area: 'save', width: 1, signed: true })],
        [0x07, sub('read', 2, 'byte', { area: 'save', width: 1 })],
        [0x08, sub('read', 2, 'word', { area: 'save', width: 2, signed: true })],
        [0x09, sub('read', 2, 'word', { area: 'save', width: 2 })],
        [0x0A, sub('flag', 2, 'flag', { area: 'temp' })],
        [0x0B, sub('read', 2, 'byte', { area: 'temp', width: 1, signed: true })],
        [0x0C, sub('read', 2, 'byte', { area: 'temp', width: 1 })],
        [0x0D, sub('read', 2, 'word', { area: 'temp', width: 2, signed: true })],
        [0x0E, sub('read', 2, 'word', { area: 'temp', width: 2 })],
        [0x0F, sub('flag', 1, 'flag', { area: 'local' })],
        [0x10, sub('read', 1, 'byte', { area: 'local', width: 1, signed: true })],
        [0x11, sub('read', 1, 'byte', { area: 'local', width: 1 })],
        [0x12, sub('read', 1, 'word', { area: 'local', width: 2, signed: true })],
        [0x13, sub('read', 1, 'word', { area: 'local', width: 2 })],
        [0x14, sub('unary', 0, '!')],
        [0x15, sub('unary', 0, '~')],
        [0x16, sub('unary', 0, '-')],
        [0x17, sub('binary', 0, '*')],
        [0x18, sub('binary', 0, '/')],
        [0x1A, sub('binary', 0, '+')],
        [0x1B, sub('binary', 0, '-')],
        [0x1C, sub('binary', 0, '<<')],
        [0x1D, sub('binary', 0, '>>')],
        [0x1E, sub('binary', 0, '<')],
        [0x1F, sub('binary', 0, '>')],
        [0x20, sub('binary', 0, '<=')],
        [0x21, sub('binary', 0, '>=')],
        [0x22, sub('binary', 0, '==')],
        [0x23, sub('binary', 0, '!=')],
        [0x24, sub('binary', 0, '&')],
        [0x25, sub('binary', 0, '|')],
        [0x26, sub('binary', 0, '^')],
        [0x27, sub('binary', 0, '||')],
        [0x28, sub('binary', 0, '&&')],
        [0x29, sub('push', 0, 'push')],
        [0x2A, sub('value', 0, 'random')],
        [0x2B, sub('unary', 0, 'random_below')],
        [0x2C, sub('unary', 0, 'lookup_034d')],
        [0x2D, sub('value', 0, 'entity_0341')],
        [0x2E, sub('value', 0, 'self_entity')],
        [0x50, sub('value', 0, 'word_0f3e')],
        [0x51, sub('value', 0, 'word_0f40')],
        [0x52, sub('value', 0, 'camera_entity')],
        [0x53, sub('value', 0, 'other_character')],
        [0x54, sub('value', 0, 'slot_word_09')],
        [0x55, sub('unary', 0, 'deref')],
        [0x56, sub('unary', 0, 'deref_byte')],
        [0x57, sub('value', 0, 'camera_entity_is_0f40')],
        [0x58, sub('value', 0, 'frame_counter_low')],
        [0x59, sub('value', 0, 'frame_counter_high')],
        [0x5A, sub('unary', 0, 'shop_buy')],
        [0x5B, sub('unary', 0, 'shop_sell')],
        [0x5C, sub('unary', 0, 'hp_above_last_damage')],
    ]);
    for (let k = 0; k < 16; k++) {
        m.set(0x30 + k, sub('const', 0, String(k)));
        m.set(0x40 + k, sub('const', 0, String(k - 16)));
        m.set(0x60 + k, sub('const', 0, String(k + 16)));
    }
    return m;
})();

/** Constant value of a size-0 constant sub-op ($30-$4F, $60-$6F). */
export function smallConstant(subOp: number): number | null {
    if (subOp >= 0x30 && subOp <= 0x3F) return subOp & 0x0F;
    if (subOp >= 0x40 && subOp <= 0x4F) return (subOp & 0x0F) - 16;
    if (subOp >= 0x60 && subOp <= 0x6F) return (subOp & 0x0F) + 16;
    return null;
}
