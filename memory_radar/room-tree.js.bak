'use strict';
// Room tree building and rendering for Memory Radar — extracted from extension.js
// Parses map declarations from .evs files and builds a navigable tree.

const path = require('path');
const fs   = require('fs');
const { radarEsc, parseEvsNum } = require('./radar-utils');
const { readRomMapHeader, readPngDimensions } = require('./rom-readers');
const { getMapEnum, readScriptAllTriggers, readLuaWatchers, VANILLA_ROOMS } = require('./room-data');

/**
 * Locate a room image in the workspace.
 * Checks docs/rooms/images/{name}.{ext} and docs/rooms/{name}.{ext}.
 * @returns {string|null} Absolute filesystem path or null.
 */
function findRoomImage(wsRoot, mapName, vanillaId, filePath) {
    const names = [mapName, vanillaId].filter(Boolean);
    const exts  = ['.png', '.jpg', '.jpeg', '.webp'];
    const baseDirs = [];
    // Sibling of the .evs file first
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
 * Parse the content of a single map block from a file.
 * @param {string}  filePath  Absolute path to the .evs file.
 * @param {number}  startLine 0-based line of the opening `map NAME(...) {`.
 * @param {number}  endLine   0-based line of the closing `}`.
 * @returns {{initMap, entrances, enemies, objects, transitions}}
 */
function parseRoomContent(filePath, startLine, endLine) {
    let lines;
    try { lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/); }
    catch { return { initMap: null, entrances: [], enemies: [], objects: [], transitions: [] }; }

    const out = { initMap: null, entrances: [], enemies: [], objects: [], transitions: [], triggerNames: { stepOn: [], bTrigger: [] } };
    const objSeen = new Set();
    // objDesc: Map<index-string, description> from commented object lines
    const objDesc = new Map();
    // enum stepon_trigger / b_trigger member name tracking
    let inStepOnEnum = false, inBTrigEnum = false, enumDepth = 0;
    const end = Math.min(endLine, lines.length - 1);

    for (let i = startLine; i <= end; i++) {
        const raw = lines[i];
        // Extract inline comment before stripping
        const inlineCommentM = raw.match(/\/\/(.*)$/);
        const comment = inlineCommentM ? inlineCommentM[1].trim() : '';
        const t = raw.replace(/\/\/.*$/, '').trim();

        // Enum member name tracking for stepon_trigger / b_trigger
        if (!inStepOnEnum && !inBTrigEnum) {
            const em = t.match(/\benum\s+(stepon_trigger|b_trigger)\b/);
            if (em) { inStepOnEnum = em[1] === 'stepon_trigger'; inBTrigEnum = !inStepOnEnum; enumDepth = 0; }
        }
        if (inStepOnEnum || inBTrigEnum) {
            const prevD = enumDepth;
            for (const c of t) { if (c === '{') enumDepth++; else if (c === '}') enumDepth--; }
            if (prevD === 1) { // at member level before entering @install block
                const mm = t.match(/^\s*([A-Za-z_]\w*)\s*=/);
                if (mm) {
                    if (inStepOnEnum) out.triggerNames.stepOn.push(mm[1]);
                    else              out.triggerNames.bTrigger.push(mm[1]);
                }
            }
            if (enumDepth <= 0) { inStepOnEnum = inBTrigEnum = false; enumDepth = 0; }
        }

        // Commented object lines: // object[N] = val; // description
        const commentedObjM = comment.match(/\bobject\[(\w+)\]\s*=\s*[^;]+;?\s*(?:\/\/\s*(.+))?/);
        if (commentedObjM) {
            const idx = commentedObjM[1];
            const desc = commentedObjM[2] ? commentedObjM[2].trim() : '';
            if (!objDesc.has(idx) && desc) objDesc.set(idx, desc);
        }

        // init_map(x1, y1, x2, y2)
        if (!out.initMap) {
            const m = t.match(/\binit_map\s*\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)\)/);
            if (m) out.initMap = { x1: parseEvsNum(m[1]), y1: parseEvsNum(m[2]), x2: parseEvsNum(m[3]), y2: parseEvsNum(m[4]), line: i };
        }

        // NAME = entrance(x, y, DIR)
        const ent = t.match(/([A-Za-z_]\w*)\s*=\s*entrance\s*\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)\)/);
        if (ent) out.entrances.push({ name: ent[1], x: parseEvsNum(ent[2]), y: parseEvsNum(ent[3]), dir: ent[4].trim(), line: i });

        // add_enemy(TYPE, x, y, ...)
        const ae = t.match(/\badd_enemy\s*\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)/);
        if (ae && !isNaN(parseEvsNum(ae[2]))) out.enemies.push({ type: ae[1].trim(), x: parseEvsNum(ae[2]), y: parseEvsNum(ae[3]), dynamic: false, line: i });

        // add_basic_souls_enemy(TYPE, x, y) and similar add_*_enemy variants
        const abe = t.match(/\badd_\w*souls\w*_enemy\s*\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)\)/);
        if (abe && !isNaN(parseEvsNum(abe[2]))) out.enemies.push({ type: abe[1].trim(), x: parseEvsNum(abe[2]), y: parseEvsNum(abe[3]), dynamic: true, line: i });

        // object[N] = val; (live code) — description from inline comment
        const obj = t.match(/\bobject\[(\w+)\]/);
        if (obj && !objSeen.has(obj[1])) {
            objSeen.add(obj[1]);
            const desc = comment.replace(/^\/\/\s*/, '').replace(/object\[.*?\]\s*=\s*[^;]+;?\s*/, '').trim()
                        || objDesc.get(obj[1]) || '';
            out.objects.push({ index: obj[1], line: i, desc });
        }

        // map_transition(target, via, dir)
        const mt = t.match(/\bmap_transition\s*\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)\)/);
        if (mt) out.transitions.push({ target: mt[1].trim(), via: mt[2].trim(), dir: mt[3].trim(), line: i });
    }
    // Fill in descriptions from commented lines for objects found in live code
    for (const o of out.objects) {
        if (!o.desc && objDesc.has(o.index)) o.desc = objDesc.get(o.index);
    }
    // Fill object index gaps: object[0x05] implies 0x00..0x04 exist too
    if (out.objects.length > 0) {
        const parseIdx = s => parseInt(s, (s.startsWith('0x') || s.startsWith('0X')) ? 16 : 10);
        const maxIdx = Math.max(...out.objects.map(o => parseIdx(o.index)));
        const seenIdxs = new Set(out.objects.map(o => parseIdx(o.index)));
        for (let i = 0; i <= maxIdx; i++) {
            if (!seenIdxs.has(i))
                out.objects.push({ index: '0x' + i.toString(16).padStart(2, '0'), line: -1, desc: '' });
        }
        out.objects.sort((a, b) => parseIdx(a.index) - parseIdx(b.index));
    }
    return out;
}

