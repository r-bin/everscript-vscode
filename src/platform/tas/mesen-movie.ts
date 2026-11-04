/**
 * platform/tas/mesen-movie.ts
 *
 * MesenCE's movie files (.mmo): a zip of Input.txt (one line per input poll: "|<system>|<pad>", the pad as
 * "ABXYLRSTUDLR" with '.' = released), GameSettings.txt ("<key> <value>" lines) and, when the recording's RAM setting
 * is Random or it started from a state, SaveState.mss. The state is the machine as the recording began. MesenCE loads it
 * whole. A state at the reset vector goes to other backends as WRAM, SRAM, ARAM, S-DSP registers and resetState(), which
 * is not all of it (the game's RNG seed comes out different without the rest). A state from mid-game (`fields`) is at a
 * field's line 225; the recomp takes it over field by field (its src/soe_mesen_state.c).
 *
 * SaveState.mss: "MSS", u32 emulator version, u32 format, u32 console, u32 frame buffer size, width, height, scale,
 * compressed size, the compressed frame; u32 name length, the ROM's name; u8 compressed, u32 size, u32 compressed size,
 * zlib data: fields of a NUL-ended key, a u32 length and the bytes, one after another.
 *
 * Pure: no vscode, no fs (callers pass buffers). The state holds memory from the user's own ROM: never commit it.
 */
import { inflateSync } from 'node:zlib';
import { readZip } from '../zip';

const KEYS = 'ABXYLRSTUDLR';
// The bits of the pad word (movie.ts), in KEYS order.
const BITS = [0x0080, 0x8000, 0x0040, 0x4000, 0x0020, 0x0010, 0x2000, 0x1000, 0x0800, 0x0400, 0x0200, 0x0100];
const MID_GAME_LINE = 225;        // where MesenCE leaves its frame loop, the only moment a state is saved
const RESET_CLOCK_LIMIT = 1000;   // master clocks: a state taken at the reset vector has run nothing yet

/** What the state's SPC700 and S-DSP do not cover of a reset of a running console, for a backend that powers on: FastROM on. */
function resetState(fields: Map<string, Buffer>): Buffer {
    return Buffer.from([fields.get('internalRegisters.enableFastRom')?.[0] ?? 0]);
}

function padFromKeys(text: string): number {
    let word = 0;
    for (let i = 0; i < KEYS.length; i++) if (text[i] && text[i] !== '.') word |= BITS[i];
    return word;
}

function inflateState(state: Buffer): Buffer {
    if (state.toString('latin1', 0, 3) !== 'MSS') throw new Error('not a Mesen save state');
    let p = 15 + 16;
    p += 4 + state.readUInt32LE(p);                 // compressed size, the frame
    p += 4 + state.readUInt32LE(p);                 // name length, the name
    const compressed = state[p] !== 0;
    const size = state.readUInt32LE(p + 1), packed = state.readUInt32LE(p + 5);
    p += 9;
    return compressed ? inflateSync(state.subarray(p, p + packed)) : state.subarray(p, p + size);
}

function stateFields(data: Buffer): Map<string, Buffer> {
    const fields = new Map<string, Buffer>();
    for (let q = 0; q < data.length;) {
        const end = data.indexOf(0, q);
        if (end < 0) break;
        const length = data.readUInt32LE(end + 1);
        fields.set(data.toString('latin1', q, end), data.subarray(end + 5, end + 5 + length));
        q = end + 5 + length;
    }
    return fields;
}

/** The movie's input rows (one pad word per poll) and, from its state, the WRAM and SRAM it began with. */
function parseMesenMovie(file: Buffer, fileName?: string) {
    const files = new Map(readZip(file).map(f => [f.name, f.data]));
    const input = files.get('Input.txt'), settings = files.get('GameSettings.txt');
    if (!input || !settings) throw new Error('not a Mesen movie');
    const rows = input.toString('latin1').split('\n').filter(line => line[0] === '|').map(line => line.slice(1).split('|'));
    if (rows.some(row => /[^.]/.test(row[0]))) throw new Error('the movie presses reset or power: not supported');
    const pads = Uint16Array.from(rows, row => padFromKeys(row[1] || ''));
    const sha1 = (/^SHA1 (\S+)/m.exec(settings.toString('latin1'))?.[1] || '').toLowerCase();
    const state = files.get('SaveState.mss');
    let start: { state: Buffer; midGame: boolean; fields: Buffer; wram: Buffer; sram: Buffer; aram: Buffer; dsp: Buffer; hw: Buffer } | null = null;
    if (state) {
        const data = inflateState(state), fields = stateFields(data);
        const clock = fields.get('memoryManager.masterClock'), wram = fields.get('memoryManager.workRam'), sram = fields.get('cart.saveRam');
        const aram = fields.get('spc.ram'), dsp = fields.get('spc.dsp.externalRegs');
        if (!clock || !wram || !sram || !aram || !dsp) throw new Error('the movie\'s save state is not a SNES state');
        const midGame = Number(clock.readBigUInt64LE(0)) > RESET_CLOCK_LIMIT;
        if (midGame && (fields.get('ppu.scanline')?.readUInt16LE(0) ?? 0) !== MID_GAME_LINE) throw new Error('the movie\'s save state is not at a field\'s line 225');
        start = { state, midGame, fields: data, wram, sram, aram, dsp, hw: resetState(fields) };
    }
    return { title: String(fileName || 'movie').replace(/\.mmo$/i, ''), pads, count: pads.length, sha1, start };
}

export { parseMesenMovie, inflateState };
