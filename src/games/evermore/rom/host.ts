// Ownership: the ROM tab's host side — answering the webview's requests and
// caching the built model. No VS Code dependency: extension.js injects the
// loaders (ROM, CDL library, room names) and `post`.
//
// State owned: `_cache` (one model per ROM hash + CDL presence) and `_cdl`
// (the loaded library's cross references, for reader lookups, and its bus facts:
// executed bank halves, WRAM usage). The Memory tab's WRAM view asks here too
// (`wramCdlRequest`): access flags and word starts for the rows it shows.

import * as crypto from 'crypto';
import { buildRomModel, stripCopierHeader } from './build';
import { readersOf } from './model/readers';
import { executedByHalf, wramStrip, wramWordStarts, wramCoverage } from './model/bus-usage';
import { missingRomText } from '../../../platform/roms/library';

/** What the library hands over for reader lookups and the bus strips (src/platform/cdl/library). */
interface CdlFacts {
    cdl: Uint8Array | null; xrefs: Map<number, number> | null; stats: Map<number, { count: number; lo: number; hi: number; flags: number }> | null;
    edges: Map<number, number>; wflags: Uint8Array;
}
interface Deps { post(message: object): void; loadRom(): Buffer | null; loadCdl(rom: Buffer): CdlFacts | null; rooms(): Map<number, { name: string; area: string }> }
interface RomMessage { command: string; refresh?: boolean; key?: string; s?: number | string; e?: number | string; lo?: number; hi?: number }

const COMMANDS = new Set(['romMapRequest', 'romReaders', 'wramCdlRequest']);

let _cache: { key: string; model: ReturnType<typeof buildRomModel> } | null = null;
let _cdl: { hash: string; cdl: Uint8Array | null; xrefs: CdlFacts['xrefs']; stats: CdlFacts['stats']; bus: object | null; wflags: Uint8Array | null; words: Set<number> | null } | null = null;

const handlesRomMessage = (command: string): boolean => COMMANDS.has(command);

/**
 * @param msg  webview message
 * @param deps {post, loadRom: () => Buffer|null, loadCdl: (rom) => {cdl, xrefs, stats, edges, wflags}|null,
 *              rooms: () => Map<id, {name, area}>}
 */
function handleRomMessage(msg: RomMessage, deps: Deps): void {
    if (msg.command === 'romMapRequest') sendModel(msg, deps);
    if (msg.command === 'romReaders') return sendReaders(msg, deps);
    if (msg.command === 'wramCdlRequest') return sendWram(msg, deps);
}

/** The ROM's hash, with its CDL library loaded into `_cdl` (again on `refresh`). */
function loadFacts(romBuf: Buffer, deps: Deps, refresh?: boolean): string {
    const hash = crypto.createHash('sha1').update(stripCopierHeader(romBuf)).digest('hex');
    if (refresh || !_cdl || _cdl.hash !== hash) {
        const lib = deps.loadCdl(romBuf);
        _cdl = { hash, cdl: lib ? lib.cdl : null, xrefs: lib ? lib.xrefs : null, stats: lib ? lib.stats : null,
            bus: lib ? { executed: executedByHalf(lib.stats, lib.edges), wram: wramStrip(lib.wflags) } : null,
            wflags: lib ? lib.wflags : null, words: null };
        _cache = null;
    }
    return hash;
}

function sendWram(msg: RomMessage, deps: Deps): void {
    const lo = Math.max(0, Number(msg.lo) | 0), hi = Math.min(0x1FFFF, Number(msg.hi) | 0);
    try {
        const romBuf = deps.loadRom();
        if (romBuf) loadFacts(romBuf, deps, msg.refresh);
        if (!_cdl || !_cdl.wflags || hi < lo) { deps.post({ command: 'wramCdl', lo, flags: [], words: [], none: 'No CDL library for this ROM (record one in the emulator\'s CDL tab).' }); return; }
        if (!_cdl.words) _cdl.words = wramWordStarts(_cdl.xrefs);
        deps.post({ command: 'wramCdl', lo, ...wramCoverage(_cdl.wflags, _cdl.words, lo, hi) });
    } catch (err) {
        deps.post({ command: 'wramCdl', lo, flags: [], words: [], none: String(err instanceof Error ? err.message : err) });
    }
}

function sendModel(msg: RomMessage, deps: Deps): void {
    try {
        const romBuf = deps.loadRom();
        if (!romBuf) { deps.post({ command: 'romMap', error: missingRomText('evermore') }); return; }
        const hash = loadFacts(romBuf, deps, msg.refresh);
        if (!_cdl) return;
        const key = hash + (_cdl.cdl ? ':cdl' : '');
        if (!_cache || _cache.key !== key) {
            _cache = { key, model: buildRomModel(romBuf, { rooms: deps.rooms(), cdl: _cdl.cdl }) };
        }
        deps.post({ command: 'romMap', model: _cache.model, hasXrefs: !!(_cdl.xrefs && _cdl.xrefs.size), bus: _cdl.bus });
    } catch (err) {
        deps.post({ command: 'romMap', error: String(err instanceof Error ? err.message : err) });
    }
}

function sendReaders(msg: RomMessage, deps: Deps): void {
    const s = Number(msg.s), e = Number(msg.e);
    const reply = { command: 'romReaders', key: msg.key };
    if (!_cdl || !_cdl.xrefs || !Number.isInteger(s) || !Number.isInteger(e)) {
        deps.post({ ...reply, readers: [], none: 'No CDL cross references recorded for this ROM.' });
        return;
    }
    const points = _cache ? _cache.model.codePoints : [];
    deps.post({ ...reply, ...readersOf(_cdl.xrefs, _cdl.stats, s, e, points) });
}

export { handlesRomMessage, handleRomMessage };
