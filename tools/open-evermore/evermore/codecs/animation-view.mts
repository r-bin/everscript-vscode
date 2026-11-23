// What an animation record does and shows, for the reader (docs/open-evermore/resources.md §characters):
// facings, duration, motion, strikes, projectiles, palette, plain-English `what` summary, and palette-shaded
// ASCII art (`art`) of its frames. Derived from the ROM for preview only; implode reads only `record`.
//
// Facts used (src/games/evermore/maps/animation-table.ts, animation-vm.ts, sprites.ts, character-record.ts):
//   record    an offset in bank $C4: [script:16][bank:8][flags:8]; flags bit 7: 8 facings; bit 6: 4 (N/E/S/W); else 1
//   frames    runAnimation() steps the script tick-by-tick; composeSpriteFromRom() renders each sprite through
//             decodeSpriteBlockFromRom() so moved sprite block tables work on --random builds
import { createRequire } from 'node:module';
import { hexText } from './readers.mts';
import { decodeSpriteBlockFromRom } from './sprite-blocks.mts';

const require = createRequire(import.meta.url);
const table = require('../../../../dist/games/evermore/maps/animation-table');
const sprites = require('../../../../dist/games/evermore/maps/sprites');
const vm = require('../../../../dist/games/evermore/maps/animation-vm');
const opcodes = require('../../../../dist/games/evermore/maps/animation-opcodes');
const charRec = require('../../../../dist/games/evermore/maps/character-record');

const BANK = 0xC4;
const FOUR: [string, number][] = [['north', 0], ['east', 4], ['south', 8], ['west', 12]];
const EIGHT: [string, number][] = Array.from({ length: 8 }, (_, i) => [`facing_${i}`, 2 * i]);
/** Dark→light luminance ramp ('.' is reserved for transparent). */
const RAMP = ':-=+*#%@';
const MAX_ART_W = 48, MAX_ART_H = 24;

export type Rgb = [number, number, number];
export interface ComposedSprite { width: number; height: number; pixels: Int16Array; palettes: Uint8Array }
export interface AsciiArt { art: string[]; width: number; height: number; scale: number }
export interface DescribeOpts {
    paletteAddr?: number;
    palette2Addr?: number;
    oneShot?: boolean;
    mode: 'full' | 'slot';
    preferStrike?: boolean;
}

const spriteCache = new WeakMap<Uint8Array, Map<number, ComposedSprite | null>>();

/** Compose a sprite record from `rom` using relocation-safe block tables; cached per ROM. */
export function composeSpriteFromRom(rom: Uint8Array, spriteAddr: number): ComposedSprite | null {
    if (!spriteAddr) return null;
    let byAddr = spriteCache.get(rom);
    if (!byAddr) spriteCache.set(rom, byAddr = new Map());
    if (byAddr.has(spriteAddr)) return byAddr.get(spriteAddr)!;

    let result: ComposedSprite | null = null;
    try {
        const info = sprites.readSpriteInfo(rom, spriteAddr) as { chunks: { x: number; y: number; block: number; large: boolean; flipX: boolean; flipY: boolean; priority: number; palette: number }[] };
        const chunks = info.chunks;
        if (chunks.length) {
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            for (const c of chunks) {
                const n = c.large ? 16 : 8;
                x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + n); y1 = Math.max(y1, c.y + n);
            }
            const width = x1 - x0, height = y1 - y0;
            const pixels = new Int16Array(width * height).fill(-1);
            const palettes = new Uint8Array(width * height);
            const order = chunks.map((c, i) => ({ c, i })).sort((a, b) => a.c.priority - b.c.priority || b.i - a.i);
            for (const { c } of order) {
                const b = decodeSpriteBlockFromRom(rom, c.block, c.large);
                if (!b) continue;
                for (let r = 0; r < b.size; r++) {
                    for (let q = 0; q < b.size; q++) {
                        const v = b.pixels[(c.flipY ? b.size - 1 - r : r) * b.size + (c.flipX ? b.size - 1 - q : q)];
                        if (!v) continue;
                        const at = (c.y - y0 + r) * width + (c.x - x0 + q);
                        pixels[at] = v;
                        palettes[at] = c.palette;
                    }
                }
            }
            result = { width, height, pixels, palettes };
        }
    } catch { /* sprite record outside ROM image */ }
    byAddr.set(spriteAddr, result);
    return result;
}

