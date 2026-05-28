'use strict';

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');
const { radarLifecycle, radarH, radarEsc, radarExtractEmoji, radarParseName, radarParseNotes, parseEvsNum, parseEnumsFromContent, parseEvsEnumValues } = require('./memory_radar/radar-utils');
const radarWebview = require('./memory_radar/webview');
const { readRoomScriptModel } = require('./debugger/emulator/room-script-model');
const { resolveExtConfig, getRepoAutofillUpdates } = require('./settings-model');



const lp = require('./code_highlighter/language-providers');


// ── Memory Radar ─────────────────────────────────────────────────────────────
// Region boundaries (from compiler/ast_everscript.py + core/[group] 00_general_enums/02_ram.evs):
//   temp    0x2800–0x28FF  compiler type "28" — cleared on room load, scratch vars
//   session 0x2200–0x27FF  compiler type "22" — persistent across rooms
//   sram    varies         explicitly tagged [SRAM] in memory map
//   system  everything else (0x0000–0x21FF engine/HW, 0x2900+)

// Note: _loot_chest/_loot/loot/retained_object are dynamically allocated from the
// compiler memory pool — addresses cannot be statically inferred from call sites.

let _radarPanel        = null;   // active radar webview panel
let _radarPinned       = false;  // when true, radar ignores editor/scope changes
let _radarDoc          = null;   // document the radar was last rendered for
let _radarCurrentScope = null;   // scope the radar was last rendered for
let _radarMapCache     = null;   // cached parsed memory-map.md
let _radarEnumCache    = null;   // cached enum cross-reference (addr→[{cls,name}])
let _radarUpdateTimer  = null;   // debounce timer for auto-update
let _radarRoomTree     = null;   // cached room tree (rebuilt when doc changes)
let _radarRoomDocPath  = null;   // fsPath the room tree was built for
let _radarActiveTab    = 'radar'; // preserved tab across re-renders
let _scalingChars      = null;   // cached character stat array (142 entries from ROM)
let _hitLookup         = null;   // precomputed hit% table {hit_rate:{evade:pct}} from ROM
let _scaleActive       = false;  // whether scale_enemies is active in workspace
let _ingrBaseUri       = '';     // webview URI base for ingredient images (set on panel creation)
let _radarByteScriptFocus = '';  // currently focused byte-script address from emulator panel

function getRadarMap() {
    if (_radarMapCache) return _radarMapCache;
    const wf = vscode.workspace.workspaceFolders?.[0];
    if (!wf) return new Map();
    _radarMapCache = radarReadMemoryMap(path.join(wf.uri.fsPath, '.github', 'memory-map.md'));
    return _radarMapCache;
}

function invalidateRadarMap() { _radarMapCache = null; }

/** Parse core evs files for enum entries mapping <0xNNNN> addresses to enum names.
 *  Returns Map<addr, [{cls, name}]> — cls is the enum class name, name is the member. */
function radarReadEnums(wsFolder) {
    const cache = new Map();
    const coreDir = path.join(wsFolder, 'in', 'core');
    if (!fs.existsSync(coreDir)) return cache;
    const scanContent = (content) => {
        for (const [addr, entries] of parseEnumsFromContent(content)) {
            if (!cache.has(addr)) cache.set(addr, []);
            for (const e of entries) cache.get(addr).push(e);
        }
    };
    const scanDir = (dir) => {
        let entries;
        try { entries = fs.readdirSync(dir); } catch { return; }
        for (const f of entries) {
            const fp = path.join(dir, f);
            try {
                const st = fs.statSync(fp);
                if (st.isDirectory()) scanDir(fp);
                else if (f.endsWith('.evs')) scanContent(fs.readFileSync(fp, 'utf8'));
            } catch { /* skip unreadable files */ }
        }
    };
    scanDir(coreDir);
    return cache;
}

function getRadarEnums() {
    if (_radarEnumCache) return _radarEnumCache;
    const wf = vscode.workspace.workspaceFolders?.[0];
    if (!wf) return new Map();
    _radarEnumCache = radarReadEnums(wf.uri.fsPath);
    return _radarEnumCache;
}

function invalidateRadarEnums() { _radarEnumCache = null; }

function invalidateRoomCaches() {
    _radarRoomTree = null;
    _radarRoomDocPath = null;
    invalidateRoomDataCaches();
}

/**
 * Read extension settings with workspace-based defaults.
 * All values are mocked / defaulted for now; will be user-configurable at release.
 */
function getExtConfig() {
    const cfg    = vscode.workspace.getConfiguration('everscript');
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    const resolved = resolveExtConfig({
        repoPath: cfg.get('repoPath'),
        inDirectory: cfg.get('inDirectory'),
        patchesDirectory: cfg.get('patchesDirectory'),
        patchesPath: cfg.get('patchesPath'),
        romPath: cfg.get('romPath'),
        assetsPath: cfg.get('assetsPath'),
        compilerPath: cfg.get('compilerPath'),
        pythonPath: cfg.get('pythonPath'),
        snesCorePath: cfg.get('snesCorePath'),
    }, wsRoot);
    return {
        inDir: resolved.inDirectory || null,
        patchesDir: resolved.patchesDirectory || null,
        romPath: resolved.romPath || null,
        assetsPath: resolved.assetsPath,
        repoPath: resolved.repoPath || null,
        compilerPath: resolved.compilerPath || null,
        pythonPath: resolved.pythonPath || null,
        snesCorePath: resolved.snesCorePath || null,
    };
}

const roomData = require('./memory_radar/room-data');
const { VANILLA_ROOMS, getMapEnum, readLuaWatchers, readScriptAllTriggers, buildVanillaRoomContent, buildVanillaRoomDetails, invalidateRoomDataCaches } = roomData;
const roomTree = require('./memory_radar/room-tree');
const { findRoomImage, parseRoomContent, collectRoomsFromDir, buildRoomTree, renderVanillaTree, renderRoomsTree, buildRoomsJson, setRoomImageUris } = roomTree;

const romReaders = require('./memory_radar/rom-readers');
const { readPngDimensions, readRomTriggerOffsets, readRomMapHeader, readRomCharacters, readRomHitLookup, detectScaleEnemies } = romReaders;

function renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTree = [], activeTab = 'radar', selectedMap = null, chars = [], scaleActive = false, ingrBaseUri = '', hitLookup = null) {
    const COLS = 16;
    const allAddrs = [...mapByAddr.keys(), ...refs.keys()];
    if (!allAddrs.length) { allAddrs.push(0x2200, 0x28FF); }
    const rowStart = Math.min(...allAddrs) & ~(COLS - 1);
    const rowEnd   = (Math.max(...allAddrs) | (COLS - 1)) + 1;
    const enumByAddr = getRadarEnums();

    const lcCount = (lc) => {
        const seen = new Set();
        for (const e of mapByAddr.values()) { if (e.lifecycle === lc && !seen.has(e)) seen.add(e); }
        return seen.size;
    };
    const lcUsed = (lc) => {
        const seen = new Set();
        for (const [addr, e] of mapByAddr) {
            if (e.lifecycle !== lc || !refs.has(addr) || seen.has(e)) continue;
            seen.add(e);
        }
        return seen.size;
    };

    const bar = (u, t, lc) => {
        const p = t ? Math.round(u / t * 100) : 0;
        const w = Math.max(p, u > 0 ? 2 : 0);
        return '<div class="bo"><div class="bi bi-' + lc + '" style="width:' + w + '%"></div></div>' +
               '<span class="bl">' + u + '/' + t + ' (' + p + '%)</span>';
    };

    // Build cell data (keyed by address number for JSON)
    const cellData = {};
    for (const [addr, me] of mapByAddr) {
        const usage = refs.get(addr);
        cellData[addr] = {
            addr: radarH(addr), name: me.name, type: me.type,
            lc: radarLifecycle(addr, me.type, me.notes), notes: me.notes,
            addrStart: me.addrStart, addrEnd: me.addrEnd,
            emoji: radarExtractEmoji(me.name + ' ' + me.notes),
            reads: usage ? usage.reads : [],
            writes: usage ? usage.writes : [],
        };
    }
    for (const [addr, usage] of refs) {
        if (!cellData[addr]) {
            const lc = radarLifecycle(addr, '', '');
            const inPool = pools.some(p => addr >= p.start && addr <= p.end);
            cellData[addr] = {
                addr: radarH(addr),
                name: inPool ? '(pool alloc)' : '(untracked)',
                type: inPool ? 'pool' : '?',
                lc, notes: '', addrStart: addr, addrEnd: addr, emoji: '',
                reads: usage.reads, writes: usage.writes,
                untracked: true, inPool,
            };
        }
    }

    // Mark pool addresses in cellData (addresses declared in pool ranges but not individually referenced)
    for (const pool of pools) {
        for (let a = pool.start; a <= pool.end; a++) {
            if (!cellData[a]) {
                cellData[a] = {
                    addr: radarH(a), name: '(pool)', type: 'pool',
                    lc: radarLifecycle(a, '', ''), notes: 'pool: ' + radarH(pool.start) + '\u2013' + radarH(pool.end),
                    addrStart: pool.start, addrEnd: pool.end, emoji: '',
                    reads: [], writes: [], isPool: true,
                };
            }
        }
    }

    // Grid HTML
    let gridHtml = '';
    for (let base = rowStart; base < rowEnd; base += COLS) {
        let cells = '', rowLcs = new Set(), allRest = true, rowHasUsed = false, rowHasDoc = false;
        for (let col = 0; col < COLS; col++) {
            const addr  = base + col;
            const me    = mapByAddr.get(addr);
            const usage = refs.get(addr);
            const lc    = radarLifecycle(addr, me ? me.type : '', me ? me.notes : '');
            const isUsed = !!usage;
            const isPool = !me && !usage && cellData[addr] && cellData[addr].isPool;
            const isRest = !me && !isUsed && !isPool;
            if (!isRest) { allRest = false; rowLcs.add(lc); }
            if (isUsed) rowHasUsed = true;
            if (me) rowHasDoc = true;
            let cls = 'cell lc-' + lc;
            if (isPool) cls += ' cp';
            if (isUsed) {
                cls += ' cu';
                if (usage.writes.length && !usage.reads.length) cls += ' cw';
                else if (usage.writes.length && usage.reads.length) cls += ' crw';
            }
            if (isRest) cls += ' cr';
            const cd = cellData[addr];
            const tip = radarEsc(radarH(addr) + (me ? ' ' + me.name : ''));
            const emoji = cd ? cd.emoji : '';
            const gsize = me ? (me.addrEnd - me.addrStart + 1) : 1;
            const grpAttrs = (gsize > 1)
                ? ' data-gid="' + me.addrStart + '" data-gend="' + me.addrEnd + '"'
                : '';
            cells += '<span class="' + cls + '" data-addr="' + addr + '"' +
                     ' title="' + tip + '"' + grpAttrs +
                     (emoji ? ' data-emoji="' + radarEsc(emoji) + '"' : '') +
                     '></span>';
        }
        gridHtml += '<div class="gr' + (allRest ? ' gar' : '') +
                    '" data-lcs="' + [...rowLcs].join(' ') + '"' +
                    ' data-used="' + (rowHasUsed ? '1' : '0') + '"' +
                    ' data-hasdoc="' + (rowHasDoc ? '1' : '0') + '">' +
                    '<span class="rl">' + radarH(base) + '</span>' + cells + '</div>';
    }

    // Detail table: unified list — all entries (known + untracked) sorted by address.
    // For bit-fielded entries (nameParts.length > 1) expand into sub-rows with rowspan.
    const mkLinks = (items, cls) => items.map(r =>
        '<a class="ll' + (cls ? ' ' + cls : '') + '" data-line="' + r.line + '" title="' + radarEsc(r.text) + '">:' + (r.line + 1) + '</a>'
    ).join('');

    const allEntries = [];
    const seenE = new Set();
    for (const [, e] of [...mapByAddr.entries()].sort((a, b) => a[0] - b[0])) {
        if (seenE.has(e)) continue;
        seenE.add(e);
        allEntries.push({ addr: e.addrStart, e, usage: refs.get(e.addrStart) || null });
    }
    const seenU = new Set();
    for (const [addr, usage] of refs) {
        if (mapByAddr.has(addr) || seenU.has(addr)) continue;
        seenU.add(addr);
        const cd = cellData[addr];
        const lc = radarLifecycle(addr, '', '');
        const label = cd && cd.inPool ? '(pool alloc)' : '(untracked)';
        allEntries.push({
            addr, usage,
            e: { name: label, nameParts: [label], type: cd && cd.inPool ? 'pool' : '?', notes: '',
                 lifecycle: lc, addrStart: addr, addrEnd: addr },
            untracked: true, inPool: cd && cd.inPool,
        });
    }
    allEntries.sort((a, b) => a.addr - b.addr);

    const detailRows = allEntries.map(({ addr, e, usage, untracked, inPool }) => {
        const lc = e.lifecycle;
        const em = radarExtractEmoji(e.name + ' ' + e.notes);
        const addrLabel = e.addrStart === e.addrEnd
            ? radarH(e.addrStart)
            : radarH(e.addrStart) + '\u2013' + radarH(e.addrEnd);
        const wLinks = usage ? mkLinks(usage.writes, 'lw') : '';
        const rLinks = usage ? mkLinks(usage.reads, '') : '';
        const linesCell = (rLinks || wLinks)
            ? (wLinks ? '<span class="rw-w">' + wLinks + '</span>' : '') +
              (rLinks ? '<span class="rw-r">' + rLinks + '</span>' : '')
            : '&ndash;';
        const badge = untracked
            ? (inPool ? '<span class="pool-badge">pool</span>' : '<span class="unk-badge">?</span>')
            : '';
        const emCell = em ? '<span class="te">' + em + '</span>' : '';
        const rowCls = 'dr lc-' + lc + (usage ? ' du' : '') + (untracked ? ' untracked' : '');
        const notesHtml = untracked
            ? '<span class="scope-only">scope usage only</span>'
            : (e.notes ? radarEsc(e.notes).replace(/\n/g, '<br>') : '&ndash;');

        const hdoc = untracked ? 0 : 1;

        // Enum cross-reference: show ENUM.NAME tags for the entry's start address
        const enumEntries = !untracked ? (enumByAddr.get(e.addrStart) || []) : [];
        const enumHtml = enumEntries.length
            ? '<br>' + enumEntries.map(ev => '<span class="enum-tag">' + radarEsc(ev.cls + '.' + ev.name) + '</span>').join(' ')
            : '';

        const parts = e.nameParts && e.nameParts.length > 1 ? e.nameParts : null;
        const numBytes = e.addrEnd - e.addrStart + 1;
        const typeStr = radarEsc(e.type.replace(/\s*\[SRAM\]/gi, '').trim());
        const es = e.addrStart, ee = e.addrEnd;

        // Bit-field expansion: one row per named part; each sub-row gets own T, Notes, Lines
        if (parts) {
            // Distribute notes by <br> if count matches; else first row gets full notes, rest get —
            const notesBrParts = notesHtml !== '&ndash;' ? notesHtml.split(/<br\s*\/?>/gi) : null;
            const notesDistrib = (notesBrParts && notesBrParts.length === parts.length) ? notesBrParts : null;
            let html = '<tr id="dr-' + es + '" class="' + rowCls + '" data-addr="' + es + '" data-es="' + es + '" data-ee="' + ee + '" data-hasdoc="' + hdoc + '">';
            html += '<td class="mo" rowspan="' + parts.length + '">' + badge + addrLabel + '</td>';
            html += '<td class="bf">' + radarEsc(parts[0]) + '</td>';
            html += '<td class="mt">' + typeStr + '</td>';
            html += '<td class="nt">' + (notesDistrib ? notesDistrib[0] : notesHtml) + enumHtml + '</td>';
            html += '<td class="rwc">' + linesCell + '</td></tr>';
            for (let i = 1; i < parts.length; i++) {
                html += '<tr id="dr-' + es + '-' + i + '" class="' + rowCls + ' bfc" data-addr="' + es + '" data-part="' + i + '" data-es="' + es + '" data-ee="' + ee + '" data-hasdoc="' + hdoc + '">';
                html += '<td class="bf">' + radarEsc(parts[i]) + '</td>';
                html += '<td class="mt">' + typeStr + '</td>';
                html += '<td class="nt">' + (notesDistrib ? notesDistrib[i] : '&ndash;') + '</td>';
                html += '<td class="rwc">' + linesCell + '</td></tr>';
            }
            return html;
        }

        // Multi-byte (Word etc.): single row, address range in addr cell
        if (!untracked && numBytes > 1) {
            return '<tr id="dr-' + es + '" class="' + rowCls + '" data-addr="' + es + '" data-es="' + es + '" data-ee="' + ee + '" data-hasdoc="' + hdoc + '">' +
                '<td class="mo">' + badge + addrLabel + '</td>' +
                '<td>' + radarEsc(e.name) + '</td>' +
                '<td class="mt">' + typeStr + '</td>' +
                '<td class="nt">' + notesHtml + enumHtml + '</td>' +
                '<td class="rwc">' + linesCell + '</td></tr>';
        }

        const nameCls = untracked ? ' class="no-vanilla"' : '';
        return '<tr id="dr-' + addr + '" class="' + rowCls + '" data-addr="' + addr + '" data-es="' + es + '" data-ee="' + ee + '" data-hasdoc="' + hdoc + '">' +
            '<td class="mo">' + badge + addrLabel + '</td>' +
            '<td' + nameCls + '>' + radarEsc(e.name) + '</td>' +
            '<td class="mt">' + typeStr + '</td>' +
            '<td class="nt">' + notesHtml + enumHtml + '</td>' +
            '<td class="rwc">' + linesCell + '</td></tr>';
    }).join('');

    // Pool declaration header rows (shown above the data rows)
    const poolRows = pools.map(p =>
        '<tr class="pool-row lc-' + p.lc + '">' +
        '<td class="mo"><span class="pool-badge">' + p.lc + '</span>' + radarH(p.start) + '\u2013' + radarH(p.end) + '</td>' +
        '<td colspan="2">declared pool &mdash; ' + (p.end - p.start + 1) + ' bytes at line ' + (p.line + 1) + '</td>' +
        '<td class="nt">' + p.lc + ' region</td><td>&ndash;</td></tr>'
    ).join('');

    const tempT = lcCount('temp'), sessT = lcCount('session'), sramT = lcCount('sram');
    const tempU = lcUsed('temp'),  sessU = lcUsed('session'),  sramU = lcUsed('sram');

    // Arg grid: show as word-sized slots, 8 per row (each slot = 1 arg = default word)
    let argHtml = '';
    const showArgGrid = argRefs.size > 0 || scope.kind === 'fun';
    if (showArgGrid) {
        const ARG_COLS = 8;
        const MIN_ARG_ROWS = scope.kind === 'fun' ? 2 : 1;
        const maxArgIdx = argRefs.size > 0 ? Math.max(...argRefs.keys()) : -1;
        const argRowEnd = Math.max((maxArgIdx | (ARG_COLS - 1)) + 1, ARG_COLS * MIN_ARG_ROWS);
        for (let base = 0; base < argRowEnd; base += ARG_COLS) {
            let cells = '', rowHasUsed = false;
            for (let col = 0; col < ARG_COLS; col++) {
                const idx = base + col;
                const usage = argRefs.get(idx);
                const isUsed = !!usage;
                if (isUsed) rowHasUsed = true;
                let cls = 'cell lc-temp arg-word';
                if (isUsed) {
                    cls += ' cu';
                    if (usage.writes.length && !usage.reads.length) cls += ' cw';
                    else if (usage.writes.length && usage.reads.length) cls += ' crw';
                }
                const rw = isUsed ? (usage.writes.length && usage.reads.length ? ' rw' : usage.writes.length ? ' write' : ' read') : '';
                cells += '<span class="' + cls + '" data-arg-idx="' + idx + '" title="arg[' + radarH(idx) + '] Word' + rw + '"></span>';
            }
            argHtml += '<div class="gr arg-row' + (rowHasUsed ? '' : ' arg-row-empty') + '">' +
                '<span class="rl">' + radarH(base) + '</span>' + cells + '</div>';
        }
    }

    const jsData = 'var CELLS=' + JSON.stringify(cellData).replace(/<\/script>/gi, '<\\/script>') + ';';

    const css = radarWebview.css;

    // ── Rooms tab data ──────────────────────────────────────────────────────
    const treeHtml       = renderRoomsTree(roomTree);
    const vanillaTreeHtml = renderVanillaTree();
    const _vrdCfg = getExtConfig();
    const vanillaRoomDetails = buildVanillaRoomDetails(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null, _vrdCfg.romPath || '');
    const roomsData      = buildRoomsJson(roomTree, activeTab, selectedMap)
        + '\nvar INGR_BASE=' + JSON.stringify(ingrBaseUri) + ';'
        + '\nvar ACTIVE_BYTE_SCRIPT_FOCUS=' + JSON.stringify(_radarByteScriptFocus || '') + ';'
        + '\nvar VANILLA_ROOMS_DATA=' + JSON.stringify(VANILLA_ROOMS) + ';'
        + '\nvar VANILLA_ROOM_DETAILS=' + JSON.stringify(vanillaRoomDetails).replace(/<\/script>/gi, '<\\/script>') + ';';

    // ── Scaling tab data ────────────────────────────────────────────────────
    const scalingData = 'var SC_CHARS=' + JSON.stringify(chars) + ';'
        + 'var SC_HIT_LOOKUP=' + JSON.stringify(hitLookup || {}) + ';'
        + 'var SC_SCALE_ACTIVE=' + (scaleActive ? 'true' : 'false') + ';'
        + 'var SC_BOY={atk1:7,def1:5,hp1:30,atkG:2,defG:1,hpG:9,hitRate1:38,hitRateG:1};'
        + 'var SC_DOG={atk1:17,def1:10,hp1:36,atkG:4,defG:6,hpG:9,hitRate1:50,hitRateG:1};'
        + 'var SC_SCALABLE={0:SC_BOY,1:SC_DOG};'
        + 'var SC_WEAPONS=['
        + '{id:"sw1",label:"Sword I",type:"sword",bonus:10},'
        + '{id:"sw2",label:"Sword II",type:"sword",bonus:20},'
        + '{id:"sw3",label:"Sword III",type:"sword",bonus:30},'
        + '{id:"sw4",label:"Sword IV",type:"sword",bonus:50},'
        + '{id:"ax1",label:"Axe I",type:"axe",bonus:15},'
        + '{id:"ax2",label:"Axe II",type:"axe",bonus:25},'
        + '{id:"ax3",label:"Axe III",type:"axe",bonus:35},'
        + '{id:"ax4",label:"Axe IV",type:"axe",bonus:50},'
        + '{id:"sp1",label:"Spear I",type:"spear",bonus:20},'
        + '{id:"sp2",label:"Spear II",type:"spear",bonus:30},'
        + '{id:"sp3",label:"Spear III",type:"spear",bonus:40},'
        + '{id:"sp4",label:"Spear IV",type:"spear",bonus:50}'
        + '];'
        + 'var SC_SPELLS=['
        + '{id:"acid",label:"Acid Rain",type:"alchemy",might:17,color:"#4b9f67"},'
        + '{id:"corrosion",label:"Corrosion",type:"alchemy",might:25,color:"#5ab08c"},'
        + '{id:"drain",label:"Drain",type:"alchemy",might:25,color:"#8e8bc7"},'
        + '{id:"flash",label:"Flash",type:"alchemy",might:27,color:"#d6a34a"},'
        + '{id:"hardball",label:"Hard Ball",type:"alchemy",might:21,color:"#4c86d9"},'
        + '{id:"doubledrain",label:"Double Drain",type:"alchemy",might:50,color:"#8f6bd1"},'
        + '{id:"lance",label:"Lance",type:"alchemy",might:50,color:"#46a9a1"},'
        + '{id:"crush",label:"Crush",type:"alchemy",might:62,color:"#c07845"},'
        + '{id:"fireball",label:"Fireball",type:"alchemy",might:62,color:"#db7049"},'
        + '{id:"sting",label:"Sting",type:"alchemy",might:75,color:"#d2b247"},'
        + '{id:"explosion",label:"Explosion",type:"alchemy",might:87,color:"#df5d3c"},'
        + '{id:"storm",label:"Lightning Storm",type:"alchemy",might:87,color:"#6797df"},'
        + '{id:"firepower",label:"Fire Power",type:"alchemy",might:112,color:"#e0582e"},'
        + '{id:"nitro",label:"Nitro",type:"alchemy",might:112,color:"#ef4343"}'
        + '];'
        + 'var SC_COLORS={sword:"#4488ff",axe:"#ff8844",spear:"#44bb66",dog:"#cc88ff"};'
        + 'var SC_TIER_OPAC=[0.18,0.32,0.50,0.75];'
        + 'var SC_MAX_LEVEL=37;';
    const scalingJs = radarWebview.scalingJs;
    const roomsJs = radarWebview.roomsJs;
    const docsJs = radarWebview.docsJs;
    const routeJs = radarWebview.routeJs;
    const rngJs = radarWebview.rngJs;
    const js = radarWebview.buildMainJs({ jsData, roomsData, scalingData, roomsJs, scalingJs, docsJs, routeJs, rngJs });

    const btns =
        '<button class="fb ft on" data-cls="ft" title="temp 0x2834\u20130x28FF: cleared on room load">temp</button>' +
        '<button class="fb fs on" data-cls="fs" title="session 0x2200\u20130x27FF: persistent across rooms">session</button>' +
        '<button class="fb fr2 on" data-cls="fr2" title="sram: battery-backed, tagged [SRAM]">sram</button>' +
        '<button class="fb fy on" data-cls="fy" title="system: engine/HW registers">system</button>' +
        '<button class="fb frest" data-cls="frest" title="rest: undocumented addresses (hidden by default)">rest</button>' +
        '<span class="sep"></span>' +
        '<button class="fb fboring" id="btn-boring" title="Hide rows with no cells used in scope">boring</button>' +
        '<button class="fb falloc" id="btn-alloc" title="Show only documented (non-gap) rows">alloc</button>' +
        '<button class="fb femoji" id="btn-emoji" title="Show emoji in grid cells">emoji</button>' +
        '<button class="fb fgroup" id="btn-group" title="Group coloring: color-stripe cells in same multi-byte entry (off by default)">group</button>' +
        '<button class="fb fhideargs on" id="btn-hideargs" title="Hide arg slots with no usage in scope">hide unused args</button>' +
        '<button class="fb fpin" id="btn-pin" title="Pin: lock to current scope, stop auto-update">pin</button>' +
        '<button class="fb fglobal" id="btn-global" title="Global scope: show whole file instead of current function">global</button>';

    return '<!doctype html><html><head><meta charset="utf-8"><style>' + css + '</style></head>' +
        '<body class="hrest">' +
        '<div class="tabs">' +
        '<button class="tab tab-active" data-tab="radar">\u26a1 Memory</button>' +
        '<button class="tab" data-tab="rooms">\ud83d\uddfa Rooms</button>' +
        '<button class="tab" data-tab="scaling">\u2694\ufe0f Scaling</button>' +
        '<button class="tab" data-tab="route">\ud83e\udded Route</button>' +
        '<button class="tab" data-tab="docs">\ud83d\udcda Docs</button>' +
        '<button class="tab" data-tab="rng">\ud83c\udfb2 RNG</button>' +
        '</div>' +
        '<div class="tab-pane" data-tab="radar">' +
        '<div class="head">' +
        '<div class="sm">Scope: <strong>' + radarEsc(scope.kind) + ' ' + radarEsc(scope.name) +
        '</strong> | Lines: ' + (scope.startLine + 1) + '\u2013' + (scope.endLine + 1) + '</div>' +
        '<div class="filters">' + btns + '</div>' +
        '<h2>Region Usage</h2>' +
        '<div class="sr"><span class="sl">temp</span>' + bar(tempU, tempT, 'temp') + '</div>' +
        '<div class="sr"><span class="sl">session</span>' + bar(sessU, sessT, 'session') + '</div>' +
        '<div class="sr"><span class="sl">sram</span>' + bar(sramU, sramT, 'sram') + '</div>' +
        '</div>' +
        '<div class="panels">' +
        '<div class="left-panel">' +
        (argHtml ? '<div class="ph">Args <span class="ph-sub">word</span></div><div class="gw arg-gw">' + argHtml + '</div>' : '') +
        '<div class="ph">WRAM ' + radarH(rowStart) + '\u2013' + radarH(rowEnd - 1) + '</div>' +
        '<div class="gw">' + gridHtml + '</div>' +
        '</div>' +
        '<div class="right-panel"><div class="dt-wrap">' +
        '<table><thead><tr><th>Addr</th><th>Name</th><th>T</th><th>Notes</th><th>Lines</th></tr></thead>' +
        '<tbody>' + (poolRows || '') + detailRows + '</tbody></table></div></div>' +
        '</div>' +
        '</div>' +
        '<div class="tab-pane" data-tab="rooms" style="display:none">' +
        '<div class="rm-panels">' +
        '<div class="rm-left">' +
        '<div class="rm-ph"><span>Rooms</span><div class="rm-mode"><button class="rmm active" id="rmm-live" title="Show rooms from the active .evs file">Live</button><button class="rmm" id="rmm-vanilla" title="Show all vanilla rooms">Vanilla</button></div></div>' +
        '<div id="rm-live-tree">' + treeHtml + '</div>' +
        '<div id="rm-vanilla-tree" style="display:none">' + vanillaTreeHtml + '</div>' +
        '</div>' +
        '<div class="rm-right"><div id="room-detail" class="rm-detail-placeholder"><span>Select a room</span></div></div>' +
        '</div>' +
        '</div>' +
        '<div class="tab-pane" data-tab="scaling" style="display:none">' +
        '<div class="sc-wrap">' +
        (scaleActive ? '<div class="sc-banner">\u26a0 scale_enemies active \u2014 enemy stats may differ at runtime.</div>' : '') +
        '<div class="sc-note" id="sc-note">★ = scalable (level grows). Scaling uses one physical damage helper for all cases: stamina first adjusts attack, Atlas optionally subtracts 480 before damage, then the same RNG-based physical formula computes min/max/999-cap odds.</div>' +
        '<div class="sc-field" id="sc-mode-field"><span class="sc-label">Damage type</span><select class="sc-sel" id="sc-mode-sel"><option value="physical">Physical</option><option value="alchemy">Offensive Alchemy</option></select></div>' +
        '<div class="sc-field" id="sc-src-field"><span class="sc-label">Source</span><select class="sc-sel" id="sc-src-sel"></select></div>' +
        '<div class="sc-field" id="sc-src-lv-field" style="display:none"><span class="sc-label">Source level</span><select class="sc-sel" style="min-width:80px" id="sc-src-lv"><option value="0">auto</option></select></div>' +
        '<div class="sc-field"><span class="sc-label">Target</span><select class="sc-sel" id="sc-tgt-sel"></select></div>' +
        '<div class="sc-field" id="sc-tgt-lv-field" style="display:none"><span class="sc-label">Target level</span><select class="sc-sel" style="min-width:80px" id="sc-tgt-lv"><option value="0">auto</option></select></div>' +
        '<div class="sc-field" id="sc-al-spell-lv-field" style="display:none"><span class="sc-label">Spell level</span><label class="sc-slider-wrap"><input class="sc-slider" id="sc-al-spell-lv" type="range" min="0" max="9" value="0"><span class="sc-slider-num" id="sc-al-spell-lv-num">0</span></label></div>' +
        '<div class="sc-field" id="sc-al-tgt-lv-field" style="display:none"><span class="sc-label">Target level</span><label class="sc-slider-wrap"><input class="sc-slider" id="sc-al-tgt-lv" type="range" min="1" max="37" value="1"><span class="sc-slider-num" id="sc-al-tgt-lv-num">1</span></label></div>' +
        '<div class="sc-field" id="sc-charge-field"><span class="sc-label">Charge</span><div class="sc-toggle-group"><button class="sc-toggle-btn" data-chg="25">25%</button><button class="sc-toggle-btn" data-chg="50">50%</button><button class="sc-toggle-btn sc-active" data-chg="100">100%</button></div></div>' +
        '<div class="sc-field" id="sc-scale-field"><span class="sc-label">Enemy scale</span><button class="sc-toggle-btn" id="sc-scale-toggle">OFF</button></div>' +
        '<div class="sc-field" id="sc-atlas-field"><span class="sc-label">Atlas</span><button class="sc-toggle-btn" id="sc-atlas-toggle">OFF</button></div>' +
        '</div>' +
        '<div class="sc-chart-layout"><div class="sc-chart-wrap"><div id="sc-chart"></div><div class="sc-hit-chart" id="sc-hit-chart"></div></div><div class="sc-legend" id="sc-legend"></div></div>' +
        '<div id="sc-xinfo" class="sc-xinfo"></div>' +
        '<div class="sc-stats" id="sc-stats"></div>' +
        '<div class="sc-note">\u2605 = scalable (level grows). Scaling uses one physical damage helper for all cases: stamina first adjusts attack, Atlas optionally subtracts 480 before damage, then the same RNG-based physical formula computes min/max/999-cap odds.</div>' +
        '</div>' +
        '</div>' +
        '<div class="tab-pane" data-tab="docs" style="display:none">' +
        '<div class="doc-wrap">' +
        '<div class="doc-subnav">' +
        '<button class="doc-btn doc-btn-active" data-doc="damage">Damage</button>' +
        '<button class="doc-btn" data-doc="alchemy">Offensive Alchemy</button>' +
        '<button class="doc-btn" data-doc="hit">Hit%</button>' +
        '<button class="doc-btn" data-doc="atlas">Atlas Glitch</button>' +
        '<button class="doc-btn" data-doc="mapload">Map Loading</button>' +
        '<button class="doc-btn" data-doc="script">Script</button>' +
        '<button class="doc-btn" data-doc="evs">Everscript</button>' +
        '<button class="doc-btn" data-doc="plugin">Plugin</button>' +
        '</div>' +
        '<div class="doc-content">' +
        '<div class="doc-sec" data-doc="damage">' +
        '<h3 class="doc-h">Physical Damage</h3>' +
        '<div class="doc-fact">Formula from soestuff.lua. The 8-bit RNG seed varies each attack, producing a range of outcomes.</div>' +
        '<pre class="doc-code">w = ~((def\u00f74 - atk) - 1) &amp; 0xFFFF\nif w &lt; 1 or w \u2265 0x8000: w = 1\nseed = hi16((w+1)\u00d7rng16)\na = (seed + w) mod 65536\ndmg = ((((a \u226a 1) mod 65536) + w + carry(a)) mod 65536) \u00bb 2\nshown = min(999, dmg)</pre>' +
        '<div class="doc-sliders"><label>atk <input id="doc-atk" type="range" min="0" max="255" value="45"><span id="doc-atk-num">45</span></label>' +
        '<label>def <input id="doc-def" type="range" min="0" max="255" value="28"><span id="doc-def-num">28</span></label></div>' +
        '<div id="doc-dmg-chart"></div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="alchemy" style="display:none">' +
        '<h3 class="doc-h">Offensive Alchemy</h3>' +
        '<div class="doc-fact">Grounded today: offensive alchemy uses the traced projectile path. Cast-side spell power comes from the ROM level table and hit damage multiplies that projectile power by <code>(0x40 - magic_defense) / 0x40</code>. Research notes also point at a projectile-slot <code>POWER</code> field for projectile alchemy.</div>' +
        '<pre class="doc-code">base_might = ROM16[0x45E6B + spell_id*2]\nlevel_scale = [2,4,7,11,15,20,26,32,39,46][spell_level]\nspell_power_at_level = ceil(base_might * level_scale / 4)\nspell_bonus_base = floor(base_might * level_scale / 4)\nprojectile_power = spell_power_at_level + floor(spell_bonus_base * rng16 / 65536)\nshown = floor(projectile_power * (0x40 - magic_defense) / 0x40)</pre>' +
        '<div class="doc-sliders"><label>spell <select id="doc-al-spell" class="sc-sel"></select></label>' +
        '<label>spell level <input id="doc-al-spell-lv" type="range" min="0" max="9" value="0"><span id="doc-al-spell-lv-num">0</span></label>' +
        '<label>magic_defense <input id="doc-al-mdef" type="range" min="0" max="64" value="51"><span id="doc-al-mdef-num">51</span></label></div>' +
        '<div class="doc-fact">Projectile alchemy research note: active alchemy attack slots start at <code>7E3564</code>, each slot is <code>0x76</code> bytes, and the projectile struct field at <code>+0x2A/+0x2B</code> is labeled <code>POWER</code> or damage in outside notes. Full throw+hit traces are the right place to trace how spell, level, and source stats feed that field.</div>' +
        '<div id="doc-al-chart"></div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="hit" style="display:none">' +
        '<h3 class="doc-h">Hit Chance</h3>' +
        '<div class="doc-fact">Two-level ROM table lookup. The in-game <em>hit_rate</em> display value is NOT the actual chance to hit.</div>' +
        '<pre class="doc-code">off_a   = \u230a(evade + 1) / 2\u230b &amp; ~1\nev_ptr  = ROM16[$8FBAAF + off_a]\noff_b   = ((hit_rate + 1) &amp; ~3) / 2\nhit%    = ROM16[$8F0000 + off_b + ev_ptr] / 0x7FFF \u00d7 100</pre>' +
        '<div id="doc-hit-table"></div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="atlas" style="display:none">' +
        '<h3 class="doc-h">Atlas Glitch \u2014 Boy Attack Underflow</h3>' +
        '<ul class="doc-bullets">' +
        '<li>This is not the Atlas Amulet item.</li>' +
        '<li>The glitch subtracts a value from the boy\'s attack; when the subtraction exceeds the current attack, the 16-bit stat underflows into the range 65056\u201365535.</li>' +
        '<li>That wrapped attack feeds the normal physical-damage routine, but atlas-underflow cases take the high-word multiply path in the RNG helper. That is why the result is usually 999, but not always 999.</li>' +
        '<li>This panel is a <b>manual post-subtraction preview</b>. It does not yet compute the subtraction from stamina or from the exact setup used in real runs.</li>' +
        '<li>The RNG slider below picks one concrete 16-bit RNG state. The bar summarizes all 65536 states for the same boy-atk / manual subtract / def inputs.</li>' +
        '</ul>' +
        '<pre class="doc-code">atk_underflow = (boy_atk - subtract) mod 65536\nw = ~((def\u00f74 - atk_underflow) - 1) &amp; 0xFFFF\nseed = hi16((w+1)\u00d7rng16)\na = (seed + w) mod 65536\ndmg = ((((a \u226a 1) mod 65536) + w + carry(a \u226a 1)) mod 65536) \u00bb 2\nshown = min(999, dmg)</pre>' +
        '<div class="doc-sliders"><label>boy atk <input id="doc-at-atk" type="range" min="0" max="255" value="81"><span id="doc-at-atk-num">81</span></label>' +
        '<label>manual subtract <input id="doc-at-sub" type="range" min="0" max="480" value="480"><span id="doc-at-sub-num">480</span></label>' +
        '<label>def <input id="doc-at-def" type="range" min="0" max="255" value="160"><span id="doc-at-def-num">160</span></label>' +
        '<label>rng16 <input id="doc-at-rng" type="range" min="0" max="65535" value="0"><span id="doc-at-rng-num">0</span></label></div>' +
        '<div id="doc-at-chart"></div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="mapload" style="display:none">' +
        '<h3 class="doc-h">Map Loading</h3>' +
        '<div class="doc-fact">Current status: the exact room-payload codec is still not fully decoded. This section records the grounded loader model from room metadata, trigger-table parsing, breakpoint tracing, and truncation tests.</div>' +
        '<pre class="doc-code">map[33 / "Prehistoria - Strong Heart\'s Exterior"]\ndata     = 0xADB50C\nsize     = 0x0455 (confirmed)\nstep_len = ROM16[0xADB519] = 0x000C = 2 entries\nb_len    = ROM16[0xADB527] = 0x0000\npayload  = 0xADB529 .. 0xADB960</pre>' +
        '<ul class="doc-bullets">' +
        '<li>Each room points at one variable-size blob. For room <b>0x33</b>, the blob begins at <b>0xADB50C</b> and ends at <b>0xADB960</b> because the next room starts immediately after it.</li>' +
        '<li>The first <b>13 bytes</b> are room metadata. Only bytes <b>0</b> and <b>1</b> are currently named with confidence: they behave like <code>trig_off_x</code> and <code>trig_off_y</code>. Bytes <b>2..12</b> are still unknown header fields.</li>' +
        '<li>At offset <b>0x0D</b> the blob switches to trigger tables: <code>step_len</code>, then 6-byte step-on entries; after that comes <code>b_len</code> and the B-trigger entries.</li>' +
        '<li>For room <b>0x33</b> that means: metadata at <b>0xADB50C..0xADB518</b>, step-on table at <b>0xADB519..0xADB526</b>, B-table length at <b>0xADB527..0xADB528</b>, then the room payload from <b>0xADB529</b> onward.</li>' +
        '</ul>' +
        '<div class="doc-val"><b>Working loader model</b></div>' +
        '<ul class="doc-bullets">' +
        '<li>1. Resolve the room\'s <code>data</code> pointer from the map table and hand it to the loader.</li>' +
        '<li>2. The breakpoint at <b>0x908F80</b> (<code>LDA [$8B],Y</code>) shows the routine streaming bytes from the current room blob through the indirect pointer in <code>$8B</code>.</li>' +
        '<li>3. The loader consumes metadata and trigger-table lengths first, then continues into the remaining room payload.</li>' +
        '<li>4. Truncation tests show the payload tail controls collision and hitbox first: deleting bytes from the end removes collision before visible tiles.</li>' +
        '<li>5. Deleting more bytes erases the room from the bottom-right upward, which strongly suggests the decoded output fills later map addresses last.</li>' +
        '<li>6. When the visual payload is mostly gone, the room can still load as a walkable black square: room state and bounds remain valid even though tile and collision data are missing.</li>' +
        '</ul>' +
        '<pre class="doc-code">908F80  B7 8B          LDA [$8B],Y\n$8B = current room blob pointer\nY   = current byte offset inside that blob</pre>' +
        '<div class="doc-val"><b>How that becomes the hut picture</b></div>' +
        '<ul class="doc-bullets">' +
        '<li>The Strong Heart exterior picture is not stored as one flat bitmap. The room payload after the trigger tables is decoded into the room\'s visual and collision buffers.</li>' +
        '<li>The two step-on records only describe the doorway transitions. They do not describe the hut image itself.</li>' +
        '<li>Because the image disappears from bottom-right first when the payload tail is cut, later payload bytes correspond to later-placed tiles in the final room image.</li>' +
        '<li>The black walkable square is the same room after payload loss: enter logic and room origin still exist, but the art and collision payload are no longer complete.</li>' +
        '<li>The current 6-byte trigger-record model matches the in-repo parser notes, but the external SoE tiles viewer C++ source was not re-verified inside this workspace.</li>' +
        '<li>Still open: header bytes 2..12, the exact codec commands, whether graphics and collision are interleaved or split, and the precise buffer layout used before the picture is shown.</li>' +
        '</ul>' +
        '</div>' +
        '<div class="doc-sec" data-doc="script" style="display:none">' +
        '<h3 class="doc-h">Script Opcodes</h3>' +
        '<div class="doc-fact">SoE scripts are event-driven. Each room has up to 4 trigger types: <b>enter</b> (room load), <b>step-on</b> (tile), <b>B-button</b> (interact), <b>global</b>.</div>' +
        '<div class="doc-fact">Opcodes are 1-byte commands followed by 0\u2013N 16-bit word arguments. The Rooms tab shows decoded triggers per room.</div>' +
        '<div style="opacity:.3;margin-top:12px;font-size:10px">Full opcode reference \u2014 coming soon.</div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="evs" style="display:none">' +
        '<h3 class="doc-h">Everscript</h3>' +
        '<div class="doc-fact">High-level scripting language that compiles to SoE opcodes. Supports maps, triggers, if/else, function calls, persistence flags, and inline memory references.</div>' +
        '<div class="doc-fact">Source lives in <code>in/</code>. Entry point is typically <code>in/kaizo/main.evs</code>. Compile: <code>python everscript.py &lt;input&gt;</code>.</div>' +
        '<div style="opacity:.3;margin-top:12px;font-size:10px">Language reference \u2014 coming soon.</div>' +
        '</div>' +
        '<div class="doc-sec" data-doc="plugin" style="display:none">' +
        '<h3 class="doc-h">Radar Plugin</h3>' +
        '<div class="doc-fact"><b>Memory:</b> WRAM usage map for the current function scope. Cells show lifecycle (temp / session / sram / system). Click a cell for details and source lines.</div>' +
        '<div class="doc-fact"><b>Rooms:</b> per-room trigger breakdown \u2014 entrances, step-on, B-triggers, sniff spots. Live mode shows rooms from .evs; Vanilla mode lists all 120 vanilla rooms.</div>' +
        '<div class="doc-fact"><b>Scaling:</b> physical damage calculator plus a level-0 offensive alchemy preview using spell might and enemy magic defense.</div>' +
        '<div class="doc-fact"><b>Docs:</b> this page \u2014 hard facts about game mechanics and tools.</div>' +
        '</div>' +
        '</div></div>' +
        '</div>' +
        '<div class="tab-pane" data-tab="route" style="display:none">' +
        '<div class="rp-wrap">' +
        '<div class="rp-banner">Mock UI only. Physical hit expectations, route-grade spell scaling / 8-cast modeling, XP tables, and route simulation are still missing. This tab is a scaffold for the route-planner workflow.</div>' +
        '<div class="rp-grid">' +
        '<div class="rp-side">' +
        '<div class="rp-h">Add Step</div>' +
        '<div class="rp-templates">' +
        '<div class="rp-tpl"><div><div class="rp-tpl-name">Thraxx\'s Heart</div><div class="rp-tpl-sub">Alchemy 8-cast boss kill</div></div><button class="rp-btn" data-rp-add="heart8">add</button></div>' +
        '<div class="rp-tpl"><div><div class="rp-tpl-name">Skelesnail</div><div class="rp-tpl-sub">Alchemy 8-cast spell leveling</div></div><button class="rp-btn" data-rp-add="skelesnail8">add</button></div>' +
        '<div class="rp-tpl"><div><div class="rp-tpl-name">Magmar</div><div class="rp-tpl-sub">Alchemy any% Act 1 route step</div></div><button class="rp-btn" data-rp-add="magmar8">add</button></div>' +
        '<div class="rp-tpl"><div><div class="rp-tpl-name">Sterling</div><div class="rp-tpl-sub">Physical / atlas overflow example</div></div><button class="rp-btn" data-rp-add="sterlingPhys">add</button></div>' +
        '</div>' +
        '<div class="rp-link-note">Draft spec: docs/route-planner.md</div>' +
        '</div>' +
        '<div class="rp-main">' +
        '<div class="rp-toolbar"><div class="rp-h" style="margin:0">Route</div><div><button class="rp-btn" id="rp-sim-btn">simulate route</button></div></div>' +
        '<div class="rp-toolbar-note">A route is a list of enemies killed by physical or alchemy methods. Dog participation is intentionally ignored in this mock.</div>' +
        '<div id="rp-list"></div>' +
        '<div class="rp-sim"><div class="rp-h">Simulation Output</div><div id="rp-sim-out"></div></div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="tab-pane" data-tab="rng" style="display:none">' +
        '<div class="rng-wrap">' +
        '<div class="rng-section">' +
        '<div class="rng-h">Naris \u2014 Super Heal</div>' +
        '<div class="rng-desc">Coin flip: the winning value is bit 0 of the game timer when the dialogue opens. 10,000-unit cooldown between attempts. Already owning Super Heal skips to the equip menu.</div>' +
        '<div class="rng-stats">' +
        '<div class="rng-stat"><div class="rng-stat-label">Chance / try</div><div class="rng-stat-val">50%</div></div>' +
        '<div class="rng-stat"><div class="rng-stat-label">Avg attempts</div><div class="rng-stat-val">2</div></div>' +
        '</div>' +
        '<div class="rng-sim-row"><button class="rng-sim-btn" id="rng-naris-btn">Simulate 10,000\xd7</button><div class="rng-sim-out" id="rng-naris-out"></div></div>' +
        '<div class="rng-hist" id="rng-naris-hist"></div>' +
        '</div>' +
        '<div class="rng-section">' +
        '<div class="rng-h">Prophet \u2014 Bronze Armor</div>' +
        '<div class="rng-desc">3-arc state machine (prophecy 0\u20135, meta 6\u20138, chaos 9+). Reach state\u00a08 (VIDEO_GAME) for Bronze Armor. State\u00a05 is a permanent tilt lock. Chaos recovers to state\u00a06 with 1/8 probability per round (or always when interaction count\u00a0>\u00a029).</div>' +
        '<table class="rng-tbl">' +
        '<thead><tr><th>#</th><th>Codename</th><th>Reach 8</th><th>Reach 5</th><th>Next states (odds)</th></tr></thead>' +
        '<tbody>' +
        '<tr class="rng-arc-proph"><td>0</td><td class="codename">DOOM</td><td>~22%</td><td>~17%</td><td>1=28/32, 6=2/32, 9+=2/32</td></tr>' +
        '<tr class="rng-arc-proph"><td>1</td><td class="codename">CATACLYSM</td><td>~24%</td><td>~19%</td><td>2=28/32, 6=2/32, 9+=2/32</td></tr>' +
        '<tr class="rng-arc-proph"><td>2</td><td class="codename">EVIL_LEADER</td><td>~27%</td><td>~22%</td><td>3=28/32, 6=2/32, 9+=2/32</td></tr>' +
        '<tr class="rng-arc-proph"><td>3</td><td class="codename">DIAMOND_EYES</td><td>~34%</td><td>25%</td><td>4=16/32, 6=9/32, 9+=7/32</td></tr>' +
        '<tr class="rng-arc-proph"><td>4</td><td class="codename">STATUE_CORE</td><td>~46%</td><td>50%</td><td>5=16/32, 6=9/32, 9+=7/32</td></tr>' +
        '<tr class="rng-arc-tilt"><td>5</td><td class="codename">I_HAVE_SPOKEN</td><td>0%</td><td>100%</td><td>locked until reset</td></tr>' +
        '<tr class="rng-st-divert rng-arc-meta"><td>6</td><td class="codename">CONTROLLED_BY_OVERLORD</td><td>~66%</td><td>~0.5%</td><td>7=26/32, 0\u20133=3/32, 9+=3/32</td></tr>' +
        '<tr class="rng-arc-meta"><td>7</td><td class="codename">SPRITES</td><td>~81%</td><td>~0.2%</td><td>8=26/32, 0\u20133=3/32, 9+=3/32</td></tr>' +
        '<tr class="rng-st-target rng-arc-meta"><td>8</td><td class="codename">VIDEO_GAME</td><td>100%</td><td>0%</td><td>\u2605 reward</td></tr>' +
        '<tr class="rng-arc-chaos"><td>9</td><td class="codename">GOAT_WARNING</td><td rowspan="11">~18%</td><td rowspan="11">~3%</td><td rowspan="11">chaos=7/8, 6=1/8</td></tr>' +
        '<tr class="rng-arc-chaos"><td>10</td><td class="codename">CHICKEN_RAISE</td></tr>' +
        '<tr class="rng-arc-chaos"><td>11</td><td class="codename">WHITE_ZONE</td></tr>' +
        '<tr class="rng-arc-chaos"><td>12</td><td class="codename">NOODLES</td></tr>' +
        '<tr class="rng-arc-chaos"><td>13</td><td class="codename">GOAT_SNEEZE</td></tr>' +
        '<tr class="rng-arc-chaos"><td>14</td><td class="codename">HOKEY_POKEY</td></tr>' +
        '<tr class="rng-arc-chaos"><td>15</td><td class="codename">FORTUNE_COOKIES</td></tr>' +
        '<tr class="rng-arc-chaos"><td>16</td><td class="codename">SECOND_GOAT_SECRET</td></tr>' +
        '<tr class="rng-arc-chaos"><td>17</td><td class="codename">PENGUINS</td></tr>' +
        '<tr class="rng-arc-chaos"><td>18</td><td class="codename">I_AM_A_FISH</td></tr>' +
        '<tr class="rng-arc-chaos"><td>19</td><td class="codename">FUSELAGE</td></tr>' +
        '</tbody></table>' +
        '<div class="rng-strat-row">' +
        '<label class="rng-pot-lbl">Profile: <select id="rng-prophet-strat" class="rng-sel">' +
        '<option value="mash">Just mash (might tilt)</option>' +
        '<option value="reset4chaos">Reset at 4 + chaos</option>' +
        '<option value="reset4" selected>Reset at 4 only</option>' +
        '<option value="metaonly">Meta arc only (6\u20138)</option>' +
        '</select></label>' +
        '<div class="rng-strat-desc" id="rng-prophet-strat-desc"></div>' +
        '</div>' +
        '<div class="rng-sim-row"><button class="rng-sim-btn" id="rng-prophet-btn">Simulate 10,000\xd7</button><div class="rng-sim-out" id="rng-prophet-out"></div></div>' +
        '<div class="rng-hist" id="rng-prophet-hist"></div>' +
        '</div>' +
        '<div class="rng-section">' +
        '<div class="rng-h">Egg \u2014 Chocobo Egg</div>' +
        '<div class="rng-desc">Hidden reward inside ceramic pots at the Nobilia market. Buying 5 pots triggers reward check at 3/8; buying 10 pots is worse at 3/16. After a triggered reward, 1/16 chance for the Chocobo Egg (otherwise jewels). Buying 1 pot never triggers a reward.</div>' +
        '<div class="rng-stats">' +
        '<div class="rng-stat"><div class="rng-stat-label">5-pot chance</div><div class="rng-stat-val">2.34%</div></div>' +
        '<div class="rng-stat"><div class="rng-stat-label">Avg (5 pots)</div><div class="rng-stat-val">~43</div></div>' +
        '<div class="rng-stat"><div class="rng-stat-label">10-pot chance</div><div class="rng-stat-val">1.17%</div></div>' +
        '<div class="rng-stat"><div class="rng-stat-label">Avg (10 pots)</div><div class="rng-stat-val">~85</div></div>' +
        '</div>' +
        '<div class="rng-sim-row">' +
        '<label class="rng-pot-lbl">Buy: <select id="rng-pot-sel" class="rng-sel"><option value="5" selected>5 pots (optimal)</option><option value="10">10 pots</option></select></label>' +
        '<button class="rng-sim-btn" id="rng-egg-btn">Simulate 10,000\xd7</button>' +
        '<div class="rng-sim-out" id="rng-egg-out"></div>' +
        '</div>' +
        '<div class="rng-hist" id="rng-egg-hist"></div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<script>' + js + '<\/script></body></html>';
}

