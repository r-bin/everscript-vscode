'use strict';
// Ownership: the host side of custom maps — the webview's requests to list,
// save, delete and export them, answered against the folder store
// (data/custom-store.js) and the export archive (rendering/custom-export.js).
//
// Split out of extension.js's message switch: it is one feature with five
// messages. The VS Code API arrives as an argument (`deps.vscode`), so this
// file does not require it and stays loadable in the tests.
//
// Messages (webview -> host):
//   requestCustomMaps               -> customMaps {maps, active}
//   saveCustomMap {map, order?, active?}
//   setCustomActive {key}
//   deleteCustomMap {key, name}     -> customMapDeleted {key} (after a modal confirm)
//   exportCustomMap {map, draft, stamps} -> customMapExported {path} | {error} | {cancelled}
//   requestWidgets                  -> widgets {widgets, graphicFamilies}
//   saveWidget {widget}             -> widgets {widgets, graphicFamilies}
//   deleteWidget {id, name}         -> widgets {widgets, graphicFamilies, deleted} (after a modal confirm)
//
// `graphicFamilies` is what vanilla attests for every graphic the widgets
// draw (rendering/vanilla-index.js): their colourings are read off it.
//
// Widgets (data/widget-store.js) live beside the maps, in one file every map
// shares: `deps.widgetsFile`.
//
// See docs/map-format/custom-map-files.md.

const fs = require('fs');
const path = require('path');
const store = require('./data/custom-store');
const widgetStore = require('./data/widget-store');
const { buildCustomMapArchive } = require('./rendering/custom-export');
const { graphicFamilies } = require('./rendering/vanilla-index');

const COMMANDS = new Set(['requestCustomMaps', 'saveCustomMap', 'setCustomActive', 'deleteCustomMap', 'exportCustomMap',
    'requestWidgets', 'saveWidget', 'deleteWidget']);

/** The prefs key the maps lived under before they had folders. */
const LEGACY_PREF = 'customMaps';

function handlesCustomMapMessage(command) { return COMMANDS.has(command); }

/**
 * `deps`: `{vscode, root, post(msg), prefs() -> object, setPrefs(object),
 * loadRom() -> {romBuf, romPath}}`. Errors are posted back, and a failed
 * save is also shown, because a map that silently did not save is lost work.
 */
