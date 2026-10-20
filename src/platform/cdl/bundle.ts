/**
 * platform/cdl/bundle.ts
 *
 * Recording bundles: one ROM's CDL library and the replays recorded on that ROM,
 * zipped by the SNES CDL Recorder for whoever collects the data, and merged back
 * into a library by the full extension. A bundle never holds ROM bytes.
 *
 *   manifest.json   { kind, format, bundleId, installId, created, tool, rom: { sha1, sha256, title, mapType, romSize }, replays }
 *   cdl/<file>      the library files (manifest.json, rom.cdl, xrefs.bin, ...)
 *   replays/<name>  .evsmv recordings
 *
 *   counts/<installId>/<file>   (v0.319.0) the summed streams split by the install that recorded them
 *
 * Importing merges every OR / min / max / union stream as usual (merging twice
 * changes nothing). The summed streams (rom-hits.bin, wram-hits.bin, rom-cycles.bin)
 * are kept as one counter per install, merged by per-key maximum (a G-counter):
 *   - <library>/imports/<installId>/<file> holds the latest totals of each other install;
 *   - this install's own counts are the library's total minus all of those;
 *   - a bundle carries every counter it knows (its own under counts/<its id>/, the ones it
 *     imported under theirs), so it can be forwarded (A -> B -> C counts A once);
 *   - an import raises each counter to the bundle's value per key and adds what grew. Its own
 *     counter (selfId) is compared with its own counts: importing your own export changes
 *     nothing, and importing it into an empty (deleted) library brings the counts back.
 * A bundle without counts/ (before v0.319.0) is the exporter's install counter, as before.
 * The same bundle twice is refused (<library>/imports/bundles.json).
 *
 * No VS Code dependency.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { buildZip, readZip } from '../zip';
import { CdlLibrary, parseRecords, packRecords } from './library';

type Replay = { name: string; data: Buffer };
type Totals = Map<number, number[]>;
interface BundleManifest {
    kind: string; format: number; bundleId?: string; installId?: string; created: string; tool: object;
    rom: { sha1: string; sha256?: string; title?: string; mapType?: string; romSize: number }; replays: string[];
}

const KIND = 'everscript-recording-bundle';
const FORMAT = 1;
const TWO32 = 0x100000000;
const SUMMED = ['rom-hits.bin', 'wram-hits.bin', 'rom-cycles.bin'];
const SAFE_NAME = /^[A-Za-z0-9 _()[\]!.,+-]+$/;
const INSTALL = /^[A-Za-z0-9-]+$/;
/** install id -> summed stream file -> its raw file. */
type Counters = Map<string, Map<string, Buffer>>;

const sha256 = (buf: Uint8Array): string => crypto.createHash('sha256').update(buf).digest('hex');

/** Library files worth sharing: the manifest and the data files it lists that exist. */
function libraryFiles(libDir: string) {
    const manifest = JSON.parse(fs.readFileSync(path.join(libDir, 'manifest.json'), 'utf8'));
    const names = ['manifest.json'].concat(manifest.files || []);
    return { manifest, files: names.filter(n => fs.existsSync(path.join(libDir, n))) };
}

/**
 * Zip one library and its replays.
 * @param {{ libDir: string, replays: {name: string, data: Buffer}[], installId: string, tool: {name: string, version: string}, when?: Date }} opts
 * @returns {{ zip: Buffer, manifest: object }}
 */
function buildBundle(opts: { libDir: string; replays: Replay[]; installId: string; tool: { name: string; version: string }; when?: Date }): { zip: Buffer; manifest: BundleManifest } {
    const { manifest: lib, files } = libraryFiles(opts.libDir);
    const when = opts.when || new Date();
    const replays = (opts.replays || []).filter(r => SAFE_NAME.test(r.name));
    const manifest: BundleManifest = {
        kind: KIND,
        format: FORMAT,
        bundleId: crypto.randomUUID(),
        installId: opts.installId || '',
        created: when.toISOString(),
        tool: opts.tool || {},
        rom: { sha1: lib.sha1, sha256: lib.sha256 || '', title: lib.title || '', mapType: lib.mapType || '', romSize: lib.romSize },
        replays: replays.map(r => r.name),
    };
    const entries: { name: string; data: string | Uint8Array }[] = [
        { name: 'manifest.json', data: JSON.stringify(manifest, null, 2) },
        ...files.map(n => ({ name: 'cdl/' + n, data: fs.readFileSync(path.join(opts.libDir, n)) })),
        ...replays.map(r => ({ name: 'replays/' + r.name, data: r.data })),
    ];
    for (const [id, byFile] of libraryCounters(opts.libDir, INSTALL.test(opts.installId || '') ? opts.installId : 'unknown')) {
        for (const [f, data] of byFile) entries.push({ name: 'counts/' + id + '/' + f, data });
    }
    return { zip: buildZip(entries, when), manifest };
}

