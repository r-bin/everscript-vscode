// Ownership: a Terranigma room as the loader leaves it in WRAM / VRAM / PPU registers
// (docs/terra/README.md §4.3): its two layer maps, their metatile tables, the background characters,
// the palette and the display registers. Pure; runs the game's loader through loader.ts.
//
// WRAM after the loader ($86:B93F and the layout set the addresses; $86:8AD8 the sizes):
//   $0826/$0828  layer 0/1 width in pixels    $082A/$082C  height in pixels (0: the room has no such layer)
//   $0832/$0834  layer 0/1 map in bank $7E    one word per 16 px cell, row by row
//   $083A/$083C  layer 0/1 metatile table     512 metatiles × 4 tile words (top-left, top-right, bottom-left, bottom-right)
//   $0836/$0838  layer 0/1 VRAM tilemap word address (which BG shows the layer: BGnSC $2107-$210A)
//   $7F:0600     the palette the frame upload copies to CGRAM (256 colours); after the load the room change
//                copies colour 32 into colour 0, the backdrop ($8D:8C52)
// A map word is the metatile (bits 0-8) and the cell type (bits 9-13, $80:DA28), filled in from a
// per-metatile table by $86:9332; bit 15 is set while a character stands on the cell ($80:BEC2).
import { isBaseTerraRom, isRoomSlotUsed, TERRA_ROOM_COUNT } from './rom';
import { newTerraBus, runRoomLoader, type LoaderRun, type TerraBus } from './loader';

export interface TerraLayer {
    /** 0 or 1: which of the loader's two layers. */
    index: number;
    /** The BG (1-4) whose tilemap the layer is copied to, 0 if none. */
    bg: number;
    /** Size in 16 px cells. */
    w: number; h: number;
    /** Map words, row by row (`w * h`). */
    cells: Uint16Array;
    /** 512 metatiles × 4 tile words. */
    metatiles: Uint16Array;
    /** The layer's cell-type table: one byte per metatile (bank $7F at `$084E` / `$0850`); a map change that sets a
     *  metatile takes the cell's type from it ($8D:905A). */
    types: Uint8Array;
}

export interface TerraPpu {
    /** $2105 BGMODE, $212C / $212D main / sub screen, $2130 CGWSEL, $2131 CGADSUB. */
    mode: number; main: number; sub: number; cgwsel: number; cgadsub: number;
    /** Fixed colour ($2132), 5-bit R, G, B. */
    fixed: number[];
    /** Per BG 1-4: tilemap word address and character base word address. */
    bgs: { map: number; chars: number }[];
}

export interface TerraRoom {
    id: number;
    /** Layers with a map (0, 1 or 2 of them). */
    layers: TerraLayer[];
    /** The whole VRAM (64 KB): characters are read from each BG's base. */
    vram: Uint8Array;
    /** 256 BGR555 colours. */
    palette: Uint16Array;
    ppu: TerraPpu;
    /** What the room's own loader run did. */
    run: LoaderRun;
    /** The rooms loaded first, oldest first, because this one keeps parts of what was loaded before it. */
    context: number[];
}

const rw = (w: Uint8Array, a: number) => w[a] | (w[a + 1] << 8);

/**
 * What a room must have loaded (itself or before it) to be drawn: background characters (VRAM written below word
 * $3800, where the BG tilemaps start; above $4000 are sprites and the font), the palette ($40), the metatiles ($20)
 * and the display mode (0).
 */
const BG_GRAPHICS = 0x100;
const NEEDED = [BG_GRAPHICS, 0x40, 0x20, 0];
function provides(run: LoaderRun): number[] {
    return NEEDED.filter(n => n === BG_GRAPHICS ? run.vramPages.some(p => p < 0x0E)
        : n === 0 ? run.display : run.sections.includes(n));
}
/** How far back to look for rooms that provide what a room keeps from before: this many used rooms. */
const CONTEXT_REACH = 16;

function readLayers(bus: TerraBus): TerraLayer[] {
    const w = bus.wram, out: TerraLayer[] = [];
    for (let i = 0; i < 2; i++) {
        const pw = rw(w, 0x0826 + i * 2), ph = rw(w, 0x082A + i * 2);
        if (!pw || !ph) continue;
        const cw = pw >> 4, ch = ph >> 4, map = rw(w, 0x0832 + i * 2), meta = rw(w, 0x083A + i * 2);
        const cells = new Uint16Array(cw * ch);
        for (let k = 0; k < cells.length; k++) cells[k] = rw(w, (map + k * 2) & 0xFFFF);
        const metatiles = new Uint16Array(512 * 4);
        for (let k = 0; k < metatiles.length; k++) metatiles[k] = rw(w, (meta + k * 2) & 0xFFFF);
        const typeAt = 0x10000 + rw(w, 0x084E + i * 2);
        const types = w.slice(typeAt, typeAt + 512);
        const vmap = rw(w, 0x0836 + i * 2);
        let bg = 0;
        for (let b = 0; b < 4; b++) if (((bus.ppuReg(0x2107 + b) & 0xFC) << 8) === vmap) { bg = b + 1; break; }
        out.push({ index: i, bg, w: cw, h: ch, cells, metatiles, types });
    }
    return out;
}

