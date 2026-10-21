// Ownership: the right-hand dock of the Terranigma Maps page — its tab strip (the shell's shellTabStripHtml)
// and its tabs: Tile (the layer, the metatile picker, what the picked metatile is, the selected cell) and Info
// (what the room is, what its load ran, its display registers, the rooms that show the same map). The dock
// node itself is the shell's (shellDockMount); this file fills it and handles its clicks. State lives on the
// editor `E` (editor.dom.ts); nothing is owned here.
import { describeCell, describeDisplay, hex, layerOf, metatileTiles, metatileUse, sheetRows, type RoomData } from './model';
import type { Editor } from './editor.dom';

const TABS: [Editor['st']['tab'], string][] = [['tile', 'Tile'], ['info', 'Info']];
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
        + 'a tile word is the SNES character, palette, priority and flips. What each cell type does is not decoded yet.</div>'
        + '</div>';
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
    const scroll = scrollOf();
    const top = scroll ? scroll.scrollTop : 0;
    E.panels.innerHTML = shellTabStripHtml(TABS.map(([value, label]) => ({ value, label, on: E.st.tab === value })), 'terra-tab')
        + '<div class="rg-tab-body" id="rg-tab-body" data-tab="' + E.st.tab + '">' + (E.st.tab === 'info' ? infoTab(E) : tileTab(E)) + '</div>';
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
        const el = t.closest('[data-terra-tab],[data-layer],[data-panel],[data-open-room]') as HTMLElement | null;
        if (!el || el.classList.contains('disabled')) return;
        const d = el.dataset;
        if (d.terraTab) E.st.tab = d.terraTab as Editor['st']['tab'];
        else if (d.layer !== undefined) E.st.layer = Number(d.layer);
        else if (d.panel) E.st.panelOpen[d.panel] = E.st.panelOpen[d.panel] === false;
        else if (d.openRoom) { E.ctx.openRoom(Number(d.openRoom)); return; }
        E.ctx.save();
        dockRender(E);
    });
}
