'use strict';
// Ownership: custom maps on disk — one folder per map, holding its editor
// document (map.json) and its whole edit history (history.json), plus an
// index of the order and the map that was open last.
//
// The layout and both formats are docs/map-format/custom-map-files.md.
// Everything here takes the root folder as an argument; the extension
// passes `<globalStorage>/custom-maps`. No VS Code API, so the tests run it
// against a temp folder.

const fs = require('fs');
const path = require('path');

const MAP_FORMAT = 'everscript-custom-map';
const HISTORY_FORMAT = 'everscript-custom-map-history';
const VERSION = 1;

/** A key is a folder name, so it must stay one. */
function safeKey(key) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(key)) {
        throw new Error('invalid custom map key: ' + JSON.stringify(key));
    }
    return key;
}

function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

/** Write through a temp file, so a crash mid-write never leaves half a map. */
function writeJson(file, value) {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(value));
    fs.renameSync(tmp, file);
}

function indexFile(root) { return path.join(root, 'index.json'); }

function readIndex(root) {
    const idx = readJson(indexFile(root), null);
    return idx && Array.isArray(idx.order) ? idx : { order: [], active: null };
}

/**
 * Every map, in list order: `[{key, name, borrow, w, h, saved, history}]` —
 * the webview's own shape (map-editor-custom.js), plus `active`, the map
 * that was open last.
 */
function listMaps(root) {
    if (!fs.existsSync(root)) return { maps: [], active: null };
    const idx = readIndex(root);
    const keys = fs.readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory() && fs.existsSync(path.join(root, e.name, 'map.json')))
        .map((e) => e.name);
    keys.sort((a, b) => {
        const ia = idx.order.indexOf(a); const ib = idx.order.indexOf(b);
        return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib) || (a < b ? -1 : 1);
    });
    const maps = [];
    for (const key of keys) {
        const doc = readJson(path.join(root, key, 'map.json'), null);
        if (!doc || doc.format !== MAP_FORMAT) continue;
        const hist = readJson(path.join(root, key, 'history.json'), null);
        maps.push({
            key, name: doc.name, borrow: doc.borrow, w: doc.width, h: doc.height,
            created: doc.created, modified: doc.modified,
            saved: doc.draft || null,
            history: hist && hist.format === HISTORY_FORMAT ? { undo: hist.undo || [], redo: hist.redo || [] } : null,
            // A newer editor wrote it: show it, never overwrite it.
            readOnly: doc.version > VERSION,
        });
    }
    return { maps, active: keys.indexOf(idx.active) >= 0 ? idx.active : null };
}

/** The document for one map, as map.json holds it. */
function mapDocument(m, previous) {
    const now = new Date().toISOString();
    return {
        format: MAP_FORMAT,
        version: VERSION,
        key: m.key,
        name: String(m.name || 'New map'),
        created: (previous && previous.created) || m.created || now,
        modified: now,
        borrow: Number(m.borrow),
        width: Number(m.w),
        height: Number(m.h),
        draft: m.saved || {},
    };
}

/** Save one map: its document, its history (when given), and the index. */
function saveMap(root, m, opts) {
    const key = safeKey(m.key);
    const dir = path.join(root, key);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'map.json');
    const previous = readJson(file, null);
    if (previous && previous.version > VERSION) throw new Error(`${m.name}: saved by a newer version of the editor`);
    // Unknown fields a newer editor wrote survive a save by this one.
    const doc = Object.assign({}, previous || {}, mapDocument(m, previous));
    writeJson(file, doc);
    if (m.history) {
        writeJson(path.join(dir, 'history.json'), {
            format: HISTORY_FORMAT, version: VERSION,
            undo: m.history.undo || [], redo: m.history.redo || [],
        });
    }
    const idx = readIndex(root);
    if (idx.order.indexOf(key) < 0) idx.order.push(key);
    if (opts && opts.order) idx.order = opts.order.filter((k) => typeof k === 'string');
    if (opts && 'active' in opts) idx.active = opts.active;
    writeJson(indexFile(root), idx);
    return doc;
}

/** Remember which map is open, without rewriting any map. */
function setActive(root, key) {
    fs.mkdirSync(root, { recursive: true });
    const idx = readIndex(root);
    idx.active = key || null;
    writeJson(indexFile(root), idx);
}

/** Delete a map's folder, history and all. */
function deleteMap(root, key) {
    const dir = path.join(root, safeKey(key));
    fs.rmSync(dir, { recursive: true, force: true });
    const idx = readIndex(root);
    idx.order = idx.order.filter((k) => k !== key);
    if (idx.active === key) idx.active = null;
    if (fs.existsSync(root)) writeJson(indexFile(root), idx);
}

/**
 * Maps saved the old way, in the UI preferences (`customMaps`), moved into
 * folders. Returns how many were moved; a map whose folder exists already
 * is left alone.
 */
function migrateFromPrefs(root, list) {
    if (!Array.isArray(list)) return 0;
    let moved = 0;
    for (const m of list) {
        if (!m || typeof m.key !== 'string') continue;
        try { safeKey(m.key); } catch { continue; }
        if (fs.existsSync(path.join(root, m.key, 'map.json'))) continue;
        saveMap(root, { key: m.key, name: m.name, borrow: m.borrow, w: m.w, h: m.h, saved: m.saved || {} });
        moved += 1;
    }
    return moved;
}

module.exports = {
    listMaps, saveMap, setActive, deleteMap, migrateFromPrefs, mapDocument,
    MAP_FORMAT, HISTORY_FORMAT, VERSION,
};
