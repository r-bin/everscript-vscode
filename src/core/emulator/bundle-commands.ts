/**
 * core/emulator/bundle-commands.ts
 *
 * VS Code side of recording bundles (cdl/bundle.ts):
 *   exportRecordingBundle  zip one ROM's CDL library and its replays (in a worker thread: bundle-worker.ts); the
 *                          CDL tab's Export > Bundle in both the recorder and Everscript
 *   importRecordingBundle  Everscript: merge a bundle into this install's library and replays
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { Worker } from 'worker_threads';
import { importBundle } from '../../platform/cdl/bundle';
import type { BundleJob } from './bundle-worker';
import { flushRecording, reloadRecording, recordingFolders, getCurrentRom } from './panel';
import { stripCopierHeader } from '../../platform/cdl/library';

/** A library on disk: its folder and manifest.json. */
interface Library { dir: string; manifest: { updated?: string; sha1: string; sha256?: string; title?: string } }

const INSTALL_ID_KEY = 'everscript.recorder.installId';

/** A random id per install: a newer bundle from it replaces its older hit counts on import. */
function installId(context: vscode.ExtensionContext) {
    let id = context.globalState.get(INSTALL_ID_KEY, '');
    if (!id) {
        id = crypto.randomUUID();
        context.globalState.update(INSTALL_ID_KEY, id);
    }
    return id;
}

/** Every library under the root with its manifest, newest first. */
function libraries(cdlRoot: string): Library[] {
    if (!fs.existsSync(cdlRoot)) return [];
    const out: Library[] = [];
    for (const name of fs.readdirSync(cdlRoot)) {
        try {
            const manifest = JSON.parse(fs.readFileSync(path.join(cdlRoot, name, 'manifest.json'), 'utf8'));
            out.push({ dir: path.join(cdlRoot, name), manifest });
        } catch (_) { /* not a library */ }
    }
    return out.sort((a, b) => String(b.manifest.updated).localeCompare(String(a.manifest.updated)));
}

/** The running ROM's library, else the one the user picks. */
async function chooseLibrary(cdlRoot: string) {
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
        detail: 'last recorded ' + new Date(l.manifest.updated as string).toLocaleString(),
        lib: l,
    })), { placeHolder: 'Which ROM\'s recording?' });
    return pick ? pick.lib : null;
}

/** Replays recorded on the library's ROM (matched by the ROM's sha256). */
/**
 * The worker's file: next to this one when running from dist/, else the package's own bundle of it
 * (the package leaves out the dist/ modules the worker needs; tools/bundle.mts).
 */
function workerFile(): string {
    const here = path.join(__dirname, 'bundle-worker.js');
    if (fs.existsSync(path.join(__dirname, '..', '..', 'platform', 'cdl', 'bundle.js'))) return here;
    return path.join(__dirname, '..', '..', '..', 'bundle', 'bundle-worker.js');
}

function writeBundle(job: BundleJob): Promise<{ bytes: number; replays: number }> {
    return new Promise((resolve, reject) => {
        const w = new Worker(workerFile(), { workerData: job });
        w.once('message', (m: { bytes?: number; replays?: number; error?: string }) => {
            if (typeof m.bytes === 'number') resolve({ bytes: m.bytes, replays: m.replays || 0 }); else reject(new Error(m.error || 'no answer'));
        });
        w.once('error', reject);
        w.once('exit', (code) => { if (code) reject(new Error(`the export stopped (exit ${code})`)); });
    });
}

function slug(text: unknown) {
    return String(text || 'rom').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rom';
}

/** Zips the library and its replays; resolves with a line for the CDL tab's status. */
async function exportRecordingBundle(context: vscode.ExtensionContext, tool: { name: string; version: string }): Promise<string> {
    flushRecording();
    const { cdlRoot, replayDir } = recordingFolders(context);
    const lib = await chooseLibrary(cdlRoot);
    if (!lib) {
        vscode.window.showInformationMessage('Nothing recorded yet: load a ROM and play with CDL recording on.');
        return 'nothing recorded yet';
    }
    let sha256 = lib.manifest.sha256 || '';
    const rom = getCurrentRom();
    if (!sha256 && rom) sha256 = crypto.createHash('sha256').update(stripCopierHeader(rom)).digest('hex');
    const day = new Date().toISOString().slice(0, 10);
    const fileName = `${slug(lib.manifest.title)}-${lib.manifest.sha1.slice(0, 8)}-${day}.zip`;
    const target = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(os.homedir(), fileName)),
        filters: { 'Recording bundle': ['zip'] },
        saveLabel: 'Export bundle',
    });
    if (!target) return 'bundle not saved';
    const r = await writeBundle({ libDir: lib.dir, replayDir, sha256, installId: installId(context), tool, target: target.fsPath });
    const text = `bundle written: ${path.basename(target.fsPath)} (${Math.round(r.bytes / 1024)} KB, ${r.replays} replay${r.replays === 1 ? '' : 's'}, no ROM bytes)`;
    // Not awaited: the notification waits for the user, the export is done.
    vscode.window.showInformationMessage('Recording ' + text + '.', 'Reveal').then(pick => {
        if (pick) vscode.commands.executeCommand('revealFileInOS', target);
    });
    return text;
}

async function importRecordingBundle(context: vscode.ExtensionContext) {
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
            // This install's own id: its own export (or one forwarded back) is not counted twice.
            const r = importBundle(fs.readFileSync(uri.fsPath), cdlRoot, replayDir, installId(context));
            if (r.duplicate) lines.push(`${name}: already imported`);
            else lines.push(`${name}: ${r.title || r.sha1.slice(0, 8)} ${r.changed ? 'merged' : 'had nothing new'}, ${r.replays} new replay${r.replays === 1 ? '' : 's'}`);
        } catch (err) {
            lines.push(`${name}: not imported (${err instanceof Error ? err.message : err})`);
        }
    }
    reloadRecording();
    vscode.window.showInformationMessage(lines.join(' / '));
}

export { exportRecordingBundle, importRecordingBundle };
