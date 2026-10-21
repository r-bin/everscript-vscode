// Ownership: the right-hand dock of the Terranigma Maps page — its tab strip (the shell's shellTabStripHtml)
// and its tabs: Tile (the layer, the metatile picker, what the picked metatile is, the selected cell), Collision
// (the cell types of the room and what each does to a move), Trigger (the room's exits) and Info (what the room
// is, what its load ran, its display registers, the rooms that show the same map). The dock
// node itself is the shell's (shellDockMount); this file fills it and handles its clicks. State lives on the
// editor `E` (editor.dom.ts); nothing is owned here.
import { blockedEdges, describeCell, describeDisplay, describeExit, describeType, exitTargets, hex, layerOf, mapWord, cellWord,
    metatileTiles, metatileUse, moveSummary, sheetRows, typeCounts, type CellTypeRule, type RoomData } from './model';
import type { Editor } from './editor.dom';

const TABS: [Editor['st']['tab'], string][] = [['tile', 'Tile'], ['collision', 'Collision'], ['trigger', 'Trigger'], ['info', 'Info']];
/** Metatiles per row of the sheet (terra://rom/rooms/<hex>.tiles.l<n>.png), and rows. */
const SHEET_COLS = 16, SHEET_ROWS = 32;

function panelHtml(E: Editor, key: string, title: string, body: string, note?: string): string {
    return shellPanelHtml(key, title, body, note, E.st.panelOpen[key] !== false);
}

function rows(lines: string[]): string {
    return lines.map(l => '<div class="tm-row">' + shellEscape(l) + '</div>').join('');
}

function info(label: string, value: string): string {
    return '<div class="tm-info-row"><span>' + shellEscape(label) + '</span><b>' + shellEscape(value) + '</b></div>';
}

function tileTab(E: Editor): string {
    const st = E.st, d = E.data, l = layerOf(d, st.layer);
    const chip = (i: number) => {
        const x = layerOf(d, i);
        return mapViewChipHtml({ label: 'Layer ' + i + (x ? ' · BG' + x.bg : ''), on: st.layer === i, attrs: { layer: String(i) }, cls: x ? '' : 'disabled',
            title: x ? `Layer ${i}: ${x.w}×${x.h} cells, shown on BG${x.bg}` : 'This room has no layer ' + i });
    };
    const head = '<div class="rg-tile-head"><div class="rd-filters">' + mapViewSegHtml([chip(0), chip(1)]) + '</div></div>';
    if (!l) return head + '<div class="rs-note">This room has no map on this layer.</div>';
    const n = st.tile, sheet = E.ctx.base + 'rooms/' + d.hex + '.tiles.l' + l.index + '.png';
    // The sheet down to the last row the layer uses (the rest of the 512 slots are unused here).
    const h = Math.max(sheetRows(l), Math.floor(n / SHEET_COLS) + 1) * 16;
    const picker = '<div class="tm-picker-box"><svg id="tm-picker" class="tm-picker" viewBox="0 0 256 ' + h + '" width="256" height="' + h + '" aria-label="Metatiles">'
        + '<rect width="256" height="' + h + '" fill="rgb(' + d.backdrop.join(',') + ')"/>'
        + '<image href="' + sheet + '" x="0" y="0" width="256" height="512"/>'
        + '<rect class="tm-picked" x="' + ((n % SHEET_COLS) * 16 + 0.5) + '" y="' + (Math.floor(n / SHEET_COLS) * 16 + 0.5) + '" width="15" height="15"/></svg></div>';
    const use = metatileUse(l, n);
    const picked = rows(['metatile $' + hex(n, 3) + ' of layer ' + l.index + ' · on ' + use.cells + ' cell' + (use.cells === 1 ? '' : 's')
        + (use.types.length ? ' · cell type' + (use.types.length > 1 ? 's ' : ' ') + use.types.join(', ') : '')])
        + '<div class="tm-tiles">' + rows(metatileTiles(l, n)) + '</div>';
    const c = st.cell;
    const cell = c ? rows([...describeCell(d, 0, c[0], c[1]), ...(layerOf(d, 1) ? ['layer 1: ' + describeCell(d, 1, c[0], c[1]).slice(1).join(' · ')] : [])])
        : '<div class="rs-note">Click a cell on the map (Select), or take its metatile with Pick.</div>';
    return head + '<div class="rg-tile-scroll">'
        + panelHtml(E, 'picker', 'METATILES', picker, 'layer ' + l.index + ' · $000–$' + hex(sheetRows(l) * 16 - 1, 3))
        + panelHtml(E, 'picked', 'PICKED', picked)
        + panelHtml(E, 'cell', 'CELL', cell, c ? c[0] + ',' + c[1] : '')
        + '<div class="rs-note">A map word is the metatile (bits 0-8) and the cell type (bits 9-13) the movement code reads; '
        + 'a tile word is the SNES character, palette, priority and flips. What each cell type does: the Collision tab.</div>'
        + '</div>';
}

