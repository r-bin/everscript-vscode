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

/** Every widget, oldest first. */
function listWidgets(file) {
    return readDoc(file).widgets;
}

function cleanVariation(v) {
    const num = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) | 0));
    const name = String(v && v.name || 'A').slice(0, 32);
    let frames = Array.isArray(v && v.frames) ? v.frames : [];
    if (!frames.length && Array.isArray(v && v.cells)) {
        frames = [{ cells: v.cells, delay: num(v.delay != null ? v.delay : 8, 1, 255) }];
    }
    const cleanFrames = frames.map((f) => ({
        cells: Array.isArray(f && f.cells) ? f.cells : [],
        delay: num(f && f.delay != null ? f.delay : 8, 1, 255),
    }));
    return {
        id: String(v && v.id || ('var-' + Math.random().toString(36).slice(2, 8))),
        name,
        frames: cleanFrames.length ? cleanFrames : [{ cells: [], delay: 8 }],
    };
}

/** Only the fields a widget has, so a webview slip cannot bloat the file. */
function cleanWidget(w) {
    const num = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) | 0));
    let variations = Array.isArray(w.variations) ? w.variations.map(cleanVariation) : [];
    if (!variations.length) {
        variations = [{
            id: 'var-a',
            name: 'A',
            frames: [{ cells: Array.isArray(w.cells) ? w.cells : [], delay: 8 }],
        }];
    }
    const activeVar = num(w.activeVariation || 0, 0, Math.max(0, variations.length - 1));
    const primaryCells = (variations[activeVar] && variations[activeVar].frames[0] && variations[activeVar].frames[0].cells)
        || variations[0].frames[0].cells;
    return {
        id: safeId(w.id),
        name: String(w.name || 'widget').slice(0, 80),
        w: num(w.w, 1, 32),
        h: num(w.h, 1, 32),
        cells: primaryCells,
        variations,
        activeVariation: activeVar,
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
    return doc.widgets;
}

/** Remove one widget. Returns the list. */
function deleteWidget(file, id) {
    safeId(id);
    const doc = readDoc(file);
    doc.widgets = doc.widgets.filter((x) => x.id !== id);
    writeDoc(file, doc);
    return doc.widgets;
}

module.exports = { listWidgets, saveWidget, deleteWidget, FORMAT, VERSION };
