// Ownership: running Terranigma's own room loader on the platform's 65816 interpreter
// (docs/terra/README.md §4) instead of re-deriving every header section by hand.
//
// The game loads a room with $86:86ED: it reads the room's script from the room table and runs
// the script's header, a list of flag bytes whose set bits (MSB first, dispatched at $86:86F9)
// each start a section — graphics into VRAM, palettes, metatiles, the layer maps, display mode,
// music — until a 00 byte. Run here on a fresh bus, the WRAM, VRAM and PPU registers it leaves are
// the room as the game builds it. Three things the bus does not have are stood in for:
//   - the WRAM the game sets up at power-on ($86:B8D6 copies a table of address/value words): the
//     same table is applied from the ROM;
//   - the layer layout a previous room's display-mode command left ($86:8DE9, table $86:8E5B):
//     entry 0, the one most rooms use;
//   - the music section ($86:8F37) uploads to the sound CPU and waits for its answers: it is
//     skipped (its operands are two bytes and a relative pointer), and the vblank flag ($4210)
//     reads as set, so the loader's "wait for vblank" before a DMA returns at once.
import { Cpu65816 } from '../../../platform/snes/cpu65816';
import { SnesBus } from '../../../platform/snes/snes-bus';

/**
 * The room loader: JSL, returns with RTL. A room change ($8D:8717) sets `$047E` = room and `$0480` = room × 2; the
 * loader reads the room table at `$047E + $0480` (room × 3, $86:9010) and the room's property stream through a
 * word table at `$82:8000 + $0480`, else `$83:8000` ($86:955C: flags to `$048B`, then the display mode, $86:8C61).
 */
const ROOM_LOADER = 0x8686ED;

/** Where each header section's handler starts, by its flag bit. */
const SECTION_HANDLERS: Record<number, number> = {
    0x80: 0x86876E, 0x40: 0x868903, 0x20: 0x868930, 0x10: 0x868A7D,
    0x08: 0x868C17, 0x04: 0x868E9B, 0x02: 0x868F37, 0x01: 0x868FAA,
};

/** What each section was seen to do (docs/terra/README.md §4.2). */
export const SECTION_NAMES: Record<number, string> = {
    0x80: 'graphics to VRAM', 0x40: 'palette', 0x20: 'metatiles', 0x10: 'layer maps',
    0x08: 'command (display mode, call or jump to a shared script)', 0x04: 'section $04', 0x02: 'music', 0x01: 'section $01',
};

/** The decompressor (into WRAM `$BB:$B9` from `[$66]`), and the same one streaming into VRAM. */
const DECOMPRESS = 0x8683BE, DECOMPRESS_TO_VRAM = 0x8684E1;
/** Enters a shared script (table B): X = entry × 3. */
const SET_ENTER = 0x869035;
/** The script readers: one byte at `[$62],Y` ($86:9005), and a relative pointer (word + bank) into `,X` ($86:90E7). */
const READ_BYTE = 0x869005, READ_POINTER = 0x8690E7;
/** The power-on WRAM table of $86:B8D6: (address, value) words up to a negative address. */
const INIT_TABLE = 0x06B93F;
/** The display-mode layouts of $86:8DE9, 16 bytes each; words +8..+15 go to $083C, $0834, $0836, $0838. */
const LAYOUT_TABLE = 0x068E5B;
const LAYOUT_WORDS = [0x083C, 0x0834, 0x0836, 0x0838];

/** The SNES bus as the loader needs it: vblank always just happened, the sound CPU never answers. */
export class TerraBus extends SnesBus {
    /** The PPU registers ($21xx) written since the bus was made. */
    readonly ppuWritten = new Set<number>();
    read(addr: number): number {
        if ((addr & 0x40FFFF) === 0x4210) return 0x80;
        return super.read(addr);
    }
    write(addr: number, v: number): void {
        if ((addr & 0x40FF00) === 0x2100) this.ppuWritten.add(addr & 0xFFFF);
        super.write(addr, v);
    }
}

