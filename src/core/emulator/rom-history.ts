/**
 * src/core/emulator/rom-history.ts
 *
 * Tracks ROM loading history and offers quick-launch targets for the emulator:
 * - The base ROM of the selected game (ROM library)
 * - ROMs a game built itself (Evermore: map editor test ROMs, *_emulator.sfc), described by the game
 * - Recently opened / built / dropped ROM files
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';

const HISTORY_FILENAME = 'recent-roms.json';
const MAX_HISTORY_ITEMS = 15;

// Which game and variant a ROM is comes from the ROM library's identification (platform/roms/identify.ts);
// this file only shapes it for the quick-launch list.
import * as platform from '../../platform';

/**
 * A game can describe ROMs it built itself (Evermore: the map editor's test ROMs) before the
 * library identification runs: (rom without copier header, target, hintPath) => details or null.
 * Set by the emulator panel from configureEmulator({ game }).
 */
/** What the list shows about a ROM; a game's describer may add more (custom map name, preview). */
interface RomDetails {
  known: boolean; isCustomMap: boolean; region: string; regionName: string; icon: string; flag: string;
  sha1?: string; crc32?: string; customName?: string; vfsUri?: string; previewDataUri?: string;
  game?: string;
}
type RomDescriber = (clean: Uint8Array, target: unknown, hintPath?: string | null) => RomDetails | null;
/** A stored history entry (recent-roms.json). */
interface HistoryItem {
  path: string; name: string; kind: string; lastUsed: number; size: number; customName?: string; vfsUri?: string;
  icon?: string; region?: string; regionName?: string; isCustomMap?: boolean; previewDataUri?: string;
  sha1?: string; game?: string;
}
/** What the panel reports when a ROM was loaded. */
interface RomUsage { path?: string; name?: string; kind?: string; dataUrl?: unknown; romBuffer?: Uint8Array; size?: number; game?: string; sha1?: string; }
/** For getStorageDir: the extension context, or anything with its global storage folder. */
type StorageContext = { globalStorageUri?: { fsPath?: string } } | null | undefined;

let _describeRom: RomDescriber | null = null;
function setRomDescriber(fn: unknown): void {
  _describeRom = typeof fn === 'function' ? fn as RomDescriber : null;
}

function detectRomDetails(target: unknown, hintPath?: string | null): RomDetails | null {
  try {
    let buf: Uint8Array | null = null;
    let targetPath = typeof target === 'string' ? target : (hintPath || '');
    if (typeof target === 'string') {
      if (!fs.existsSync(target)) return null;
      buf = fs.readFileSync(target);
    } else if (Buffer.isBuffer(target) || (target instanceof Uint8Array)) {
      buf = target;
    }
    if (!buf || buf.length < 0x200000) return null;

    const clean = (buf.length % 1024 === 512) ? buf.subarray(512) : buf;
    const sha1 = crypto.createHash('sha1').update(clean).digest('hex').toLowerCase();
    const crc = platform.crc32(clean).toString(16).padStart(8, '0').toLowerCase();

    // 1. A ROM the game itself built (e.g. a map editor test ROM)
    const own = _describeRom ? _describeRom(clean, target, hintPath) : null;
    if (own) return Object.assign(own, { sha1: sha1, crc32: crc });

    // 2. A known variant of a registered game
    const id = platform.identifyRom(clean);
    const variant = id.match === 'known' && id.game ? platform.gameById(id.game)?.variants.find(v => v.id === id.variant) : null;
    if (variant) {
      const code = variant.id.toUpperCase();
      return {
        known: true,
        game: id.game || undefined,
        isCustomMap: false,
        region: code,
        regionName: variant.name,
        icon: code,
        flag: code,
        sha1: sha1,
        crc32: crc,
      };
    }

    // 3. Fallback: unknown / mod / hack
    return {
      known: false,
      isCustomMap: false,
      region: '?',
      regionName: 'Unknown ROM / Hack',
      icon: '?',
      flag: '?',
      sha1: sha1,
      crc32: crc,
    };
  } catch (_) {
    return null;
  }
}

