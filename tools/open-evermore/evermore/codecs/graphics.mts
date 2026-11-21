// The `fonts` and `hud` kinds (docs/open-evermore/resources.md §fonts, §hud): graphics the engine uploads from bank $C4
// by fixed addresses, so each stays at its home (an item only its home fits, like projectile records); implode writes
// it there from what the files say.
//
// Facts used (knowledge routines/font_metrics_table_setup.md, opcodes/9a.md, field_hud_weapon_stamina_gauge_vram_dma_upload.md):
//   fonts    two, at $C4:0000 and $C4:0C82: `font` (opcode 0x9A) takes 2·id into the word table $8C:E6E6, the font's
//            offset in bank $C4 (the boot and two other callers pass 0). $8C:9DAF reads a header of two bytes: the
//            glyph height in rows ($0B3D) and the bytes per row ($0B43); the glyphs follow, 128 of them (codes $20-$9F:
//            the multiplier $80 is an immediate) at height · bytes per row each: 8 pixels wide, a row's bytes its
//            planes (ink, then shadow: $8C:A5AC), the leftmost pixel in bit 7; then 128 widths in pixels, one byte each, which the layout reads at glyph base + 128 · stride ($8C:A938)
//   hud      the field HUD's gauge tiles: $C4:3704, $160 bytes (22 2bpp tiles: digits, %, /, the level marks) uploaded
//            to VRAM $1F48 by $8F:8710, and two 4-colour palettes, $C4:3864 and $C4:386C, to CGRAM 8 ($80:85FA)
// The table $8C:E6E6 stays in _base/ while the fonts stay home; a font's name is how scripts write `font`.
import { createRequire } from 'node:module';
import type { Codec, ImplodeContext, Item } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';

const require = createRequire(import.meta.url);
const { decodePng, encodeIndexedPng } = require('../../../../dist/platform/png');

/** A record only its home fits. */
const pinned = (at: number, length: number) => ({ above: at, below: at + length, bankOffset: at & 0xFFFF });
const word = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const hexColour = (c: number) => '#' + [c & 31, (c >> 5) & 31, (c >> 10) & 31].map(v => (v << 3).toString(16).padStart(2, '0')).join('');
function colourOf(text: unknown): number | null {
    const m = typeof text === 'string' ? /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(text) : null;
    if (!m) return null;
    const [r, g, b] = [m[1], m[2], m[3]].map(x => parseInt(x, 16));
    return [r, g, b].some(x => x & 7) ? null : (r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10);
}
const rgb = (c: number) => [(c & 31) << 3, ((c >> 5) & 31) << 3, ((c >> 10) & 31) << 3];

/** A file's home and name: explode records it, implode finds it again (renamed: by its id, homes in address order). */
function homeOf(ctx: ImplodeContext, kind: string, name: string, names: Set<string>): { at: number; length: number } | undefined {
    const own = ctx.base.homes.get(`${kind}/${name}`), id = ctx.ids.get(kind)?.get(name);
    if (own || id === undefined) return own;
    const homes = [...ctx.base.homes].filter(([k]) => k.startsWith(`${kind}/`)).sort((a, b) => a[1].at - b[1].at);
    return homes[id] && !names.has(homes[id][0].slice(kind.length + 1)) ? homes[id][1] : undefined;
}

// ── fonts ──
export const FONTS = 'fonts';
const FONT_TABLE = 0x0CE6E6, FONT_BANK = 0x040000, GLYPHS = 128, FONT_NAMES = ['default', 'outro'];
export const FONT_COUNT = FONT_NAMES.length;

interface Font { height: number; rowBytes: number; glyphs: Uint8Array; widths: number[] }
function fontAt(rom: Uint8Array, at: number): Font {
    const height = rom[at], rowBytes = rom[at + 1], size = height * rowBytes * GLYPHS;
    return { height, rowBytes, glyphs: rom.slice(at + 2, at + 2 + size), widths: [...rom.subarray(at + 2 + size, at + 2 + size + GLYPHS)] };
}
const fontBytes = (f: Font) => Uint8Array.from([f.height, f.rowBytes, ...f.glyphs, ...f.widths]);
/** The glyphs as a PNG: 16 a row, codes $20 on, each 8 pixels wide and `height` tall. A row's bytes are planes
 *  (the rasterizer $8C:A5AC blends the first as ink and the second as its shadow): a pixel's colour is bit k of
 *  plane k, so 2 planes give 4 colours (none, ink, shadow, both). */
