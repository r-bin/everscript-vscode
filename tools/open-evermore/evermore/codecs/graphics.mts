// The `fonts` and `hud` kinds (docs/open-evermore/resources.md §fonts, §hud): graphics the engine uploads from bank $C4
// by fixed addresses, so each stays at its home (an item only its home fits, like projectile records); implode writes
// it there from what the files say.
//
// Facts used (knowledge routines/font_metrics_table_setup.md, opcodes/9a.md, field_hud_weapon_stamina_gauge_vram_dma_upload.md):
//   fonts    two, at $C4:0000 and $C4:0C82: `font` (opcode 0x9A) takes 2·id into the word table $8C:E6E6, the font's
//            offset in bank $C4 (the boot and two other callers pass 0). $8C:9DAF reads a header of two bytes: the
//            glyph height in rows ($0B3D) and its width in byte columns ($0B43); the glyphs follow, 128 of them (codes
//            $20-$9F: the multiplier $80 is an immediate) at height · columns bytes each ($0B3F): 1bpp, one byte a row
//            (the leftmost pixel in bit 7), the left column's rows, then the next column's (only glyphs wider than 8
//            pixels have ink there: W, m, w, the hands $80/$81); the rasterizer ($8C:A60C) draws the shadow itself;
//            then 128 widths in pixels, one byte each, which the layout reads at glyph base + 128 · stride ($8C:A938)
//            A glyph's code is the byte a string holds for it: strings.mts `toText` says how a string file writes it
//   hud      (docs/disassembly/ui/field-hud.md) the field HUD's tiles: $C4:3704, $160 bytes, 22 2bpp tiles uploaded to
//            VRAM $1F48 (BG3 tiles $3E9-$3FE) by $8F:8710; two 4-colour palettes, $C4:3864 to CGRAM 8 (BG3 palette 2)
//            and $C4:386C to CGRAM 12 (palette 3, the gauge's); the box, 3 rows of 10 BG3 map words at $8F:8000,
//            written by $8F:87FE to rows 25-27 from the widget's column ($051D Boy, $0561 Dog: `lda #imm : sta`, six
//            sites, the centred column 11 when the other box is hidden); every reader takes the column from the widget,
//            the rows are immediates. The portraits are sprites (bank $CC) whose blocks the sprite_blocks_16 kind owns
// The table $8C:E6E6 stays in _base/ while the fonts stay home; a font's name is how scripts write `font`.
import { createRequire } from 'node:module';
import type { Codec, ImplodeContext, Item, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText, sha1 } from '../../tree.mts';
import { toText } from './strings.mts';
import type { Tree } from '../../tree.mts';

const require = createRequire(import.meta.url);
const { decodePng, encodeIndexedPng, encodePng } = require('../../../../dist/platform/png');
const { renderSpriteAt } = require('../../../../dist/games/evermore/maps');
const { paletteAt } = require('../../../../dist/games/evermore/maps/character-record');
const { readDogForm, DOG_FORM_COUNT } = require('../../../../dist/games/evermore/sprites/dog-forms');

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
const FONT_TABLE = 0x0CE6E6, FONT_BANK = 0x040000, GLYPHS = 128, FIRST = 0x20, FONT_NAMES = ['default', 'outro'];
export const FONT_COUNT = FONT_NAMES.length;

