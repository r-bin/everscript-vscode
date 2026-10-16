'use strict';
// Ownership: the user's own widgets on disk — one JSON file,
// `<globalStorage>/widgets.json`, shared by every map.
//
// A widget is what the editor stamps: a rectangle of portable cells
// (`{dx, dy, canopy, terrain, collision}`, each layer `{graphic, family,
// flags}` or null for "keep the floor") plus the triggers and objects that
// come with it. Portable, so it stamps into any map — see
// map-editor-constructs.js and docs/map-format/custom-map-files.md §5.
//
// Takes the file path as an argument; no VS Code API, so the tests run it
// against a temp folder. Writes go through a temp file.

const fs = require('fs');
const path = require('path');

const FORMAT = 'everscript-widgets';
const VERSION = 1;

function safeId(id) {
    if (typeof id !== 'string' || !/^w-[A-Za-z0-9_-]{1,60}$/.test(id)) {
        throw new Error('invalid widget id: ' + JSON.stringify(id));
    }
    return id;
}

function readDoc(file) {
    try {
        const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (doc && doc.format === FORMAT && Array.isArray(doc.widgets)) return doc;
    } catch { /* missing or unreadable: an empty library */ }
    return { format: FORMAT, version: VERSION, widgets: [] };
}

function writeDoc(file, doc) {
    if (doc.version > VERSION) throw new Error('widgets.json was written by a newer version; not overwriting it');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(doc));
    fs.renameSync(tmp, file);
}

/** Every widget, oldest first, in the current shape (see `ownCells`). */
function listWidgets(file) {
    return readDoc(file).widgets.map(currentShape);
}

const num = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) | 0));

/**
 * The cells a widget stamps. Animation is per cell part now (`anim`, the
 * map's Animation tab), so frames and hand-made variations are not stored;
 * a widget saved with them keeps frame 0 of its first variation with art, a
 * hand-made one before a generated `fam-<id>` colouring.
 */
function ownCells(w) {
    const hasArt = (f) => f && Array.isArray(f.cells) && f.cells.length;
    if (Array.isArray(w.cells) && w.cells.length) return w.cells;
    const fr = (Array.isArray(w.frames) ? w.frames : []).find(hasArt);
    if (fr) return fr.cells;
    const vars = (Array.isArray(w.variations) ? w.variations : []).filter((v) => (v && v.frames || []).some(hasArt));
    const own = vars.find((v) => !/^fam-\d+$/.test(String(v.id))) || vars[0];
    return own ? own.frames.find(hasArt).cells : [];
}

/** A stored widget, older shapes included, as `{..., cells}` with no frames or variations. */
function currentShape(w) {
    if (!w.variations && !w.frames && !('animated' in w)) return w;
    const out = { ...w, cells: ownCells(w) };
    delete out.variations;
    delete out.activeVariation;
    delete out.frames;
    delete out.animated;
    return out;
}

/** Only the fields a widget has, so a webview slip cannot bloat the file. */
function cleanWidget(w) {
    return {
        id: safeId(w.id),
        name: String(w.name || 'widget').slice(0, 80),
        w: num(w.w, 1, 32),
        h: num(w.h, 1, 32),
        cells: ownCells(w),
        attachments: w.attachments && typeof w.attachments === 'object'
            ? w.attachments : { bTrigger: [], stepOn: [], objects: [] },
        source: w.source || null,
        created: w.created || new Date().toISOString(),
        modified: new Date().toISOString(),
    };
}

/** Add or replace one widget (by id). Returns the list. */
function saveWidget(file, widget) {
    const doc = readDoc(file);
    const w = cleanWidget(widget || {});
    const at = doc.widgets.findIndex((x) => x.id === w.id);
    if (at >= 0) { w.created = doc.widgets[at].created || w.created; doc.widgets[at] = w; } else doc.widgets.push(w);
    writeDoc(file, doc);
    return doc.widgets.map(currentShape);
}

/** Remove one widget. Returns the list. */
function deleteWidget(file, id) {
    safeId(id);
    const doc = readDoc(file);
    doc.widgets = doc.widgets.filter((x) => x.id !== id);
    writeDoc(file, doc);
    return doc.widgets.map(currentShape);
}

module.exports = { listWidgets, saveWidget, deleteWidget, FORMAT, VERSION };