const PLANE_COLOURS = [[255, 255, 255], [0, 0, 0], [160, 160, 160], [80, 80, 80], [255, 0, 0], [0, 160, 0], [0, 0, 255], [255, 160, 0]];
function glyphsPng(f: Font): Uint8Array {
    const w = 16 * 8, h = (GLYPHS / 16) * f.height, px = new Uint8Array(w * h);
    for (let g = 0; g < GLYPHS; g++) for (let r = 0; r < f.height; r++) for (let x = 0; x < 8; x++) {
        let v = 0;
        for (let k = 0; k < f.rowBytes; k++) v |= ((f.glyphs[(g * f.height + r) * f.rowBytes + k] >> (7 - x)) & 1) << k;
        px[(Math.floor(g / 16) * f.height + r) * w + (g % 16) * 8 + x] = v;
    }
    return new Uint8Array(encodeIndexedPng(w, h, px, Array.from({ length: 1 << f.rowBytes }, (_, i) => PLANE_COLOURS[i] ?? [i, i, i])));
}
function glyphsOf(png: Uint8Array, height: number, rowBytes: number): Uint8Array | string {
    let img: { width: number; height: number; indices?: Uint8Array };
    try { img = decodePng(png); } catch (e) { return (e as Error).message; }
    const w = 16 * 8, colours = 1 << rowBytes;
    if (!img.indices || img.width !== w || img.height !== (GLYPHS / 16) * height || img.indices.some(v => v >= colours)) return `an indexed PNG of ${colours} colours, ${w}×${(GLYPHS / 16) * height}: 16 glyphs a row, each 8×${height}`;
    const out = new Uint8Array(GLYPHS * height * rowBytes);
    for (let g = 0; g < GLYPHS; g++) for (let r = 0; r < height; r++) for (let x = 0; x < 8; x++) {
        const v = img.indices[(Math.floor(g / 16) * height + r) * w + (g % 16) * 8 + x];
        for (let k = 0; k < rowBytes; k++) if ((v >> k) & 1) out[(g * height + r) * rowBytes + k] |= 0x80 >> x;
    }
    return out;
}