interface Font { height: number; columns: number; glyphs: Uint8Array; widths: number[] }
function fontAt(rom: Uint8Array, at: number): Font {
    const height = rom[at], columns = rom[at + 1], size = height * columns * GLYPHS;
    return { height, columns, glyphs: rom.slice(at + 2, at + 2 + size), widths: [...rom.subarray(at + 2 + size, at + 2 + size + GLYPHS)] };
}
const fontBytes = (f: Font) => Uint8Array.from([f.height, f.columns, ...f.glyphs, ...f.widths]);
/** A glyph's file: its code in hex (`41.png`), the byte a string holds for it. */
const glyphFile = (code: number) => `glyphs/${code.toString(16).padStart(2, '0')}.png`;
/** What a string file writes for a code (strings.mts), and whether that byte is a control a string cannot draw. */
function spelling(code: number): { write: string; control?: true } {
    const t = toText([code]);
    return /^\[[A-Z]/.test(t) ? { write: t, control: true } : { write: t };
}
/** One glyph as a 2-colour PNG, 8·columns × height: 1bpp, one byte per row and column, the columns one after the
 *  other (byte c·height + r: the rasterizer $8C:A60C steps one byte a row); the shadow is drawn, not stored. */
const INK = [[255, 255, 255], [0, 0, 0]];
function glyphPng(f: Font, g: number): Uint8Array {
    const w = 8 * f.columns, px = new Uint8Array(w * f.height), base = g * f.height * f.columns;
    for (let c = 0; c < f.columns; c++) for (let r = 0; r < f.height; r++) for (let x = 0; x < 8; x++)
        px[r * w + 8 * c + x] = (f.glyphs[base + c * f.height + r] >> (7 - x)) & 1;
    return new Uint8Array(encodeIndexedPng(w, f.height, px, INK));
}
/** A glyph's bytes from its PNG, written into `out`; an error text when the PNG is not one. */
function glyphOf(png: Uint8Array, height: number, columns: number, g: number, out: Uint8Array): string | null {
    let img: { width: number; height: number; indices?: Uint8Array };
    try { img = decodePng(png); } catch (e) { return (e as Error).message; }
    const w = 8 * columns, base = g * height * columns;
    if (!img.indices || img.width !== w || img.height !== height || img.indices.some(v => v > 1)) return `an indexed PNG of 2 colours (0 paper, 1 ink), ${w}×${height}`;
    for (let c = 0; c < columns; c++) for (let r = 0; r < height; r++) for (let x = 0; x < 8; x++)
        if (img.indices[r * w + 8 * c + x]) out[base + c * height + r] |= 0x80 >> x;
    return null;
}
const FONT_WHAT = 'height: rows a glyph; columns: its width in bytes (8 pixels each); glyphs: codes $20-$9F, each glyphs/<code>.png (1bpp, the shadow is drawn), '
    + 'the pixels the cursor advances (width) and what a string file writes to show it (write; control: a byte the text decoder acts on, so no string draws that glyph)';

export const fontsCodec: Codec = {
    kind: FONTS, version: 2, path: FONTS, folder: `graphics/${FONTS}`,
    defaultName: id => FONT_NAMES[id] ?? `font_${id}`,

    // A PNG compares by its indices; font.json by its sizes and widths (`write`, `control`, `what` are for the reader).
    canonical(path, bytes) {
        if (path.endsWith('.png')) return [path.replace(/\.png$/, '.indices'), decodePng(bytes).indices ?? bytes];
        if (!path.endsWith('/font.json')) return [path, bytes];
        const v = JSON.parse(readText(bytes));
        return [path, json({ height: v.height, columns: v.columns, widths: Array.isArray(v.glyphs) ? v.glyphs.map((g: any) => [g?.code, g?.width]) : v.glyphs })];
    },

    explode(rom, name) {
        const files: Tree = new Map(), names: string[] = [], pool = [], homes = [];
        for (let id = 0; id < FONT_NAMES.length; id++) {
            const at = FONT_BANK + word(rom, FONT_TABLE + 2 * id), f = fontAt(rom, at), n = name(FONTS, id), bytes = fontBytes(f);
            names.push(n);
            const glyphs = [];
            for (let g = 0; g < GLYPHS; g++) {
                const code = FIRST + g;
                glyphs.push({ code: '0x' + code.toString(16), width: f.widths[g], ...spelling(code) });
                files.set(`${FONTS}/${n}/${glyphFile(code)}`, glyphPng(f, g));
            }
            files.set(`${FONTS}/${n}/font.json`, json({ height: f.height, columns: f.columns, what: FONT_WHAT, glyphs }));
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
            const m = /^fonts\/([^/]+)\/(font\.json|glyphs\/[0-9a-f]{2}\.png)$/.exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'a font is a folder with font.json and glyphs/<code>.png; ignored');
        }
        return names;
    },

    encode(ctx, names) {
        const items: Item[] = [];
        for (const n of names) {
            const file = `${FONTS}/${n}/font.json`;
            if (!NAME_RE.test(n)) { ctx.findings.error('bad-name', file, '', `"${n}": snake_case, at most 80 characters`); continue; }
            if (!ctx.tree.has(file)) { ctx.findings.error('missing-file', file, '', 'the font: height, columns, glyphs'); continue; }
            let v: any;
            try { v = JSON.parse(readText(ctx.tree.get(file)!)); } catch (e) { ctx.findings.error('parse-error', file, '', (e as Error).message); continue; }
            const byte = (x: unknown) => Number.isInteger(x) && (x as number) >= 1 && (x as number) <= 0xFF;
            if (!byte(v.height) || !byte(v.columns)) { ctx.findings.error('invalid-value', file, '', 'height and columns: whole numbers 1-255'); continue; }
            const widths: number[] = new Array(GLYPHS).fill(-1);
            for (const [i, g] of (Array.isArray(v.glyphs) ? v.glyphs : []).entries()) {
                const code = typeof g?.code === 'string' && /^0x[0-9a-f]{2}$/i.test(g.code) ? Number(g.code) - FIRST : -1;
                if (code < 0 || code >= GLYPHS || widths[code] >= 0 || !Number.isInteger(g.width) || g.width < 0 || g.width > 0xFF) { ctx.findings.error('invalid-value', file, `/glyphs/${i}`, 'a glyph: { code: "0x20"-"0x9f", once each, width: 0-255 pixels }'); continue; }
                widths[code] = g.width;
            }
            const missing = widths.findIndex(w => w < 0);
            if (missing >= 0) { ctx.findings.error('invalid-value', file, '/glyphs', `every code $20-$9F once; 0x${(FIRST + missing).toString(16)} has no width`); continue; }
            const glyphs = new Uint8Array(GLYPHS * v.height * v.columns);
            let bad = false;
            for (let g = 0; g < GLYPHS && !bad; g++) {
                const png = `${FONTS}/${n}/${glyphFile(FIRST + g)}`;
                if (!ctx.tree.has(png)) { ctx.findings.error('missing-file', png, '', 'every glyph of the font has its picture'); bad = true; continue; }
                const err = glyphOf(ctx.tree.get(png)!, v.height, v.columns, g, glyphs);
                if (err) { ctx.findings.error('invalid-value', png, '', err); bad = true; }
            }
            if (bad) continue;
            const bytes = fontBytes({ height: v.height, columns: v.columns, glyphs, widths });
            const home = homeOf(ctx, FONTS, n, names);
            if (!home) { ctx.findings.error('no-room', file, '', `"${n}" has no place: fonts stay where the engine loads them from (bank $C4, by fixed offsets); change an existing one`); continue; }
            if (bytes.length !== home.length) { ctx.findings.error('invalid-value', file, '', `${bytes.length} bytes; the font's place holds ${home.length} (height · columns stays ${(home.length - 2 - GLYPHS) / GLYPHS})`); continue; }
            items.push({ key: `${FONTS}/${n}`, file, bytes, rule: pinned(home.at, home.length) });
        }
        return items;
    },

    tables() { return []; },
};

