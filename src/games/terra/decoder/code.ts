// Ownership: the Terranigma routines we have read, by name: where each one is, what it does in our own words, and the
// COP commands of the character scripts with the argument bytes each one takes. The facts and their evidence are in
// docs/terra/README.md §7 and docs/terra/jumping.md; this table is what terra://rom/code/ shows (disasm.ts reads the
// code itself from the ROM at run time).

/** One routine (or a documented part of a longer one): `len` bytes from the bus address `addr`. */
export interface TerraRoutine {
    /** Unique, lower_snake, our own words: the folder name under terra://rom/code/. */
    name: string;
    addr: number;
    /** Bytes of documented code or data. */
    len: number;
    /** Accumulator / index width at entry (the code's own REP / SEP are followed after that). */
    m8?: boolean;
    x8?: boolean;
    /** `data` for a table shown as bytes. */
    kind?: 'code' | 'data';
    title: string;
    /** What it does, in our own words. */
    what: string;
    /** Comments on the listing, in our own words, keyed by byte offset from `addr` (an instruction's first byte). */
    notes?: Record<number, string>;
    /** `read`: from the code; `checked`: its effect also seen in the running game. */
    confidence: 'read' | 'checked';
    /** The doc and section that explain it, relative to docs/terra/. */
    doc: string;
}

/** A COP command of the character scripts: `COP n` followed by `args` bytes the handler consumes. */
export interface TerraCop { n: number; args: number; handler: number; what: string }

/** `COP n` dispatches through the word table at $80:83B2 (bank $80); the bytes after the operand are its arguments. */
export const COP_TABLE = 0x8083B2;

export const COP_COMMANDS: TerraCop[] = [
    { n: 0x00, args: 3, handler: 0x808592, what: 'call: continue at the 3-byte address, keeping the return point in $7F:0004,X / $7F:0006,X' },
    { n: 0x01, args: 0, handler: 0x8085B8, what: 'return to the point a COP $00 call kept (with none kept: carry on after the COP)' },
    { n: 0x02, args: 2, handler: 0x8085DF, what: 'loop start: the body up to COP $03 runs once per frame, word = how many times' },
    { n: 0x03, args: 0, handler: 0x8085F8, what: 'loop end: count down; until zero, leave the script for this frame and resume at the loop start' },
    { n: 0x36, args: 1, handler: 0x8091E8, what: 'store the byte in $04B7 (the jump stores $0F there after landing; meaning not decoded)' },
    { n: 0xAF, args: 1, handler: 0x80A965, what: 'select entry n of the character\'s curve table (curve_entry_load)' },
    { n: 0xC1, args: 2, handler: 0x80AB17, what: 'wait: word to +$0E, resume point to +$0A / +$0C, leave the script for this frame' },
    { n: 0xCB, args: 4, handler: 0x80ADBD, what: 'a flag byte and a 3-byte script or pose address (the handler is not decoded past the flag byte)' },
];