export const fontsCodec: Codec = {
    kind: FONTS, version: 1, path: FONTS, folder: `graphics/${FONTS}`,
    defaultName: id => FONT_NAMES[id] ?? `font_${id}`,

    // The PNG compares by its indices.
    canonical(path, bytes) {
        if (!path.endsWith('.png')) return [path, bytes];
        return [path.replace(/\.png$/, '.indices'), decodePng(bytes).indices ?? bytes];
    },

    explode(rom, name) {
        const files: Tree = new Map(), names: string[] = [], pool = [], homes = [];
        for (let id = 0; id < FONT_NAMES.length; id++) {
            const at = FONT_BANK + word(rom, FONT_TABLE + 2 * id), f = fontAt(rom, at), n = name(FONTS, id), bytes = fontBytes(f);
            names.push(n);
            files.set(`${FONTS}/${n}/font.json`, json({ height: f.height, row_bytes: f.rowBytes, widths: f.widths, what: 'height: rows a glyph; row_bytes: planes a row (8 pixels each; 2: ink and shadow); widths: pixels the cursor advances, codes $20-$9F' }));
            files.set(`${FONTS}/${n}/glyphs.png`, glyphsPng(f));
            pool.push({ start: at, end: at + bytes.length });
            homes.push({ key: `${FONTS}/${n}`, at, length: bytes.length, sha1: sha1(bytes) });
        }
        files.set(`${FONTS}/${ENUM}`, enumFile({ kind: FONTS, limit: FONT_NAMES.length, names, why: '`font` (0x9A) reads 2·id from the two-word table $8C:E6E6' }));
        return { files, pool, tables: [], homes };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(FONTS + '/') || path === `${FONTS}/${ENUM}`) continue;
            const m = /^fonts\/([^/]+)\/(font\.json|glyphs\.png)$/.exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'a font is a folder with font.json and glyphs.png; ignored');
        }
        return names;
    },

    encode(ctx, names) {
        const items: Item[] = [];
        for (const n of names) {
            const file = `${FONTS}/${n}/font.json`, png = `${FONTS}/${n}/glyphs.png`;
            if (!NAME_RE.test(n)) { ctx.findings.error('bad-name', file, '', `"${n}": snake_case, at most 80 characters`); continue; }
            let v: any;
            try { v = JSON.parse(readText(ctx.tree.get(file)!)); } catch (e) { ctx.findings.error('parse-error', file, '', (e as Error).message); continue; }
            const byte = (x: unknown) => Number.isInteger(x) && (x as number) >= 1 && (x as number) <= 0xFF;
            if (!byte(v.height) || !byte(v.row_bytes)) { ctx.findings.error('invalid-value', file, '', 'height and row_bytes: whole numbers 1-255'); continue; }
            if (!Array.isArray(v.widths) || v.widths.length !== GLYPHS || !v.widths.every((x: unknown) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 0xFF)) { ctx.findings.error('invalid-value', file, '/widths', `${GLYPHS} widths, 0-255 pixels`); continue; }
            if (!ctx.tree.has(png)) { ctx.findings.error('missing-file', png, '', 'the glyphs'); continue; }
            const glyphs = glyphsOf(ctx.tree.get(png)!, v.height, v.row_bytes);
            if (typeof glyphs === 'string') { ctx.findings.error('invalid-value', png, '', glyphs); continue; }
            const bytes = fontBytes({ height: v.height, rowBytes: v.row_bytes, glyphs, widths: v.widths });
            const home = homeOf(ctx, FONTS, n, names);
            if (!home) { ctx.findings.error('no-room', file, '', `"${n}" has no place: fonts stay where the engine loads them from (bank $C4, by fixed offsets); change an existing one`); continue; }
            if (bytes.length !== home.length) { ctx.findings.error('invalid-value', file, '', `${bytes.length} bytes; the font's place holds ${home.length} (height · row_bytes stays ${home.length - 2 - GLYPHS} / ${GLYPHS})`); continue; }
            items.push({ key: `${FONTS}/${n}`, file, bytes, rule: pinned(home.at, home.length) });
        }
        return items;
    },

    tables() { return []; },
};

// ── hud ──
export const HUD = 'hud';
/** The HUD's pieces: name, file offset, length, and what they are. */
const HUD_PARTS: { name: string; at: number; length: number; form: 'tiles2' | 'palette'; what: string }[] = [
    { name: 'gauge_tiles', at: 0x043704, length: 0x160, form: 'tiles2', what: '22 2bpp tiles of the field HUD: digits, %, /, the level marks ($8F:8710 → VRAM $1F48)' },
    { name: 'gauge_palette', at: 0x043864, length: 8, form: 'palette', what: '4 colours to CGRAM 8 ($8F:8726)' },
    { name: 'gauge_palette_2', at: 0x04386C, length: 8, form: 'palette', what: '4 colours to CGRAM 8 ($8F:873C)' },
];
const TILE_COLS = 11;

/** 2bpp tiles (16 bytes each, planes 0 and 1 interleaved per row) ↔ indices of an image TILE_COLS tiles wide. */
function tiles2Png(bytes: Uint8Array, palette: number[][]): Uint8Array {
    const n = bytes.length / 16, rows = Math.ceil(n / TILE_COLS), w = TILE_COLS * 8, h = rows * 8, px = new Uint8Array(w * h);
    for (let t = 0; t < n; t++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const m = 0x80 >> x, v = (bytes[t * 16 + 2 * y] & m ? 1 : 0) | (bytes[t * 16 + 2 * y + 1] & m ? 2 : 0);
        px[((Math.floor(t / TILE_COLS)) * 8 + y) * w + (t % TILE_COLS) * 8 + x] = v;
    }
    return new Uint8Array(encodeIndexedPng(w, h, px, palette));
}
function tiles2Of(png: Uint8Array, length: number): Uint8Array | string {
    const n = length / 16, w = TILE_COLS * 8, h = Math.ceil(n / TILE_COLS) * 8;
    let img: { width: number; height: number; indices?: Uint8Array };
    try { img = decodePng(png); } catch (e) { return (e as Error).message; }
    if (!img.indices || img.width !== w || img.height !== h || img.indices.some(v => v > 3)) return `an indexed PNG of 4 colours, ${w}×${h}: ${n} tiles, ${TILE_COLS} a row`;
    const out = new Uint8Array(length);
    for (let t = 0; t < n; t++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const v = img.indices[((Math.floor(t / TILE_COLS)) * 8 + y) * w + (t % TILE_COLS) * 8 + x];
        if (v & 1) out[t * 16 + 2 * y] |= 0x80 >> x;
        if (v & 2) out[t * 16 + 2 * y + 1] |= 0x80 >> x;
    }
    return out;
}