// ── Activation ────────────────────────────────────────────────────────────────

async function syncDerivedSettingsFromRepoPath() {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    const cfg = vscode.workspace.getConfiguration('everscript');
    if (!cfg || typeof cfg.update !== 'function') return;
    const updates = getRepoAutofillUpdates({
        repoPath: cfg.get('repoPath'),
        inDirectory: cfg.get('inDirectory'),
        patchesDirectory: cfg.get('patchesDirectory'),
        patchesPath: cfg.get('patchesPath'),
        romPath: cfg.get('romPath'),
        compilerPath: cfg.get('compilerPath'),
        pythonPath: cfg.get('pythonPath'),
    }, wsRoot);
    const hasWorkspace = !!(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length);
    const target = hasWorkspace && vscode.ConfigurationTarget
        ? vscode.ConfigurationTarget.Workspace
        : (vscode.ConfigurationTarget ? vscode.ConfigurationTarget.Global : undefined);
    for (const [key, value] of Object.entries(updates)) {
        if (!value) continue;
        if ((cfg.get(key, '') || '').trim() === value) continue;
        await cfg.update(key, value, target);
    }
}

// ── Radar CodeLens provider ───────────────────────────────────────────────────
class RadarCodeLensProvider {
    provideCodeLenses(document) {
        if (document.languageId !== 'everscript') return [];
        const declRe = /^\s*(fun|map|area|group)\s+([A-Za-z_][A-Za-z0-9_]*)\b/;
        const lenses = [];
        for (let i = 0; i < document.lineCount; i++) {
            if (!declRe.test(document.lineAt(i).text)) continue;
            lenses.push(new vscode.CodeLens(document.lineAt(i).range, {
                title: '◉ Memory Radar',
                command: 'everscript.openMemoryRadar',
                arguments: [document, i],
            }));
        }
        return lenses;
    }
}