/** What one run of the loader did. */
export interface LoaderRun {
    /** Header sections that ran (flag bits), in the order first seen. */
    sections: number[];
    /** Shared scripts (table B entries) the header entered. */
    sets: number[];
    /** Compressed blocks read: bus address, and the VRAM word address it was streamed to (null: into WRAM). */
    blocks: { at: number; vram: number | null }[];
    /** The script bytes the header read, in order (pointers as the 3 bytes they are written as). */
    read: number[];
    /** Whether the run set the display mode (main screen $212C, from the room properties or an `08 00` command). */
    display: boolean;
    /** VRAM written (DMA, ports, the streaming decompressor's target), as 1 K-word pages (word address >> 10). */
    vramPages: number[];
    steps: number;
}

const w16 = (bus: SnesBus, a: number, v: number) => { bus.wram[a] = v & 0xFF; bus.wram[a + 1] = (v >> 8) & 0xFF; };

/** A bus with the ROM and the WRAM the game has before its first room. */
export function newTerraBus(rom: Uint8Array): TerraBus {
    const bus = new TerraBus(rom);
    for (let i = INIT_TABLE; i + 4 <= rom.length; i += 4) {
        const a = rom[i] | (rom[i + 1] << 8);
        if (a & 0x8000) break;
        w16(bus, a, rom[i + 2] | (rom[i + 3] << 8));
    }
    LAYOUT_WORDS.forEach((a, i) => w16(bus, a, rom[LAYOUT_TABLE + 8 + i * 2] | (rom[LAYOUT_TABLE + 9 + i * 2] << 8)));
    return bus;
}

/**
 * Run the loader for room `id` on `bus` (a fresh `newTerraBus`, or one a previous room was loaded on).
 * `headerOnly` skips the decompressors (their sources are still recorded): the sections, sizes, palette
 * and the uncompressed parts are right, the decompressed data is not — enough to tell rooms apart.
 */
export function runRoomLoader(bus: TerraBus, id: number, opts: { headerOnly?: boolean } = {}): LoaderRun {
    const run: LoaderRun = { sections: [], sets: [], blocks: [], read: [], display: false, vramPages: [], steps: 0 };
    bus.takeDirtyChars();
    const before = bus.ppuWritten.has(0x212C);
    bus.ppuWritten.delete(0x212C);
    w16(bus, 0x047E, id);
    w16(bus, 0x0480, id * 2);
    const cpu = new Cpu65816(bus);
    cpu.db = 0x80; cpu.d = 0; cpu.s = 0x01FF;
    cpu.p = 0x24;                                  // 8-bit A, 16-bit X/Y, as the game calls it
    for (const [bit, at] of Object.entries(SECTION_HANDLERS)) {
        const flag = Number(bit);
        cpu.traps.set(at, c => { if (!run.sections.includes(flag)) run.sections.push(flag); c.step(); });
    }
    cpu.traps.set(SECTION_HANDLERS[0x02], c => {
        if (!run.sections.includes(0x02)) run.sections.push(0x02);
        c.y = (c.y + 5) & 0xFFFF;
        c.returnFrom();
    });
    cpu.traps.set(SET_ENTER, c => { run.sets.push(Math.floor(c.x / 3)); c.step(); });
    const script = (n: number) => (c: Cpu65816) => {
        const w = bus.wram, at = (w[0x62] | (w[0x63] << 8) | (w[0x64] << 16)) + c.y;
        const bank = (at >> 16) << 16;
        for (let i = 0; i < n; i++) run.read.push(bus.read(bank | ((at + i) & 0xFFFF)));
        c.step();
    };
    cpu.traps.set(READ_BYTE, script(1));
    cpu.traps.set(READ_POINTER, script(3));
    const block = (vram: boolean) => (c: Cpu65816) => {
        const w = bus.wram;
        run.blocks.push({ at: w[0x66] | (w[0x67] << 8) | (w[0x68] << 16), vram: vram ? bus.ppuReg(0x2116) | (bus.ppuReg(0x2117) << 8) : null });
        if (opts.headerOnly) c.returnFrom(true); else c.step();
    };
    cpu.traps.set(DECOMPRESS, block(false));
    cpu.traps.set(DECOMPRESS_TO_VRAM, block(true));
    cpu.call(ROOM_LOADER, { maxSteps: 20_000_000 });
    run.steps = cpu.steps;
    run.display = bus.ppuWritten.has(0x212C);
    const pages = new Set(bus.takeDirtyChars().map(c => c >> 6));
    for (const b of run.blocks) if (b.vram !== null) pages.add(b.vram >> 10);
    run.vramPages = [...pages].sort((a, b) => a - b);
    if (before) bus.ppuWritten.add(0x212C);
    return run;
}