export const hudCodec: Codec = {
    kind: HUD, version: 1, path: HUD, folder: `graphics/${HUD}`,
    defaultName: id => HUD_PARTS[id]?.name ?? `hud_${id}`,

    canonical(path, bytes) {
        if (!path.endsWith('.png')) return [path, bytes];
        return [path.replace(/\.png$/, '.indices'), decodePng(bytes).indices ?? bytes];
    },

    explode(rom) {
        const files: Tree = new Map(), pool = [], homes = [];
        const palette = Array.from({ length: 4 }, (_, i) => rgb(word(rom, HUD_PARTS[1].at + 2 * i)));
        for (const p of HUD_PARTS) {
            const bytes = rom.slice(p.at, p.at + p.length);
            if (p.form === 'palette') {
                const colours = Array.from({ length: 4 }, (_, i) => word(bytes, 2 * i));
                if (colours.some(c => c & 0x8000)) throw new Error(`hud: ${p.name} has a colour with bit 15 set; explode would lose it`);
                files.set(`${HUD}/${p.name}.json`, json({ colours: colours.map(hexColour), what: p.what }));
            } else files.set(`${HUD}/${p.name}.png`, tiles2Png(bytes, palette));
            pool.push({ start: p.at, end: p.at + p.length });
            homes.push({ key: `${HUD}/${p.name}`, at: p.at, length: p.length, sha1: sha1(bytes) });
        }
        files.set(`${HUD}/${ENUM}`, enumFile({ kind: HUD, limit: HUD_PARTS.length, names: HUD_PARTS.map(p => p.name), why: 'each part has its fixed place and its own reader; the names are fixed' }));
        return { files, pool, tables: [], homes };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(HUD + '/') || path === `${HUD}/${ENUM}`) continue;
            const m = /^hud\/([^/]+)\.(png|json)$/.exec(path);
            if (m && HUD_PARTS.some(p => p.name === m[1])) names.add(m[1]);
            else findings.warning('unknown-file', path, '', `the HUD's parts are ${HUD_PARTS.map(p => p.name).join(', ')} (each where the engine loads it from); ignored`);
        }
        return names;
    },

    encode(ctx, names) {
        const items: Item[] = [];
        for (const p of HUD_PARTS) {
            const file = `${HUD}/${p.name}.${p.form === 'palette' ? 'json' : 'png'}`;
            if (!names.has(p.name)) { ctx.findings.error('missing-file', file, '', 'the engine loads it from a fixed place; it cannot be left out'); continue; }
            let bytes: Uint8Array | string;
            if (p.form === 'palette') {
                let v: any;
                try { v = JSON.parse(readText(ctx.tree.get(file)!)); } catch (e) { ctx.findings.error('parse-error', file, '', (e as Error).message); continue; }
                const cs = Array.isArray(v.colours) && v.colours.length === 4 ? v.colours.map(colourOf) : null;
                bytes = !cs || cs.some((c: number | null) => c === null) ? '4 colours, "#rrggbb" with each channel a multiple of 8 (5 bits a channel)' : Uint8Array.from(cs.flatMap((c: number) => [c & 0xFF, c >> 8]));
            } else bytes = tiles2Of(ctx.tree.get(file)!, p.length);
            if (typeof bytes === 'string') { ctx.findings.error('invalid-value', file, '', bytes); continue; }
            items.push({ key: `${HUD}/${p.name}`, file, bytes, rule: pinned(p.at, p.length) });
        }
        return items;
    },

    tables() { return []; },
};
