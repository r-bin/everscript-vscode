// Ownership: one Terranigma room on the shared editor shell — the name line, the canvas column (the shell's
// card, pill, zoom chip, filter bar, status bar), the picture (or, while a map change is picked, the picture with it
// applied), the hovered and selected cell, and the pointer: Select (click a cell, an exit, a chest or a map change;
// drag to pan) and Pick (take a cell's metatile into the Tile tab). The overlays are overlays.dom.ts', the dock's
// tabs dock.dom.ts'. Read-only: nothing here changes a room.
// One svg unit is 8 px, as in the other games' editors; the pixel-sized content sits in `#rg-px`, scaled 1/8.
import { changedRoom, changesAt, chestsAt, exitsAt, exitTargets, hex, layerOf, mapWord, cellWord, type CellTypeRule, type RoomData } from './model';
import { dockBind, dockRender } from './dock.dom';
import { chipOn, forcedBy, stageChanges, stageCollision, stageGrid, stageTriggers, stageTypes, type Chip } from './overlays.dom';

export interface ViewState {
    tool: 'select' | 'pick'; tab: 'tile' | 'collision' | 'object' | 'trigger' | 'info';
    /** The layer the Tile tab shows (0 or 1) and its picked metatile. */
    layer: number; tile: number;
    /** The selected cell, or null. */
    cell: [number, number] | null;
    /** The selected exit, chest and map change (indices into the room's lists) and the Collision tab's type, or null. */
    exit: number | null; chest: number | null; change: number | null; ctype: number | null;
    /** The Trigger tab's list: exits or chests. */
    trigSub: 'exits' | 'chests';
    /** Filter chips: each layer's picture, the cell types, collision, triggers, map changes, the grid. */
    l0: boolean; l1: boolean; types: boolean; collision: boolean; triggers: boolean; objects: boolean; grid: boolean;
    panelOpen: Record<string, boolean>;
}

export interface EditorCtx {
    entry: { id: number; hex: string; name: string; variants: number[] };
    data: RoomData; base: string; st: Partial<ViewState>; save(): void; openRoom(id: number): void;
    /** What each cell type does (terra://rom/cell-types.json); empty if it could not be read. */
    rules: CellTypeRule[];
}

export interface Editor {
    /** `data`: the room as shown — `ctx.data`, or with the picked map change applied. */
    ctx: EditorCtx; st: ViewState; data: RoomData; W: number; H: number;
    svg: SVGSVGElement; wrap: HTMLElement; panels: HTMLElement | null; closed: boolean;
    zp: ShellZoomPan; pan: ShellPan;
    /** The cell the button went down on (a click selects it only if it comes up there, without a pan). */
    down: [number, number] | null;
    /** Redraw the chips and overlays that follow the open tab and the selection (the dock calls it). */
    redraw(): void;
    /** Show the room with one of its map changes applied, or as it loads (null). */
    pickChange(k: number | null): void;
}

const UNIT = 8, CELL = 2;
const DEFAULTS: ViewState = { tool: 'select', tab: 'tile', layer: 0, tile: 0, cell: null, exit: null, chest: null, change: null, ctype: null,
    trigSub: 'exits', l0: true, l1: true, types: false, collision: false, triggers: false, objects: false, grid: false, panelOpen: {} };

