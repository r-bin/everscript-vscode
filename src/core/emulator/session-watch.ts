/**
 * core/emulator/session-watch.ts
 *
 * Keeps an emulator session from losing its recording without anyone noticing.
 *
 * - Heartbeat: while the panel is open the host posts hostAlive every HOST_ALIVE_MS. The page
 *   (webview/page/05-host-watch.js) pauses the game and says so when they stop: a webview outlives
 *   its extension host, and a restarted host never takes the old page back, so the page would
 *   otherwise play on with nothing saved (the Windows tester's 5 h session kept 1 h, v0.353.5).
 * - Marker: <storage>/emulator-session.json exists while a panel is open (touched with the
 *   heartbeat, removed on close and on deactivate). A host that starts and finds one left by
 *   another process says the last session stopped without closing, and offers to open the emulator
 *   again (the ROM picker's Continue resumes the recording from its last snapshot).
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const HOST_ALIVE_MS = 5000;
const MARKER = 'emulator-session.json';
const TOUCH_EVERY_MS = 60 * 1000;

interface Marker { pid: number; opened: string; command: string }

let timer: ReturnType<typeof setInterval> | null = null;
let markerFile = '';

function _storage(context: vscode.ExtensionContext): string {
    return context.globalStorageUri ? context.globalStorageUri.fsPath : path.join(context.extensionPath, '.storage');
}

/** The panel opened: heartbeat to the page, marker on disk. `command` reopens this kind of panel. */
function startSessionWatch(context: vscode.ExtensionContext, post: (msg: object) => void, command: string): void {
    stopSessionWatch();
    markerFile = path.join(_storage(context), MARKER);
    try {
        fs.mkdirSync(path.dirname(markerFile), { recursive: true });
        const marker: Marker = { pid: process.pid, opened: new Date().toISOString(), command };
        fs.writeFileSync(markerFile, JSON.stringify(marker));
    } catch (_) { markerFile = ''; }
    let lastTouch = Date.now();
    timer = setInterval(() => {
        post({ command: 'hostAlive' });
        if (markerFile && Date.now() - lastTouch >= TOUCH_EVERY_MS) {
            lastTouch = Date.now();
            try { const now = new Date(); fs.utimesSync(markerFile, now, now); } catch (_) {}
        }
    }, HOST_ALIVE_MS);
}

/** The panel closed (or the extension deactivates): no heartbeat, no marker. */
function stopSessionWatch(): void {
    if (timer) { clearInterval(timer); timer = null; }
    if (markerFile) { try { fs.unlinkSync(markerFile); } catch (_) {} markerFile = ''; }
}

function _alive(pid: number): boolean {
    try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM'; }
}

/** At activation: a marker another host left means its session never closed; say so once. */
function checkLastSession(context: vscode.ExtensionContext): void {
    const file = path.join(_storage(context), MARKER);
    let marker: Marker, stopped: Date;
    try {
        marker = JSON.parse(fs.readFileSync(file, 'utf8'));
        stopped = fs.statSync(file).mtime;
    } catch (_) { return; }
    if (marker.pid === process.pid || _alive(marker.pid)) return;
    try { fs.unlinkSync(file); } catch (_) {}
    const when = (d: Date) => d.toLocaleString();
    const text = `The emulator session opened ${when(new Date(marker.opened))} stopped without closing (last heard of about ${when(stopped)}): `
        + 'VS Code\'s extension host stopped or restarted. What was saved before then is kept. If its tab is still open, close it; '
        + 'open the emulator again and choose Continue in the ROM picker to resume the recording.';
    vscode.window.showWarningMessage(text, 'Open Emulator').then(pick => {
        if (pick) vscode.commands.executeCommand(marker.command || 'everscript.openEmulator');
    });
}

export { startSessionWatch, stopSessionWatch, checkLastSession, HOST_ALIVE_MS };
