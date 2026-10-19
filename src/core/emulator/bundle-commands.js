'use strict';

/**
 * emulator/bundle-commands.js
 *
 * VS Code side of recording bundles (cdl/bundle.ts):
 *   exportRecordingBundle  SNES CDL Recorder: zip one ROM's CDL library and its replays
 *   importRecordingBundle  Everscript: merge a bundle into this install's library and replays
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildBundle, importBundle } = require('../../../dist/platform/cdl/bundle');
const { parseMovie } = require('../../../dist/platform/tas/movie');
const { flushRecording, reloadRecording, recordingFolders, getCurrentRom } = require('./panel');
const { stripCopierHeader } = require('../../../dist/platform/cdl/library');

const INSTALL_ID_KEY = 'everscript.recorder.installId';

/** A random id per install: a newer bundle from it replaces its older hit counts on import. */
function installId(context) {
    let id = context.globalState.get(INSTALL_ID_KEY, '');
    if (!id) {
        id = crypto.randomUUID();
        context.globalState.update(INSTALL_ID_KEY, id);
    }
    return id;
}

/** Every library under the root with its manifest, newest first. */
function libraries(cdlRoot) {
    if (!fs.existsSync(cdlRoot)) return [];
    const out = [];
    for (const name of fs.readdirSync(cdlRoot)) {
        try {
            const manifest = JSON.parse(fs.readFileSync(path.join(cdlRoot, name, 'manifest.json'), 'utf8'));
            out.push({ dir: path.join(cdlRoot, name), manifest });
        } catch (_) { /* not a library */ }
    }
    return out.sort((a, b) => String(b.manifest.updated).localeCompare(String(a.manifest.updated)));
}

/** The running ROM's library, else the one the user picks. */
async function chooseLibrary(cdlRoot) {
    const all = libraries(cdlRoot);
    if (!all.length) return null;
    const rom = getCurrentRom();
    if (rom) {
        const sha1 = crypto.createHash('sha1').update(stripCopierHeader(rom)).digest('hex');
        const running = all.find(l => l.manifest.sha1 === sha1);
        if (running) return running;
    }
    if (all.length === 1) return all[0];
    const pick = await vscode.window.showQuickPick(all.map(l => ({
        label: l.manifest.title || l.manifest.sha1,
        description: l.manifest.sha1.slice(0, 8),
        detail: 'last recorded ' + new Date(l.manifest.updated).toLocaleString(),
        lib: l,
    })), { placeHolder: 'Which ROM\'s recording?' });
    return pick ? pick.lib : null;
}

/** Replays recorded on the library's ROM (matched by the ROM's sha256). */
function replaysFor(replayDir, sha256) {
    if (!sha256 || !fs.existsSync(replayDir)) return [];
    const out = [];
    for (const name of fs.readdirSync(replayDir).filter(n => /\.evsmv$/i.test(n))) {
        try {
            const data = fs.readFileSync(path.join(replayDir, name));
            if (parseMovie(data.toString('utf8'), name).meta.romSha256 === sha256) out.push({ name, data });
        } catch (_) { /* unreadable: skipped */ }
    }
    return out;
}

function slug(text) {
    return String(text || 'rom').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rom';
}

async function exportRecordingBundle(context, tool) {
    flushRecording();
    const { cdlRoot, replayDir } = recordingFolders(context);
    const lib = await chooseLibrary(cdlRoot);
    if (!lib) {
        vscode.window.showInformationMessage('Nothing recorded yet: load a ROM and play with CDL recording on.');
        return;
    }
    let sha256 = lib.manifest.sha256 || '';
    const rom = getCurrentRom();
    if (!sha256 && rom) sha256 = crypto.createHash('sha256').update(stripCopierHeader(rom)).digest('hex');
    const replays = replaysFor(replayDir, sha256);
    const day = new Date().toISOString().slice(0, 10);
    const fileName = `${slug(lib.manifest.title)}-${lib.manifest.sha1.slice(0, 8)}-${day}.zip`;
    const target = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(require('os').homedir(), fileName)),
        filters: { 'Recording bundle': ['zip'] },
        saveLabel: 'Export bundle',
    });
    if (!target) return;
    const { zip } = buildBundle({ libDir: lib.dir, replays, installId: installId(context), tool });
    fs.writeFileSync(target.fsPath, zip);
    const kb = Math.round(zip.length / 1024);
    const pick = await vscode.window.showInformationMessage(
        `Recording bundle written: ${path.basename(target.fsPath)} (${kb} KB, ${replays.length} replay${replays.length === 1 ? '' : 's'}). It holds no ROM bytes.`,
        'Reveal');
    if (pick) vscode.commands.executeCommand('revealFileInOS', target);
}

async function importRecordingBundle(context) {
    const uris = await vscode.window.showOpenDialog({
        canSelectMany: true,
        openLabel: 'Import',
        filters: { 'Recording bundle': ['zip'] },
    });
    if (!uris || !uris.length) return;
    flushRecording();
    const { cdlRoot, replayDir } = recordingFolders(context);
    const lines = [];
    for (const uri of uris) {
        const name = path.basename(uri.fsPath);
        try {
            const r = importBundle(fs.readFileSync(uri.fsPath), cdlRoot, replayDir);
            if (r.duplicate) lines.push(`${name}: already imported`);
            else lines.push(`${name}: ${r.title || r.sha1.slice(0, 8)} ${r.changed ? 'merged' : 'had nothing new'}, ${r.replays} new replay${r.replays === 1 ? '' : 's'}`);
        } catch (err) {
            lines.push(`${name}: not imported (${err.message})`);
        }
    }
    reloadRecording();
    vscode.window.showInformationMessage(lines.join(' / '));
}

module.exports = { exportRecordingBundle, importRecordingBundle };
