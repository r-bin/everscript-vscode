// The ROM library (docs/architecture/multi-game.md §5): the ROMs you loaded, as paths (never copies),
// with their detected game and variant. One JSON file in the extension's global storage, read the same
// way by the extension, the MCP server, tests and node tools — so headless runs see the same ROMs.
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { identifyRom, type RomIdentity } from './identify';
import { stripCopierHeader } from './header';
import { gameById, baseVariant } from '../games';

export interface LibraryEntry extends Omit<RomIdentity, 'header'> {
    path: string;
    addedAt: number;
    lastUsed: number;
}

interface LibraryFile {
    version: 1;
    roms: LibraryEntry[];
    /** Path of the ROM last chosen with Switch ROM. */
    selected: string | null;
    /** Per game, the ROM last chosen for it: what its open panels keep when another game is selected. */
    current: Record<string, string>;
    /** Base ROM chosen by hand per game, for when the known base variant is not in the library. */
    bases: Record<string, string>;
}

const FILE_NAME = 'roms.json';
const EXTENSION_ID = 'rbin.everscript';

let dirOverride: string | null = null;

/** The extension passes `context.globalStorageUri.fsPath`; headless code finds the same folder. */
export function setLibraryDir(dir: string): void {
    dirOverride = dir;
}

function userDataDirs(): string[] {
    const home = homedir();
    const apps = ['Code', 'Code - Insiders', 'VSCodium', 'Cursor'];
    const base = platform() === 'darwin' ? join(home, 'Library', 'Application Support')
        : platform() === 'win32' ? (process.env.APPDATA ?? join(home, 'AppData', 'Roaming'))
        : (process.env.XDG_CONFIG_HOME ?? join(home, '.config'));
    return apps.map((a) => join(base, a, 'User', 'globalStorage', EXTENSION_ID));
}

/** Where the library file is (or will be). */
export function libraryPath(): string {
    if (dirOverride) return join(dirOverride, FILE_NAME);
    const dirs = userDataDirs();
    const found = dirs.find((d) => existsSync(join(d, FILE_NAME))) ?? dirs.find((d) => existsSync(d));
    return join(found ?? dirs[0], FILE_NAME);
}

function empty(): LibraryFile {
    return { version: 1, roms: [], selected: null, bases: {}, current: {} };
}

export function loadLibrary(): LibraryFile {
    try {
        const raw = JSON.parse(readFileSync(libraryPath(), 'utf8'));
        if (raw && raw.version === 1 && Array.isArray(raw.roms)) return { ...empty(), ...raw };
    } catch { /* missing or unreadable: start empty */ }
    return empty();
}

function save(lib: LibraryFile): void {
    const file = libraryPath();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(lib, null, 1) + '\n');
}

const cache = new Map<string, { mtime: number; bytes: Uint8Array }>();

/** The ROM file's bytes, cached by path and mtime. Null when it cannot be read. */
export function readRomFile(path: string): Uint8Array | null {
    try {
        const mtime = statSync(path).mtimeMs;
        const hit = cache.get(path);
        if (hit && hit.mtime === mtime) return hit.bytes;
        const bytes = new Uint8Array(readFileSync(path));
        cache.set(path, { mtime, bytes });
        return bytes;
    } catch {
        return null;
    }
}

/** Adds (or refreshes) a ROM; returns its entry, or null when the file cannot be read. */
export function addRom(path: string): LibraryEntry | null {
    const abs = resolve(path);
    const bytes = readRomFile(abs);
    if (!bytes) return null;
    const { header: _h, ...id } = identifyRom(bytes);
    const lib = loadLibrary();
    const now = Date.now();
    const old = lib.roms.find((r) => r.path === abs);
    const entry: LibraryEntry = { ...id, path: abs, addedAt: old?.addedAt ?? now, lastUsed: now };
    lib.roms = [entry, ...lib.roms.filter((r) => r.path !== abs)];
    save(lib);
    return entry;
}

export function removeRom(path: string): void {
    const abs = resolve(path);
    const lib = loadLibrary();
    lib.roms = lib.roms.filter((r) => r.path !== abs);
    if (lib.selected === abs) lib.selected = null;
    for (const [g, p] of Object.entries(lib.current)) if (p === abs) delete lib.current[g];
    for (const [g, p] of Object.entries(lib.bases)) if (p === abs) delete lib.bases[g];
    save(lib);
}

/** Makes a ROM the selected one (adds it when needed). */
export function selectRom(path: string): LibraryEntry | null {
    const entry = addRom(path);
    if (!entry) return null;
    const lib = loadLibrary();
    lib.selected = entry.path;
    if (entry.game) lib.current[entry.game] = entry.path;
    save(lib);
    return entry;
}

/** Marks a ROM as its game's base by hand (for when the known base variant is missing). */
export function setBaseRom(path: string): LibraryEntry | null {
    const entry = addRom(path);
    if (!entry?.game) return null;
    const lib = loadLibrary();
    lib.bases[entry.game] = entry.path;
    save(lib);
    return entry;
}

export function listRoms(): LibraryEntry[] {
    return loadLibrary().roms.filter((r) => existsSync(r.path));
}

/** The library ROM with this SHA-256 (copier header stripped), the hash a replay names its ROM by. */
export function romBySha256(sha256: string): LibraryEntry | null {
    const want = sha256.toLowerCase();
    for (const entry of listRoms()) {
        const bytes = readRomFile(entry.path);
        if (bytes && createHash('sha256').update(stripCopierHeader(bytes)).digest('hex') === want) return entry;
    }
    return null;
}

export function selectedRom(): LibraryEntry | null {
    const lib = loadLibrary();
    return lib.roms.find((r) => r.path === lib.selected && existsSync(r.path)) ?? null;
}

/** The game's base ROM: one marked by hand, else the known base variant. */
export function baseRom(gameId: string): LibraryEntry | null {
    const lib = loadLibrary();
    const roms = lib.roms.filter((r) => existsSync(r.path));
    const marked = lib.bases[gameId];
    const byHand = marked ? roms.find((r) => r.path === marked && r.game === gameId) : undefined;
    if (byHand) return byHand;
    const game = gameById(gameId);
    if (!game) return null;
    const base = baseVariant(game).id;
    return roms.find((r) => r.game === gameId && r.match === 'known' && r.variant === base) ?? null;
}

/**
 * The ROM a game's scheme means (multi-game.md §5): `rom` (a path, added when new) if given, else the
 * selected ROM when it is this game's, else the ROM last chosen for this game, else its base ROM. So
 * selecting another game's ROM leaves this game's panels on the ROM they had (§6).
 */
export function romFor(gameId: string, rom?: string): LibraryEntry | null {
    if (rom) {
        const entry = addRom(rom);
        return entry && entry.game === gameId ? entry : null;
    }
    const sel = selectedRom();
    if (sel && sel.game === gameId) return sel;
    const lib = loadLibrary();
    const last = lib.current[gameId];
    const kept = last ? lib.roms.find((r) => r.path === last && r.game === gameId && existsSync(r.path)) : undefined;
    return kept ?? baseRom(gameId);
}

/** What a panel, tool or file system says when a game has no ROM in the library (multi-game.md §6). */
export function missingRomText(gameId: string): string {
    const name = gameById(gameId)?.name ?? gameId;
    return `No ${name} ROM in the ROM library. Add your own with Everscript: Switch ROM.`;
}
