'use strict';

/**
 * emulator/cdl/bus-report.js
 *
 * bus.json / bus.md: what the recording says about moving Evermore to another
 * cartridge layout, in the order of the plan (docs/exhirom/layout-options.md):
 *   exhirom  bytes that ran / were read through $00-$3F or $40-$7D (those bytes
 *            change meaning in ExHiROM), the instructions that read them, and the
 *            control-flow edges that land there
 *   sa1      the same for every form except $C0-$FF (SA-1 maps $80-$BF LoROM-style)
 *   banks    per 64 KB file bank: bytes executed / read through each form
 *   cycles   where the master cycles went (functions, from functions.json records)
 * Only observed behaviour: a layout with no hits is "not seen", not "safe".
 */

const { hex } = require('./rom-map');
const { busSitesList, BUS } = require('./library-ext');

const FORMS = [[BUS.C, '$C0-$FF'], [BUS.B8, '$80-$BF'], [BUS.B0, '$00-$3F'], [BUS.B4, '$40-$7D']];
const bankClass = bank => (bank >= 0xC0 ? BUS.C : bank >= 0x80 ? BUS.B8 : bank >= 0x40 ? BUS.B4 : BUS.B0);
const names = bits => FORMS.filter(([b]) => bits & b).map(([, n]) => n);
const topN = (list, n) => list.slice(0, n);

function buildBusReport(lib, map, functions) {
    const banks = new Map();
    const bankOf = off => {
        const b = off >> 16;
        return banks.get(b) || banks.set(b, { exec: [0, 0, 0, 0], read: [0, 0, 0, 0] }).get(b);
    };
    const total = { exec: [0, 0, 0, 0], read: [0, 0, 0, 0], recorded: 0 };
    for (let off = 0; off < lib.romSize; off++) {
        const v = lib.bus[off];
        if (!v) continue;
        total.recorded++;
        for (let i = 0; i < 4; i++) {
            if (v & (1 << i)) { bankOf(off).exec[i]++; total.exec[i]++; }
            if (v & (16 << i)) { bankOf(off).read[i]++; total.read[i]++; }
        }
    }

    const sites = busSitesList(lib).map(s => ({
        pc: '$' + hex(s.pc, 6), form: names(s.formBit)[0], lo: '$' + hex(s.lo, 6), hi: '$' + hex(s.hi, 6),
        dma: !!(s.flags & 0x20), bit: s.formBit,
    }));
    const edges = [];
    for (const [key] of lib.edges) {
        const from = Math.floor(key / 0x1000000), to = key % 0x1000000;
        const cls = bankClass(to >>> 16);
        if (cls !== BUS.C) edges.push({ from: '$' + hex(from, 6), to: '$' + hex(to, 6), form: names(cls)[0], bit: cls });
    }
    const pick = mask => ({
        executedBytes: total.exec.reduce((n, c, i) => n + ((mask & (1 << i)) ? c : 0), 0),
        readBytes: total.read.reduce((n, c, i) => n + ((mask & (1 << i)) ? c : 0), 0),
        readSites: sites.filter(s => s.bit & mask).map(({ bit, ...r }) => r),
        edgesInto: edges.filter(e => e.bit & mask).map(({ bit, ...r }) => r),
    });
    const cycleTotal = functions.reduce((n, f) => n + (f.cycles || 0), 0);
    const byCycles = functions.filter(f => f.cycles).sort((a, b) => b.cycles - a.cycles).map(f => ({
        name: f.name, bus: '$' + hex(f.bus, 6), cycles: f.cycles, share: cycleTotal ? f.cycles / cycleTotal : 0,
        execCount: f.execCount, cyclesPerCall: f.execCount ? Math.round(f.cycles / f.execCount) : null,
        blockers: f.sa1.transitiveBlockers,
    }));
    return {
        layout: map.type,
        recordedBytes: total.recorded,
        exhirom: pick(BUS.B0 | BUS.B4),
        sa1: pick(BUS.B8 | BUS.B0 | BUS.B4),
        banks: [...banks].sort((a, b) => a[0] - b[0]).map(([b, v]) => ({ fileBank: '$' + hex(b, 2), exec: v.exec, read: v.read })),
        cycles: { total: cycleTotal, functions: byCycles },
    };
}

function busReportMd(r) {
    const L = [];
    L.push('# Bus-form report', '',
        'Which mirror of the ROM the recorded program used (`bus.cdl`, `bus-sites.bin`), and where the cycles went. Only observed behaviour: no hits means "not seen yet", not "safe". Plan: `docs/exhirom/layout-options.md`.', '',
        `ROM layout: ${r.layout}. Bytes with a recorded bus form: ${r.recordedBytes}.`, '');
    for (const [key, title, why] of [
        ['exhirom', 'ExHiROM audit', 'Bytes seen through `$00-$3F:8000+` or `$40-$7D` change meaning in ExHiROM. Zero here after a long recording means the first 4 MB can stay identical.'],
        ['sa1', 'SA-1 audit', 'SA-1 maps `$80-$BF:8000+` LoROM-style, so every use of a form other than `$C0-$FF` has to be rewritten (to `$Cx`).'],
    ]) {
        const x = r[key];
        L.push(`## ${title}`, '', why, '',
            `- executed bytes through those forms: **${x.executedBytes}**`,
            `- bytes read through those forms: **${x.readBytes}**`,
            `- instructions reading through them: **${x.readSites.length}**`,
            `- control-flow edges landing in them: **${x.edgesInto.length}**`, '');
        if (x.readSites.length) {
            L.push('| instruction | form | lowest | highest | DMA |', '|---|---|---|---|---|');
            for (const s of topN(x.readSites, 40)) L.push(`| ${s.pc} | ${s.form} | ${s.lo} | ${s.hi} | ${s.dma ? 'yes' : ''} |`);
            if (x.readSites.length > 40) L.push('', `…${x.readSites.length - 40} more in bus.json`);
            L.push('');
        }
        if (x.edgesInto.length) {
            L.push('| from | to | form |', '|---|---|---|');
            for (const e of topN(x.edgesInto, 40)) L.push(`| ${e.from} | ${e.to} | ${e.form} |`);
            if (x.edgesInto.length > 40) L.push('', `…${x.edgesInto.length - 40} more in bus.json`);
            L.push('');
        }
    }
    L.push('## Bytes per file bank and form', '', '| file bank | exec C0-FF | exec 80-BF | exec 00-3F | exec 40-7D | read C0-FF | read 80-BF | read 00-3F | read 40-7D |', '|---|---|---|---|---|---|---|---|---|');
    for (const b of r.banks) L.push(`| ${b.fileBank} | ${b.exec.join(' | ')} | ${b.read.join(' | ')} |`);
    L.push('', '## Cycles', '',
        `Total recorded master cycles in known functions: ${r.cycles.total}. Top functions (SA-1 candidates are those with few blockers):`, '',
        '| function | bus | cycles | share | per call | blockers |', '|---|---|---|---|---|---|');
    for (const f of topN(r.cycles.functions, 30)) {
        L.push(`| ${f.name} | ${f.bus} | ${f.cycles} | ${(f.share * 100).toFixed(1)}% | ${f.cyclesPerCall == null ? '' : f.cyclesPerCall} | ${f.blockers.join(', ') || 'none'} |`);
    }
    return L.join('\n') + '\n';
}

module.exports = { buildBusReport, busReportMd };