// ── hud ──
export const HUD = 'hud';
const HUD_FILE = `${HUD}/hud.json`, TILES_AT = 0x043704, FIRST_TILE = 0x3E9, BOX_AT = 0x0F8000, BOX_W = 10, BOX_H = 3, BOX_ROW = 25;
/** The 22 tiles in VRAM order (BG3 tile $3E9 on): ours, from the pictures and where the HUD shows them. */
const TILE_NAMES = ['edge', 'corner', 'side', ...Array.from({ length: 10 }, (_, i) => `digit_${i}`), 'glyph_3f6', 'glyph_3f7', 'slash',
    'level_1_left', 'level_2_left', 'level_3_left', 'level_1_right', 'level_2_right', 'level_3_right'];
const PALETTES = [
    { name: 'box', at: 0x043864, cgram: 8, what: 'BG3 palette 2: the boxes and the HP digits' },
    { name: 'gauge', at: 0x04386C, cgram: 12, what: 'BG3 palette 3: the charge gauge' },
];
/** The widgets' columns: the file offsets of `lda #imm` operands in $8F:8710 and $8F:89xx that the engine stores. */
const COLUMNS = [
    { box: 'boy', field: 'column', sites: [0x0F875F, 0x0F8A05] },
    { box: 'boy', field: 'column_alone', sites: [0x0F89FD] },
    { box: 'dog', field: 'column', sites: [0x0F8765, 0x0F89D3] },
    { box: 'dog', field: 'column_alone', sites: [0x0F89C5] },
];
/** Columns a box may take: 10 wide in BG3's 32, and its portrait on screen (Boy at (column - 2)·8, Dog at (column + 10)·8). */
const COLUMN_RANGE: Record<string, [number, number]> = { boy: [2, 22], dog: [0, 21] };
/** The Dog's forms in the order of their entries ($8F:945D; sprites/dog-forms.ts names them). */
const DOG_FORMS = ['dog_act1', 'dog_act1_stick', 'dog_act2', 'dog_act3', 'dog_podunk', 'dog_act4'];
const BOY_PORTRAIT = 0x8F810F, BOY_PORTRAIT_BANK = 0x8F8116, PORTRAIT_PALETTE = 0xAD6B;
const HUD_WHAT = 'tiles/<name>.png: the 22 tiles in BG3 tile order ($3E9 on, _enum.json), in palette box; palettes: CGRAM entries; '
    + 'box: the frame both boxes show (BG3 map words: tile, palette 0-7, h / v flip, behind: priority 0); boxes: the column each box '
    + 'starts at (column_alone: when the other box is hidden); at: where the engine puts each part from it (BG3 column, row; the '
    + 'portrait in screen pixels); portraits: the sprites drawn beside the boxes (pixels: characters/sprite_blocks_16/<block>.png; '
    + 'portraits/<name>.png shows them)';