/** A cell type's swatch, as the overlay draws it (walls red, a diagonal's line, the edges some moves cannot cross). */
function typeSwatch(rule: CellTypeRule | undefined): string {
    if (!rule || rule.look === 'open') return shellSwatchSvg();
    if (rule.look === 'wall') return shellSwatchSvg('M0 0h16v16h-16z', 'var(--tm-wall)');
    if (rule.look === 'diagonal') return shellSwatchSvg('', '', '<path d="' + (rule.type === 7 ? 'M0 0L16 16' : 'M0 16L16 0') + '" stroke="var(--tm-wall)" stroke-width="2.5"/>');
    const edge: Record<string, string> = { top: 'M0 0h16v2h-16z', bottom: 'M0 14h16v2h-16z', left: 'M0 0h2v16h-2z', right: 'M14 0h2v16h-2z' };
    const e = blockedEdges(rule);
    return shellSwatchSvg(e.filter(x => !x.gated).map(x => edge[x.side]).join(''), 'var(--tm-wall)',
        e.filter(x => x.gated).map(x => '<path d="' + edge[x.side] + '" fill="var(--tm-gated)"/>').join(''));
}

function collisionTab(E: Editor): string {
    const rules = E.ctx.rules, counts = typeCounts(E.data), sel = E.st.ctype;
    if (!rules.length) return '<div class="rs-note">The cell-type rules could not be read (terra://rom/cell-types.json).</div>';
    if (!layerOf(E.data, 0)) return '<div class="rs-note">This room has no layer 0, the map the movement code reads.</div>';
    const keys = shellKeysHtml([['red', 'stops every move'], ['edge', 'stops a move across it'], ['dashed', 'only without a flag'], ['click', 'a cell shows its type']]);
    const cards = shellSwatchGridHtml([...counts].map(([t, n]) => ({
        attrs: { 'terra-ctype': t }, swatch: typeSwatch(rules[t]), label: 'type ' + t, sub: n + ' cell' + (n === 1 ? '' : 's'),
        on: t === sel, title: moveSummary(rules[t]) + ' — click to outline its cells',
    })));
    const rule = sel !== null ? rules[sel] : undefined;
    const detail = rule ? rows([moveSummary(rule), ...describeType(rule)])
        : '<div class="rs-note">Pick a type above, or click a cell on the map.</div>';
    const c = E.st.cell, w = c ? cellWord(E.data, 0, c[0], c[1]) : -1;
    const cell = w >= 0 ? rows([`cell ${c![0]},${c![1]} · type ${mapWord(w).type}`, moveSummary(rules[mapWord(w).type])]) : '';
    return keys + panelHtml(E, 'ctypes', 'TYPES IN THIS ROOM', cards, String(counts.size))
        + panelHtml(E, 'ctype', rule ? 'TYPE ' + rule.type : 'TYPE', detail, rule ? '$' + hex(rule.type, 2) : '')
        + (cell ? panelHtml(E, 'ccell', 'CELL', cell) : '')
        + '<div class="rs-note">Read from the movement code ($80:D0F9): a 32-entry jump table per direction, by the type of the cell a move enters, '
        + 'on layer 0 (the map at $7E:A000). In line with a single cell a move passes or stops as shown; straddling two cells it also slides around a corner. '
        + 'Types 6 (/) and 7 (\\) slide the character along a diagonal from either side; the overlay fills the half facing the walls next to the cell. Bit 14 of a map word is not decoded.</div>';
}

