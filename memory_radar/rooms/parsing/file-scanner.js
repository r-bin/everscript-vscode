'use strict';
// Ownership: filesystem scanning — walking .evs directories, building the room tree,
// locating room images, and converting image paths to webview URIs.
// Impure: reads filesystem. No HTML rendering, no ROM data reading.

const path = require('path');
const fs   = require('fs');
const { parseRoomContent } = require('./content-parser');
const { readPngDimensions } = require('../../rom-readers');

// These are imported lazily via getters to avoid circular deps at require time.
// file-scanner depends on room-data functions (getMapEnum etc.) which may be in the same
// require graph. Passing them as callbacks keeps the dependency arrow one-directional.

/**
 * Locate a room image in the workspace.
 * Checks docs/rooms/images/{name}.{ext} then docs/rooms/{name}.{ext}.
 * @returns {string|null} Absolute filesystem path or null.
 */
function findRoomImage(wsRoot, mapName, vanillaId, filePath) {
    const names    = [mapName, vanillaId].filter(Boolean);
    const exts     = ['.png', '.jpg', '.jpeg', '.webp'];
    const baseDirs = [];
    if (filePath) baseDirs.push(path.dirname(filePath));
    if (wsRoot) {
        baseDirs.push(
            path.join(wsRoot, 'docs', 'rooms', 'images'),
            path.join(wsRoot, 'docs', 'rooms'),
        );
    }
    for (const dir of baseDirs) {
        for (const name of names) {
            for (const ext of exts) {
                const p = path.join(dir, name + ext);
                if (fs.existsSync(p)) return p;
            }
        }
    }
    return null;
}

/**
 * Walk a directory tree collecting map nodes.
 * [area] subdirs → area nodes; .evs files scanned for `map` declarations.
 *
 * @param {string}   dir     Absolute directory path to scan.
 * @param {string}   wsRoot  Workspace root (for image lookup + relative paths).
 * @param {number}   depth   Recursion guard (max 8).
 * @param {object}   extCfg  Extension config ({ romPath }).
 * @param {object}   deps    Runtime deps: { getMapEnum, readScriptAllTriggers, readLuaWatchers, readRomMapHeader }
 */
function collectRoomsFromDir(dir, wsRoot, depth, extCfg, deps) {
    if (depth > 8) return [];
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return []; }

    const items    = [];
    const subAreas = entries.filter(e => e.isDirectory() && e.name.startsWith('[area]')).sort((a, b) => a.name.localeCompare(b.name));
    const files    = entries.filter(e => !e.isDirectory() && e.name.endsWith('.evs') && !e.name.startsWith('_')).sort((a, b) => a.name.localeCompare(b.name));

    for (const sd of subAreas) {
        const areaName = sd.name.replace(/^\[area\]\s*/, '').replace(/^\d+_/, '');
        const children = collectRoomsFromDir(path.join(dir, sd.name), wsRoot, depth + 1, extCfg, deps);
        if (children.length) items.push({ name: areaName, kind: 'area', children });
    }

    const mapRe = /^\s*map\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(\s*([^)]*?)\s*\))?\s*\{/;
    for (const f of files) {
        const fp = path.join(dir, f.name);
        let text;
        try { text = fs.readFileSync(fp, 'utf8'); } catch { continue; }
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            const m = mapRe.exec(lines[i]);
            if (!m) continue;
            let d = 0, endLine = i;
            for (let j = i; j < lines.length; j++) {
                for (const c of lines[j]) {
                    if (c === '{') d++;
                    else if (c === '}') { d--; if (d === 0) { endLine = j; j = lines.length; break; } }
                }
            }
            const vid     = m[2] ? m[2].trim() : null;
            const content = parseRoomContent(fp, i, endLine);
            const imgPath = findRoomImage(wsRoot, m[1], vid, fp);
            if (wsRoot && vid && deps) {
                content.triggers = deps.readScriptAllTriggers(wsRoot, vid, extCfg.romPath || '');
                const luaPoi     = deps.readLuaWatchers(wsRoot);
                const roomNum    = deps.getMapEnum(wsRoot).get(vid);
                if (roomNum !== undefined) {
                    const hexKey = roomNum.toString(16).replace(/^0+/, '') || '0';
                    content.poi = luaPoi.get(hexKey) || null;
                    const _rh = deps.readRomMapHeader(wsRoot, roomNum, extCfg.romPath || '');
                    if (_rh) { content.trigOffset = { offX: _rh.offX, offY: _rh.offY }; content.romHeader = _rh; }
                }
            }
            items.push({
                name: m[1], vanillaId: vid, kind: 'map',
                filePath: fp, relPath: wsRoot ? path.relative(wsRoot, fp) : fp,
                startLine: i, endLine, content, imagePath: imgPath,
            });
        }
    }
    return items;
}

