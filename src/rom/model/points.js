'use strict';
// Ownership: the curated names of ROM addresses that are points, not sized
// regions: routine entries and tables whose length nobody has measured.
// Data only. Carried over from the everscript wiki's ROM map (wiki/rom/Rom-Map.md);
// the wiki overlay (wiki-overlay.js) adds any the wiki gains later.
//
// Bus addresses as the game uses them. `cat` is the emoji category of the
// ROM map's legend: 🧠 code, 📋 table, ⚗️ alchemy, 📜 script.

const CODE = [
    [0x808020, 'RESET handler'], [0x80823A, 'NMI (V-Blank) handler'], [0x8084EA, 'IRQ handler'],
    [0x80885E, 'COP handler'], [0x80885F, 'BRK handler'], [0x809033, 'Direct sprite draw (OAM)'],
    [0x8C805B, 'SPC700 IPL bootloader handshake & block upload'],
    [0x8C81FD, 'APU handshake / `$2140` spinlock'],
    [0x8C8236, 'Song soundbank validation & loader (prevents or induces "The Sound Glitch")'],
    [0x8C828F, 'Opcode `0x33` (`music`) pre-dispatcher & volume handler'],
    [0x8C988D, 'Decompression dispatcher: reads `sub_flag`, jumps through `$8C:98A1`'],
    [0x8C98B1, 'Method `0x00`: raw copy'], [0x8C98C9, 'Method `0x03`: LZSS (window `$7F:A000`)'],
    [0x8C9B65, 'Method `0x07`: 2D Markov grid decoder'],
    [0x8CC88C, 'Load a 16×16 map graphic through `$EE:0000 + 3·id`, DMA to VRAM'],
    [0x8CC9C0, 'Map graphic dual-stream decompressor'],
    [0x8CCE99, 'Room enter-script lookup (id × 5 via the 8-bit multiplier)'],
    [0x8CD0A6, 'Script VM opcode dispatch'], [0x8CD6BE, 'Script opcode `0x30` (`sound`)'],
    [0x8CD709, 'Script opcode `0x33` (`music`)'],
    [0x8F8398, 'Character stat recalculation (armor, charms, buffs) — unverified'],
    [0x8FA914, 'Elevation plane update (bits 5..4, kept on bit-6 / bit-13 tiles)'],
    [0x8FACB1, 'Step-on trigger search'], [0x8FACCE, 'Pixel → cell (`>> 4`) for trigger tests'],
    [0x8FACEF, 'Trigger box test (origin added, far edge exclusive)'],
    [0x8FAD51, 'Entity mover (`step`), direction table `$8F:AF18`'],
    [0x8FADB2, 'Drift / diagonal stairs (bit 13; also `$8F:ADD1`)'], [0x8FAFF5, 'Gravity'],
    [0x8FB078, 'Bit-14 gate before step-on search; current trigger in `$7E:2429`'],
    [0x8FB46D, 'Body collision → `$8F:B4AB`'], [0x8FB52C, 'Contact damage (charging body)'],
    [0x8FB5F2, 'Strike / projectile hit test (melee enters at `$8F:B5E6`)'],
    [0x8FB6A5, 'Attack proc dispatch'], [0x8FB75A, 'To-hit (evade vs hit rate)'],
    [0x8FBA1A, 'Hit cooldown: same attacker blocked for 21 ticks'],
    [0x8FC067, 'Physical damage into pending `+0x76`'], [0x8FC237, 'Pending damage applied to HP'],
    [0x8FC773, 'Sprite in front of canopy (bit 12)'], [0x8FC780, 'Sprite depth against the canopy'],
    [0x8FCE43, 'B button: bit 15 → search B-triggers, else swing'],
    [0x9080CE, 'Animation VM per-tick loop'], [0x9082D8, 'Attack starter: picks attack 0–3 by stamina'],
    [0x908E85, 'Block 1 delta accumulator (deltas → graphic ids in `$7F:C300`)'],
    [0x908F60, 'Room loader (to `$90:9180`)'], [0x908F80, 'Room header reader (to `$90:9050`)'],
    [0x9091B0, 'Block 3 → canopy / terrain / collision words (to `$90:9245`)'],
    [0x909460, 'Streams grid cells to VRAM through the dictionary'],
    [0x909DE8, 'Collision geometry (bits 3..0)'], [0x909ECC, 'Camera flag: header bytes 9–10, bit 14'],
    [0x90A0D0, 'Animated tiles: V-Blank graphic swaps (to `$90:A1A0`)'],
    [0x90A3AC, 'Object stepping without holds'], [0x90A429, 'Object tick: one state per hold'],
    [0x90A4E8, 'XOR a stamping block into the grid'], [0x90A6EF, 'Cuttable grass: swap a cut cell'],
    [0x90CBB3, 'Reload families when a script changes `MAP_PALETTE`'],
    [0x90CD80, 'Sprite palette allocator'], [0x90CDAF, 'Palette: free slot search'],
    [0x90CE92, 'Palette: steal slot 4'], [0x90D020, 'Load up to 7 tile families from `MAP_PALETTE`'],
    [0x90D50F, "Reserve the CHR descriptors' extra graphics"], [0x90DCA4, 'Spawn projectile'],
    [0x90DE5E, 'Projectile pool update'],
    [0x919BCC, 'Reads an effect\'s "done" bit (set by animation opcode `0x5D`)'],
    [0x919C90, 'Spell damage: magic defence, charm boost, clamp 1..999'],
    [0x919D16, 'Spell heal: clamp to max HP 999'], [0x919D2E, 'Reads an effect\'s "done" bit'],
    [0x91A53A, 'Reads an effect\'s "done" bit'],
    [0x91B137, 'Defend & status buff: boost stats `$4F29..$4F31`'],
    [0x91CCD8, 'Formula cast & power: `$4202..$4216` math, XP gain, target split, RNG'],
    [0x91CE38, 'Grey out ring-menu formula icon (animation opcode `0x56`)'],
];