/** One 2bpp tile (16 bytes) ↔ an 8×8 indexed PNG. */
function tilePng(bytes: Uint8Array, palette: number[][]): Uint8Array {
    const px = new Uint8Array(64);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const m = 0x80 >> x;
        px[y * 8 + x] = (bytes[2 * y] & m ? 1 : 0) | (bytes[2 * y + 1] & m ? 2 : 0);
    }
    return new Uint8Array(encodeIndexedPng(8, 8, px, palette));
}
function tileOf(png: Uint8Array): Uint8Array | string {
    let img: { width: number; height: number; indices?: Uint8Array };
    try { img = decodePng(png); } catch (e) { return (e as Error).message; }
    if (!img.indices || img.width !== 8 || img.height !== 8 || img.indices.some(v => v > 3)) return 'an indexed PNG of 4 colours, 8×8';
    const out = new Uint8Array(16);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const v = img.indices[y * 8 + x];
        if (v & 1) out[2 * y] |= 0x80 >> x;
        if (v & 2) out[2 * y + 1] |= 0x80 >> x;
    }
    return out;
}

/** A BG3 map word as text: `<tile> <palette>` then `h`, `v`, `behind`; the tile by name, else `0x3ff`. */
function cellText(w: number, tileName: (t: number) => string | undefined): string {
    const t = w & 0x3FF;
    return [tileName(t) ?? '0x' + t.toString(16), String((w >> 10) & 7), ...(w & 0x4000 ? ['h'] : []), ...(w & 0x8000 ? ['v'] : []), ...(w & 0x2000 ? [] : ['behind'])].join(' ');
}
function cellWord(s: unknown, tileOfName: (n: string) => number | undefined): number | null {
    if (typeof s !== 'string') return null;
    const [tile, pal, ...flags] = s.trim().split(/\s+/);
    const t = /^0x[0-9a-f]{1,3}$/i.test(tile) ? Number(tile) : tileOfName(tile);
    if (t === undefined || t > 0x3FF || !/^[0-7]$/.test(pal ?? '') || flags.some(f => !['h', 'v', 'behind'].includes(f)) || new Set(flags).size !== flags.length) return null;
    return t | (Number(pal) << 10) | (flags.includes('h') ? 0x4000 : 0) | (flags.includes('v') ? 0x8000 : 0) | (flags.includes('behind') ? 0 : 0x2000);
}
const isImmediate = (rom: Uint8Array, at: number) => rom[at - 1] === 0xA9 && rom[at + 1] === 0x00 && (rom[at + 2] === 0x8D);