/**
 * Walk a directory tree collecting map nodes.
 * [area] subdirs become area nodes; .evs files are scanned for `map` declarations.
 */
function collectRoomsFromDir(dir, wsRoot, depth, extCfg) {
    if (depth > 8) return [];
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return []; }

    const items = [];
    const subAreas = entries.filter(e => e.isDirectory() && e.name.startsWith('[area]')).sort((a, b) => a.name.localeCompare(b.name));
    const files    = entries.filter(e => !e.isDirectory() && e.name.endsWith('.evs') && !e.name.startsWith('_')).sort((a, b) => a.name.localeCompare(b.name));

    for (const sd of subAreas) {
        const areaName = sd.name.replace(/^\[area\]\s*/, '').replace(/^\d+_/, '');
        const children = collectRoomsFromDir(path.join(dir, sd.name), wsRoot, depth + 1, extCfg);
        if (children.length) items.push({ name: areaName, kind: 'area', children });
    }

    for (const f of files) {
        const fp = path.join(dir, f.name);
        let text;
        try { text = fs.readFileSync(fp, 'utf8'); } catch { continue; }
        const lines  = text.split(/\r?\n/);
        const mapRe  = /^\s*map\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(\s*([^)]*?)\s*\))?\s*\{/;
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
            if (wsRoot && vid) {
                content.triggers = readScriptAllTriggers(wsRoot, vid, extCfg.romPath || '');
                // Attach Lua POI and trigger origin offset if available
                const luaPoi = readLuaWatchers(wsRoot);
                const roomNumStr = getMapEnum(wsRoot).get(vid);
                if (roomNumStr !== undefined) {
                    const hexKey = roomNumStr.toString(16).replace(/^0+/, '') || '0';
                    content.poi = luaPoi.get(hexKey) || null;
                    const _rh = readRomMapHeader(wsRoot, roomNumStr, extCfg.romPath || '');
                    if (_rh) { content.trigOffset = { offX: _rh.offX, offY: _rh.offY }; content.romHeader = _rh; }
                }
            }
            items.push({ name: m[1], vanillaId: vid, kind: 'map', filePath: fp, relPath: wsRoot ? path.relative(wsRoot, fp) : fp, startLine: i, endLine, content, imagePath: imgPath });
        }
    }
    return items;
}