/** Unzip and check a bundle: { manifest, cdl: Map<name, Buffer>, replays: {name, data}[] }. */
function readBundle(buf: Buffer) {
    const entries = readZip(buf);
    const byName = new Map(entries.map(e => [e.name, e.data]));
    const raw = byName.get('manifest.json');
    if (!raw) throw new Error('not a recording bundle: no manifest.json');
    const manifest = JSON.parse(raw.toString('utf8'));
    if (manifest.kind !== KIND) throw new Error('not a recording bundle: kind is ' + manifest.kind);
    if (manifest.format > FORMAT) throw new Error('bundle format ' + manifest.format + ' is newer than this extension (' + FORMAT + ')');
    const rom = manifest.rom || {};
    if (!/^[0-9a-f]{40}$/.test(rom.sha1 || '') || !(rom.romSize > 0)) throw new Error('bundle manifest has no ROM hash / size');
    const cdl = new Map<string, Buffer>();
    const replays: Replay[] = [];
    const counters: Counters = new Map();
    for (const e of entries) {
        const c = /^counts\/([^/]+)\/([^/]+)$/.exec(e.name);
        if (c && INSTALL.test(c[1]) && SUMMED.includes(c[2])) {
            if (!counters.has(c[1])) counters.set(c[1], new Map());
            counters.get(c[1])!.set(c[2], e.data);
            continue;
        }
        const m = /^(cdl|replays)\/([^/]+)$/.exec(e.name);
        if (!m || !SAFE_NAME.test(m[2])) continue;
        if (m[1] === 'cdl') cdl.set(m[2], e.data);
        else if (/\.evsmv$/i.test(m[2])) replays.push({ name: m[2], data: e.data });
    }
    return { manifest, cdl, replays, counters };
}

/** Totals of a summed stream: Map key -> [values...]. */
function totals(buf: Buffer | undefined, name: string): Totals {
    const out: Totals = new Map();
    if (name === 'wram-hits.bin') {
        const r = parseRecords(buf, 'EVWH', 5);
        if (r) for (let i = 0; i + 4 < r.length; i += 5) out.set(r[i], [r[i + 1] + r[i + 2] * TWO32, r[i + 3] + r[i + 4] * TWO32]);
    } else {
        const r = parseRecords(buf, name === 'rom-hits.bin' ? 'EVRH' : 'EVRY', 3);
        if (r) for (let i = 0; i + 2 < r.length; i += 3) out.set(r[i], [r[i + 1] + r[i + 2] * TWO32]);
    }
    return out;
}

/** Per key and value: f(a, b) over the keys of both (missing = 0); keys whose values are all 0 are dropped. */
function combine(a: Totals, b: Totals, f: (x: number, y: number) => number): Totals {
    const out: Totals = new Map();
    for (const key of new Set([...a.keys(), ...b.keys()])) {
        const x = a.get(key) || [], y = b.get(key) || [];
        const v = Array.from({ length: Math.max(x.length, y.length) }, (_, i) => f(x[i] || 0, y[i] || 0));
        if (v.some(n => n > 0)) out.set(key, v);
    }
    return out;
}
const sumOf = (a: Totals, b: Totals) => combine(a, b, (x, y) => x + y);
const minus = (a: Totals, b: Totals) => combine(a, b, (x, y) => Math.max(0, x - y));
const maxOf = (a: Totals, b: Totals) => combine(a, b, Math.max);

/** Totals back into a summed stream file (keys ascending, 53-bit values as lo / hi words). */
function packTotals(name: string, t: Totals): Buffer {
    const values = name === 'wram-hits.bin' ? 2 : 1;
    const rows = [...t.keys()].sort((x, y) => x - y).map(key => {
        const v = t.get(key)!, row = [key];
        for (let i = 0; i < values; i++) row.push((v[i] || 0) % TWO32, Math.floor((v[i] || 0) / TWO32));
        return row;
    });
    return packRecords(name === 'wram-hits.bin' ? 'EVWH' : name === 'rom-hits.bin' ? 'EVRH' : 'EVRY', rows, 1 + values * 2);
}

/** Flat [key, d0, d1, ...] rows for CdlLibrary.applyDelta. */
function rows(t: Totals): number[] {
    const out: number[] = [];
    for (const [key, v] of t) out.push(key, ...v);
    return out;
}

/** The other installs' counters a library imported (<library>/imports/<id>/). */
function importedCounters(libDir: string): Counters {
    const out: Counters = new Map();
    const dir = path.join(libDir, 'imports');
    if (!fs.existsSync(dir)) return out;
    for (const id of fs.readdirSync(dir).filter(n => INSTALL.test(n))) {
        const byFile = new Map<string, Buffer>();
        for (const f of SUMMED) if (fs.existsSync(path.join(dir, id, f))) byFile.set(f, fs.readFileSync(path.join(dir, id, f)));
        if (byFile.size) out.set(id, byFile);
    }
    return out;
}