/** Where the engine draws each part of a box from its column (field-hud.md; the rows are immediates). */
function placement(box: string, column: number) {
    return {
        box: [column, BOX_ROW], hp: [column + 2, BOX_ROW], gauge: [column + 1, BOX_ROW + 1],
        portrait: [box === 'boy' ? (column - 2) * 8 : (column + 10) * 8, BOX_ROW * 8 + 1],
    };
}

export const hudCodec: Codec = {
    kind: HUD, version: 2, path: HUD, folder: `graphics/${HUD}`,
    defaultName: id => TILE_NAMES[id] ?? `tile_${(FIRST_TILE + id).toString(16)}`,

    // A tile compares by its indices; hud.json by what implode reads (`at`, `portraits`, `what` are derived); the
    // portrait previews are for the reader.
    canonical(path, bytes) {
        if (path.startsWith(`${HUD}/portraits/`)) return null;
        if (path.endsWith('.png')) return [path.replace(/\.png$/, '.indices'), decodePng(bytes).indices ?? bytes];
        if (path !== HUD_FILE) return [path, bytes];
        const v = JSON.parse(readText(bytes)), boxes: Record<string, unknown> = {};
        for (const [k, b] of Object.entries(v.boxes ?? {}) as [string, any][]) boxes[k] = { column: b?.column, column_alone: b?.column_alone };
        return [path, json({ palettes: v.palettes, box: v.box, boxes })];
    },

    explode(rom, name) {
        const files: Tree = new Map(), pool = [], tables = [], homes = [];
        const colours = (at: number) => Array.from({ length: 4 }, (_, i) => word(rom, at + 2 * i));
        const palettes: Record<string, unknown> = {};
        for (const p of PALETTES) {
            const cs = colours(p.at);
            if (cs.some(c => c & 0x8000)) throw new Error(`hud: palette ${p.name} has a colour with bit 15 set; explode would lose it`);
            palettes[p.name] = { cgram: p.cgram, colours: cs.map(hexColour), what: p.what };
            pool.push({ start: p.at, end: p.at + 8 });
            homes.push({ key: `${HUD}/palette_${p.name}`, at: p.at, length: 8, sha1: sha1(rom.slice(p.at, p.at + 8)) });
        }
        const look = colours(PALETTES[0].at).map(rgb), names: string[] = [];
        for (let i = 0; i < TILE_NAMES.length; i++) {
            const n = name(HUD, i);
            names.push(n);
            files.set(`${HUD}/tiles/${n}.png`, tilePng(rom.subarray(TILES_AT + 16 * i, TILES_AT + 16 * i + 16), look));
        }
        pool.push({ start: TILES_AT, end: TILES_AT + 16 * TILE_NAMES.length });
        homes.push({ key: `${HUD}/tiles`, at: TILES_AT, length: 16 * TILE_NAMES.length, sha1: sha1(rom.slice(TILES_AT, TILES_AT + 16 * TILE_NAMES.length)) });
        const tileName = (t: number) => t >= FIRST_TILE && t < FIRST_TILE + names.length ? names[t - FIRST_TILE] : undefined;
        const box = Array.from({ length: BOX_H }, (_, r) => Array.from({ length: BOX_W }, (_, c) => cellText(word(rom, BOX_AT + 2 * (r * BOX_W + c)), tileName)));
        pool.push({ start: BOX_AT, end: BOX_AT + 2 * BOX_W * BOX_H });
        homes.push({ key: `${HUD}/box`, at: BOX_AT, length: 2 * BOX_W * BOX_H, sha1: sha1(rom.slice(BOX_AT, BOX_AT + 2 * BOX_W * BOX_H)) });
        const boxes: Record<string, any> = {};
        for (const c of COLUMNS) {
            const vs = c.sites.map(at => { if (!isImmediate(rom, at)) throw new Error(`hud: $${(0xC00000 | at).toString(16)} is not the lda #imm : sta this codec knows; another release?`); return rom[at]; });
            if (vs.some(v => v !== vs[0])) throw new Error(`hud: the ${c.box} box's ${c.field} differs between its sites; explode would lose one`);
            (boxes[c.box] ??= {})[c.field] = vs[0];
            for (const at of c.sites) tables.push({ start: at, end: at + 1 });
        }
        for (const [k, b] of Object.entries(boxes)) Object.assign(b, { at: placement(k, b.column), at_alone: placement(k, b.column_alone) });
        // The portraits: the Boy's from the HUD setup's operands, the Dog's from each form (sprites/dog-forms.ts).
        const portraits: Record<string, unknown> = {}, block16 = (sprite: number) => { const o = (sprite & 0x3FFFFF) + 5; return name('sprite_blocks_16', word(rom, o)); };
        const portrait = (n: string, sprite: number, paletteAddr: number) => {
            portraits[n] = { sprite: '$' + (sprite >> 16).toString(16).toUpperCase() + ':' + (sprite & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'), block: block16(sprite) };
            const img = renderSpriteAt(rom, sprite, paletteAt(rom, paletteAddr));
            if (img) files.set(`${HUD}/portraits/${n}.png`, new Uint8Array(encodePng(img.width, img.height, img.data)));
        };
        portrait('boy', word(rom, BOY_PORTRAIT & 0x3FFFFF) | (rom[BOY_PORTRAIT_BANK & 0x3FFFFF] << 16), PORTRAIT_PALETTE);
        for (let i = 0; i < DOG_FORM_COUNT; i++) { const f = readDogForm(rom, i); portrait(DOG_FORMS[i] ?? `dog_form_${i + 1}`, f.portrait, f.paletteAddr); }
        files.set(HUD_FILE, json({ what: HUD_WHAT, palettes, box, boxes, portraits }));
        files.set(`${HUD}/${ENUM}`, enumFile({ kind: HUD, limit: TILE_NAMES.length, names, why: '$8F:8710 uploads the 22 tiles in this order to BG3 tiles $3E9-$3FE; the box and the code name them by that number' }));
        return { files, pool, tables, homes };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(HUD + '/') || path === `${HUD}/${ENUM}` || path === HUD_FILE || /^hud\/portraits\/[^/]+\.png$/.test(path)) continue;
            const m = /^hud\/tiles\/([^/]+)\.png$/.exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'the HUD is hud.json, tiles/<name>.png and portraits/ (a preview); ignored');
        }
        return names;
    },

    encode(ctx, names) {
        const items: Item[] = [], ids = ctx.ids.get(HUD) ?? new Map<string, number>(), f = ctx.findings;
        const tiles = new Uint8Array(16 * TILE_NAMES.length);
        let ok = true;
        for (const n of names) {
            const file = `${HUD}/tiles/${n}.png`, id = ids.get(n);
            if (id === undefined || id >= TILE_NAMES.length) { f.error('invalid-value', file, '', `the HUD has ${TILE_NAMES.length} tiles, in _enum.json's order; this one has no place there`); ok = false; continue; }
            const b = tileOf(ctx.tree.get(file)!);
            if (typeof b === 'string') { f.error('invalid-value', file, '', b); ok = false; continue; }
            tiles.set(b, 16 * id);
        }
        if ([...ids.values()].filter(id => id < TILE_NAMES.length).length !== TILE_NAMES.length) { f.error('missing-file', `${HUD}/${ENUM}`, '', `all ${TILE_NAMES.length} tiles: the engine uploads them as one block`); ok = false; }
        if (ok) items.push({ key: `${HUD}/tiles`, file: `${HUD}/${ENUM}`, bytes: tiles, rule: pinned(TILES_AT, tiles.length) });
        if (!ctx.tree.has(HUD_FILE)) { f.error('missing-file', HUD_FILE, '', 'the palettes, the box and the columns'); return items; }
        let v: any;
        try { v = JSON.parse(readText(ctx.tree.get(HUD_FILE)!)); } catch (e) { f.error('parse-error', HUD_FILE, '', (e as Error).message); return items; }
        for (const p of PALETTES) {
            const cs = Array.isArray(v.palettes?.[p.name]?.colours) && v.palettes[p.name].colours.length === 4 ? v.palettes[p.name].colours.map(colourOf) : null;
            if (!cs || cs.some((c: number | null) => c === null)) { f.error('invalid-value', HUD_FILE, `/palettes/${p.name}`, '4 colours, "#rrggbb" with each channel a multiple of 8 (5 bits a channel)'); continue; }
            items.push({ key: `${HUD}/palette_${p.name}`, file: HUD_FILE, bytes: Uint8Array.from(cs.flatMap((c: number) => [c & 0xFF, c >> 8])), rule: pinned(p.at, 8) });
        }
        const rows = Array.isArray(v.box) && v.box.length === BOX_H && v.box.every((r: unknown) => Array.isArray(r) && r.length === BOX_W) ? v.box as unknown[][] : null;
        if (!rows) f.error('invalid-value', HUD_FILE, '/box', `${BOX_H} rows of ${BOX_W} cells`);
        else {
            const bytes = new Uint8Array(2 * BOX_W * BOX_H), tileId = (n: string) => { const id = ids.get(n); return id === undefined ? undefined : FIRST_TILE + id; };
            let good = true;
            rows.forEach((r, y) => r.forEach((cell, x) => {
                const w = cellWord(cell, tileId);
                if (w === null) { f.error('invalid-value', HUD_FILE, `/box/${y}/${x}`, `"${cell}": "<tile> <palette 0-7>" then h, v, behind; a tile by its name or 0x000-0x3ff`); good = false; }
                else bytes.set([w & 0xFF, w >> 8], 2 * (y * BOX_W + x));
            }));
            if (good) items.push({ key: `${HUD}/box`, file: HUD_FILE, bytes, rule: pinned(BOX_AT, bytes.length) });
        }
        for (const c of COLUMNS) {
            const x = v.boxes?.[c.box]?.[c.field], [lo, hi] = COLUMN_RANGE[c.box];
            if (!Number.isInteger(x) || x < lo || x > hi) f.error('invalid-value', HUD_FILE, `/boxes/${c.box}/${c.field}`, `a BG3 column ${lo}-${hi} (the box is ${BOX_W} wide and its portrait stays on screen)`);
        }
        return items;
    },

    tables(ctx) {
        const writes: Write[] = [];
        let v: any;
        try { v = JSON.parse(readText(ctx.tree.get(HUD_FILE) ?? new Uint8Array())); } catch { return writes; }
        for (const c of COLUMNS) {
            const x = v.boxes?.[c.box]?.[c.field];
            if (Number.isInteger(x) && x >= 0 && x <= 0xFF) for (const at of c.sites) writes.push({ at, bytes: Uint8Array.of(x), file: HUD_FILE });
        }
        return writes;
    },
};