function activate(context) {
    const idx = lp.loadIndex(context.extensionPath);

    // Build workspace index on activation; keep it fresh on file changes
    lp.buildWorkspaceIndex();
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.evs');
    watcher.onDidChange(() => lp.buildWorkspaceIndex());
    watcher.onDidCreate(() => lp.buildWorkspaceIndex());
    watcher.onDidDelete(() => lp.buildWorkspaceIndex());
    context.subscriptions.push(watcher);

    // Invalidate memory map cache when memory-map.md changes
    const mapWatcher = vscode.workspace.createFileSystemWatcher('**/.github/memory-map.md');
    mapWatcher.onDidChange(() => invalidateRadarMap());
    mapWatcher.onDidCreate(() => invalidateRadarMap());
    context.subscriptions.push(mapWatcher);

    // Invalidate enum cache when core evs files change
    const enumWatcher = vscode.workspace.createFileSystemWatcher('**/in/core/**/*.evs');
    enumWatcher.onDidChange(() => invalidateRadarEnums());
    enumWatcher.onDidCreate(() => invalidateRadarEnums());
    enumWatcher.onDidDelete(() => invalidateRadarEnums());
    context.subscriptions.push(enumWatcher);

    // Dead branch decorations
    const applyDeadBranches = (editor) => lp.updateDeadBranchDecorations(editor, idx);
    applyDeadBranches(vscode.window.activeTextEditor);
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(applyDeadBranches),
        vscode.workspace.onDidChangeTextDocument(e => {
            const ed = vscode.window.activeTextEditor;
            if (ed && e.document === ed.document) applyDeadBranches(ed);
        }),
    );

    context.subscriptions.push(

        vscode.languages.registerHoverProvider('everscript', {
            provideHover: (doc, pos) => lp.provideHover(doc, pos, idx),
        }),

        vscode.languages.registerDocumentSymbolProvider('everscript', {
            provideDocumentSymbols: lp.provideDocumentSymbols,
        }),

        vscode.languages.registerCompletionItemProvider(
            'everscript',
            { provideCompletionItems: (doc, pos) => lp.provideCompletionItems(doc, pos, idx) },
            '.', '@',
        ),

        vscode.languages.registerDefinitionProvider('everscript', {
            provideDefinition: (doc, pos) => lp.provideDefinition(doc, pos),
        }),

        vscode.languages.registerReferenceProvider('everscript', {
            provideReferences: (doc, pos) => lp.provideReferences(doc, pos),
        }),

        vscode.languages.registerCodeLensProvider(
            { language: 'everscript' },
            new RadarCodeLensProvider(),
        ),

        // Memory Radar command — opens a scope-aware WRAM visualizer beside the editor.
        // Triggered via: right-click → "Open Memory Radar", or the ◉ CodeLens above fun/map/area/group.
        vscode.commands.registerCommand('everscript.openMemoryRadar', async (doc, startLine) => {
            const editor   = vscode.window.activeTextEditor;
            const document = (doc && typeof doc.lineCount === 'number') ? doc : editor?.document;
            if (!document) {
                vscode.window.showWarningMessage('No active Everscript file.');
                return;
            }
            const cursorLine   = typeof startLine === 'number' ? startLine : (editor?.selection.active.line ?? 0);
            _radarDoc          = document;
            const scope        = radarDetectScope(document, cursorLine);
            _radarCurrentScope = scope;
            const { refs, pools, argRefs } = radarAnalyzeScope(document, scope.startLine, scope.endLine);
            const mapByAddr    = getRadarMap();
            const wsRoot       = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const wsRootUri    = wsRoot ? vscode.Uri.file(wsRoot) : null;

            // Load character data for Scaling tab (ROM read is cached; scale detection is per-document)
            if (!_scalingChars) {
                _scalingChars = readRomCharacters(wsRoot);
                _hitLookup    = readRomHitLookup(wsRoot, _scalingChars);
            }
            _scaleActive = detectScaleEnemies(wsRoot, document.uri.fsPath);

            // Reuse existing panel if open; otherwise create a new one
            if (!_radarPanel) {
                _radarPanel = vscode.window.createWebviewPanel(
                    'everscriptRadar',
                    'Radar: ' + scope.name,
                    vscode.ViewColumn.Beside,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true,
                        localResourceRoots: [wsRootUri, vscode.Uri.file(getExtConfig().assetsPath)].filter(Boolean),
                    },
                );
                _radarPanel.onDidDispose(() => {
                    _radarPanel = null;
                    _radarPinned = false;
                    _radarCurrentScope = null;
                    _radarRoomTree = null;
                    _radarRoomDocPath = null;
                    _radarActiveTab = 'radar';
                    _ingrBaseUri = '';
                    _radarByteScriptFocus = '';
                }, null, context.subscriptions);
            } else {
                _radarPanel.title = 'Radar: ' + scope.name;
                _radarPanel.reveal(vscode.ViewColumn.Beside, true);
            }

            // Compute ingredient image base URI (once per panel lifetime)
            if (!_ingrBaseUri) {
                try {
                    const ingrDir = path.join(getExtConfig().assetsPath, 'ingredients');
                    _ingrBaseUri = _radarPanel.webview.asWebviewUri(vscode.Uri.file(ingrDir)).toString() + '/';
                } catch { _ingrBaseUri = ''; }
            }

            // Build or reuse room tree (rebuild when document changes)
            if (_radarRoomDocPath !== document.uri.fsPath) {
                _radarRoomTree    = buildRoomTree(document, wsRoot, getExtConfig());
                _radarRoomDocPath = document.uri.fsPath;
                setRoomImageUris(_radarRoomTree, p => _radarPanel.webview.asWebviewUri(vscode.Uri.file(p)).toString());
            }

            const selectedMap = scope.kind === 'map' ? scope.name : null;
            _radarPanel.webview.html = renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, _radarRoomTree, _radarActiveTab, selectedMap, _scalingChars || [], _scaleActive, _ingrBaseUri, _hitLookup);

            // Handle messages from the webview
            _radarPanel.webview.onDidReceiveMessage(msg => {
                if (msg.command === 'goToLine') {
                    const line = Math.max(0, Math.min(Number(msg.line), document.lineCount - 1));
                    const pos  = new vscode.Position(line, 0);
                    const range = new vscode.Range(pos, pos);
                    const ed = vscode.window.visibleTextEditors.find(e => e.document === _radarDoc)
                            || vscode.window.activeTextEditor;
                    if (ed) {
                        ed.selection = new vscode.Selection(pos, pos);
                        ed.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
                        vscode.window.showTextDocument(ed.document, ed.viewColumn);
                    }
                } else if (msg.command === 'pin') {
                    _radarPinned = true;
                } else if (msg.command === 'unpin') {
                    _radarPinned = false;
                } else if (msg.command === 'tabChange') {
                    _radarActiveTab = msg.tab || 'radar';
                } else if (msg.command === 'globalScope') {
                    _radarPinned = true; // freeze auto-updates while in global view
                    if (_radarDoc) {
                        const gscope = { kind: 'global', name: _radarDoc.fileName.split(/[\/\\]/).pop(), startLine: 0, endLine: _radarDoc.lineCount - 1 };
                        const { refs, pools, argRefs } = radarAnalyzeScope(_radarDoc, 0, _radarDoc.lineCount - 1);
                        _scaleActive = detectScaleEnemies(wsRoot, _radarDoc.uri?.fsPath ?? null);
                        _radarPanel.webview.html = renderRadarHtml(gscope, refs, pools, argRefs, getRadarMap(), _radarRoomTree || [], _radarActiveTab, null, _scalingChars || [], _scaleActive, _ingrBaseUri, _hitLookup);
                        _radarPanel.title = 'Radar: (global)';
                    }
                } else if (msg.command === 'autoScope') {
                    _radarPinned = false;
                    refreshRadar(vscode.window.activeTextEditor);
                } else if (msg.command === 'moveEntity') {
                    if (!_radarDoc || typeof msg.line !== 'number' || msg.line < 0) return;
                    const lineIdx = Math.min(Math.max(0, msg.line), _radarDoc.lineCount - 1);
                    const lineText = _radarDoc.lineAt(lineIdx).text;
                    const fmt = (n) => '0x' + n.toString(16).padStart(2, '0');
                    let newText;
                    if (msg.kind === 'entrance') {
                        newText = lineText.replace(
                            /entrance\s*\(\s*[0-9a-fA-Fx]+\s*,\s*[0-9a-fA-Fx]+\s*,/,
                            `entrance(${fmt(msg.newX)}, ${fmt(msg.newY)},`
                        );
                    } else if (msg.kind === 'enemy') {
                        newText = lineText.replace(
                            /(add_\w*_?enemy\s*\(\s*[^,)]+\s*,\s*)([0-9a-fA-Fx]+)(\s*,\s*)([0-9a-fA-Fx]+)/,
                            (_, pre, _x, sep) => pre + fmt(msg.newX) + sep + fmt(msg.newY)
                        );
                    }
                    if (newText && newText !== lineText) {
                        const edit = new vscode.WorkspaceEdit();
                        edit.replace(_radarDoc.uri, _radarDoc.lineAt(lineIdx).range, newText);
                        vscode.workspace.applyEdit(edit);
                    }
                } else if (msg.command === 'pickRoomImage') {
                    // Let user pick an image file and assign it to this room
                    vscode.window.showOpenDialog({ filters: { Images: ['png', 'jpg', 'jpeg', 'webp'] }, canSelectMany: false }).then(uris => {
                        if (!uris || !uris.length) return;
                        const chosen = uris[0].fsPath;
                        // Find the node in the room tree and update imagePath
                        function patchNode(nodes) {
                            for (const n of nodes || []) {
                                if (n.kind === 'map' && n.name === msg.mapName) { n.imagePath = chosen; return true; }
                                if (n.children && patchNode(n.children)) return true;
                            }
                            return false;
                        }
                        patchNode(_radarRoomTree);
                        if (_radarPanel) setRoomImageUris(_radarRoomTree, p => _radarPanel.webview.asWebviewUri(vscode.Uri.file(p)).toString());
                        refreshRadar(vscode.window.activeTextEditor);
                    });
                }
            }, undefined, context.subscriptions);
        }),

        // Auto-update radar when active editor changes
        vscode.window.onDidChangeActiveTextEditor(ed => {
            clearTimeout(_radarUpdateTimer);
            _radarUpdateTimer = setTimeout(() => refreshRadar(ed), 400);
        }),

        // Auto-update radar when cursor moves to a different scope
        vscode.window.onDidChangeTextEditorSelection(e => {
            if (_radarPinned) return;
            clearTimeout(_radarUpdateTimer);
            _radarUpdateTimer = setTimeout(() => refreshRadar(e.textEditor), 600);
        }),

    );

    // ── Debugger: DebugConfigurationProvider ────────────────────────────────
    // Handles two cases:
    //   1. F5 with no launch.json → fills in defaults using the active .evs file
    //   2. A launch.json entry with program:"${file}" that VS Code did not expand
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider('everscript', {
            provideDebugConfigurations(folder) {
                const editor  = vscode.window.activeTextEditor;
                const program = (editor && editor.document.languageId === 'everscript')
                    ? editor.document.uri.fsPath
                    : '${file}';
                return [{
                    type:          'everscript',
                    request:       'launch',
                    name:          'Debug current .evs file',
                    program,
                    entryFunction: 'trigger_enter',
                }];
            },
            resolveDebugConfiguration(folder, config) {
                // F5 with no launch.json → empty config, fill it in
                if (!config.type && !config.request && !config.name) {
                    const editor = vscode.window.activeTextEditor;
                    if (editor && editor.document.languageId === 'everscript') {
                        config.type          = 'everscript';
                        config.request       = 'launch';
                        config.name          = 'Debug .evs file';
                        config.program       = editor.document.uri.fsPath;
                        config.entryFunction = 'trigger_enter';
                    }
                }
                // Resolve unexpanded ${file} (shouldn't happen, safety net)
                if (config.program === '${file}') {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) config.program = editor.document.uri.fsPath;
                }
                return config;
            },
        }),
    );

    // ── Emulator Panel ───────────────────────────────────────────────────────
    const { openEmulatorPanel } = require('./debugger/emulator/panel');
    context.subscriptions.push(
        vscode.commands.registerCommand('everscript.openEmulator', () => {
            openEmulatorPanel(context);
        }),
        vscode.commands.registerCommand('everscript._scriptFocus', (payload) => {
            _radarByteScriptFocus = String(payload?.address || '').toUpperCase();
            if (_radarPanel) {
                _radarPanel.webview.postMessage({
                    command: 'byteScriptFocus',
                    address: _radarByteScriptFocus,
                    slot: typeof payload?.slot === 'number' ? payload.slot : null,
                    state: payload?.state || '',
                });
            }
        }),
        vscode.commands.registerCommand('everscript.openSettings', () => {
            syncDerivedSettingsFromRepoPath().catch(() => {});
            vscode.commands.executeCommand('workbench.action.openSettings', 'everscript');
        }),
    );

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration('everscript')) return;
        invalidateRoomCaches();
        invalidateRadarMap();
        if (event.affectsConfiguration('everscript.repoPath')) syncDerivedSettingsFromRepoPath().catch(() => {});
    }));

    // ── Build-and-Run (F5 in .evs files) ─────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('everscript.buildAndRun', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'everscript') {
                vscode.window.showWarningMessage('Everscript: no .evs file is active.');
                return;
            }

            const cfg       = vscode.workspace.getConfiguration('everscript');
            const nodePath  = require('path');
            const nodeFs    = require('fs');
            const nodeOs    = require('os');
            const cp        = require('child_process');
            const extCfg    = getExtConfig();

            // ── 1. Resolve compiler and project root ───────────────────────
            let repoPath    = extCfg.repoPath || '';
            let patchesPath = extCfg.patchesDir || '';
            let romPath     = extCfg.romPath || ''; // full path to vanilla ROM
            let compilerBin = extCfg.compilerPath || ''; // manual override
            let projectRoot = repoPath;
            let useScript   = false;

            // Prefer everscript.py in the repo root (Python-based compiler).
            if (repoPath && nodeFs.existsSync(nodePath.join(repoPath, 'everscript.py'))) {
                useScript = true;
                if (!compilerBin) compilerBin = nodePath.join(repoPath, 'everscript.py');
            }

            if (!compilerBin) {
                // Auto-detect by walking up from the active .evs file.
                let dir = nodePath.dirname(editor.document.uri.fsPath);
                for (let depth = 0; depth < 8 && !compilerBin; depth++) {
                    const pyCandidate = nodePath.join(dir, 'everscript.py');
                    if (nodeFs.existsSync(pyCandidate)) {
                        useScript   = true;
                        compilerBin = pyCandidate;
                        if (!projectRoot) projectRoot = dir;
                        break;
                    }
                    for (const bin of ['everscript_mac', 'everscript', 'everscript.exe']) {
                        const candidate = nodePath.join(dir, 'dist', bin);
                        if (nodeFs.existsSync(candidate)) {
                            compilerBin = candidate;
                            if (!projectRoot) projectRoot = dir;
                            break;
                        }
                    }
                    const parent = nodePath.dirname(dir);
                    if (parent === dir) break;
                    dir = parent;
                }
            }

            if (!compilerBin) {
                vscode.window.showErrorMessage(
                    'Everscript: compiler not found. Open the Emulator panel \u2192 Settings tab and set the repo path.'
                );
                return;
            }

            if (!projectRoot) {
                projectRoot = useScript
                    ? nodePath.dirname(compilerBin)
                    : nodePath.dirname(nodePath.dirname(compilerBin)); // parent of dist/
            }

            // ── 2. Resolve ROM ─────────────────────────────────────────────
            let romName = '';
            if (romPath) {
                romName = nodePath.basename(romPath);
            } else {
                try {
                    const files = nodeFs.readdirSync(projectRoot);
                    const found = files.find(f => /\.(smc|sfc)$/i.test(f));
                    if (found) romName = found;
                } catch (_) {}
            }

            if (!romName) {
                vscode.window.showErrorMessage(
                    'Everscript: no ROM found. Set the Vanilla ROM in the Emulator panel \u2192 Settings tab.'
                );
                return;
            }

            // ── 3. Resolve patches folder ──────────────────────────────────
            let patchesArg = patchesPath;
            if (!patchesArg && projectRoot) {
                const defaultPatches = nodePath.join(projectRoot, 'patches');
                if (nodeFs.existsSync(defaultPatches)) patchesArg = defaultPatches;
            }

            // ── 4. Build spawn args ────────────────────────────────────────
            const inputEvs  = editor.document.uri.fsPath;
            const outputRom = nodePath.join(projectRoot, 'out', romName);

            // Detect Python: prefer project venv so packages like 'injector' are available
            let pythonBin = extCfg.pythonPath || '';
            if (!pythonBin && projectRoot) {
                for (const rel of ['.venv/bin/python3', '.venv/bin/python', 'venv/bin/python3', 'venv/bin/python']) {
                    const c = nodePath.join(projectRoot, rel);
                    if (nodeFs.existsSync(c)) { pythonBin = c; break; }
                }
            }
            if (!pythonBin) pythonBin = 'python3';

            // Use relative paths (matches: python everscript.py --rom ... --patches ./patches in/...)
            const _sep = nodePath.sep;
            const inputArg = inputEvs.startsWith(projectRoot + _sep)
                ? nodePath.relative(projectRoot, inputEvs)
                : inputEvs;
            const patchesArgRel = patchesArg && patchesArg.startsWith(projectRoot)
                ? nodePath.relative(projectRoot, patchesArg)
                : patchesArg;

            let spawnBin, spawnArgs;
            if (useScript) {
                spawnBin  = pythonBin;
                spawnArgs = [compilerBin, '--rom', romName];
                if (patchesArgRel) spawnArgs.push('--patches', patchesArgRel);
                spawnArgs.push(inputArg);
            } else {
                spawnBin  = compilerBin;
                spawnArgs = ['--rom', romName, inputArg];
            }

            function buildSpawnEnv() {
                const env = { ...process.env };
                const pathKey = Object.keys(env).find((key) => key.toUpperCase() === 'PATH') || 'PATH';
                const pathEntries = [];
                const seen = new Set();
                function addPathEntry(entry) {
                    if (!entry || seen.has(entry)) return;
                    seen.add(entry);
                    pathEntries.push(entry);
                }

                if (projectRoot) {
                    for (const rel of ['.venv/bin', 'venv/bin']) {
                        const candidate = nodePath.join(projectRoot, rel);
                        if (nodeFs.existsSync(candidate)) addPathEntry(candidate);
                    }
                }
                if (pythonBin) addPathEntry(nodePath.dirname(pythonBin));

                const shellBin = env.SHELL || '/bin/zsh';
                try {
                    const shellResult = cp.spawnSync(shellBin, ['-lic', 'printf %s "$PATH"'], {
                        cwd: projectRoot,
                        encoding: 'utf8',
                        env,
                        timeout: 5000,
                    });
                    if (shellResult.status === 0 && shellResult.stdout) {
                        for (const entry of shellResult.stdout.split(nodePath.delimiter)) addPathEntry(entry);
                    }
                } catch (_) {}

                for (const entry of String(env[pathKey] || '').split(nodePath.delimiter)) addPathEntry(entry);
                for (const entry of [
                    '/opt/homebrew/bin',
                    '/usr/local/bin',
                    '/usr/bin',
                    '/bin',
                    nodePath.join(nodeOs.homedir(), 'Documents', 'GitHub', 'asar', 'asar', 'bin'),
                    nodePath.join(nodeOs.homedir(), 'GitHub', 'asar', 'asar', 'bin'),
                ]) {
                    if (nodeFs.existsSync(entry)) addPathEntry(entry);
                }

                env[pathKey] = pathEntries.join(nodePath.delimiter);
                return env;
            }

            const channel = vscode.window.createOutputChannel('Everscript Build');
            channel.clear();
            channel.show(true);
            channel.appendLine(`[Everscript] Compiling: ${nodePath.basename(inputEvs)}`);
            channel.appendLine(`[Everscript] CWD:       ${projectRoot}`);
            function _qArg(a) { return /[ ()\[\]\\!'"<>]/.test(a) ? '"' + a.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"' : a; }
            channel.appendLine(`[Everscript] Command:   ${[spawnBin, ...spawnArgs.map(_qArg)].join(' ')}`);
            channel.appendLine('');

            const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
            statusItem.text = '$(sync~spin) Everscript: building...';
            statusItem.show();

            const exitCode = await new Promise(resolve => {
                const proc = cp.spawn(spawnBin, spawnArgs, { cwd: projectRoot, shell: false, env: buildSpawnEnv() });
                proc.stdout.on('data', d => channel.append(d.toString()));
                proc.stderr.on('data', d => channel.append(d.toString()));
                proc.on('close', code => resolve(code));
                proc.on('error', err => {
                    channel.appendLine('[Everscript] Error: ' + err.message);
                    resolve(1);
                });
            });

            statusItem.dispose();

            if (exitCode !== 0) {
                vscode.window.showErrorMessage(
                    'Everscript build failed (exit ' + exitCode + '). See Output > Everscript Build.'
                );
                return;
            }

            channel.appendLine('[Everscript] Build succeeded.');

            // ── 5. Load output ROM into the emulator ───────────────────────
            let romData;
            try {
                romData = nodeFs.readFileSync(outputRom);
            } catch (e) {
                channel.appendLine(`[Everscript] Output ROM not found: ${outputRom}`);
                channel.appendLine(`[Everscript] Error: ${e.message}`);
                vscode.window.showErrorMessage('Everscript: build succeeded but output ROM not found: ' + e.message);
                openEmulatorPanel(context, undefined, channel);
                return;
            }
            channel.appendLine(`[Everscript] Output ROM:  ${outputRom}`);
            channel.appendLine(`[Everscript] ROM size:    ${(romData.length / 1024 / 1024).toFixed(2)} MB`);
            const dataUrl = 'data:application/octet-stream;base64,' + romData.toString('base64');
            openEmulatorPanel(context, { dataUrl, name: nodePath.basename(outputRom) }, channel);
        }),
    );
}

function deactivate() {}

module.exports = { activate, deactivate };
