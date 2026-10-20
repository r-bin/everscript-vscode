/**
 * emulator/tas/prefs.ts
 *
 * The REPLAYS settings, kept in the recordings folder as tas-prefs.json (they travel with the recordings):
 *   overlay      the input overlay is on
 *   pinned       favourite recordings (file names)
 *   minSeconds   a session shorter than this is deleted when it ends (0 = keep every session with input)
 * No vscode here (tests load it under node).
 */

import * as fs from 'fs';
import * as path from 'path';

interface Prefs { overlay?: boolean; pinned?: string[]; minSeconds?: number }

const PREFS_FILE = 'tas-prefs.json';
const MIN_SECONDS = [0, 10, 60, 600];

function readPrefs(dir: string): Prefs {
    try { return JSON.parse(fs.readFileSync(path.join(dir, PREFS_FILE), 'utf8')); } catch (_) { return {}; }
}

function savePrefs(dir: string, prefs: Prefs): void {
    fs.writeFileSync(path.join(dir, PREFS_FILE), JSON.stringify(prefs, null, 2));
}

/** The length threshold in seconds (default 10). */
function minSeconds(prefs: Prefs): number {
    const s = Number(prefs.minSeconds);
    return MIN_SECONDS.includes(s) ? s : 10;
}

/** The page's tasPrefs message merged into prefs: only the fields it sends, only offered values. */
function mergePrefs(prefs: Prefs, msg: { overlay?: boolean; minSeconds?: number }): Prefs {
    if (msg.overlay !== undefined) prefs.overlay = !!msg.overlay;
    if (MIN_SECONDS.includes(Number(msg.minSeconds))) prefs.minSeconds = Number(msg.minSeconds);
    return prefs;
}

export type { Prefs };
export { readPrefs, savePrefs, minSeconds, mergePrefs };