const TABLES = [
    [0x8088A3, 'Orbit table (y)', 'angle → y, boomerang ellipse'], [0x808923, 'Orbit table (x)', 'angle → x'],
    [0x8C98A1, 'Decompressor jump table', '8 methods; `0x00` raw, `0x03` LZSS, `0x07` Markov'],
    [0x8F0000, 'Hit-chance table base', 'indexed via `$8F:BAAF`'], [0x8FBAAF, 'Hit-chance pointers by evade', ''],
    [0x8FAF18, 'Mover direction table', ''], [0x8FB090, 'Step dither `3,2,0,1`', ''],
    [0x8FCA50, 'Segment ease: velocity share', ''], [0x8FCB18, 'Segment ease: distance share', ''],
    [0x908E74, 'Room effect jump table', 'header byte 8'], [0x90815B, 'Facing → pose table', '4-pose records'],
    [0x90D967, 'Projectile movement routines', ''], [0x90DD88, 'Projectile velocity by facing', ''],
    [0x91AE31, 'Status effect apply / remove dispatch', '8 status slots, masks, durations'],
    [0x90B00B, 'Default Boy palette', ''],
];

/** @returns {{bus:number, cat:string, name:string, notes:string}[]} */
function knownPoints() {
    return [
        ...CODE.map(([bus, name]) => ({ bus, cat: '🧠', name, notes: '' })),
        ...TABLES.map(([bus, name, notes]) => ({ bus, cat: '📋', name, notes })),
        { bus: 0xC45802, cat: '⚗️', name: 'Alchemy script pointer table', notes: '4 bytes/entry `[addr:16][bank:8][0]`; length not measured' },
        { bus: 0x92E0CA, cat: '📜', name: 'First intro code', notes: '`ADDRESS.INTRO_FIRST_CODE_EXECUTED`' },
    ];
}

module.exports = { knownPoints };
