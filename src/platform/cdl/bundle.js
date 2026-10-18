'use strict';

/**
 * platform/cdl/bundle.js
 *
 * Recording bundles: one ROM's CDL library and the replays recorded on that ROM,
 * zipped by the SNES CDL Recorder for whoever collects the data, and merged back
 * into a library by the full extension. A bundle never holds ROM bytes.
 *
 *   manifest.json   { kind, format, bundleId, installId, created, tool, rom: { sha1, sha256, title, mapType, romSize }, replays }
 *   cdl/<file>      the library files (manifest.json, rom.cdl, xrefs.bin, ...)
 *   replays/<name>  .evsmv recordings
 *
 * Importing merges every OR / min / max / union stream as usual (merging twice
 * changes nothing). The summed streams (rom-hits.bin, wram-hits.bin, rom-cycles.bin)
 * are cumulative per recorder install: a newer bundle from the same install holds
 * the older one's counts too. So the import adds only what grew since that
 * install's last imported bundle (kept in <library>/imports/<installId>/) - the
 * library then counts each install's latest totals once. The same bundle twice is
 * refused (<library>/imports/bundles.json).
 *
 * No VS Code dependency.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildZip, readZip } = require('../../../dist/platform/zip');
const { CdlLibrary, parseRecords } = require('../../../dist/platform/cdl/library');

const KIND = 'everscript-recording-bundle';
const FORMAT = 1;
const TWO32 = 0x100000000;
const SUMMED = ['rom-hits.bin', 'wram-hits.bin', 'rom-cycles.bin'];
const SAFE_NAME = /^[A-Za-z0-9 _()[\]!.,+-]+$/;

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

/** Library files worth sharing: the manifest and the data files it lists that exist. */
function libraryFiles(libDir) {
    const manifest = JSON.parse(fs.readFileSync(path.join(libDir, 'manifest.json'), 'utf8'));
    const names = ['manifest.json'].concat(manifest.files || []);
    return { manifest, files: names.filter(n => fs.existsSync(path.join(libDir, n))) };
}

/**
 * Zip one library and its replays.
 * @param {{ libDir: string, replays: {name: string, data: Buffer}[], installId: string, tool: {name: string, version: string}, when?: Date }} opts
 * @returns {{ zip: Buffer, manifest: object }}
 */
function buildBundle(opts) {
    const { manifest: lib, files } = libraryFiles(opts.libDir);
    const when = opts.when || new Date();
    const replays = (opts.replays || []).filter(r => SAFE_NAME.test(r.name));
    const manifest = {
        kind: KIND,
        format: FORMAT,
        bundleId: crypto.randomUUID(),
        installId: opts.installId || '',
        created: when.toISOString(),
        tool: opts.tool || {},
        rom: { sha1: lib.sha1, sha256: lib.sha256 || '', title: lib.title || '', mapType: lib.mapType || '', romSize: lib.romSize },
        replays: replays.map(r => r.name),
    };
    const entries = [{ name: 'manifest.json', data: JSON.stringify(manifest, null, 2) }]
        .concat(files.map(n => ({ name: 'cdl/' + n, data: fs.readFileSync(path.join(opts.libDir, n)) })))
        .concat(replays.map(r => ({ name: 'replays/' + r.name, data: r.data })));
    return { zip: buildZip(entries, when), manifest };
}

/** Unzip and check a bundle: { manifest, cdl: Map<name, Buffer>, replays: {name, data}[] }. */
function readBundle(buf) {
    const entries = readZip(buf);
    const byName = new Map(entries.map(e => [e.name, e.data]));
    const raw = byName.get('manifest.json');
    if (!raw) throw new Error('not a recording bundle: no manifest.json');
    const manifest = JSON.parse(raw.toString('utf8'));
    if (manifest.kind !== KIND) throw new Error('not a recording bundle: kind is ' + manifest.kind);
    if (manifest.format > FORMAT) throw new Error('bundle format ' + manifest.format + ' is newer than this extension (' + FORMAT + ')');
    const rom = manifest.rom || {};
    if (!/^[0-9a-f]{40}$/.test(rom.sha1 || '') || !(rom.romSize > 0)) throw new Error('bundle manifest has no ROM hash / size');
    const cdl = new Map();
    const replays = [];
    for (const e of entries) {
        const m = /^(cdl|replays)\/([^/]+)$/.exec(e.name);
        if (!m || !SAFE_NAME.test(m[2])) continue;
        if (m[1] === 'cdl') cdl.set(m[2], e.data);
        else if (/\.evsmv$/i.test(m[2])) replays.push({ name: m[2], data: e.data });
    }
    return { manifest, cdl, replays };
}

/** Totals of a summed stream: Map key -> [values...]. */
function totals(buf, name) {
    const out = new Map();
    if (name === 'wram-hits.bin') {
        const r = parseRecords(buf, 'EVWH', 5);
        if (r) for (let i = 0; i + 4 < r.length; i += 5) out.set(r[i], [r[i + 1] + r[i + 2] * TWO32, r[i + 3] + r[i + 4] * TWO32]);
    } else {
        const r = parseRecords(buf, name === 'rom-hits.bin' ? 'EVRH' : 'EVRY', 3);
        if (r) for (let i = 0; i + 2 < r.length; i += 3) out.set(r[i], [r[i + 1] + r[i + 2] * TWO32]);
    }
    return out;
}