function readPpu(bus: TerraBus): TerraPpu {
    const nba = [bus.ppuReg(0x210B), bus.ppuReg(0x210C)];
    return {
        mode: bus.ppuReg(0x2105), main: bus.ppuReg(0x212C), sub: bus.ppuReg(0x212D),
        cgwsel: bus.ppuReg(0x2130), cgadsub: bus.ppuReg(0x2131), fixed: bus.fixedColor.slice(),
        bgs: [0, 1, 2, 3].map(b => ({
            map: (bus.ppuReg(0x2107 + b) & 0xFC) << 8,
            chars: ((nba[b >> 1] >> ((b & 1) * 4)) & 0x0F) << 12,
        })),
    };
}

/** What a header-only run (decompressors skipped: cheap) tells about a room. */
export interface HeaderSummary {
    run: LoaderRun;
    /** Layer 0 / 1 size in 16 px cells ([w0, h0, w1, h1]); 0 where the room loads no such layer. */
    sizes: number[];
    /** The palette as the header left it (256 BGR555 words). */
    palette: Uint16Array;
    /** The PPU registers $2100-$2133 as the run left them (display mode, layer layout). */
    ppu: number[];
}

const headerCache = new WeakMap<Uint8Array, Map<number, HeaderSummary>>();
/** The room's header-only summary, cached per ROM buffer. */
export function headerRun(rom: Uint8Array, id: number): HeaderSummary {
    let m = headerCache.get(rom);
    if (!m) { m = new Map(); headerCache.set(rom, m); }
    let r = m.get(id);
    if (!r) {
        const bus = newTerraBus(rom), run = runRoomLoader(bus, id, { headerOnly: true }), w = bus.wram;
        const palette = new Uint16Array(256);
        for (let i = 0; i < 256; i++) palette[i] = rw(w, 0x10600 + i * 2) & 0x7FFF;
        const ppu = Array.from({ length: 0x34 }, (_, i) => bus.ppuReg(0x2100 + i));
        r = { run, sizes: [rw(w, 0x0826) >> 4, rw(w, 0x082A) >> 4, rw(w, 0x0828) >> 4, rw(w, 0x082C) >> 4], palette, ppu };
        m.set(id, r);
    }
    return r;
}

/** Which sections a room runs by itself. */
export function roomSections(rom: Uint8Array, id: number): number[] { return headerRun(rom, id).run.sections; }

/**
 * The rooms to load before `id`, oldest first, for the parts it keeps from before (background graphics, palette,
 * metatiles, display mode): for each such part the closest earlier used room that loads it. The game has whatever
 * room the player came from; the rooms before it in the table are the guess, and the UI says it is one. Empty when
 * the room loads everything itself or has no map of its own.
 */
export function contextRooms(rom: Uint8Array, id: number): number[] {
    const own = headerRun(rom, id).run;
    if (!own.sections.includes(0x10)) return [];
    const has = provides(own);
    let missing = NEEDED.filter(n => !has.includes(n));
    const chain: number[] = [];
    for (let k = id - 1, seen = 0; missing.length && k >= 0 && seen < CONTEXT_REACH; k--) {
        if (!isRoomSlotUsed(rom, k)) continue;
        seen++;
        const gives = provides(headerRun(rom, k).run).filter(n => missing.includes(n));
        if (!gives.length) continue;
        chain.unshift(k);
        missing = missing.filter(n => !gives.includes(n));
    }
    return chain;
}

/** Load room `id` as the game would; null for an unused slot, a ROM other than the base one, or a loader failure. */
export function loadRoom(rom: Uint8Array, id: number): TerraRoom | null {
    if (!Number.isInteger(id) || id < 0 || id >= TERRA_ROOM_COUNT || !isRoomSlotUsed(rom, id) || !isBaseTerraRom(rom)) return null;
    const bus = newTerraBus(rom);
    const context = contextRooms(rom, id);
    try {
        for (const k of context) runRoomLoader(bus, k);
        const run = runRoomLoader(bus, id);
        const palette = new Uint16Array(256);
        for (let i = 0; i < 256; i++) palette[i] = rw(bus.wram, 0x10600 + i * 2) & 0x7FFF;
        palette[0] = palette[32];      // the room change copies colour 32 to the backdrop after the load ($8D:8C52)
        return { id, layers: readLayers(bus), vram: bus.vram.slice(), palette, ppu: readPpu(bus), run, context };
    } catch {
        return null;
    }
}
