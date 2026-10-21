// Ownership: one Terranigma room on the shared editor shell — the name line, the canvas column (the shell's
// card, pill, zoom chip, filter bar, status bar), what is on the map (the picture, the cell-type overlay, the
// grid, the hovered and selected cell) and the pointer: Select (click a cell, drag to pan) and Pick (take a
// cell's metatile into the Tile tab). The dock's tabs are dock.dom.ts'. Read-only: nothing here changes a room.
// One svg unit is 8 px, as in the other games' editors; the pixel-sized content sits in `#rg-px`, scaled 1/8.
import { hex, layerOf, mapWord, cellWord, typeColor, typedCells, type RoomData } from './model';
import { dockBind, dockRender } from './dock.dom';

export interface ViewState {
    tool: 'select' | 'pick'; tab: 'tile' | 'info';
    /** The layer the Tile tab shows (0 or 1) and its picked metatile. */
    layer: number; tile: number;
    /** The selected cell, or null. */
    cell: [number, number] | null;
    /** Filter chips: each layer's picture, the cell types, the grid. */
    l0: boolean; l1: boolean; types: boolean; grid: boolean;
    panelOpen: Record<string, boolean>;
}

export interface EditorCtx {
    entry: { id: number; hex: string; name: string; variants: number[] };
    data: RoomData; base: string; st: Partial<ViewState>; save(): void; openRoom(id: number): void;
}

export interface Editor {
    ctx: EditorCtx; st: ViewState; data: RoomData; W: number; H: number;
    svg: SVGSVGElement; wrap: HTMLElement; panels: HTMLElement | null; closed: boolean;
    zp: ShellZoomPan; pan: ShellPan;
    /** The cell the button went down on (a click selects it only if it comes up there, without a pan). */
    down: [number, number] | null;
}

const UNIT = 8, CELL = 2;
const DEFAULTS: ViewState = { tool: 'select', tab: 'tile', layer: 0, tile: 0, cell: null, l0: true, l1: true, types: false, grid: false, panelOpen: {} };
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag: string, attrs: Record<string, string | number>): SVGElement {
    const el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(k => el.setAttribute(k, String(attrs[k])));
    return el;
}

/** The picture for the layer chips: both layers, or the one that is on. */
function pictureHref(E: Editor): string {
    const both = E.st.l0 && E.st.l1, one = E.st.l0 ? 0 : 1;
    const has = (i: number) => !!layerOf(E.data, i);
    const suffix = both || !has(0) || !has(1) ? '' : '.l' + one;
    return E.ctx.base + 'rooms/' + E.data.hex + suffix + '.png';
}

function filtersHtml(E: Editor): string {
    const layerChip = (i: number) => {
        const l = layerOf(E.data, i);
        return mapViewChipHtml({ label: l ? 'BG' + l.bg : 'Layer ' + i, on: !!l && (i === 0 ? E.st.l0 : E.st.l1), attrs: { toggle: 'l' + i },
            cls: l ? '' : 'disabled', title: l ? `Layer ${i}, shown on BG${l.bg} (${l.w}×${l.h} cells)` : 'This room has no layer ' + i });
    };
    const chip = (label: string, key: 'types' | 'grid', title: string) => mapViewChipHtml({ label, on: E.st[key], attrs: { toggle: key }, title });
    // BG1 first, as in the other games' filter bars.
    const order = [0, 1].sort((a, b) => (layerOf(E.data, a)?.bg ?? 9) - (layerOf(E.data, b)?.bg ?? 9));
    return '<div class="rd-filters rg-view-filters">' + mapViewSegHtml(order.map(layerChip))
        + chip('Cell types', 'types', 'Layer 0’s cell types (bits 9-13 of each map word, what the movement code reads); type 0 is not drawn')
        + chip('Grid', 'grid', 'The 16 px grid') + '</div>';
}

function pillHtml(E: Editor): string {
    const tools = [['select', 'select', 'Select a cell (drag to pan)'], ['pick', 'pick', 'Pick: take a cell’s metatile into the Tile tab']]
        .map(([key, icon, tip]) => shellToolButtonHtml({ key, icon: SHELL_TOOL_ICONS[icon], tip, label: key, on: E.st.tool === key }));
    const v = E.ctx.entry.variants;
    const bar = v.length < 2 ? '' : shellSideBarHtml({ id: 'rg-variant-bar', cls: 'rg-variant-bar', label: 'Variant', items: v.map((id, i) => ({
        text: String(i + 1), attr: { 'terra-room': id }, on: id === E.ctx.entry.id, color: 'var(--rg-accent)',
        tip: 'Room $' + hex(id, 3) + ' — shows the same map',
    })) });
    return shellPillHtml([tools], bar);
}