/**
 * Build the room tree from the active document, scanning #import directories.
 * Maps from the active document appear first.
 *
 * @param {vscode.TextDocument} document  Active VS Code document.
 * @param {string}              wsRoot    Workspace root.
 * @param {object}              extCfg    Extension config.
 * @param {object}              deps      Runtime deps: { getMapEnum, readScriptAllTriggers, readLuaWatchers, readRomMapHeader }
 */
function buildRoomTree(document, wsRoot, extCfg, deps) {
    const docPath = document.uri.fsPath;
    const docDir  = path.dirname(docPath);
    const mapRe   = /^\s*map\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(\s*([^)]*?)\s*\))?\s*\{/;

    const docMaps = [];
    for (let i = 0; i < document.lineCount; i++) {
        const m = mapRe.exec(document.lineAt(i).text);
        if (!m) continue;
        let d = 0, endLine = i;
        for (let j = i; j < document.lineCount; j++) {
            for (const c of document.lineAt(j).text) {
                if (c === '{') d++;
                else if (c === '}') { d--; if (d === 0) { endLine = j; j = document.lineCount; break; } }
            }
        }
        const vid     = m[2] ? m[2].trim() : null;
        const content = parseRoomContent(docPath, i, endLine);
        const imgPath = findRoomImage(wsRoot, m[1], vid, docPath);
        if (wsRoot && vid && deps) {
            content.triggers = deps.readScriptAllTriggers(wsRoot, vid, extCfg.romPath || '');
            const mapNum = deps.getMapEnum(wsRoot).get(vid);
            if (mapNum !== undefined) {
                const _rh = deps.readRomMapHeader(wsRoot, mapNum, extCfg.romPath || '');
                if (_rh) { content.trigOffset = { offX: _rh.offX, offY: _rh.offY }; content.romHeader = _rh; }
            }
        }
        docMaps.push({
            name: m[1], vanillaId: vid, kind: 'map',
            filePath: docPath, relPath: wsRoot ? path.relative(wsRoot, docPath) : docPath,
            startLine: i, endLine, content, imagePath: imgPath,
        });
    }

    const importedAreas = [];
    for (let i = 0; i < document.lineCount; i++) {
        const imp = document.lineAt(i).text.match(/#import\s*\(\s*["']([^"']+)["']\s*\)/);
        if (!imp) continue;
        const impRel     = imp[1].replace(/^\.\//, '');
        const candidates = [wsRoot ? path.join(wsRoot, impRel) : null, path.join(docDir, impRel)].filter(Boolean);
        for (const p of candidates) {
            if (!fs.existsSync(p)) continue;
            let stat;
            try { stat = fs.statSync(p); } catch { continue; }
            if (stat.isDirectory()) {
                const areaName = path.basename(p).replace(/^\[area\]\s*/, '').replace(/^\d+_/, '');
                const children = collectRoomsFromDir(p, wsRoot || docDir, 0, extCfg, deps);
                if (children.length) importedAreas.push({ name: areaName, kind: 'area', children });
            }
            break;
        }
    }

    const tree = [];
    if (docMaps.length) {
        if (importedAreas.length) {
            tree.push({ name: path.basename(docPath, '.evs'), kind: 'area', children: docMaps });
        } else {
            tree.push(...docMaps);
        }
    }
    tree.push(...importedAreas);
    return tree;
}

/**
 * Convert imagePath on every map node to a webview URI in-place. Also reads PNG dimensions.
 * @param {Array}    nodes        Room tree nodes (mutated in-place).
 * @param {Function} toWebviewUri (imagePath: string) => string
 */
function setRoomImageUris(nodes, toWebviewUri) {
    for (const n of nodes) {
        if (n.kind === 'map' && n.imagePath) {
            try {
                n.imageUri  = toWebviewUri(n.imagePath);
                if (n.imagePath.match(/\.png$/i)) n.imageDims = readPngDimensions(n.imagePath);
            } catch { n.imageUri = null; }
        }
        if (n.children) setRoomImageUris(n.children, toWebviewUri);
    }
}

module.exports = { findRoomImage, collectRoomsFromDir, buildRoomTree, setRoomImageUris };