const J = 'jumping.md';
export const TERRA_ROUTINES: TerraRoutine[] = [
    // The character-script machinery (bank $80).
    { name: 'cop_dispatch', addr: 0x808378, len: 24, m8: true, title: 'COP: run a character-script command',
        what: 'Takes the byte after COP as the command number and jumps through the table at $80:83B2. The handler reads its arguments from the script through [$36] and sets the return address past them.',
        notes: { 0: 'A 16-bit (the caller\'s X width is kept)', 2: 'Y = the running record', 3: '$37/$38: bank of the return address', 7: 'the return address points past the operand', 9: 'back one byte: the command number', 12: 'n', 14: '$36 now points at the first argument byte', 19: 'word index into the table', 21: 'to the handler; it reads its arguments from [$36]' },
        confidence: 'read', doc: 'README.md §7' },
    { name: 'cop_script_call', addr: 0x808592, len: 38, title: 'COP $00: call a script', what: COP_COMMANDS[0].what, notes: { 1: 'the target address, low word', 7: 'becomes the return address: RTI goes there', 9: 'its bank byte', 18: 'the return bank', 22: 'and the record\'s script bank', 25: 'keep the bank of the point after the call', 31: 'and the point after the arguments: the return point' },
        confidence: 'read', doc: 'README.md §7' },
    { name: 'cop_script_return', addr: 0x8085B8, len: 39, title: 'COP $01: return', what: COP_COMMANDS[1].what, notes: { 1: 'is a return point kept?', 5: 'none: carry on after the COP', 7: 'resume there', 15: 'with its bank', 23: 'the record\'s script bank', 26: 'forget the return point', 34: 'none kept: return past the COP (no arguments)' },
        confidence: 'read', doc: 'README.md §7' },
    { name: 'cop_loop_start', addr: 0x8085DF, len: 25, title: 'COP $02: per-frame loop start', what: COP_COMMANDS[2].what, notes: { 1: 'the count', 7: 'count, per record (bank $7F)', 11: 'the loop body starts after the arguments', 13: 'kept as the loop start', 17: 'and returned to now', 19: 'the script bank' },
        confidence: 'checked', doc: J + ' §2.2' },
    { name: 'cop_loop_end', addr: 0x8085F8, len: 27, title: 'COP $03: per-frame loop end', what: COP_COMMANDS[3].what, notes: { 1: 'count down', 6: 'zero: the loop is done, carry on after COP $03', 8: 'not yet: keep the count', 12: 'next frame the script resumes at the loop start', 19: 'drop the interrupt frame (P, return address)', 21: 'and leave the script for this frame', 22: 'done: return past the COP' },
        confidence: 'checked', doc: J + ' §2.2' },
    { name: 'cop_store_04b7', addr: 0x8091E8, len: 20, title: 'COP $36: store a byte in $04B7', what: COP_COMMANDS[4].what, notes: { 1: 'the argument byte', 10: 'stored (8-bit) in $04B7; read elsewhere, not decoded' },
        confidence: 'read', doc: 'README.md §7' },
    { name: 'cop_select_curve', addr: 0x80A965, len: 16, title: 'COP $AF: select a curve entry', what: COP_COMMANDS[5].what, notes: { 1: 'n, the curve entry', 8: 'load entry n into the running record' },
        confidence: 'read', doc: J + ' §2.1' },
    { name: 'cop_wait', addr: 0x80AB17, len: 23, title: 'COP $C1: wait and resume', what: COP_COMMANDS[6].what, notes: { 1: 'the word argument', 7: '+$0E: frames to wait (counted down elsewhere)', 10: 'resume bank', 15: 'resume at the point after the arguments', 20: 'drop the interrupt frame', 22: 'leave the script for this frame' },
        confidence: 'read', doc: 'README.md §7' },
    { name: 'curve_entry_load', addr: 0x80BBDB, len: 84, title: 'Load curve entry n of a character',
        what: 'Entry n (4 bytes) of the curve table at $7F:0022,X (bank $7F unless $7F:0024,X names one): the first pointer to $7F:0010,X and $7F:0014,X, the second to $7F:0012,X and $7F:0016,X; the step counters +$28 / +$2A are cleared.',
        notes: { 0: 'n × 4: an entry is two words', 3: '+ the record\'s curve table', 9: 'a bank of its own?', 13: 'yes: read from that bank', 15: 'first curve pointer', 17: 'live copy', 21: 'start copy', 25: 'its step counter restarts', 32: 'second curve pointer (the jump\'s height curve)', 42: 'its step counter restarts', 46: 'the table\'s bank for [$3A]', 78: 'back to bank $7F for [$3A]' },
        confidence: 'read', doc: J + ' §2.1' },
    // Ground, ledges and walls for the player (bank $80).
    { name: 'player_ground_check', addr: 0x80CB91, len: 397, title: 'The ground under the player\'s feet, every frame',
        what: 'Player record only. Mirrors airborne into $0986 bit $0400, then (unless dropping) reads the types of up to four cells under the foot box into $02 / $04 / $06 / $08 and acts on them: a ledge drops the player off, type $14 starts its scripts; all skipped while airborne.',
        notes: { 0: 'the player record only', 6: '$0986: clear bits $3000, then move bits $0C00 (last frame) up to $3000', 29: 'bit 4 of the record\'s +4 clear: set $0800', 43: 'airborne?', 51: 'mirror it into $0986 bit $0400 ($0987 bit 2)', 57: 'record +4 bit 7: no ground check', 66: 'already dropping off a ledge: go straight to the ground reading', 77: 'bits 1, 4 or 15 of $097C: nothing to do', 83: 'record +4 bit 2 clear: nothing to do', 92: 'clear the sprite priority bits', 102: 'foot box x = x + $7F:0028,X (−8)', 112: '$1E: x within the cell (0: one column)', 117: 'foot box y = y + $7F:002C,X (−16)', 127: '$24: y within the cell (0: one row)', 135: 'the cell under the box\'s top-left', 139: 'its type', 144: '$02, and by default $04 / $06 / $08 too', 152: 'straddling two columns?', 156: 'yes: $04 = the type to the right', 169: 'straddling two rows?', 173: 'yes: $06 = the type below', 188: 'and $08 = below-right', 198: 'bits 0 or 6 (dropping): skip the ledge and $14 tests', 209: 'on a ledge?', 214: 'yes: drop off it (unless airborne)', 220: 'type $14 under all four corners?', 239: 'airborne: no effect', 250: 'bit 1 and its script', 263: 'what $CE28 says of each cell (not decoded)', 291: 'top-left is $14 and y within the cell is 7-13', 315: 'airborne: no effect', 323: 'bit 3 already set: started before', 328: 'the type-$14 script for the control record', 343: 'bit 3: started', 351: 'not on $14: clear bit 3', 360: 'type $13 under any corner: do not save the position', 379: 'else save x, y and facing ($0958-$095C)' },
        confidence: 'checked', doc: J + ' §3' },
    { name: 'ledge_under_feet', addr: 0x80CED1, len: 95, title: 'Is the foot box on a ledge?',
        what: 'Carry set when the top two cells (or, deeper than 8 px into the cell, the bottom two) are both ledge class in $80:CF30 and not both type $14.',
        notes: { 3: 'class of the top-left type', 9: 'same class as the top-right?', 22: 'and that class is 8 (ledge)', 28: 'both $14: not a ledge (carry clear)', 41: 'a ledge: carry set', 43: 'deeper than 8 px into the cell?', 52: 'then the same test on the bottom pair', 92: 'no ledge: carry clear' },
        confidence: 'checked', doc: J + ' §3' },
    { name: 'ledge_class_table', addr: 0x80CF30, len: 32, kind: 'data', title: 'Cell type → class (32 bytes)',
        what: 'One byte per cell type; 8 = ledge class (types 8, $14, $1F), 0 = anything else.', confidence: 'read', doc: J + ' §3' },
    { name: 'ledge_drop_start', addr: 0x80CF50, len: 41, title: 'Start dropping off a ledge',
        what: 'Unless airborne or bit 15 of $097C: sets bit 0 of $097C and starts the drop script ($84:9ECC when +$14 is 1, else $84:9EBC).',
        notes: { 0: 'airborne (bit 2) or bit 15: no drop', 9: 'record +$14 is 1?', 15: 'bit 0: dropping', 21: 'the drop script for +$14 = 1', 28: 'bit 0: dropping', 34: 'the drop script for any other +$14' },
        confidence: 'checked', doc: J + ' §3' },
    { name: 'move_up_into_ledge', addr: 0x80D506, len: 60, title: 'Moving up into type 8',
        what: 'A wall unless airborne. In the air it is open when the cell above is not type 8 too (and, straddling, the other cell is type 8).',
        notes: { 0: 'airborne?', 8: 'no: a wall', 11: 'straddling two columns?', 15: 'no: test the cell above', 18: 'yes: the type to the right', 27: 'must be a ledge too', 35: 'else a wall', 38: 'the cell above the ledge', 47: 'also type 8: the band is deeper than one row', 52: 'no: open, the move goes on', 57: 'yes: a wall' },
        confidence: 'checked', doc: J + ' §3' },
    { name: 'wall_bump_reaction', addr: 0x80E1DF, len: 335, title: 'React to bumping a wall',
        what: 'When the player is stopped by a wall, picks a reaction script for the player\'s control record ($0DEE) by the wall\'s cells and $0980. Not while bits 0, 1 or 15 of $097C are set; the default reaction also not while bit 2 (airborne), 7 or 15 is.',
        notes: { 1: 'bits 0, 1 or 15 of $097C: no reaction', 9: 'only when record +$14 is 1', 19: 'x within the cell', 31: 'more than half way: the cell to the right', 35: 'test the wall cell ($E71B / $E723 not decoded)', 103: 'reaction by $0980 bit 5 and the pad ($0454)', 127: 'reaction script for the control record ($0DEE)', 171: '$0980 bit 7: count frames pushing in $096E', 194: 'after 30 frames: a reaction script', 216: '$0980 bit 6: a reaction script', 241: '$0980 bits 4/6: the player\'s own reaction pointer at $7F:1006,X', 285: 'none: store $4F in $04B7', 288: 'airborne, bit 7 or 15: no default reaction', 296: 'default reaction by $097C bits 8-9' },
        confidence: 'read', doc: J + ' §3' },
    { name: 'sprite_y_jump_height', addr: 0x80F0B1, len: 28, title: 'Sprite builder: add the jump height',
        what: 'Part of the sprite builder: for the player\'s record ($0DEA) adds the jump height $0970 to the screen y $22. The only reader of the height for position.',
        notes: { 1: 'the screen position ($22 = y)', 4: 'the player record?', 9: 'add the jump height (negative = up): only the sprite moves' },
        confidence: 'checked', doc: J + ' §2.4' },
    // Map cells (bank $8D): X is a cell's byte offset in the layer-0 map.
    { name: 'cell_right', addr: 0x8D8CE1, len: 47, title: 'The cell to the right', what: 'X += 2, across a 32-cell block edge by the map\'s block layout ($0880, $087E); carry set when it crossed.', notes: { 3: 'last cell of a 32-cell block row?', 12: 'no: the next cell, carry clear', 17: '$0880 negative: the map is split into blocks', 36: 'step into the next block', 45: 'carry set: crossed' },
        confidence: 'read', doc: J + ' §3' },
    { name: 'cell_left', addr: 0x8D8D10, len: 45, title: 'The cell to the left', what: 'X -= 2, the mirror of cell_right.', notes: { 3: 'the previous cell', 5: 'crossed a 32-cell block edge?', 14: 'no: carry clear', 36: 'into the previous block', 43: 'carry set: crossed' },
        confidence: 'read', doc: J + ' §3' },
    { name: 'cell_below', addr: 0x8D8D3D, len: 24, title: 'The cell below', what: 'X += the row stride $087E.', notes: { 3: 'one row down ($087E = bytes per row)', 9: 'past the cell count $082E?', 16: 'no: carry clear', 19: 'wrapped: carry set' },
        confidence: 'read', doc: J + ' §3' },
    { name: 'cell_above', addr: 0x8D8D55, len: 24, title: 'The cell above', what: 'X -= the row stride $087E; wraps with the cell count $082E.', notes: { 3: 'one row up', 8: 'before the first row?', 10: 'no: carry clear', 14: 'wrap round by the cell count $082E', 22: 'carry set: wrapped' },
        confidence: 'read', doc: J + ' §3' },
    // The player's jump (bank $84, character code with COP commands).
    { name: 'jump_script', addr: 0x84976D, len: 34, title: 'The player\'s jump',
        what: 'jump_start, then a 25-frame loop (COP $02 $0019 … COP $03) that steers and counts, then back to walking.',
        notes: { 0: 'airborne on, curve entry $39, height 0', 3: '25 frames:', 7: 'steering (not decoded): carry set skips the next call', 12: 'pass the curves to the player record', 15: 'count +$26', 18: 'next frame, until 25 are done', 20: 'landed: which way on? (not decoded)', 25: 'the other way out: $96C6 clears airborne', 28: '$0F to $04B7', 31: 'back to walking (clears $097C)' },
        confidence: 'checked', doc: J + ' §2.2' },
    { name: 'jump_start', addr: 0x849990, len: 33, title: 'Start a jump',
        what: 'Sets airborne (bit 2 of $097C), selects curve entry $39 (COP $AF), points $0972 at its height curve and clears $0974 and the height $0970.',
        notes: { 0: 'bit 2: airborne', 6: 'clear $7F:201A,X', 13: 'curve entry $39 of the character', 16: '+$26 counts the jump\'s frames', 19: 'its second curve: the height', 23: 'walked by jump_curve_step', 26: 'start on the first step', 29: 'height 0' },
        confidence: 'checked', doc: J + ' §2.1' },
    { name: 'jump_pass_curves', addr: 0x849972, len: 30, title: 'Hand the curves to the player record',
        what: 'Copies the running record\'s two curve pointers ($7F:0010,X / $7F:0012,X) to the player\'s record and clears its step counters.',
        notes: { 1: 'the running record\'s two curves', 10: 'to the player record', 22: 'their step counters restart', 28: 'X = the running record again' },
        confidence: 'read', doc: J + ' §2.2' },
    { name: 'fall_wait_landing', addr: 0x849861, len: 74, title: 'Airborne until the height is back near 0 (part of a script)',
        what: 'Sets bit 7 of $045A, clears bit 4 of the player\'s +4 and sets airborne; then checks each frame (COP $C1) until |$0970| < 3, clears airborne, sets bit 4 again, sets a pose and goes back to walking. Which move uses it is not checked.',
        notes: { 0: 'bit 7 of $045A', 6: 'clear bit 4 of the player\'s +4', 18: 'bit 2: airborne', 24: 'each frame from here:', 28: '|height|', 37: 'still 3 px or more up: wait for the next frame', 43: 'down: airborne off', 49: 'set bit 4 of the player\'s +4 again', 61: 'pose', 67: 'wait 3 frames', 71: 'back to walking' },
        confidence: 'read', doc: J + ' §2.2' },
    { name: 'player_jump_frame', addr: 0x84C199, len: 108, title: 'Per frame: the jump height',
        what: 'Copies the player\'s position and priority to the record at $0DF4 while +$26 is set (probably the shadow), adds the next height step to $0970, and keeps $0999 for the follower.',
        notes: { 0: 'jumping (+$26 counts)?', 9: 'the record at $0DF4 (probably the shadow)', 19: 'gets the player\'s x, y', 31: 'and sprite priority bits', 51: 'the next step of the height curve', 55: 'height += step', 61: 'the player\'s +$16 to the $0DF4 record too', 75: 'while jumping: $0999 follows the height', 87: 'else the $0DF4 record\'s own curve, if it jumps', 97: 'its step, added to $0999' },
        confidence: 'checked', doc: J + ' §2.3' },
    { name: 'jump_curve_step', addr: 0x84C205, len: 56, title: 'Next step of the height curve',
        what: 'Walks the (count, delta) word pairs at $0972 with the counter $0974; returns the delta; a negative count ends the curve (pointer and height to 0).',
        notes: { 0: 'no curve: return 0', 8: 'one more frame on this step?', 11: 'yes: return the same delta', 13: 'next pair: the count', 19: 'count ≥ 0: a new step', 21: 'negative: the curve ends, height back to 0', 31: 'not reached from here: the word is a pointer to another list', 41: 'frames on this step − 1', 44: 'point at the delta', 53: 'return the delta' },
        confidence: 'checked', doc: J + ' §2.3' },
    { name: 'follower_curve_step', addr: 0x84C23D, len: 59, title: 'The same step for another record',
        what: 'jump_curve_step on $7F:0012,X with the counter +$2A, for the record at $0DF4.', notes: { 0: 'the record\'s second curve', 9: 'one more frame on this step?', 14: 'next pair: the count', 20: 'count ≥ 0: a new step', 22: 'negative: done, curve and $0999 to 0', 43: 'frames on this step − 1, in +$2A', 50: 'point at the delta', 56: 'return the delta' },
        confidence: 'read', doc: J + ' §2.3' },
];

export function routineByName(name: string): TerraRoutine | undefined {
    return TERRA_ROUTINES.find(r => r.name === name);
}

/** The documented routine whose range holds `bus`, if any. */
export function routineAt(bus: number): TerraRoutine | undefined {
    return TERRA_ROUTINES.find(r => bus >= r.addr && bus < r.addr + r.len);
}
