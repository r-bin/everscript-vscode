'use strict';
// Ownership: the small, scattered assets of a Secret of Evermore ROM — map
// graphics, sprite blocks, sprite infos, animation bytecode — measured item by
// item from their pointer tables. Pure.
//
// These fill every hole the packer left (wiki ROM map §2.11), so they are
// measured exactly and merged only when closer than `GAP` and inside one 32 KB
// half: nothing in the ROM crosses a half line.

const { walkSprites } = require('../../maps');
const { disassembleScript } = require('../../maps/dist/animation-opcodes');
const { hex, bus, busToFile } = require('./util');

const GFX_TABLE = 0x2E0000, GFX_COUNT = 6688;
const GAP = 32;

/** Byte length of one $EE-table graphic: raw word copy or dual-stream ($8C:C9C0). */
function graphicLength(rom, a) {
    const info = rom[a];
    if (!(info & 0x80)) return 1 + 2 * Math.min((info & 0x7F) + 1, 64);
    let dp = a + (info & 0x7F), cp = a + 1, half = false, out = 0;
    const nibble = () => { const v = rom[cp]; let x; if (half) { x = v & 15; cp++; } else x = v >> 4; half = !half; return x; };
    while (out < 64) {
        let ind = rom[dp++];
        for (let b = 0; b < 8 && out < 64; b++, ind = (ind << 1) & 255) {
            if (!(ind & 0x80)) { dp += 2; out++; continue; }
            const m = nibble();
            if (m <= 3) out++;
            else if (m <= 8 || m >= 13) { dp++; out++; }
            else out = Math.min(64, out + m - 8 + (m === 12 ? nibble() : 0));
        }
    }
    return Math.max(dp, cp + (half ? 1 : 0)) - a;
}

/** Byte length of a compressed sprite block: a status byte per 8 words, set bit = zero word not stored. */
function spriteBlockLength(rom, a, size) {
    let src = a;
    for (let g = 0; g < (size === 16 ? 8 : 2); g++) {
        let bits = rom[src++];
        for (let b = 0; b < 8; b++, bits >>= 1) if (!(bits & 1)) src += 2;
    }
    return src - a;
}

/** Merge [s, e] spans closer than `tol`, never across a half. */
function mergeRuns(spans, tol) {
    const out = [];
    for (const r of spans.slice().sort((a, b) => a.s - b.s)) {
        const l = out[out.length - 1];
        if (l && r.s - l.e <= tol && (r.s >> 15) === ((l.e - 1) >> 15)) { l.e = Math.max(l.e, r.e); l.items.push(r); }
        else out.push({ s: r.s, e: r.e, items: [r] });
    }
    return out;
}

/** Each graphic's span, clipped to its half; `over` marks a measured length that would cross. */
function graphicSpans(rom) {
    const r24 = o => rom[o] | rom[o + 1] << 8 | rom[o + 2] << 16;
    const spans = [];
    for (let id = 0; id < GFX_COUNT; id++) {
        const a = busToFile(r24(GFX_TABLE + id * 3));
        if (a >= rom.length) continue;
        const len = graphicLength(rom, a), halfEnd = (a | 0x7FFF) + 1;
        spans.push({ s: a, e: Math.min(a + len, halfEnd), id, measured: len, over: a + len > halfEnd });
    }
    return spans;
}

/**
 * Claims for map graphics (tagged with the worlds whose rooms load them),
 * sprite infos and blocks, and animation bytecode.
 * @param worldsOfGraphic Map<graphic id, Set<world>>
 */
function assetRegions(rom, R, gfx, worldsOfGraphic) {
    R(GFX_TABLE, GFX_TABLE + GFX_COUNT * 3, '📋', 'Map graphic pointer table', `${GFX_COUNT} × 24-bit pointer; graphic id × 3, read by \`$8C:C88C\``, '', 2);
    for (const run of mergeRuns(gfx, GAP)) {
        const worlds = new Set();
        for (const g of run.items) (worldsOfGraphic.get(g.id) || []).forEach(w => worlds.add(w));
        const warn = run.items.filter(g => g.over).map(g => ` · ⚠ graphic ${g.id} measures ${g.measured} B from ${bus(g.s)}, past the end of its half; a 16-bit pointer would wrap to \`$${hex(0x80 + (g.s >> 16), 2)}:0000\` instead, so this is unverified`).join('');
        R(run.s, run.e, '🖼️', 'Map graphics (16×16 CHR)', `${run.items.length} graphics${warn}`, [...worlds].sort().join(' · '));
    }

    const infos = walkSprites(rom);
    let maxL = 0, maxS = 0;
    for (const i of infos) for (const c of i.chunks) { if (c.large) maxL = Math.max(maxL, c.block); else maxS = Math.max(maxS, c.block); }
    const infoSpans = infos.map(i => ({ s: busToFile(i.address), e: busToFile(i.address) + i.size }));
    for (const run of mergeRuns(infoSpans, 2)) R(run.s, run.e, '🧍', 'Sprite infos (chunk lists)', `${run.items.length} sprites; \`[count][offset]\` then 5-byte chunks \`[flags][x][y][block:16]\``);

    const blocks = [];
    for (const [table, n, base, size] of [[0x2C0000, maxL + 1, 0x190000, 16], [0x180000, maxS + 1, 0x110000, 8]]) {
        R(table, table + n * 3, '📋', `${size}×${size} sprite block pointers`, `${n} × 3 bytes (highest index used); data at \`$${hex(0xC0 + (base >> 16), 2)}:0000 + ptr\`, bit 23 = compressed`, '', 2);
        for (let i = 0; i < n; i++) {
            const raw = rom[table + i * 3] | rom[table + i * 3 + 1] << 8 | rom[table + i * 3 + 2] << 16;
            const a = base + (raw & 0x7FFFFF);
            if (a >= rom.length) continue;
            blocks.push({ s: a, e: a + (raw & 0x800000 ? spriteBlockLength(rom, a, size) : size * size / 2) });
        }
    }
    for (const run of mergeRuns(blocks, GAP)) R(run.s, run.e, '🧍', 'Sprite blocks (4bpp)', `${run.items.length} blocks of pixel data`);

    // Every command reachable from every animation record.
    const reached = new Uint8Array(rom.length);
    let scripts = 0;
    for (let r = 0x043E3A; r < 0x04599A; r += 4) {
        const script = 0xC00000 | (rom[r + 2] << 16) | rom[r] | rom[r + 1] << 8;
        if (busToFile(script) >= rom.length) continue;
        scripts++;
        for (const line of disassembleScript(rom, script)) {
            for (let i = 0; i < line.bytes.length; i++) reached[busToFile(line.address) + i] = 1;
        }
    }
    const spans = [];
    let start = -1;
    for (let o = 0; o <= rom.length; o++) {
        const on = o < rom.length && reached[o] && !(o >= 0x043C92 && o < 0x04599A);
        if (on && start < 0) start = o;
        if (!on && start >= 0) { spans.push({ s: start, e: o }); start = -1; }
    }
    for (const run of mergeRuns(spans, 64)) R(run.s, run.e, '🎞️', 'Animation bytecode', `reached from the ${scripts} animation records`, '', 0);
    return { spriteBlocks: blocks.length };
}

module.exports = { assetRegions, graphicSpans };
