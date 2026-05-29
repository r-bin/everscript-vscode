'use strict';
// Owner: memory_radar/render-memory-tab.js
// Renders the WRAM grid, arg grid, and detail table tab-pane HTML.
// Pure function — no state, no VS Code dependency.

const { radarH, radarEsc, radarLifecycle, radarExtractEmoji } = require('./radar-utils');

const COLS = 16;

/**
 * Build the full `<div class="tab-pane" data-tab="radar">` HTML string.
 * @param {object} scope - { kind, name, startLine, endLine }
 * @param {Map} refs - addr → { reads, writes }
 * @param {Array} pools - [ { start, end, lc, line } ]
 * @param {Map} argRefs - argIdx → { reads, writes }
 * @param {Map} mapByAddr - addr → memory-map entry
 * @param {Map} enumByAddr - addr → [{cls, name}] (default empty map)
 * @returns {{ html: string, cellData: object }} tab HTML + cell data JSON
 */
function buildMemoryTabHtml(scope, refs, pools, argRefs, mapByAddr, enumByAddr = new Map()) {
    const allAddrs = [...mapByAddr.keys(), ...refs.keys()];
    if (!allAddrs.length) { allAddrs.push(0x2200, 0x28FF); }
    const rowStart = Math.min(...allAddrs) & ~(COLS - 1);
    const rowEnd   = (Math.max(...allAddrs) | (COLS - 1)) + 1;

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

    // Detail table
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
        const rowCls = 'dr lc-' + lc + (usage ? ' du' : '') + (untracked ? ' untracked' : '');
        const notesHtml = untracked
            ? '<span class="scope-only">scope usage only</span>'
            : (e.notes ? radarEsc(e.notes).replace(/\n/g, '<br>') : '&ndash;');
        const hdoc = untracked ? 0 : 1;
        const enumEntries = !untracked ? (enumByAddr.get(e.addrStart) || []) : [];
        const enumHtml = enumEntries.length
            ? '<br>' + enumEntries.map(ev => '<span class="enum-tag">' + radarEsc(ev.cls + '.' + ev.name) + '</span>').join(' ')
            : '';
        const parts = e.nameParts && e.nameParts.length > 1 ? e.nameParts : null;
        const numBytes = e.addrEnd - e.addrStart + 1;
        const typeStr = radarEsc(e.type.replace(/\s*\[SRAM\]/gi, '').trim());
        const es = e.addrStart, ee = e.addrEnd;

        if (parts) {
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

    const poolRows = pools.map(p =>
        '<tr class="pool-row lc-' + p.lc + '">' +
        '<td class="mo"><span class="pool-badge">' + p.lc + '</span>' + radarH(p.start) + '\u2013' + radarH(p.end) + '</td>' +
        '<td colspan="2">declared pool &mdash; ' + (p.end - p.start + 1) + ' bytes at line ' + (p.line + 1) + '</td>' +
        '<td class="nt">' + p.lc + ' region</td><td>&ndash;</td></tr>'
    ).join('');

    const tempT = lcCount('temp'), sessT = lcCount('session'), sramT = lcCount('sram');
    const tempU = lcUsed('temp'),  sessU = lcUsed('session');

    // Arg grid
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

    const tabHtml =
        '<div class="tab-pane" data-tab="radar">' +
        '<div class="head">' +
        '<div class="sm">Scope: <strong>' + radarEsc(scope.kind) + ' ' + radarEsc(scope.name) +
        '</strong> | Lines: ' + (scope.startLine + 1) + '\u2013' + (scope.endLine + 1) + '</div>' +
        '<div class="filters">' + btns + '</div>' +
        '<h2>Region Usage</h2>' +
        '<div class="sr"><span class="sl">temp</span>' + bar(tempU, tempT, 'temp') + '</div>' +
        '<div class="sr"><span class="sl">session</span>' + bar(sessU, sessT, 'session') + '</div>' +
        '<div class="sr"><span class="sl">sram</span>' + bar(lcUsed('sram'), lcCount('sram'), 'sram') + '</div>' +
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
        '</div>';

    return { html: tabHtml, cellData };
}

module.exports = { buildMemoryTabHtml };
