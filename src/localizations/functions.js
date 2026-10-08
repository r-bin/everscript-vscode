'use strict';
// Ownership: ROM function addresses (bus addresses) to subjective function/routine names.
// Sources: everscript wiki ROM map, src/rom/model/points.js.

const { resolveLocalizedName } = require('./strings');

const FUNCTIONS = [
    { address: 0x808020, name: 'RESET handler', notes: '', category: '🧠', stringIndex: null },
    { address: 0x80823A, name: 'NMI (V-Blank) handler', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8084EA, name: 'IRQ handler', notes: '', category: '🧠', stringIndex: null },
    { address: 0x80885E, name: 'COP handler', notes: '', category: '🧠', stringIndex: null },
    { address: 0x80885F, name: 'BRK handler', notes: '', category: '🧠', stringIndex: null },
    { address: 0x809033, name: 'Direct sprite draw (OAM)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8C805B, name: 'SPC700 IPL bootloader handshake & block upload', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8C81FD, name: 'APU handshake / `$2140` spinlock', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8C8236, name: 'Song soundbank validation & loader (prevents or induces "The Sound Glitch")', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8C828F, name: 'Opcode `0x33` (`music`) pre-dispatcher & volume handler', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8C988D, name: 'Decompression dispatcher: reads `sub_flag`, jumps through `$8C:98A1`', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8C98B1, name: 'Method `0x00`: raw copy', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8C98C9, name: 'Method `0x03`: LZSS (window `$7F:A000`)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8C9B65, name: 'Method `0x07`: 2D Markov grid decoder', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8CC88C, name: 'Load a 16×16 map graphic through `$EE:0000 + 3·id`, DMA to VRAM', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8CC9C0, name: 'Map graphic dual-stream decompressor', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8CCE99, name: 'Room enter-script lookup (id × 5 via the 8-bit multiplier)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8CD0A6, name: 'Script VM opcode dispatch', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8CD6BE, name: 'Script opcode `0x30` (`sound`)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8CD709, name: 'Script opcode `0x33` (`music`)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8F8398, name: 'Character stat recalculation (armor, charms, buffs) — unverified', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FA914, name: 'Elevation plane update (bits 5..4, kept on bit-6 / bit-13 tiles)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FACB1, name: 'Step-on trigger search', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FACCE, name: 'Pixel → cell (`>> 4`) for trigger tests', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FACEF, name: 'Trigger box test (origin added, far edge exclusive)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FAD51, name: 'Entity mover (`step`), direction table `$8F:AF18`', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FADB2, name: 'Drift / diagonal stairs (bit 13; also `$8F:ADD1`)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FAFF5, name: 'Gravity', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FB078, name: 'Bit-14 gate before step-on search; current trigger in `$7E:2429`', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FB46D, name: 'Body collision → `$8F:B4AB`', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FB52C, name: 'Contact damage (charging body)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FB5F2, name: 'Strike / projectile hit test (melee enters at `$8F:B5E6`)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FB6A5, name: 'Attack proc dispatch', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FB75A, name: 'To-hit (evade vs hit rate)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FBA1A, name: 'Hit cooldown: same attacker blocked for 21 ticks', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FC067, name: 'Physical damage into pending `+0x76`', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FC237, name: 'Pending damage applied to HP', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FC773, name: 'Sprite in front of canopy (bit 12)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FC780, name: 'Sprite depth against the canopy', notes: '', category: '🧠', stringIndex: null },
    { address: 0x8FCE43, name: 'B button: bit 15 → search B-triggers, else swing', notes: '', category: '🧠', stringIndex: null },
    { address: 0x9080CE, name: 'Animation VM per-tick loop', notes: '', category: '🧠', stringIndex: null },
    { address: 0x9082D8, name: 'Attack starter: picks attack 0–3 by stamina', notes: '', category: '🧠', stringIndex: null },
    { address: 0x908E85, name: 'Block 1 delta accumulator (deltas → graphic ids in `$7F:C300`)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x908F60, name: 'Room loader (to `$90:9180`)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x908F80, name: 'Room header reader (to `$90:9050`)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x9091B0, name: 'Block 3 → canopy / terrain / collision words (to `$90:9245`)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x909460, name: 'Streams grid cells to VRAM through the dictionary', notes: '', category: '🧠', stringIndex: null },
    { address: 0x909DE8, name: 'Collision geometry (bits 3..0)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x909ECC, name: 'Camera flag: header bytes 9–10, bit 14', notes: '', category: '🧠', stringIndex: null },
    { address: 0x90A0D0, name: 'Animated tiles: V-Blank graphic swaps (to `$90:A1A0`)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x90A3AC, name: 'Object stepping without holds', notes: '', category: '🧠', stringIndex: null },
    { address: 0x90A429, name: 'Object tick: one state per hold', notes: '', category: '🧠', stringIndex: null },
    { address: 0x90A4E8, name: 'XOR a stamping block into the grid', notes: '', category: '🧠', stringIndex: null },
    { address: 0x90A6EF, name: 'Cuttable grass: swap a cut cell', notes: '', category: '🧠', stringIndex: null },
    { address: 0x90CBB3, name: 'Reload families when a script changes `MAP_PALETTE`', notes: '', category: '🧠', stringIndex: null },
    { address: 0x90CD80, name: 'Sprite palette allocator', notes: '', category: '🧠', stringIndex: null },
    { address: 0x90CDAF, name: 'Palette: free slot search', notes: '', category: '🧠', stringIndex: null },
    { address: 0x90CE92, name: 'Palette: steal slot 4', notes: '', category: '🧠', stringIndex: null },
    { address: 0x90D020, name: 'Load up to 7 tile families from `MAP_PALETTE`', notes: '', category: '🧠', stringIndex: null },
    { address: 0x90D50F, "name": "Reserve the CHR descriptors' extra graphics", notes: '', category: '🧠', stringIndex: null },
    { address: 0x90DCA4, name: 'Spawn projectile', notes: '', category: '🧠', stringIndex: null },
    { address: 0x90DE5E, name: 'Projectile pool update', notes: '', category: '🧠', stringIndex: null },
    { address: 0x919BCC, name: 'Reads an effect\'s "done" bit (set by animation opcode `0x5D`)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x919C90, name: 'Spell damage: magic defence, charm boost, clamp 1..999', notes: '', category: '🧠', stringIndex: null },
    { address: 0x919D16, name: 'Spell heal: clamp to max HP 999', notes: '', category: '🧠', stringIndex: null },
    { address: 0x919D2E, name: 'Reads an effect\'s "done" bit', notes: '', category: '🧠', stringIndex: null },
    { address: 0x91A53A, name: 'Reads an effect\'s "done" bit', notes: '', category: '🧠', stringIndex: null },
    { address: 0x91B137, name: 'Defend & status buff: boost stats `$4F29..$4F31`', notes: '', category: '🧠', stringIndex: null },
    { address: 0x91CCD8, name: 'Formula cast & power: `$4202..$4216` math, XP gain, target split, RNG', notes: '', category: '🧠', stringIndex: null },
    { address: 0x91CE38, name: 'Grey out ring-menu formula icon (animation opcode `0x56`)', notes: '', category: '🧠', stringIndex: null },
    { address: 0x92E0CA, name: 'First intro code', notes: '`ADDRESS.INTRO_FIRST_CODE_EXECUTED`', category: '📜', stringIndex: null },
];

const FUNCTION_BY_ADDRESS = new Map();
for (const f of FUNCTIONS) {
    FUNCTION_BY_ADDRESS.set(f.address, f);
}

function getFunction(address) {
    if (typeof address !== 'number') return null;
    return FUNCTION_BY_ADDRESS.get(address) || null;
}

function getFunctionName(address, options = {}) {
    const fn = getFunction(address);
    if (!fn) return `func_${address.toString(16).toUpperCase()}`;
    return resolveLocalizedName(fn, options.rom, 'name');
}

module.exports = {
    FUNCTIONS,
    FUNCTION_BY_ADDRESS,
    getFunction,
    getFunctionName,
};