function triggerTab(E: Editor): string {
    const exits = E.data.exits || [], sel = E.st.exit;
    if (!exits.length) return '<div class="rs-note">This room has no exits in the exit table ($81:8000). Events (characters, chests, cutscenes) are not decoded yet.</div>';
    const list = exits.map((e, i) => {
        const on = i === sel, flagged = e.targets.some(t => t.flag !== null);
        const body = on ? '<div class="rg-object-expanded">' + rows(describeExit(e))
            + '<div class="tm-rooms">' + e.targets.map(t => '<button class="rdf" data-open-room="' + t.room + '" title="Open room $' + hex(t.room, 3) + '">open $' + hex(t.room, 3) + '</button>').join('') + '</div></div>' : '';
        return '<div class="rg-trigger-card' + (on ? ' on' : '') + '"><div class="rg-trigger-row' + (on ? ' on' : '') + '" data-exit="' + i + '" title="Select this exit">'
            + '<span class="rg-trigger-label">#' + i + ' · ' + e.x + ',' + e.y + (e.w > 1 || e.h > 1 ? ' · ' + e.w + '×' + e.h : '') + ' → ' + shellEscape(exitTargets(e))
            + (flagged ? ' · by flag' : '') + '</span></div>' + body + '</div>';
    }).join('');
    return panelHtml(E, 'exits', 'EXITS', '<div class="rg-trigger-list">' + list + '</div>', String(exits.length))
        + '<div class="rs-note">An exit is a rectangle of cells: the room change starts when the player’s 16 px box is inside it ($8D:8797, every frame). '
        + 'Its target is a room and an arrival point in that room’s pixels, or a list of choices by event flag ($8D:8911). '
        + 'Click an exit on the map or a row here; events run by characters and objects are not decoded yet.</div>';
}

function infoTab(E: Editor): string {
    const d: RoomData = E.data, v = E.ctx.entry.variants;
    const room = info('room', '$' + hex(d.id, 3)) + info('script', d.script === null ? '—' : '$' + hex(d.script >> 16, 2) + ':' + hex(d.script & 0xFFFF, 4))
        + info('size', d.w + '×' + d.h + ' cells (' + d.w * 16 + '×' + d.h * 16 + ' px)')
        + d.layers.map(l => info('layer ' + l.index, 'BG' + l.bg + ' · ' + l.w + '×' + l.h + (l.w < d.w || l.h < d.h ? ' (repeats)' : ''))).join('');
    const context = !d.context.length ? ''
        : '<div class="rs-note">This room keeps background graphics, palette, metatiles or display mode from the room before it. '
            + (d.context.length > 1 ? 'Rooms ' : 'Room ') + d.context.map(k => '$' + hex(k, 3)).join(', ')
            + ', the closest earlier rooms that load them, ' + (d.context.length > 1 ? 'were' : 'was') + ' loaded first; in the game it is whichever room the player came from.</div>';
    const load = rows(d.sections.map(s => '$' + hex(s.bit, 2) + ' · ' + s.name))
        + (d.sets.length ? info('shared scripts', d.sets.map(s => '$' + hex(s, 2)).join(' ')) : '');
    const same = v.length > 1
        ? '<div class="tm-rooms">' + v.map(id => '<button class="rdf' + (id === d.id ? ' on' : '') + '" data-open-room="' + id + '" title="Open room $' + hex(id, 3) + '">$' + hex(id, 3) + '</button>').join('') + '</div>'
        : '<div class="rs-note">No other room shows this map.</div>';
    return panelHtml(E, 'room', 'ROOM', room + context)
        + panelHtml(E, 'load', 'LOAD', load, 'header sections, in order')
        + panelHtml(E, 'display', 'DISPLAY', rows(describeDisplay(d)))
        + panelHtml(E, 'same', 'SAME PICTURE', same, String(v.length))
        + '<div class="rs-note">Drawn from the game’s own room loader run on a 65816 interpreter. Not drawn: characters and other sprites, '
        + 'BG3 (text), tile animation, windows, palette animation (animated water shows the colours the loader leaves).</div>';
}