/** What grew from `before` to `now` (both totals), as flat [key, d0, d1, ...] rows. */
function growth(now, before) {
    const rows = [];
    for (const [key, vals] of now) {
        const old = before.get(key) || [];
        const d = vals.map((v, i) => Math.max(0, v - (old[i] || 0)));
        if (d.some(x => x > 0)) rows.push(key, ...d);
    }
    return rows;
}

/** A delta for CdlLibrary.applyDelta from a bundle's library files (summed streams: growth only). */
function deltaFromFiles(cdl, snapshot, romSize) {
    const rec = (name, magic, words) => parseRecords(cdl.get(name), magic, words);
    const bytes = name => (cdl.has(name) ? new Uint8Array(cdl.get(name)) : null);
    const whole = name => { const b = bytes(name); return b ? [{ index: 0, data: b }] : []; };
    const code = bytes('wram-code.bin'), state = bytes('wram-code.state');
    const words = bytes('word-ranges.bin');
    const grown = name => growth(totals(cdl.get(name), name), totals(snapshot.get(name), name));
    const romImage = bytes('rom.cdl'), extImage = bytes('rom.ext');
    return {
        chunks: romImage || extImage ? [{ index: 0, cdl: romImage && romImage.subarray(0, romSize), ext: extImage && extImage.subarray(0, romSize) }] : [],
        wvals: whole('wram-values.bin'),
        wflags: whole('wram.flags'),
        xrefs: rec('xrefs.bin', 'EVXR', 3),
        edges: rec('edges.bin', 'EVED', 3),
        stats: rec('pcstats.bin', 'EVPS', 5),
        scriptXrefs: rec('script-xrefs.bin', 'EVSX', 3),
        romHits: grown('rom-hits.bin'),
        wramHits: grown('wram-hits.bin'),
        rets: rec('rets.bin', 'EVRT', 3),
        regs: rec('regs.bin', 'EVRG', 2),
        bases: rec('bases.bin', 'EVBS', 3),
        wcode: code && state ? [{ index: 0, code, state }] : [],
        aram: whole('aram.cdl'),
        bus: whole('bus.cdl'),
        busSites: rec('bus-sites.bin', 'EVBU', 4),
        romCycles: grown('rom-cycles.bin'),
        ioVals: whole('io-values.bin'),
        sramFlags: whole('sram-flags.bin'),
        wordRanges: words ? [0, 1].map(set => ({ set, index: 0, data: words.subarray(set * words.length / 2, (set + 1) * words.length / 2) })) : [],
    };
}

/** Replays into `dir`, skipping any whose content is already there. Returns how many were added. */
function addReplays(dir, replays) {
    fs.mkdirSync(dir, { recursive: true });
    const have = new Set();
    for (const n of fs.readdirSync(dir)) {
        if (/\.evsmv$/i.test(n)) { try { have.add(sha256(fs.readFileSync(path.join(dir, n)))); } catch (_) { /* unreadable: ignore */ } }
    }
    let added = 0;
    for (const r of replays) {
        const h = sha256(r.data);
        if (have.has(h)) continue;
        let name = r.name;
        for (let i = 2; fs.existsSync(path.join(dir, name)); i++) name = r.name.replace(/\.evsmv$/i, '') + ' (' + i + ').evsmv';
        fs.writeFileSync(path.join(dir, name), r.data);
        have.add(h);
        added++;
    }
    return added;
}

/**
 * Merge a bundle into the library root and the replay folder.
 * @returns {{ duplicate: boolean, sha1: string, title: string, libDir: string, changed: boolean, replays: number, summary?: object }}
 */
function importBundle(buf, root, replayDir) {
    const { manifest, cdl, replays } = readBundle(buf);
    const rom = manifest.rom;
    const lib = CdlLibrary.open(root, rom.sha1, rom.romSize, { title: rom.title, mapType: rom.mapType, sha256: rom.sha256 });
    const importsDir = path.join(lib.dir, 'imports');
    const seenFile = path.join(importsDir, 'bundles.json');
    let seen = [];
    try { seen = JSON.parse(fs.readFileSync(seenFile, 'utf8')); } catch (_) { seen = []; }
    const result = { duplicate: false, sha1: rom.sha1, title: rom.title, libDir: lib.dir, changed: false, replays: 0 };
    if (manifest.bundleId && seen.includes(manifest.bundleId)) return Object.assign(result, { duplicate: true });

    const install = /^[A-Za-z0-9-]+$/.test(manifest.installId || '') ? manifest.installId : 'unknown';
    const snapDir = path.join(importsDir, install);
    const snapshot = new Map();
    for (const n of SUMMED) if (fs.existsSync(path.join(snapDir, n))) snapshot.set(n, fs.readFileSync(path.join(snapDir, n)));

    result.changed = lib.applyDelta(deltaFromFiles(cdl, snapshot, rom.romSize));
    lib.flush();
    fs.mkdirSync(snapDir, { recursive: true });
    for (const n of SUMMED) if (cdl.has(n)) fs.writeFileSync(path.join(snapDir, n), cdl.get(n));
    if (manifest.bundleId) fs.writeFileSync(seenFile, JSON.stringify(seen.concat([manifest.bundleId]), null, 2));
    result.replays = addReplays(replayDir, replays);
    result.summary = lib.summary();
    return result;
}

module.exports = { buildBundle, readBundle, importBundle, KIND };