/** Trim transparent borders and render a composed sprite as luminance-shaded ASCII art. */
export function renderAsciiArt(
    comp: { width: number; height: number; pixels: Int16Array; palettes?: Uint8Array },
    pal1?: Rgb[] | null,
    pal2?: Rgb[] | null,
): AsciiArt | null {
    let x0 = comp.width, y0 = comp.height, x1 = 0, y1 = 0;
    for (let y = 0; y < comp.height; y++) {
        for (let x = 0; x < comp.width; x++) {
            if (comp.pixels[y * comp.width + x] > 0) {
                if (x < x0) x0 = x;
                if (y < y0) y0 = y;
                if (x + 1 > x1) x1 = x + 1;
                if (y + 1 > y1) y1 = y + 1;
            }
        }
    }
    if (x0 >= x1 || y0 >= y1) return null;

    const w = x1 - x0, h = y1 - y0;
    const baseY = h < 12 ? 1 : 2;
    const scale = Math.max(1, Math.ceil(w / MAX_ART_W), Math.ceil(Math.ceil(h / baseY) / MAX_ART_H));
    const stepX = scale, stepY = baseY * scale;
    const art: string[] = [];
    for (let y = y0; y < y1; y += stepY) {
        let row = '';
        for (let x = x0; x < x1; x += stepX) {
            let count = 0, lumSum = 0;
            for (let dy = 0; dy < stepY && y + dy < y1; dy++) {
                for (let dx = 0; dx < stepX && x + dx < x1; dx++) {
                    const pos = (y + dy) * comp.width + (x + dx);
                    const idx = comp.pixels[pos];
                    if (idx > 0) {
                        count++;
                        const pal = comp.palettes?.[pos] === 1 && pal2 ? pal2 : pal1;
                        const [r, g, b] = pal?.[idx] ?? [idx * 17, idx * 17, idx * 17];
                        lumSum += (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                    }
                }
            }
            if (!count) { row += '.'; continue; }
            const ci = Math.min(RAMP.length - 1, Math.max(0, Math.round((lumSum / count) * (RAMP.length - 1))));
            row += RAMP[ci];
        }
        art.push(row);
    }
    return { art, width: w, height: h, scale };
}

function safePalette(rom: Uint8Array, addr: number): Rgb[] | null {
    if (!addr) return null;
    try { return charRec.paletteAt(rom, addr) as Rgb[]; } catch { return null; }
}

function facingsOf(rom: Uint8Array, record: number): [string, number][] {
    const off = ((BANK & 0x3F) << 16) | (record + 3);
    if (off >= rom.length) return [['any', 0]];
    const flags = rom[off];
    if (flags & 0x80) return EIGHT;
    if (flags & 0x40) return FOUR;
    return [['any', 0]];
}

/** Pick the representative facing (south when directional, else the first facing that draws a sprite). */
function runRepresentative(rom: Uint8Array, record: number, oneShot: boolean) {
    const facings = facingsOf(rom, record);
    const preferred = facings.find(([label]) => label === 'south') ?? facings[0];
    const order = [preferred, ...facings.filter(f => f !== preferred)];
    let fallback: { label: string; script: number; run: any } | null = null;
    for (const [label, angle] of order) {
        let script = 0;
        try { script = table.facingScript(rom, record, angle); } catch { continue; }
        let run: any;
        try { run = vm.runAnimation(rom, script, angle, { oneShot }); } catch { continue; }
        if (!fallback) fallback = { label, script, run };
        if ((run.frames as any[]).some(f => f.sprite && composeSpriteFromRom(rom, f.sprite))) {
            return { facings, chosen: { label, script, run } };
        }
    }
    return { facings, chosen: fallback };
}

/** Build a compact summary + read-only preview (`art` or `frames`) for animation record `record`. */
export function describeAnimation(rom: Uint8Array, record: number, opts: DescribeOpts): Record<string, unknown> {
    if (!record) return { what: opts.mode === 'slot' ? 'none' : 'empty (no animation record)' };

    const oneShot = !!opts.oneShot;
    const { facings, chosen } = runRepresentative(rom, record, oneShot);
    if (!chosen) return { what: 'unreadable animation record' };

    const { label: showing, script, run } = chosen;
    const frames: any[] = run.frames ?? [];
    const effPalAddr: number = run.palette || opts.paletteAddr || 0;
    const pal1 = safePalette(rom, effPalAddr);
    const pal2 = safePalette(rom, opts.palette2Addr || 0);

    let disasm: { bytes: number[]; known: boolean }[] = [];
    try { disasm = opcodes.disassembleScript(rom, script); } catch { /* truncated */ }
    const loops = oneShot
        ? false
        : Boolean(run.complete) && (run.loopFrom > 0 || disasm.some(l => l.known && (l.bytes[0] & 0x7F) === 0x2D) || disasm.every(l => l.known && (l.bytes[0] & 0x7F) !== 0x5D));

    const strikes: { dx: number; dy: number; width: number; height: number }[] = [];
    const strikeKeys = new Set<string>();
    const projSet = new Set<string>();
    let invulnerable = false;
    let firstVisual: AsciiArt | null = null;
    let strikeVisual: AsciiArt | null = null;
    const renderedBySprite = new Map<number, AsciiArt | null>();

    for (const f of frames) {
        if (f.mode & vm.MODE_INVULNERABLE) invulnerable = true;
        if (f.strikeBox) {
            const k = `${f.strikeBox.dx},${f.strikeBox.dy},${f.strikeBox.width},${f.strikeBox.height}`;
            if (!strikeKeys.has(k)) { strikeKeys.add(k); strikes.push(f.strikeBox); }
        }
        for (const sp of f.spawns ?? []) projSet.add(hexText(sp.id, 4));
        if (f.sprite && !renderedBySprite.has(f.sprite)) {
            const comp = composeSpriteFromRom(rom, f.sprite);
            renderedBySprite.set(f.sprite, comp ? renderAsciiArt(comp, pal1, pal2) : null);
        }
        const art = f.sprite ? renderedBySprite.get(f.sprite) ?? null : null;
        if (art) {
            if (!firstVisual) firstVisual = art;
            if (f.strikeBox && !strikeVisual) strikeVisual = art;
        }
    }

    const totalTicks: number = run.totalTicks ?? 0;
    const seconds = Number((totalTicks / 60).toFixed(2));
    const projectiles = [...projSet];
    const facingDesc = facings.length === 8 ? '8 facings' : facings.length === 4 ? '4 facings (N/E/S/W)' : '1 facing (any)';
    const parts: string[] = [];
    if (!firstVisual) parts.push('invisible (no sprite drawn)');
    parts.push(facingDesc);
    parts.push(`${frames.length} ${frames.length === 1 ? 'frame' : 'frames'}`);
    parts.push(`${totalTicks} ${totalTicks === 1 ? 'tick' : 'ticks'} (${seconds}s)`);
    if (run.moves) parts.push('moves');
    if (strikes.length) parts.push(strikes.length === 1 ? '1 strike box' : `${strikes.length} strike boxes`);
    if (projectiles.length) parts.push(projectiles.length === 1 ? `throws ${projectiles[0]}` : `throws ${projectiles.length} projectiles`);
    if (invulnerable) parts.push('invulnerable');
    if (run.palette) parts.push('loads own palette');
    parts.push(loops ? 'loops' : 'one-shot');
    if (firstVisual) parts.push(`${firstVisual.width}×${firstVisual.height} px`);
    if (!run.complete) parts.push('incomplete');
    const what = !firstVisual ? `${parts[0]}; ${parts.slice(1).join(', ')}` : parts.join(', ');

    if (opts.mode === 'slot') {
        const rep = (opts.preferStrike ? strikeVisual : null) ?? firstVisual;
        return {
            what,
            ...(rep && rep.scale > 1 ? { scale: `1:${rep.scale}` } : {}),
            ...(rep ? { art: rep.art } : {}),
        };
    }

    const firstFrameOfSprite = new Map<number, number>();
    const outFrames = frames.map((f, idx) => {
        const extra: Record<string, unknown> = {};
        if (f.strikeBox) extra.strike = f.strikeBox;
        if (f.mode & vm.MODE_INVULNERABLE) extra.invulnerable = true;
        if (f.spawns?.length) extra.projectiles = f.spawns.map((sp: { id: number }) => hexText(sp.id, 4));
        if (f.step) extra.step = f.step;

        const art = f.sprite ? renderedBySprite.get(f.sprite) ?? null : null;
        if (!f.sprite || !art) return { ticks: f.ticks, empty: true, ...extra };
        const prev = firstFrameOfSprite.get(f.sprite);
        if (prev !== undefined) return { ticks: f.ticks, same_as_frame: prev, ...extra };
        firstFrameOfSprite.set(f.sprite, idx);
        return {
            ticks: f.ticks,
            size: `${art.width}×${art.height}`,
            ...(art.scale > 1 ? { scale: `1:${art.scale}` } : {}),
            ...extra,
            art: art.art,
        };
    });

    const preview: Record<string, unknown> = {
        note: "Read-only preview from ROM; implode reads only `record`. Art: '.' transparent, ':-=+*#%@' dark->light.",
        facings: facings.map(([label]) => label),
        ...(facings.length > 1 ? { showing } : {}),
        ticks: totalTicks,
        seconds,
        loops,
        ...(run.moves ? { moves: true } : {}),
        ...(invulnerable ? { invulnerable: true } : {}),
        ...(strikes.length ? { strikes } : {}),
        ...(projectiles.length ? { projectiles } : {}),
        ...(effPalAddr ? { palette: run.palette ? `${hexText(effPalAddr, 4)} (script)` : hexText(effPalAddr, 4) } : {}),
        ...(!run.complete ? { incomplete: true } : {}),
        frames: outFrames,
    };
    return { what, preview };
}