function handleCustomMapMessage(msg, deps) {
    const { vscode, root, post } = deps;
    if (msg.command === 'requestCustomMaps') {
        try {
            const prefs = deps.prefs() || {};
            if (Array.isArray(prefs[LEGACY_PREF])) {
                store.migrateFromPrefs(root, prefs[LEGACY_PREF]);
                const rest = { ...prefs };
                delete rest[LEGACY_PREF];
                deps.setPrefs(rest);
            }
            post({ command: 'customMaps', ...store.listMaps(root) });
        } catch (err) {
            post({ command: 'customMaps', maps: [], active: null, error: String(err && err.message || err) });
        }
        return;
    }
    if (msg.command === 'requestWidgets' || msg.command === 'saveWidget' || msg.command === 'deleteWidget') {
        handleWidgetMessage(msg, deps);
        return;
    }
    if (msg.command === 'saveCustomMap') {
        try {
            const opts = {};
            if (Array.isArray(msg.order)) opts.order = msg.order;
            if ('active' in msg) opts.active = msg.active || null;
            store.saveMap(root, msg.map || {}, opts);
        } catch (err) {
            vscode.window.showErrorMessage('Could not save the custom map: ' + String(err && err.message || err));
        }
        return;
    }
    if (msg.command === 'setCustomActive') {
        try { store.setActive(root, msg.key || null); } catch { /* nothing to lose */ }
        return;
    }
    if (msg.command === 'deleteCustomMap') {
        (async () => {
            const name = String(msg.name || 'this map');
            const pick = await vscode.window.showWarningMessage(
                `Delete “${name}”? Its tiles and its whole edit history are removed. This cannot be undone.`,
                { modal: true }, 'Delete');
            if (pick !== 'Delete') { post({ command: 'customMapDeleted', key: msg.key, cancelled: true }); return; }
            try {
                store.deleteMap(root, msg.key);
                post({ command: 'customMapDeleted', key: msg.key });
            } catch (err) {
                const error = String(err && err.message || err);
                post({ command: 'customMapDeleted', key: msg.key, error });
                vscode.window.showErrorMessage('Could not delete the map: ' + error);
            }
        })();
        return;
    }
    if (msg.command === 'exportCustomMap') {
        (async () => {
            const reply = { command: 'customMapExported' };
            try {
                const { romBuf, romPath } = deps.loadRom();
                if (!romBuf) throw new Error('ROM not found — set everscript.romPath');
                const out = buildCustomMapArchive(romBuf, { map: msg.map || {}, draft: msg.draft || {}, stamps: msg.stamps || [] });
                const target = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(path.join(romPath ? path.dirname(romPath) : root, out.fileName)),
                    filters: { 'Zip archive': ['zip'] },
                    saveLabel: 'Export map',
                });
                if (!target) { post({ ...reply, cancelled: true }); return; }
                fs.writeFileSync(target.fsPath, out.zip);
                post({ ...reply, path: target.fsPath, report: out.report });
                const pick = await vscode.window.showInformationMessage(
                    `Exported ${path.basename(target.fsPath)}: the blob (${out.report.blobBytes} bytes), `
                    + 'the editor file, a sample .evs and the stamps.', 'Reveal');
                if (pick === 'Reveal') vscode.commands.executeCommand('revealFileInOS', target);
            } catch (err) {
                const error = String(err && err.message || err);
                post({ ...reply, error });
                vscode.window.showErrorMessage('Map export failed: ' + error);
            }
        })();
    }
}

/** The widget library: list, save, delete (with a modal confirm). */
function handleWidgetMessage(msg, deps) {
    const { vscode, post, widgetsFile } = deps;
    const reply = (extra) => post({ command: 'widgets', ...extra, graphicFamilies: widgetGraphicFamilies(extra.widgets, deps) });
    if (msg.command === 'requestWidgets') {
        try { reply({ widgets: widgetStore.listWidgets(widgetsFile) }); } catch (err) {
            reply({ widgets: [], error: String(err && err.message || err) });
        }
        return;
    }
    if (msg.command === 'saveWidget') {
        try { reply({ widgets: widgetStore.saveWidget(widgetsFile, msg.widget || {}), saved: msg.widget && msg.widget.id }); } catch (err) {
            vscode.window.showErrorMessage('Could not save the widget: ' + String(err && err.message || err));
        }
        return;
    }
    (async () => {
        const name = String(msg.name || 'this widget');
        const pick = await vscode.window.showWarningMessage(
            `Delete the widget “${name}”? Maps it was stamped into keep their copy. This cannot be undone.`,
            { modal: true }, 'Delete');
        if (pick !== 'Delete') return;
        try { reply({ widgets: widgetStore.deleteWidget(widgetsFile, msg.id), deleted: msg.id }); } catch (err) {
            vscode.window.showErrorMessage('Could not delete the widget: ' + String(err && err.message || err));
        }
    })();
}

/** `{graphic: [[family, uses], ...]}` for every graphic the widgets draw; `{}` without a ROM. */
function widgetGraphicFamilies(widgets, deps) {
    const seen = new Set();
    const note = (cells) => (cells || []).forEach((c) => [c.canopy, c.terrain].forEach((p) => {
        if (p && p.graphic != null) seen.add(p.graphic);
    }));
    (widgets || []).forEach((w) => {
        note(w.cells);
        (w.variations || []).forEach((v) => (v.frames || []).forEach((f) => note(f.cells)));
    });
    try {
        const rom = deps.loadRom && deps.loadRom();
        return rom && rom.romBuf && seen.size ? graphicFamilies(rom.romBuf, [...seen]) : {};
    } catch { return {}; }
}

module.exports = { handlesCustomMapMessage, handleCustomMapMessage, widgetGraphicFamilies };