function stageInner(E: Editor): string {
    return '<g id="rg-px" transform="scale(0.125)"><image class="room-img tm-picture" id="rg-img" x="0" y="0" width="' + E.W + '" height="' + E.H
        + '" preserveAspectRatio="none" href="' + pictureHref(E) + '"/>'
        + '<g id="tm-types" pointer-events="none"></g><g id="rg-grid" pointer-events="none"></g>'
        + '<rect id="tm-sel" class="tm-sel" x="0" y="0" width="16" height="16" display="none" pointer-events="none"/>'
        + '<rect id="rg-hover" class="tm-hover" x="0" y="0" width="16" height="16" display="none" pointer-events="none"/></g>';
}

export function stageTypes(E: Editor): void {
    const g = document.getElementById('tm-types');
    if (!g) return;
    g.textContent = '';
    if (!E.st.types) return;
    for (const [x, y, t] of typedCells(E.data)) {
        g.appendChild(svgEl('rect', { x: x * 16, y: y * 16, width: 16, height: 16, fill: typeColor(t), class: 'tm-type' }));
        const label = svgEl('text', { x: x * 16 + 8, y: y * 16 + 11, class: 'tm-type-label' });
        label.textContent = String(t);
        g.appendChild(label);
    }
}

function stageGrid(E: Editor): void {
    const g = document.getElementById('rg-grid');
    if (!g) return;
    g.textContent = '';
    if (!E.st.grid) return;
    let d = '';
    for (let x = 16; x < E.W; x += 16) d += 'M' + x + ' 0V' + E.H;
    for (let y = 16; y < E.H; y += 16) d += 'M0 ' + y + 'H' + E.W;
    g.appendChild(svgEl('path', { d, class: 'tm-grid' }));
}

export function stageSelection(E: Editor): void {
    const r = document.getElementById('tm-sel');
    if (!r) return;
    const c = E.st.cell;
    if (!c) { r.setAttribute('display', 'none'); return; }
    r.setAttribute('x', String(c[0] * 16)); r.setAttribute('y', String(c[1] * 16)); r.removeAttribute('display');
}

function cellAt(E: Editor, e: MouseEvent): [number, number] | null {
    const m = E.svg.getScreenCTM();
    if (!m) return null;
    const pt = E.svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(m.inverse());
    const x = Math.floor(p.x / CELL), y = Math.floor(p.y / CELL);
    return x < 0 || y < 0 || x >= E.data.w || y >= E.data.h ? null : [x, y];
}

function hover(E: Editor, c: [number, number] | null): void {
    const r = document.getElementById('rg-hover');
    if (!r) return;
    if (!c) { r.setAttribute('display', 'none'); return; }
    r.setAttribute('x', String(c[0] * 16)); r.setAttribute('y', String(c[1] * 16)); r.removeAttribute('display');
}

function refreshFilters(E: Editor): void {
    const bar = document.querySelector('.rg-view-filters');
    if (bar) bar.outerHTML = filtersHtml(E);
}

function refreshPill(E: Editor): void {
    const pill = document.getElementById('rg-edit-chrome');
    if (pill) pill.outerHTML = pillHtml(E);
}

/** A cell clicked with Select or Pick: select it; Pick also takes its metatile into the Tile tab. */
function clickCell(E: Editor, c: [number, number]): void {
    E.st.cell = c;
    if (E.st.tool === 'pick') {
        const w = cellWord(E.data, E.st.layer, c[0], c[1]);
        if (w >= 0) { E.st.tile = mapWord(w).metatile; E.st.tab = 'tile'; }
    }
    E.ctx.save();
    stageSelection(E);
    dockRender(E);
}

/**
 * Open room `ctx.entry` in `#room-detail`. Returns {close()}: the handlers that outlive the room's markup
 * (`#room-detail` survives every room) go with it, or a second room would run every click twice.
 */