/** The picture for the layer chips: both layers, or the one that is on; with a picked map change, the room with it. */
function pictureHref(E: Editor): string {
    if (E.st.change !== null) return E.ctx.base + 'rooms/' + E.data.hex + '.c' + E.st.change + '.png';
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
    const chip = (label: string, key: Chip, title: string) => {
        const by = forcedBy(E, key);
        return mapViewChipHtml({ label, on: chipOn(E, key), attrs: { toggle: key }, cls: by ? 'forced' : '',
            title: title + (by ? ' — shown while the ' + by + ' tab is open' : '') });
    };
    // BG1 first, as in the other games' filter bars.
    const order = [0, 1].sort((a, b) => (layerOf(E.data, a)?.bg ?? 9) - (layerOf(E.data, b)?.bg ?? 9));
    return '<div class="rd-filters rg-view-filters">' + mapViewSegHtml(order.map(layerChip))
        + chip('Cell types', 'types', 'Layer 0’s cell types (bits 9-13 of each map word, what the movement code reads); type 0 is not drawn')
        + chip('Collision', 'collision', 'What stops a character: walls, diagonal corners, and the edges of cells only some moves pass (the Collision tab)')
        + chip('Objects', 'objects', 'Map changes: parts of the map the story switches, re-applied when the room loads (the Object tab)')
        + chip('Triggers', 'triggers', 'Exits (rectangles that take the player to another room) and chests (what the A button finds in a cell): the Trigger tab')
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
        + '<defs><pattern id="tm-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
        + '<rect width="4" height="4" class="tm-hatch-bg"/><rect width="1.6" height="4" class="tm-hatch-line"/></pattern></defs>'
        + '<g id="tm-types" pointer-events="none"></g><g id="tm-coll" pointer-events="none"></g>'
        + '<g id="tm-changes" pointer-events="none"></g><g id="tm-exits" pointer-events="none"></g><g id="rg-grid" pointer-events="none"></g>'
        + '<rect id="tm-sel" class="tm-sel" x="0" y="0" width="16" height="16" display="none" pointer-events="none"/>'
        + '<rect id="rg-hover" class="tm-hover" x="0" y="0" width="16" height="16" display="none" pointer-events="none"/></g>';
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

/** The next of `hit` after `cur` (a second click on the same cell cycles through what overlaps there). */
const nextOf = (hit: number[], cur: number | null) => hit[(hit.indexOf(cur ?? -1) + 1) % hit.length];

/**
 * A cell clicked with Select or Pick: select it; Pick also takes its metatile into the Tile tab. With Triggers
 * shown, a click on a chest or an exit selects it in the Trigger tab; with Objects shown, one on a map change's cells
 * selects it in the Object tab; on the Collision tab a click shows the cell's type.
 */
function clickCell(E: Editor, c: [number, number]): void {
    E.st.cell = c;
    const triggers = chipOn(E, 'triggers') && E.st.tool === 'select';
    const chests = triggers ? chestsAt(E.ctx.data, c[0], c[1]) : [], exits = triggers ? exitsAt(E.data, c[0], c[1]) : [];
    const changes = chipOn(E, 'objects') && E.st.tool === 'select' ? changesAt(E.ctx.data, c[0], c[1]) : [];
    if (chests.length) { E.st.chest = nextOf(chests, E.st.chest); E.st.tab = 'trigger'; E.st.trigSub = 'chests'; }
    else if (exits.length) { E.st.exit = nextOf(exits, E.st.exit); E.st.tab = 'trigger'; E.st.trigSub = 'exits'; }
    else if (changes.length) { pickChange(E, nextOf(changes, E.st.change)); E.st.tab = 'object'; }
    else if (E.st.tab === 'collision') {
        const w = cellWord(E.data, 0, c[0], c[1]);
        if (w >= 0) E.st.ctype = mapWord(w).type;
    }
    if (E.st.tool === 'pick') {
        const w = cellWord(E.data, E.st.layer, c[0], c[1]);
        if (w >= 0) { E.st.tile = mapWord(w).metatile; E.st.tab = 'tile'; }
    }
    E.ctx.save();
    stageSelection(E);
    refreshOverlays(E);
    dockRender(E);
}

/** Show the room with map change `k` applied (null: as it loads): the picture, and the cells the overlays read. */
export function pickChange(E: Editor, k: number | null): void {
    const c = k === null ? undefined : E.ctx.data.changes?.[k];
    E.st.change = c ? k : null;
    E.data = c ? changedRoom(E.ctx.data, c) : E.ctx.data;
    document.getElementById('rg-img')?.setAttribute('href', pictureHref(E));
    stageTypes(E);
}

/** Redraw what depends on the open tab and the selection: the chips (forced ones), collision, triggers, changes. */
export function refreshOverlays(E: Editor): void {
    refreshFilters(E);
    stageCollision(E);
    stageChanges(E);
    stageTriggers(E);
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
    st.exit = null; st.chest = null; st.change = null;
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

    E.redraw = () => refreshOverlays(E);
    E.pickChange = (k: number | null) => pickChange(E, k);
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
    stageTypes(E); stageCollision(E); stageChanges(E); stageTriggers(E); stageGrid(E); stageSelection(E);
    shellStatusBind(e => {
        const c = cellAt(E, e);
        if (!c) return null;
        const word = cellWord(E.data, 0, c[0], c[1]);
        const exits = exitsAt(E.data, c[0], c[1]).map(i => 'exit → ' + exitTargets(E.data.exits[i]))
            .concat(chestsAt(E.ctx.data, c[0], c[1]).map(i => 'chest #' + i), changesAt(E.ctx.data, c[0], c[1]).map(i => 'map change bit ' + E.ctx.data.changes[i].bit));
        return 'x: ' + statusPad2(c[0]) + ' y: ' + statusPad2(c[1]) + (word >= 0 ? ' · $' + hex(mapWord(word).metatile, 3) + ' · type ' + mapWord(word).type : '')
            + (exits.length ? ' · ' + exits.join(', ') : '');
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
        const k = d.toggle as Chip | undefined;
        if (!k || b.classList.contains('disabled') || b.classList.contains('forced')) return;
        E.st[k] = !E.st[k];
        if (!E.st.l0 && !E.st.l1) E.st[k === 'l0' ? 'l1' : 'l0'] = true;   // there is no picture of nothing
        ctx.save();
        refreshFilters(E);
        if (k === 'l0' || k === 'l1') document.getElementById('rg-img')?.setAttribute('href', pictureHref(E));
        else if (k === 'types') stageTypes(E);
        else if (k === 'collision') stageCollision(E);
        else if (k === 'triggers') stageTriggers(E);
        else if (k === 'objects') stageChanges(E);
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
