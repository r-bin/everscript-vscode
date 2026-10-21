// Ownership: the right-hand dock of the Terranigma Maps page — its tab strip (the shell's shellTabStripHtml)
// and its tabs: Tile (the layer, the metatile picker, what the picked metatile is, the selected cell), Collision
// (the cell types of the room and what each does to a move), Object (the room's map changes, one previewed on the
// map), Trigger (the room's exits and chests) and Info (what the room is, what its load ran, its display registers,
// the rooms that show the same map). The dock
// node itself is the shell's (shellDockMount); this file fills it and handles its clicks. State lives on the
// editor `E` (editor.dom.ts); nothing is owned here.
import { blockedEdges, chestKind, contentsText, describeCell, describeChange, describeChest, describeDisplay, describeExit, describeType,
    exitTargets, hex, layerOf, mapWord, cellWord, metatileTiles, metatileUse, moveSummary, sheetRows, typeCounts,
    type CellTypeRule, type RoomData } from './model';
import type { Editor } from './editor.dom';

const TABS: [Editor['st']['tab'], string][] = [['tile', 'Tile'], ['collision', 'Collision'], ['object', 'Object'], ['trigger', 'Trigger'], ['info', 'Info']];
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

/** A selectable card of a list: its row and, when selected, its rows and buttons underneath. */
function card(attr: string, i: number, on: boolean, label: string, body: string): string {
    return '<div class="rg-trigger-card' + (on ? ' on' : '') + '"><div class="rg-trigger-row' + (on ? ' on' : '') + '" data-' + attr + '="' + i
        + '" title="Select it (it is outlined on the map)"><span class="rg-trigger-label">' + shellEscape(label) + '</span></div>'
        + (on ? '<div class="rg-object-expanded">' + body + '</div>' : '') + '</div>';
}

const openRooms = (rooms: number[]) => '<div class="tm-rooms">' + rooms.map(r => '<button class="rdf" data-open-room="' + r + '" title="Open room $'
    + hex(r, 3) + '">open $' + hex(r, 3) + '</button>').join('') + '</div>';

function exitsList(E: Editor): string {
    const exits = E.data.exits || [];
    if (!exits.length) return '<div class="rs-note">This room has no exits in the exit table ($81:8000).</div>';
    return '<div class="rg-trigger-list">' + exits.map((e, i) => card('exit', i, i === E.st.exit,
        '#' + i + ' · ' + e.x + ',' + e.y + (e.w > 1 || e.h > 1 ? ' · ' + e.w + '×' + e.h : '') + ' → ' + exitTargets(e) + (e.targets.some(t => t.flag !== null) ? ' · by flag' : ''),
        rows(describeExit(e)) + openRooms(e.targets.map(t => t.room)))).join('') + '</div>'
        + '<div class="rs-note">An exit is a rectangle of cells: the room change starts when the player’s 16 px box is inside it ($8D:8797, every frame). '
        + 'Its target is a room and an arrival point in that room’s pixels, or a list of choices by event flag ($8D:8911).</div>';
}

function chestsList(E: Editor): string {
    const chests = E.ctx.data.chests || [];
    if (!chests.length) return '<div class="rs-note">This room has no chests in the chest table ($99:D859).</div>';
    return '<div class="rg-trigger-list">' + chests.map((c, i) => card('chest', i, i === E.st.chest,
        '#' + i + ' · ' + c.x + ',' + c.y + ' · ' + contentsText(c.contents).replace(/ \(.*$/, '') + (chestKind(E.ctx.data, c) === 'chest' ? '' : ' · ' + chestKind(E.ctx.data, c)),
        rows(describeChest(E.ctx.data, c)))).join('') + '</div>'
        + '<div class="rs-note">The A button checks the cell in front of the player ($87:9199): a character there is talked to; '
        + 'else a closed chest (metatile $0F0, faced from below), metatiles $0F3 and $0FA–$0FC, or a cell of type 4 is looked up in the room’s list '
        + '($87:C7AE). Opening sets the chest’s flag and draws metatile $0F1; a room load draws it open again once the flag is set ($8D:912B). '
        + 'Item names are not decoded.</div>';
}

function triggerTab(E: Editor): string {
    const n = { exits: (E.data.exits || []).length, chests: (E.ctx.data.chests || []).length };
    const subs = '<div class="rg-subtabs" role="tablist">' + ([['exits', 'Exits'], ['chests', 'Chests']] as const).map(([k, label]) =>
        '<button class="rg-subtab' + (E.st.trigSub === k ? ' on' : '') + '" role="tab" aria-selected="' + (E.st.trigSub === k) + '" data-trig-sub="' + k + '">'
        + label + ' <span class="rs-note">' + n[k] + '</span></button>').join('') + '</div>';
    return subs + (E.st.trigSub === 'chests' ? chestsList(E) : exitsList(E));
}

function objectTab(E: Editor): string {
    const changes = E.ctx.data.changes || [];
    if (!changes.length) return '<div class="rs-note">No map change of the table ($99:D4E7) is for this room.</div>';
    const list = changes.map((c, i) => card('change', i, i === E.st.change,
        'bit ' + c.bit + ' · ' + c.edits.map(e => 'layer ' + e.layer + (e.kind === 'set' ? ' cell ' + e.x + ',' + e.y : ' ' + e.w + '×' + e.h + ' at ' + e.x + ',' + e.y)).join(', '),
        rows([...describeChange(c), 'the map shows the room with it applied; click again for the room as it loads']))).join('');
    return panelHtml(E, 'changes', 'MAP CHANGES', '<div class="rg-trigger-list">' + list + '</div>', String(changes.length))
        + '<div class="rs-note">The game’s parts of a map that the story switches: change n is on while bit n of $7E:0710 is set, and every room load '
        + 're-applies the room’s changes that are on ($8D:8FB4, table $99:D4E7) — a cell set to a metatile, or a block copied from elsewhere in the same layer. '
        + 'What sets the bits (the events) is not decoded.</div>';
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
    const tabs: Record<string, (e: Editor) => string> = { info: infoTab, collision: collisionTab, trigger: triggerTab, object: objectTab };
    const tab = (tabs[E.st.tab] ?? tileTab)(E);
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
        const el = t.closest('[data-terra-tab],[data-layer],[data-panel],[data-open-room],[data-terra-ctype],[data-exit],[data-chest],[data-change],[data-trig-sub]') as HTMLElement | null;
        if (!el || el.classList.contains('disabled')) return;
        const d = el.dataset;
        if (d.terraTab) {
            E.st.tab = d.terraTab as Editor['st']['tab'];
            if (E.st.tab !== 'object' && E.st.change !== null) E.pickChange(null);   // the preview belongs to the Object tab
        }
        else if (d.trigSub) E.st.trigSub = d.trigSub as Editor['st']['trigSub'];
        else if (d.chest !== undefined) E.st.chest = E.st.chest === Number(d.chest) ? null : Number(d.chest);
        else if (d.change !== undefined) E.pickChange(E.st.change === Number(d.change) ? null : Number(d.change));
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