/** Fill the dock with the tab strip and the open tab. */
export function dockRender(E: Editor): void {
    if (!E.panels || E.closed) return;
    const scrollOf = () => E.panels!.querySelector(E.st.tab === 'tile' ? '.rg-tile-scroll' : '.rg-tab-body');
    const tab = E.st.tab === 'info' ? infoTab(E) : E.st.tab === 'collision' ? collisionTab(E) : E.st.tab === 'trigger' ? triggerTab(E) : tileTab(E);
    const scroll = scrollOf();
    const top = scroll ? scroll.scrollTop : 0;
    E.panels.innerHTML = shellTabStripHtml(TABS.map(([value, label]) => ({ value, label, on: E.st.tab === value })), 'terra-tab')
        + '<div class="rg-tab-body" id="rg-tab-body" data-tab="' + E.st.tab + '">' + tab + '</div>';
    const again = scrollOf();
    if (again && top) again.scrollTop = top;
}

/** The dock's clicks, bound once per dock node (the node is the editor's: a new room mounts a new one). */
export function dockBind(E: Editor): void {
    const panels = E.panels;
    if (!panels || panels.dataset.terraBound) return;
    panels.dataset.terraBound = '1';
    panels.addEventListener('click', ev => {
        const t = ev.target instanceof Element ? ev.target : null;
        if (!t) return;
        const picker = t.closest('#tm-picker') as SVGSVGElement | null;
        if (picker && ev instanceof MouseEvent) {
            const m = picker.getScreenCTM();
            if (!m) return;
            const pt = picker.createSVGPoint();
            pt.x = ev.clientX; pt.y = ev.clientY;
            const p = pt.matrixTransform(m.inverse());
            const x = Math.floor(p.x / 16), y = Math.floor(p.y / 16);
            if (x < 0 || y < 0 || x >= SHEET_COLS || y >= SHEET_ROWS) return;
            E.st.tile = y * SHEET_COLS + x;
            E.ctx.save(); dockRender(E);
            return;
        }
        const el = t.closest('[data-terra-tab],[data-layer],[data-panel],[data-open-room],[data-terra-ctype],[data-exit]') as HTMLElement | null;
        if (!el || el.classList.contains('disabled')) return;
        const d = el.dataset;
        if (d.terraTab) E.st.tab = d.terraTab as Editor['st']['tab'];
        else if (d.terraCtype !== undefined) E.st.ctype = E.st.ctype === Number(d.terraCtype) ? null : Number(d.terraCtype);
        else if (d.exit !== undefined) E.st.exit = E.st.exit === Number(d.exit) ? null : Number(d.exit);
        else if (d.layer !== undefined) E.st.layer = Number(d.layer);
        else if (d.panel) E.st.panelOpen[d.panel] = E.st.panelOpen[d.panel] === false;
        else if (d.openRoom) { E.ctx.openRoom(Number(d.openRoom)); return; }
        E.ctx.save();
        E.redraw();
        dockRender(E);
    });
}