/**
 * Build the room tree from the active document, scanning #import directories.
 * Maps from the active document appear first (grouped if imports also exist).
 */
function buildRoomTree(document, wsRoot, extCfg) {
    const docPath = document.uri.fsPath;
    const docDir  = path.dirname(docPath);
    const mapRe   = /^\s*map\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(\s*([^)]*?)\s*\))?\s*\{/;

    // Parse maps declared directly in the active document
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
        if (wsRoot && vid) {
            content.triggers = readScriptAllTriggers(wsRoot, vid, extCfg.romPath || '');
            const mapNum = getMapEnum(wsRoot).get(vid);
            if (mapNum !== undefined) { const _rh = readRomMapHeader(wsRoot, mapNum, extCfg.romPath || ''); if (_rh) { content.trigOffset = { offX: _rh.offX, offY: _rh.offY }; content.romHeader = _rh; } }
        }
        docMaps.push({ name: m[1], vanillaId: vid, kind: 'map', filePath: docPath, relPath: wsRoot ? path.relative(wsRoot, docPath) : docPath, startLine: i, endLine, content, imagePath: imgPath });
    }

    // Scan #import directories
    const importedAreas = [];
    for (let i = 0; i < document.lineCount; i++) {
        const imp = document.lineAt(i).text.match(/#import\s*\(\s*["']([^"']+)["']\s*\)/);
        if (!imp) continue;
        const impRel = imp[1].replace(/^\.\//, '');
        const candidates = [wsRoot ? path.join(wsRoot, impRel) : null, path.join(docDir, impRel)].filter(Boolean);
        for (const p of candidates) {
            if (!fs.existsSync(p)) continue;
            let stat;
            try { stat = fs.statSync(p); } catch { continue; }
            if (stat.isDirectory()) {
                const areaName = path.basename(p).replace(/^\[area\]\s*/, '').replace(/^\d+_/, '');
                const children = collectRoomsFromDir(p, wsRoot || docDir, 0, extCfg);
                if (children.length) importedAreas.push({ name: areaName, kind: 'area', children });
            }
            break;
        }
    }

    const tree = [];
    if (docMaps.length) {
        if (importedAreas.length) {
            // Group the active-file maps under a named area node
            tree.push({ name: path.basename(docPath, '.evs'), kind: 'area', children: docMaps });
        } else {
            tree.push(...docMaps);
        }
    }
    tree.push(...importedAreas);
    return tree;
}

/** Server-side render of the static vanilla room list grouped by act. */
function renderVanillaTree() {
    let html = '<ul class="rt">';
    for (const grp of VANILLA_ROOMS) {
        html += '<li class="rn-area"><span class="rn-area-label">' + radarEsc(grp.area) + '</span><ul class="rt">';
        for (const r of grp.rooms) {
            html += '<li class="rn-map vn-map" data-vid="' + radarEsc(r.id)
                  + '"><span class="rn-label">' + radarEsc(r.name)
                  + '</span><span class="rn-vid-tag">' + radarEsc(r.id) + '</span></li>';
        }
        html += '</ul></li>';
    }
    return html + '</ul>';
}

/** Server-side render of the collapsible room tree as HTML. */
function renderRoomsTree(nodes) {
    if (!nodes || !nodes.length) return '<div class="rm-empty">No rooms found in this file.</div>';
    let html = '<ul class="rt">';
    for (const n of nodes) {
        if (n.kind === 'area') {
            html += '<li class="rn-area"><span class="rn-area-label">' + radarEsc(n.name) + '</span>' + renderRoomsTree(n.children) + '</li>';
        } else {
            const vid = n.vanillaId ? '<span class="rv-id">' + radarEsc(n.vanillaId) + '</span>' : '';
            html += '<li class="rn-map" data-map="' + radarEsc(n.name) + '" data-line="' + n.startLine + '"><span class="rn-map-label">' + radarEsc(n.name) + vid + '</span></li>';
        }
    }
    return html + '</ul>';
}

/** Build ROOMS JSON data object for embedding in the webview. Expects imagePath already converted to imageUri. */
function buildRoomsJson(tree, activeTab, selectedMap) {
    const all = {};
    function sanitizeTriggers(triggers) {
        if (!triggers) return null;
        const cleanScript = (script) => {
            if (!script) return null;
            const { scriptLines, ...rest } = script;
            return rest;
        };
        const clean = (arr) => (arr || []).map(cleanScript);
        return {
            meta: triggers.meta || null,
            enter: cleanScript(triggers.enter),
            stepOn: clean(triggers.stepOn),
            bTrigger: clean(triggers.bTrigger),
        };
    }
    function sanitizeContent(c) {
        if (!c) return null;
        return { ...c, triggers: sanitizeTriggers(c.triggers) };
    }
    function walk(nodes) {
        for (const n of nodes) {
            if (n.kind === 'map') {
                all[n.name] = { name: n.name, vanillaId: n.vanillaId || null, relPath: n.relPath || '',
                    startLine: n.startLine, endLine: n.endLine,
                    content: sanitizeContent(n.content),
                    imageUri: n.imageUri || null,
                    imageDims: n.imageDims || null };
            } else if (n.children) { walk(n.children); }
        }
    }
    walk(tree);
    return 'var ROOMS=' + JSON.stringify(all).replace(/<\/script>/gi, '<\\/script>') +
        ';var ACTIVE_TAB=' + JSON.stringify(activeTab || 'radar') +
        ';var SELECTED_MAP=' + JSON.stringify(selectedMap || null) + ';';
}

/** Convert imagePath on every map node to a webview URI in-place. Also reads PNG dimensions. */
function setRoomImageUris(nodes, toWebviewUri) {
    for (const n of nodes) {
        if (n.kind === 'map' && n.imagePath) {
            try {
                n.imageUri = toWebviewUri(n.imagePath);
                if (n.imagePath.match(/\.png$/i)) n.imageDims = readPngDimensions(n.imagePath);
            } catch { n.imageUri = null; }
        }
        if (n.children) setRoomImageUris(n.children, webview);
    }
}

module.exports = {
    findRoomImage,
    parseRoomContent,
    collectRoomsFromDir,
    buildRoomTree,
    renderVanillaTree,
    renderRoomsTree,
    buildRoomsJson,
    setRoomImageUris,
};
