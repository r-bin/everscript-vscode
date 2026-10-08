'use strict';
// Ownership: the ROM tab's host side — answering the webview's requests and
// caching the built model. No VS Code dependency: extension.js injects the
// loaders (ROM, CDL library, wiki text, room names) and `post`.
//
// State owned: `_cache` (one model per ROM hash + CDL presence) and `_cdl`
// (the loaded library's cross references, for reader lookups, and its bus facts:
// executed bank halves, WRAM usage).

const crypto = require('crypto');
const { buildRomModel, stripCopierHeader } = require('./build');
const { readersOf } = require('./model/readers');
const { executedByHalf, wramStrip } = require('./model/bus-usage');

const COMMANDS = new Set(['romMapRequest', 'romReaders']);

let _cache = null;   // { key, model }
let _cdl = null;     // { hash, xrefs, stats }

const handlesRomMessage = command => COMMANDS.has(command);

/**
 * @param msg  webview message
 * @param deps {post, loadRom: () => Buffer|null, loadCdl: (rom) => {cdl, xrefs, stats, edges, wflags}|null,
 *              readWiki: () => string, rooms: () => Map<id, {name, area}>}
 */
function handleRomMessage(msg, deps) {
    if (msg.command === 'romMapRequest') return sendModel(msg, deps);
    if (msg.command === 'romReaders') return sendReaders(msg, deps);
}

function sendModel(msg, deps) {
    try {
        const romBuf = deps.loadRom();
        if (!romBuf) { deps.post({ command: 'romMap', error: 'ROM not found — set everscript.romPath' }); return; }
        const hash = crypto.createHash('sha1').update(stripCopierHeader(romBuf)).digest('hex');
        if (msg.refresh || !_cdl || _cdl.hash !== hash) {
            const lib = deps.loadCdl(romBuf);
            _cdl = { hash, cdl: lib ? lib.cdl : null, xrefs: lib ? lib.xrefs : null, stats: lib ? lib.stats : null,
                bus: lib ? { executed: executedByHalf(lib.stats, lib.edges), wram: wramStrip(lib.wflags) } : null };
            _cache = null;
        }
        const key = hash + (_cdl.cdl ? ':cdl' : '');
        if (!_cache || _cache.key !== key) {
            _cache = { key, model: buildRomModel(romBuf, { rooms: deps.rooms(), wiki: deps.readWiki(), cdl: _cdl.cdl }) };
        }
        deps.post({ command: 'romMap', model: _cache.model, hasXrefs: !!(_cdl.xrefs && _cdl.xrefs.size), bus: _cdl.bus });
    } catch (err) {
        deps.post({ command: 'romMap', error: String(err && err.message || err) });
    }
}

function sendReaders(msg, deps) {
    const s = Number(msg.s), e = Number(msg.e);
    const reply = { command: 'romReaders', key: msg.key };
    if (!_cdl || !_cdl.xrefs || !Number.isInteger(s) || !Number.isInteger(e)) {
        deps.post({ ...reply, readers: [], none: 'No CDL cross references recorded for this ROM.' });
        return;
    }
    const points = _cache ? _cache.model.codePoints : [];
    deps.post({ ...reply, ...readersOf(_cdl.xrefs, _cdl.stats, s, e, points) });
}

module.exports = { handlesRomMessage, handleRomMessage };