function formatBytes(bytes: unknown): string {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatRelativeTime(ts: number | null | undefined): string {
  if (!ts) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getBadge(kind: string | undefined): string {
  switch (kind) {
    case 'editor':  return 'Map Editor';
    case 'vanilla': return 'Vanilla';
    case 'build':   return 'Build';
    case 'dropped': return 'Dropped';
    default:        return 'File';
  }
}

function getStorageDir(context: StorageContext): string {
  if (context && context.globalStorageUri && context.globalStorageUri.fsPath) {
    const p = context.globalStorageUri.fsPath;
    try {
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    } catch (_) {}
    return p;
  }
  const fallback = path.join(os.tmpdir(), 'everscript');
  try {
    if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
  } catch (_) {}
  return fallback;
}

function getVanillaRom(wsRoot?: string | null, cfgRomPath?: string | null) {
  try {
    // The base ROM of the selected ROM's game (the clean one to hack), else the selected ROM itself.
    const sel = platform.selectedRom();
    const base = sel && sel.game ? platform.baseRom(sel.game) : null;
    const p = cfgRomPath || (base && base.path) || (sel && sel.path) || null;
    if (p && fs.existsSync(p)) {
      const st = fs.statSync(p);
      const details = detectRomDetails(p);
      return {
        available: true,
        path: p,
        name: path.basename(p),
        size: st.size,
        sizeFormatted: formatBytes(st.size),
        icon: (details && details.icon) || 'US',
        region: (details && details.region) || 'US',
        regionName: (details && details.regionName) || 'USA',
      };
    }
  } catch (_) {}
  return { available: false };
}

function scanEditorTempRoms(storageDir: string): HistoryItem[] {
  const dirs = [storageDir, os.tmpdir()].filter(Boolean);
  const found = new Map<string, HistoryItem>();

  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.endsWith('_emulator.sfc') || f.endsWith('_emulator.smc')) {
          const fullPath = path.join(dir, f);
          try {
            const st = fs.statSync(fullPath);
            if (st.isFile()) {
              found.set(fullPath, {
                path: fullPath,
                name: f,
                kind: 'editor',
                lastUsed: st.mtimeMs,
                size: st.size,
              });
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  return Array.from(found.values());
}

function readHistoryFile(storageDir: string): HistoryItem[] {
  const histPath = path.join(storageDir, HISTORY_FILENAME);
  try {
    if (fs.existsSync(histPath)) {
      const data = fs.readFileSync(histPath, 'utf8');
      const list = JSON.parse(data);
      if (Array.isArray(list)) return list;
    }
  } catch (_) {}
  return [];
}

function writeHistoryFile(storageDir: string, list: HistoryItem[]): void {
  const histPath = path.join(storageDir, HISTORY_FILENAME);
  try {
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
    fs.writeFileSync(histPath, JSON.stringify(list.slice(0, MAX_HISTORY_ITEMS), null, 2), 'utf8');
  } catch (_) {}
}

function clearRecentRoms(storageDir: string): void {
  writeHistoryFile(storageDir, []);
}

function recordRomUsage(entry: RomUsage | null | undefined, context: StorageContext): void {
  if (!entry) return;
  const storageDir = getStorageDir(context);
  let filePath = entry.path || '';
  const name = entry.name || (filePath ? path.basename(filePath) : 'game.sfc');
  let kind = entry.kind || 'file';

  // If this was a dropped file with no path on disk, save it to storage so it can be re-run
  if (!filePath && entry.dataUrl && typeof entry.dataUrl === 'string') {
    try {
      const comma = entry.dataUrl.indexOf(',');
      const b64 = comma >= 0 ? entry.dataUrl.slice(comma + 1) : entry.dataUrl;
      const buf = Buffer.from(b64, 'base64');
      const safeName = name.replace(/[^\w.-]+/g, '_');
      const stagedPath = path.join(storageDir, 'dropped_' + safeName);
      fs.writeFileSync(stagedPath, buf);
      filePath = stagedPath;
      if (kind === 'file') kind = 'dropped';
    } catch (_) {}
  }

  let details: RomDetails | null = null;
  if (filePath && fs.existsSync(filePath)) {
    details = detectRomDetails(filePath, filePath || name);
  } else if (entry.romBuffer) {
    details = detectRomDetails(entry.romBuffer, filePath || name);
  }

  const list = readHistoryFile(storageDir);
  const now = Date.now();
  let size = entry.size || 0;
  if (!size && filePath && fs.existsSync(filePath)) {
    try { size = fs.statSync(filePath).size; } catch (_) {}
  }

  const sha1 = (details && details.sha1) || entry.sha1 || '';
  const game = (details && details.game) || entry.game || '';
  const canonicalPath = filePath ? path.resolve(filePath) : '';

  // Remove duplicate by canonical path, sha1, or name
  const filtered = list.filter(item => {
    if (canonicalPath && item.path && path.resolve(item.path) === canonicalPath) return false;
    if (sha1 && item.sha1 && item.sha1 === sha1) return false;
    if (!filePath && !sha1 && item.name === name) return false;
    return true;
  });

  filtered.unshift({
    path: filePath,
    name: name,
    customName: (details && details.customName) || '',
    vfsUri: (details && details.vfsUri) || '',
    kind: (details && details.isCustomMap) ? 'editor' : kind,
    lastUsed: now,
    size: size,
    icon: (details && details.icon) || '?',
    region: (details && details.region) || '?',
    regionName: (details && details.regionName) || 'Unknown ROM',
    isCustomMap: !!(details && details.isCustomMap),
    previewDataUri: (details && details.previewDataUri) || '',
    sha1: sha1,
    game: game,
  });

  writeHistoryFile(storageDir, filtered);
}

function getRecentRoms(storageDir: string, activeGame?: string | null) {
  const stored = readHistoryFile(storageDir);
  const tempEditorRoms = scanEditorTempRoms(storageDir);

  const byKey = new Map<string, HistoryItem>();
  for (const item of stored) {
    const k = item.path ? path.resolve(item.path) : (item.sha1 || item.name);
    byKey.set(k, item);
  }

  // Merge any scanned temp ROMs from editor that aren't recorded or have newer mtime
  for (const temp of tempEditorRoms) {
    const k = temp.path ? path.resolve(temp.path) : temp.name;
    const existing = byKey.get(k);
    if (!existing) {
      byKey.set(k, temp);
    } else if (temp.lastUsed > (existing.lastUsed || 0)) {
      existing.lastUsed = temp.lastUsed;
      existing.size = temp.size;
    }
  }

  const merged = Array.from(byKey.values());
  merged.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));

  let changed = false;

  // Deduplicate entries by sha1 and canonical path
  const seenSha1 = new Set<string>();
  const seenPath = new Set<string>();
  const uniqueList: HistoryItem[] = [];

  for (const item of merged) {
    let exists = false;
    let size = item.size || 0;
    if (item.path) {
      try {
        if (fs.existsSync(item.path)) {
          exists = true;
          if (!size) size = fs.statSync(item.path).size;
          if (!item.icon || item.icon === '?' || !item.sha1 || (item.isCustomMap && !item.previewDataUri)) {
            const d = detectRomDetails(item.path, item.path || item.name);
            if (d) {
              item.icon = d.icon;
              item.region = d.region;
              item.regionName = d.regionName;
              item.isCustomMap = d.isCustomMap;
              if (d.customName) item.customName = d.customName;
              if (d.vfsUri) item.vfsUri = d.vfsUri;
              if (d.previewDataUri) item.previewDataUri = d.previewDataUri;
              if (d.sha1) item.sha1 = d.sha1;
              if (d.game) item.game = d.game;
              changed = true;
            }
          }
        }
      } catch (_) {}
    }

    const normPath = item.path ? path.resolve(item.path) : '';
    if (item.sha1 && seenSha1.has(item.sha1)) continue;
    if (normPath && seenPath.has(normPath)) continue;

    if (item.sha1) seenSha1.add(item.sha1);
    if (normPath) seenPath.add(normPath);
    item.size = size;
    uniqueList.push(item);
  }

  // Filter by selected game: show matching game + unknown/custom maps; hide other games
  const filtered = uniqueList.filter(item => {
    if (!activeGame) return true;
    if (!item.game || item.isCustomMap) return true;
    return item.game === activeGame;
  });

  const result = filtered.slice(0, 10).map(item => {
    const exists = !!(item.path && fs.existsSync(item.path));
    return {
      path: item.path || '',
      name: item.name || (item.path ? path.basename(item.path) : 'ROM'),
      customName: item.customName || '',
      vfsUri: item.vfsUri || '',   // set by the game's describer (Evermore: soe://maps/custom/<name>)
      kind: item.kind || 'file',
      badge: getBadge(item.kind),
      lastUsed: item.lastUsed || 0,
      timeFormatted: formatRelativeTime(item.lastUsed),
      size: item.size || 0,
      sizeFormatted: formatBytes(item.size || 0),
      exists: exists,
      icon: item.icon || '?',
      region: item.region || '?',
      regionName: item.regionName || '',
      isCustomMap: !!item.isCustomMap,
      previewDataUri: item.previewDataUri || '',
      sha1: item.sha1 || '',
      game: item.game || '',
    };
  });

  if (changed) {
    try { writeHistoryFile(storageDir, merged); } catch (_) {}
  }

  return result;
}

function getRomOfferData(context: StorageContext, wsRoot?: string | null, cfgRomPath?: string | null, activeGame?: string | null) {
  const storageDir = getStorageDir(context);
  const vanilla = getVanillaRom(wsRoot, cfgRomPath);
  const recent = getRecentRoms(storageDir, activeGame);
  return { vanilla, recent };
}

function getSramPath(storageDir: string, romHash: string): string {
  const savesDir = path.join(storageDir, 'saves');
  try {
    if (!fs.existsSync(savesDir)) fs.mkdirSync(savesDir, { recursive: true });
  } catch (_) {}
  return path.join(savesDir, romHash.replace(/[^a-zA-Z0-9_-]/g, '_') + '.srm');
}

function savePersistentSram(storageDir: string, romHash: string, sramBase64: string): void {
  if (!romHash || !sramBase64) return;
  try {
    const srmPath = getSramPath(storageDir, romHash);
    const buf = Buffer.from(sramBase64, 'base64');
    fs.writeFileSync(srmPath, buf);
  } catch (_) {}
}

function loadPersistentSram(storageDir: string, romHash: string): string | null {
  if (!romHash) return null;
  try {
    const srmPath = getSramPath(storageDir, romHash);
    if (fs.existsSync(srmPath)) {
      const buf = fs.readFileSync(srmPath);
      return buf.toString('base64');
    }
  } catch (_) {}
  return null;
}

export type { RomDetails, RomDescriber, HistoryItem };
export { formatBytes, formatRelativeTime, getBadge, getStorageDir, getVanillaRom, scanEditorTempRoms, recordRomUsage, getRecentRoms, getRomOfferData, clearRecentRoms, detectRomDetails, setRomDescriber, savePersistentSram, loadPersistentSram };