/** This install's own counts of one summed stream: the library's total minus the imported counters (except selfId's). */
function ownTotals(libDir: string, f: string, imported: Counters, selfId: string): Totals {
    const file = path.join(libDir, f);
    let own = totals(fs.existsSync(file) ? fs.readFileSync(file) : undefined, f);
    for (const [id, byFile] of imported) if (id !== selfId) own = minus(own, totals(byFile.get(f), f));
    return own;
}

/** Every counter a library holds: its own under selfId, the imported ones under theirs. */
function libraryCounters(libDir: string, selfId: string): Counters {
    const imported = importedCounters(libDir);
    const out: Counters = new Map();
    for (const [id, byFile] of imported) if (id !== selfId) out.set(id, byFile);
    out.set(selfId, new Map(SUMMED.filter(f => fs.existsSync(path.join(libDir, f))).map(f => [f, packTotals(f, ownTotals(libDir, f, imported, selfId))])));
    return out;
}

/** A delta for CdlLibrary.applyDelta from a bundle's library files; `grown` = the summed streams' growth. */
function deltaFromFiles(cdl: Map<string, Buffer>, grownBy: Map<string, Totals>, romSize: number) {
    const rec = (name: string, magic: string, words: number) => parseRecords(cdl.get(name), magic, words);
    const bytes = (name: string): Uint8Array | null => (cdl.has(name) ? new Uint8Array(cdl.get(name)!) : null);
    const whole = (name: string) => { const b = bytes(name); return b ? [{ index: 0, data: b }] : []; };
    const code = bytes('wram-code.bin'), state = bytes('wram-code.state');
    const words = bytes('word-ranges.bin');
    const grown = (name: string) => rows(grownBy.get(name) || new Map());
    const romImage = bytes('rom.cdl'), extImage = bytes('rom.ext');
    return {
        chunks: romImage || extImage ? [{ index: 0, cdl: romImage?.subarray(0, romSize), ext: extImage?.subarray(0, romSize) }] : [],
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
function addReplays(dir: string, replays: Replay[]): number {
    fs.mkdirSync(dir, { recursive: true });
    const have = new Set<string>();
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
function importBundle(buf: Buffer, root: string, replayDir: string, selfId = ''): { duplicate: boolean; sha1: string; title: string; libDir: string; changed: boolean; replays: number; summary?: object } {
    const { manifest, cdl, replays, counters } = readBundle(buf);
    const rom = manifest.rom;
    const lib = CdlLibrary.open(root, rom.sha1, rom.romSize, { title: rom.title, mapType: rom.mapType, sha256: rom.sha256 });
    const importsDir = path.join(lib.dir, 'imports');
    const seenFile = path.join(importsDir, 'bundles.json');
    let seen: string[] = [];
    try { seen = JSON.parse(fs.readFileSync(seenFile, 'utf8')); } catch (_) { seen = []; }
    const result: { duplicate: boolean; sha1: string; title: string; libDir: string; changed: boolean; replays: number; summary?: object } = { duplicate: false, sha1: rom.sha1, title: rom.title, libDir: lib.dir, changed: false, replays: 0 };
    if (manifest.bundleId && seen.includes(manifest.bundleId)) return Object.assign(result, { duplicate: true });

    // A bundle from before counters/: its summed files are the exporter's install counter.
    if (!counters.size) {
        const install = INSTALL.test(manifest.installId || '') ? manifest.installId : 'unknown';
        counters.set(install, new Map(SUMMED.filter(f => cdl.has(f)).map(f => [f, cdl.get(f)!])));
    }
    const imported = importedCounters(lib.dir);
    const grownBy = new Map<string, Totals>();
    const raised: { id: string; f: string; t: Totals }[] = [];
    for (const [id, byFile] of counters) {
        for (const [f, data] of byFile) {
            const theirs = totals(data, f);
            const mine = id === selfId ? ownTotals(lib.dir, f, imported, selfId) : totals(imported.get(id)?.get(f), f);
            grownBy.set(f, sumOf(grownBy.get(f) || new Map(), minus(theirs, mine)));
            if (id !== selfId) raised.push({ id, f, t: maxOf(mine, theirs) });
        }
    }

    result.changed = lib.applyDelta(deltaFromFiles(cdl, grownBy, rom.romSize));
    lib.flush();
    for (const { id, f, t } of raised) {
        fs.mkdirSync(path.join(importsDir, id), { recursive: true });
        fs.writeFileSync(path.join(importsDir, id, f), packTotals(f, t));
    }
    fs.mkdirSync(importsDir, { recursive: true });
    if (manifest.bundleId) fs.writeFileSync(seenFile, JSON.stringify(seen.concat([manifest.bundleId]), null, 2));
    result.replays = addReplays(replayDir, replays);
    result.summary = lib.summary();
    return result;
}

export { buildBundle, readBundle, importBundle, KIND };
