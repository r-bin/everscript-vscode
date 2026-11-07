// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';

// REPORT.md + report.json for the recomp export: what is done, what blocks a recomp, what to work on.

const fs = require('fs');
const path = require('path');

const CDL_CODE = 0x01, CDL_DATA = 0x02;
const pct = (a, b) => (b ? (100 * a / b) : 0);
const p1 = x => x.toFixed(1) + ' %';

function metrics({ rom, inputs, exp }) {
    const { lib, names, assets } = inputs;
    let code = 0, data = 0, touched = 0;
    for (let i = 0; i < rom.length; i++) {
        const c = lib.cdl[i];
        if (c & CDL_CODE) code++; else if (c & CDL_DATA) data++;
        if (c || lib.ext[i]) touched++;
    }
    const known = new Uint8Array(rom.length);
    for (let i = 0; i < rom.length; i++) if (lib.cdl[i] || lib.ext[i]) known[i] = 1;
    for (const a of assets) known.fill(1, a.start, Math.min(a.end, rom.length));
    for (const r of exp.regions || []) known.fill(1, r.start, r.end);
    let knownBytes = 0;
    for (const v of known) knownBytes += v;

    const entries = exp.index.entries;
    const named = entries.filter(off => names.names.has(off)).length;
    const described = entries.filter(off => exp.index.noteOf(off)).length;
    let wramUsed = 0, wramNamed = 0;
    const namedRam = new Uint8Array(0x20000);
    for (const [addr, w] of names.wramNames) namedRam.fill(1, addr, Math.min(addr + (w.size || 1), 0x20000));
    for (let a = 0; a < 0x20000; a++) if (lib.wflags[a]) { wramUsed++; if (namedRam[a]) wramNamed++; }
    return {
        romBytes: rom.length, code, data, touched, knownBytes,
        functions: entries.length, named, described,
        codeLines: exp.codeLines, commentedLines: exp.commentedLines,
        wramUsed, wramNamed, wramNames: names.wramNames.size,
        knownRegions: (exp.regions || []).length, assetRegions: assets.length,
        mesen: exp.mesen,
    };
}

function todo(m, rebuild, recomp, recorded) {
    const t = [];
    const add = (prio, area, text) => t.push({ prio, area, text });
    if (!recorded) add(0, 'CDL', 'No CDL library for this ROM: record a session in the emulator (CDL tab) first.');
    if (!rebuild.identical) add(0, 'Asar', rebuild.reason || ('Rebuild differs from the ROM at file offset $' + (rebuild.firstDiff >>> 0).toString(16).toUpperCase() + ' (asar.log, asar/build/out.sfc).'));
    if (recomp && !recomp.skipped) add(1, 'Recomp', 'Import the seeds, bound C and annotations into the recomp (its node tools/import.mts), then its tools/regen.sh and build.');
    if (recomp && !recomp.skipped) add(1, 'Parity', 'Check the build against MesenCE on the sync replays (SecretOfEvermoreRecomp tools/compare/compare.mts --backend mesen,recomp) and its native share (tools/compare/probes/tier-stats.mts); docs/progress.md in the recomp repository.');
    const cov = pct(m.code + m.data, m.romBytes);
    if (cov < 50) add(1, 'CDL', `Coverage ${p1(cov)} of the ROM recorded: play more rooms, menus, bosses (or scripted headless runs).`);
    const nm = pct(m.named, m.functions);
    if (nm < 80) add(2, 'Names', `${m.named}/${m.functions} recorded functions named (${p1(nm)}): run a re-curator pass.`);
    const cm = pct(m.commentedLines, m.codeLines);
    if (cm < 50) add(3, 'Comments', `${p1(cm)} of instruction lines carry a comment.`);
    const ds = pct(m.described, m.functions);
    if (ds < 50) add(3, 'Comments', `${p1(ds)} of functions have a curated description.`);
    const kn = pct(m.knownBytes, m.romBytes);
    if (kn < 95) add(2, 'Assets', `${p1(kn)} of ROM bytes are code, recorded data or a known asset: decode the unknown ROM-tab regions.`);
    const wr = pct(m.wramNamed, m.wramUsed);
    if (wr < 80) add(2, 'RAM map', `${m.wramNamed}/${m.wramUsed} accessed WRAM bytes have a name (${p1(wr)}).`);
    return t.sort((a, b) => a.prio - b.prio);
}

