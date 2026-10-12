'use strict';

/**
 * src/emulator/rom-history.js
 *
 * Tracks ROM loading history and offers quick-launch targets for the emulator:
 * - Configured vanilla Secret of Evermore ROM
 * - Temporarily generated ROMs from the map editor (*_emulator.sfc)
 * - Recently opened / built / dropped ROM files
 */

const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const crypto = require('crypto');
const maps   = require('../maps');
const { resolveRomPath } = require('../shared/rom-readers');

const HISTORY_FILENAME = 'recent-roms.json';
const MAX_HISTORY_ITEMS = 15;

const KNOWN_EVERMORE_HASHES = [
  {
    region: 'US',
    name: 'USA',
    language: 'English',
    icon: 'US',
    flag: 'USA',
    crc32: 'a5c0045e',
    sha1: '79e7738630fff5699217ef58ecc421bc8fcbcd89',
  },
  {
    region: 'EU',
    name: 'Europe',
    language: 'English',
    icon: 'EU',
    flag: 'EUR',
    crc32: 'e168d085',
    sha1: 'ae17166919fdfdf26cc5771f83cfd19eaf71806c',
  },
  {
    region: 'DE',
    name: 'Germany',
    language: 'German',
    icon: 'DE',
    flag: 'DEU',
    crc32: '27f60e77',
    sha1: '5e5c2082526690d05f962c3ffbd7e080c681bfa4',
  },
  {
    region: 'FR',
    name: 'France',
    language: 'French',
    icon: 'FR',
    flag: 'FRA',
    crc32: '7425bb91',
    sha1: '8a430c9d6a3dcef974252fe8d946a0d619bb1a61',
  },
  {
    region: 'ES',
    name: 'Spain',
    language: 'Spanish',
    icon: 'ES',
    flag: 'ESP',
    crc32: '7bfe934f',
    sha1: '4363ce4b19e76261f9325ac9a0cce27d97490df2',
  },
];

let _crcTable = null;
function calcCrc32(bytes) {
  if (!_crcTable) {
    _crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      _crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = _crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function detectRomDetails(target) {
  try {
    let buf = null;
    if (typeof target === 'string') {
      if (!fs.existsSync(target)) return null;
      buf = fs.readFileSync(target);
    } else if (Buffer.isBuffer(target) || (target && target.buffer)) {
      buf = target;
    }
    if (!buf || buf.length < 0x200000) return null;

    const clean = (buf.length % 1024 === 512) ? buf.subarray(512) : buf;
    const sha1 = crypto.createHash('sha1').update(clean).digest('hex').toLowerCase();
    const crc = calcCrc32(clean).toString(16).padStart(8, '0').toLowerCase();

    // 1. Known Evermore releases
    const match = KNOWN_EVERMORE_HASHES.find(h => h.sha1 === sha1 || h.crc32 === crc);
    if (match) {
      return {
        known: true,
        isCustomMap: false,
        region: match.region,
        regionName: match.name,
        language: match.language,
        icon: match.icon,
        flag: match.flag,
        sha1: sha1,
        crc32: crc,
      };
    }

    // 2. Custom map showcase ROM detection
    // BuildExportRom patches intro jump at $92E0CA (file offset 0x12E0CA):
    // OP_CHANGE_MAP (0x22), at.x, at.y, roomId (0x15), 0x00, OP_END (0x00)
    if (clean.length >= 0x300000 && clean.length <= 0x500000) {
      const introOffset = 0x12e0ca;
      if (clean[introOffset] === 0x22 && clean[introOffset + 4] === 0x00 && clean[introOffset + 5] === 0x00) {
        const targetRoom = clean[introOffset + 3];
        if (targetRoom >= 0 && targetRoom <= 0x7e) {
          try {
            const room = maps.decodeRoom(clean, targetRoom);
            if (room && room.header) {
              let previewDataUri = '';
              try {
                const composite = maps.renderRoomComposite(clean, room);
                if (composite) previewDataUri = maps.encodePngDataUri(composite);
              } catch (_) {}
              return {
                known: false,
                isCustomMap: true,
                targetRoom: targetRoom,
                roomWidth: room.header.widthTiles,
                roomHeight: room.header.heightTiles,
                previewDataUri: previewDataUri || '',
                region: 'MAP',
                regionName: 'Custom Map (Room ' + targetRoom + ')',
                icon: 'MAP',
                flag: 'MAP',
                sha1: sha1,
                crc32: crc,
              };
            }
          } catch (_) {}
        }
      }
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
    const p = resolveRomPath(wsRoot, cfgRomPath || '');
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
        language: (details && details.language) || 'English',
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
    details = detectRomDetails(filePath);
  } else if (entry.romBuffer) {
    details = detectRomDetails(entry.romBuffer);
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
            const d = detectRomDetails(item.path);
            if (d) {
              item.icon = d.icon;
              item.region = d.region;
              item.regionName = d.regionName;
              item.isCustomMap = d.isCustomMap;
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
  calcCrc32,
  KNOWN_EVERMORE_HASHES,
};