export function openEditor(ctx: EditorCtx): { close(): void } {
    const st = ctx.st as ViewState;
    (Object.keys(DEFAULTS) as (keyof ViewState)[]).forEach(k => { if (st[k] === undefined) (st as unknown as Record<string, unknown>)[k] = DEFAULTS[k]; });
    if (!layerOf(ctx.data, st.layer)) st.layer = ctx.data.layers[0]?.index ?? 0;
    st.cell = null;
    const panel = document.getElementById('room-detail')!;
    const E = { ctx, st, data: ctx.data, W: ctx.data.w * 16, H: ctx.data.h * 16, panels: null, closed: false, down: null,
        pan: { panX: 0, panY: 0, panActive: false, panMoved: false, panCX: 0, panCY: 0, panBX: 0, panBY: 0 } } as unknown as Editor;

    panel.className = 'rg-theme rg-editing';
    if (isCompactMode()) panel.classList.add('rg-compact');
    if (_layoutCollapsed.dock) panel.classList.add('dock-collapsed');
    const dispW = 520, dispH = Math.min(600, Math.round(dispW * E.H / E.W));
    const parts = shellCanvasParts({ dispW, dispH, viewBox: '0 0 ' + (E.W / UNIT) + ' ' + (E.H / UNIT), filtersHtml: filtersHtml(E),
        statusHtml: shellStatusbarHtml({ width: ctx.data.w, height: ctx.data.h, cellTitle: 'The cell under the pointer', sizeTitle: 'Room size in 16 px cells' }),
        zoomTitle: 'Zoom — 100% is one game pixel per screen pixel. Ctrl/⌘ + scroll over the map to pinch.' });
    const same = ctx.entry.variants.filter(id => id !== ctx.entry.id);
    panel.innerHTML = shellHeadHtml({ name: ctx.entry.name, tags: [{ cls: 'rd-vid', text: ctx.data.w + '×' + ctx.data.h },
        { cls: 'rd-file', text: same.length ? 'same picture: ' + same.map(id => '$' + hex(id, 3)).join(', ') : '' }] })
        + parts.open + stageInner(E) + parts.close;
    const w = window as unknown as Record<string, unknown>;
    w.renderEditHeadActs = () => {
        const el = document.getElementById('rg-head-acts');
        if (el) el.innerHTML = shellSidebarTogglesHtml(isRailVisible(), isDockVisible());
    };
    (w.renderEditHeadActs as () => void)();

    E.wrap = document.getElementById('rg-wrap')!;
    E.svg = document.getElementById('rg-svg') as unknown as SVGSVGElement;
    document.getElementById('rg-canvas-card')!.insertAdjacentHTML('afterbegin', pillHtml(E));
    E.panels = shellDockMount(document.getElementById('rg-outer')!).panels;
    dockBind(E);
    dockRender(E);
    layoutApplyCollapsed();
    layoutUpdateCompact();
    E.zp = { svg: E.svg, canvas: document.getElementById('rg-canvas')!, wrap: E.wrap, W: E.W / UNIT, H: E.H / UNIT, dispW, dispH, zoomState: { scale: 0 }, panX: 0, panY: 0 };
    setupZoomPan(E.zp);
    stageTypes(E); stageGrid(E); stageSelection(E);
    shellStatusBind(e => {
        const c = cellAt(E, e);
        if (!c) return null;
        const word = cellWord(E.data, 0, c[0], c[1]);
        return 'x: ' + statusPad2(c[0]) + ' y: ' + statusPad2(c[1]) + (word >= 0 ? ' · $' + hex(mapWord(word).metatile, 3) + ' · type ' + mapWord(word).type : '');
    });

    const onDown = (e: MouseEvent) => {
        if (e.button !== 0) return;
        const c = cellAt(E, e);
        if (E.st.tool === 'select' && shellPanStart(E.zp, E.pan, E.wrap, e)) e.preventDefault();
        E.pan.panMoved = false;
        E.down = c;
    };
    const onUp = (e: MouseEvent) => {
        const down = E.down;
        E.down = null;
        if (!down || E.pan.panMoved || e.button !== 0) return;
        const c = cellAt(E, e);
        if (c && c[0] === down[0] && c[1] === down[1]) clickCell(E, c);
    };
    const onMove = (e: MouseEvent) => hover(E, cellAt(E, e));
    const onLeave = () => hover(E, null);
    E.wrap.addEventListener('mousedown', onDown, true);
    E.wrap.addEventListener('mouseup', onUp, true);
    E.wrap.addEventListener('mousemove', onMove, true);
    E.wrap.addEventListener('mouseleave', onLeave, true);

    // Clicks on the pill, the filter bar and the name line (the dock has its own, dock.dom.ts).
    const onClick = (ev: Event) => {
        const b = ev.target instanceof Element ? ev.target.closest('button') : null;
        if (!b || b.disabled || !panel.contains(b) || (E.panels && E.panels.contains(b))) return;
        const d = b.dataset;
        if (d.editTool) { E.st.tool = d.editTool as ViewState['tool']; ctx.save(); refreshPill(E); return; }
        if (d.terraRoom) { ctx.openRoom(Number(d.terraRoom)); return; }
        if (d.editAct === 'toggle-rail') { editToggleRail(); return; }
        if (d.editAct === 'toggle-dock') { editToggleDock(); return; }
        const k = d.toggle as 'l0' | 'l1' | 'types' | 'grid' | undefined;
        if (!k || b.classList.contains('disabled')) return;
        E.st[k] = !E.st[k];
        if (!E.st.l0 && !E.st.l1) E.st[k === 'l0' ? 'l1' : 'l0'] = true;   // there is no picture of nothing
        ctx.save();
        refreshFilters(E);
        if (k === 'l0' || k === 'l1') document.getElementById('rg-img')?.setAttribute('href', pictureHref(E));
        else if (k === 'types') stageTypes(E);
        else stageGrid(E);
    };
    panel.addEventListener('click', onClick);

    return {
        close() {
            E.closed = true;
            panel.removeEventListener('click', onClick);
        },
    };
}