function writeReport({ out, romPath, sha1, rom, inputs, exp, rebuild, recomp, log }) {
    const m = metrics({ rom, inputs, exp });
    const tasks = todo(m, rebuild, recomp, inputs.recorded);
    const status = (ok, extra = '') => (ok ? '✅' : '❌') + (extra ? ' ' + extra : '');
    const lines = [
        '# Recomp export report', '',
        `Generated ${new Date().toISOString()} by \`npm run recomp\`. ROM: \`${path.basename(romPath)}\` (SHA-1 \`${sha1}\`).`,
        `CDL library: \`${inputs.libDir}\`${inputs.recorded ? '' : ' (empty)'}.`, '',
        '## Status', '',
        '| Step | Result |', '|---|---|',
        `| Asar rebuild | ${status(rebuild.identical, rebuild.identical ? 'byte-identical' : (rebuild.reason || 'differs at $' + (rebuild.firstDiff >>> 0).toString(16)))} |`,
        `| Recomp repository (read only) | ${recomp.repo ? '`' + recomp.repo + '`: exclusions from `' + recomp.exclusions + '`, ' + recomp.nodes + ' entries of its last generation' : '— not read (--no-recomp)'} |`, '',
        '## Measures', '',
        '| Measure | Value |', '|---|---|',
        `| ROM recorded by the CDL (code + data) | ${p1(pct(m.code + m.data, m.romBytes))} (${m.code} code, ${m.data} data bytes) |`,
        `| ROM known (CDL ∪ known regions ∪ ROM-tab assets) | ${p1(pct(m.knownBytes, m.romBytes))} |`,
        `| Recorded functions named | ${m.named} / ${m.functions} (${p1(pct(m.named, m.functions))}) |`,
        `| Functions with a curated description | ${m.described} / ${m.functions} (${p1(pct(m.described, m.functions))}) |`,
        `| Instruction lines with a comment | ${m.commentedLines} / ${m.codeLines} (${p1(pct(m.commentedLines, m.codeLines))}) |`,
        `| Accessed WRAM bytes with a name | ${m.wramNamed} / ${m.wramUsed} (${p1(pct(m.wramNamed, m.wramUsed))}) |`,
        `| Known regions / ROM-tab asset regions | ${m.knownRegions} / ${m.assetRegions} |`,
        `| Mesen2 | ${m.mesen.labels} labels, ${m.mesen.comments} comments, +${m.mesen.assetBytes} asset bytes in rom.cdl |`, '',
        '## To do (highest priority first)', '',
        ...tasks.map(t => `- **P${t.prio} ${t.area}:** ${t.text}`), '',
        '## Outputs', '',
        '- `asar/` — Asar project (`main.asm`, `banks/`, …), `asar/build/out.sfc` + `out.sym` (WLA symbols) + `out.cdl`',
        '- `asar/mesen/labels.mlb`, `asar/mesen/rom.cdl` — load in Mesen2 (Debugger → Import labels / CDL)',
        '- `asar/recomp/cfg/` — snesrecomp seeds, `asar/recomp/annotations.tsv` — names for the generated C (the recomp\'s `tools/import.mts` copies both)',
        '- `asar.log`, `report.json`', '',
        '## Steps', '',
        ...log.map(s => `- ${s.name}: ${(s.ms / 1000).toFixed(1)} s`), '',
    ];
    const file = path.join(out, 'REPORT.md');
    fs.writeFileSync(file, lines.join('\n'));
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ sha1, metrics: m, rebuild, recomp, todo: tasks }, null, 1) + '\n');
    const summary = [
        `Asar rebuild: ${rebuild.identical ? 'byte-identical' : 'NOT identical'}`,
        `CDL ${p1(pct(m.code + m.data, m.romBytes))} | known ${p1(pct(m.knownBytes, m.romBytes))} | named ${m.named}/${m.functions} | comments ${p1(pct(m.commentedLines, m.codeLines))} | WRAM named ${p1(pct(m.wramNamed, m.wramUsed))}`,
        'Top to-do: ' + (tasks[0] ? tasks[0].text : 'none'),
    ].join('\n');
    return { file, summary, metrics: m, todo: tasks };
}

module.exports = { writeReport };
