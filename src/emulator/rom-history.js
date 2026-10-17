'use strict';

/**
 * src/emulator/rom-history.js
 *
 * Tracks ROM loading history and offers quick-launch targets for the emulator:
 * - The base ROM of the selected game (ROM library)
 * - ROMs a game built itself (Evermore: map editor test ROMs, *_emulator.sfc), described by the game
 * - Recently opened / built / dropped ROM files
 */

const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const crypto = require('crypto');

const HISTORY_FILENAME = 'recent-roms.json';
const MAX_HISTORY_ITEMS = 15;

// Which game and variant a ROM is comes from the ROM library's identification (platform/roms/identify.ts);
// this file only shapes it for the quick-launch list.
const platform = require('../../dist/platform');

/**
 * A game can describe ROMs it built itself (Evermore: the map editor's test ROMs) before the
 * library identification runs: (rom without copier header, target, hintPath) => details or null.
 * Set by the emulator panel from configureEmulator({ game }).
 */
let _describeRom = null;
function setRomDescriber(fn) {
  _describeRom = typeof fn === 'function' ? fn : null;
}

function detectRomDetails(target, hintPath) {
  try {
    let buf = null;
    let targetPath = typeof target === 'string' ? target : (hintPath || '');
    if (typeof target === 'string') {
      if (!fs.existsSync(target)) return null;
      buf = fs.readFileSync(target);
    } else if (Buffer.isBuffer(target) || (target && target.buffer)) {
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

function formatBytes(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatRelativeTime(ts) {
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

function getBadge(kind) {
  switch (kind) {
    case 'editor':  return 'Map Editor';
    case 'vanilla': return 'Vanilla';
    case 'build':   return 'Build';
    case 'dropped': return 'Dropped';
    default:        return 'File';
  }
}

function getStorageDir(context) {
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

function getVanillaRom(wsRoot, cfgRomPath) {
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

function scanEditorTempRoms(storageDir) {
  const dirs = [storageDir, os.tmpdir()].filter(Boolean);
  const found = new Map();

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

function readHistoryFile(storageDir) {
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

function writeHistoryFile(storageDir, list) {
  const histPath = path.join(storageDir, HISTORY_FILENAME);
  try {
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
    fs.writeFileSync(histPath, JSON.stringify(list.slice(0, MAX_HISTORY_ITEMS), null, 2), 'utf8');
  } catch (_) {}
}

function clearRecentRoms(storageDir) {
  writeHistoryFile(storageDir, []);
}

function recordRomUsage(entry, context) {
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

  let details = null;
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

  // Remove duplicate by path or name
  const filtered = list.filter(item => {
    if (filePath && item.path === filePath) return false;
    if (!filePath && item.name === name) return false;
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
  });

  writeHistoryFile(storageDir, filtered);
}

function getRecentRoms(storageDir) {
  const stored = readHistoryFile(storageDir);
  const tempEditorRoms = scanEditorTempRoms(storageDir);

  const byPath = new Map();
  for (const item of stored) {
    if (item.path) byPath.set(item.path, item);
  }

  // Merge any scanned temp ROMs from editor that aren't recorded or have newer mtime
  for (const temp of tempEditorRoms) {
    const existing = byPath.get(temp.path);
    if (!existing) {
      byPath.set(temp.path, temp);
    } else if (temp.lastUsed > (existing.lastUsed || 0)) {
      existing.lastUsed = temp.lastUsed;
      existing.size = temp.size;
    }
  }

  const merged = Array.from(byPath.values());
  merged.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));

  let changed = false;
  const result = merged.slice(0, 10).map(item => {
    let exists = false;
    let size = item.size || 0;
    if (item.path) {
      try {
        if (fs.existsSync(item.path)) {
          exists = true;
          if (!size) size = fs.statSync(item.path).size;
          if (!item.icon || item.icon === '?' || (item.isCustomMap && !item.previewDataUri)) {
            const d = detectRomDetails(item.path, item.path || item.name);
            if (d) {
              item.icon = d.icon;
              item.region = d.region;
              item.regionName = d.regionName;
              item.isCustomMap = d.isCustomMap;
              if (d.customName) item.customName = d.customName;
              if (d.vfsUri) item.vfsUri = d.vfsUri;
              if (d.previewDataUri) item.previewDataUri = d.previewDataUri;
              changed = true;
            }
          }
        }
      } catch (_) {}
    }
    return {
      path: item.path || '',
      name: item.name || (item.path ? path.basename(item.path) : 'ROM'),
      customName: item.customName || '',
      vfsUri: item.vfsUri || '',   // set by the game's describer (Evermore: soe://maps/custom/<name>)
      kind: item.kind || 'file',
      badge: getBadge(item.kind),
      lastUsed: item.lastUsed || 0,
      timeFormatted: formatRelativeTime(item.lastUsed),
      size: size,
      sizeFormatted: formatBytes(size),
      exists: exists,
      icon: item.icon || '?',
      region: item.region || '?',
      regionName: item.regionName || '',
      isCustomMap: !!item.isCustomMap,
      previewDataUri: item.previewDataUri || '',
    };
  });

  if (changed) {
    try { writeHistoryFile(storageDir, merged); } catch (_) {}
  }

  return result;
}

function getRomOfferData(context, wsRoot, cfgRomPath) {
  const storageDir = getStorageDir(context);
  const vanilla = getVanillaRom(wsRoot, cfgRomPath);
  const recent = getRecentRoms(storageDir);
  return { vanilla, recent };
}

module.exports = {
  formatBytes,
  formatRelativeTime,
  getBadge,
  getStorageDir,
  getVanillaRom,
  scanEditorTempRoms,
  recordRomUsage,
  getRecentRoms,
  getRomOfferData,
  clearRecentRoms,
  detectRomDetails,
  setRomDescriber,
};
