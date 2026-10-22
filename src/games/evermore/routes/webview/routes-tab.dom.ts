// Ownership: the Routes tab's page — a route played step by step (`routesIndex`, host.ts): a rail
// of routes and variants; in the middle the state after the current step (room, Talons, items,
// flags) over the step list; on the right the current step's room with its trigger boxes and
// enemy spawns, the opened gourds drawn opened, the step's target lit (and the hovered step's),
// and the previous / next bar. State owned: `st` (route, step, hover, filter, pictures).
// Bundled by tools/bundle-pages.mts as dist/webview/routes-tab.js (global RoutesTab); the radar
// page calls RoutesTab.setupRoutesTab(post, activeTab, gotoRoom) inside its own script.

import { fightPanelHtml } from './fight-panel.dom';
import type { FightResult } from './fight-panel.dom';

type Verdict = 'ok' | 'differs' | 'missing' | 'none';
interface State { room: number; talons: number; items: Record<string, number>; flags: { addr: number; bit: number; name: string }[]; opened: Record<string, number[]> }
interface Step {
    n: number; room: number; kind: string; action: string; who?: string; claim?: string; at?: string; enemy?: number; to?: number; toName?: string; check?: string;
    inherited: boolean; effects: string[]; assumed: string[]; verdict: Verdict; note: string; after: State;
}
interface Route {
    id: string; routeId: string; title: string; note: string; base: string | null; startName: string; steps: Step[];
    route: { status: string; game: string; version: string; start: { room: number; note: string }; endpoint: string; source?: string; assumptions: string[]; questions: string[] };
    totals: { steps: number; rooms: number; talons: number; open: number; ok: number; differs: number; missing: number };
}
interface Overlay {
    room: number; hex: string; name: string; area: string; error?: string;
    triggers: { key: string; label: string; x: number; y: number; w: number; h: number }[];
    spawns: { index: number; name: string; x: number; y: number }[];
}
interface Picture { uri?: string; width?: number; height?: number; error?: string }
interface Index { routes: Route[]; rooms: Record<string, Overlay>; files: { id: string; file: string; source?: string }[]; problems: string[]; rom: boolean }

const esc = (s: unknown): string => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const hex = (n: number): string => '0x' + n.toString(16).padStart(2, '0').toUpperCase();
const word = (item: string): string => item.charAt(0) + item.slice(1).toLowerCase().replace(/_/g, ' ');
const MARK: Record<Verdict, [string, string]> = {
    ok: ['✓', 'The script agrees with the draft'], differs: ['≠', 'The script does something else than the draft says'],
    missing: ['✗', 'No script does this'], none: ['·', 'Not a script step'],
};

/** `gotoRoom`: the Maps tab's room opener (rooms/webview), handed in by the page. */
function setupRoutesTab(post: (msg: object) => void, activeTab: string, gotoRoom: ((id: number) => void) | null): void {
    // A node-only harness (tests/memory/ui.test.js) runs the page script without a browser.
    if (typeof window === 'undefined' || !window.addEventListener) return;
    const pane = document.querySelector<HTMLElement>('.rte-pane');
    if (!pane || !pane.dataset || pane.dataset.rteBound) return;
    pane.dataset.rteBound = '1';
    const st = { index: null as Index | null, error: '', requested: false, sel: '', step: 1, hover: 0, query: '', pictures: {} as Record<string, Picture | 'pending'>, zoom: 1 as number | 'fit',
        /** The step whose simulation the right column shows (0: the map), and the results by route and step. */
        sim: 0, fights: {} as Record<string, FightResult | 'pending'> };
    const $ = (id: string) => document.getElementById(id)!;

    const current = (): Route | undefined => st.index?.routes.find((r) => r.id === st.sel);
    const stepOf = (r: Route, n: number): Step | undefined => r.steps[n - 1];
    const matches = (s: Step): boolean => !st.query ||
        [s.action, s.who, s.claim, s.check, s.kind, s.effects.join(' '), st.index!.rooms[s.room]?.name, hex(s.room)].join(' ').toLowerCase().indexOf(st.query.toLowerCase()) >= 0;

    function railHtml(): string {
        const out: string[] = [];
        st.index!.routes.forEach((r) => {
            if (!r.base) out.push('<div class="scr-group">' + esc(r.title) + ' · ' + esc(r.route.status) + '</div>');
            out.push('<div class="scr-item' + (r.base ? ' rte-variant' : '') + (r.id === st.sel ? ' scr-sel' : '') + '" data-rte-pick="' + esc(r.id) + '">' +
                '<span class="scr-item-main">' + esc(r.title) + '</span><span class="scr-item-sub">' + r.totals.steps + ' steps</span></div>');
        });
        return out.join('') || '<div class="scr-empty">No routes.</div>';
    }

    const chip = (label: string, value: string | number, cls = ''): string => '<span class="rte-chip ' + cls + '"><b>' + esc(value) + '</b> ' + esc(label) + '</span>';

    /** The state after the current step: where the party is, what it carries, what the scripts have set. */
    function stateHtml(r: Route, s: Step): string {
        const a = s.after;
        const items = Object.keys(a.items).map((k) => '<span class="rte-item">' + esc(word(k)) + ' <b>' + a.items[k] + '</b></span>').join('');
        const opened = Object.keys(a.opened).map((room) => hex(Number(room)) + ': object ' + a.opened[room].join(', ')).join(' · ');
        return '<div class="rte-state"><div class="rte-state-h">After step ' + s.n + ' of ' + r.steps.length + '</div>' +
            '<div class="rte-state-grid">' +
            '<span>Room</span><span><code>' + hex(a.room) + '</code> ' + esc(st.index!.rooms[a.room]?.name || '') + '</span>' +
            '<span>Talons</span><span><b>' + a.talons + '</b></span>' +
            '<span>Items</span><span>' + (items || '<span class="scr-dim">none</span>') + '</span>' +
            '<span>Flags</span><span>' + (a.flags.length ? a.flags.map((f) => '<div>' + esc(f.name) + '</div>').join('') : '<span class="scr-dim">none set</span>') + '</span>' +
            '<span>Opened</span><span>' + (opened ? esc(opened) : '<span class="scr-dim">nothing</span>') + '</span>' +
            '</div></div>';
    }

    function stepRow(s: Step, prevRoom: number | null): string {
        const [m, title] = MARK[s.verdict];
        const head = s.room !== prevRoom ? '<tr class="rte-room-row"><td colspan="4"><code>' + hex(s.room) + '</code> ' + esc(st.index!.rooms[s.room]?.name || '') + '</td></tr>' : '';
        return head + '<tr data-rte-step="' + s.n + '" class="' + (s.n === st.step ? 'rte-cur' : '') + '"' + (s.inherited ? ' data-rte-inherited' : '') + '>' +
            '<td class="rte-n">' + s.n + '</td>' +
            '<td><span class="rte-kind rte-k-' + esc(s.kind) + '">' + esc(s.kind) + '</span></td>' +
            '<td class="rte-act">' + ((s.kind === 'fight' || s.kind === 'death') && s.enemy !== undefined
                ? '<button class="scr-btn rte-sim' + (st.sim === s.n ? ' rte-sim-on' : '') + '" data-rte-sim="' + s.n + '" title="Simulate this ' + s.kind + ' 10,000 times">simulate</button> ' : '') + esc(s.action) + (s.who ? ' <span class="scr-dim">· ' + esc(s.who) + '</span>' : '') +
            (s.effects.length ? '<div class="rte-fx">' + s.effects.map(esc).join(' · ') + '</div>' : '') + '</td>' +
            '<td class="rte-mark rte-' + s.verdict + '" title="' + esc(title) + '">' + m + '</td></tr>';
    }

    function notesHtml(r: Route): string {
        const file = st.index!.files.find((f) => f.id === r.routeId);
        const li = (items: string[]) => '<ul class="rte-list">' + items.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';
        return '<details class="rte-notes"><summary>Route notes · start <code>' + hex(r.route.start.room) + '</code> · ' + esc(r.route.game + ' ' + r.route.version) + ' · endpoint ' + esc(r.route.endpoint) + '</summary>' +
            (r.route.start.note ? '<div class="scr-note">' + esc(r.route.start.note) + '</div>' : '') +
            (file ? '<div class="rte-files"><a class="scr-script-link" data-rte-open="' + esc(file.file) + '">' + esc(file.file.split(/[\\/]/).pop()) + '</a>' +
                (file.source ? ' · <a class="scr-script-link" data-rte-open="' + esc(file.source) + '">' + esc(file.source.split('/').pop()) + '</a>' : '') + '</div>' : '') +
            (r.route.assumptions.length ? '<div class="scr-side-h">Assumptions</div>' + li(r.route.assumptions) : '') +
            '<div class="scr-side-h">Odds</div><div class="scr-note">Not built: each fight needs its damage distribution and XP reward (routes.md).</div>' +
            (r.route.questions.length ? '<div class="scr-side-h">Open questions</div>' + li(r.route.questions) : '') +
            (st.index!.problems.length ? '<div class="scr-side-h">Problems in the route files</div>' + li(st.index!.problems) : '') + '</details>';
    }

    function midHtml(r: Route): string {
        const t = r.totals, s = stepOf(r, st.step)!;
        const rom = st.index!.rom
            ? chip('agree', t.ok, 'rte-ok') + chip('differ', t.differs, t.differs ? 'rte-differs' : '') + chip('no script', t.missing, t.missing ? 'rte-missing' : '')
            : chip('ROM', 'no', 'rte-missing');
        let prev: number | null = null;
        const rows = r.steps.filter(matches).map((x) => { const h = stepRow(x, prev); prev = x.room; return h; }).join('');
        return '<div class="scr-h">' + esc(r.title) + (r.base ? ' <span class="scr-dim">variant of ' + esc(r.base) + '</span>' : '') + '</div>' +
            (r.note ? '<div class="scr-sub">' + esc(r.note) + '</div>' : '') +
            '<div class="rte-chips">' + chip('steps', t.steps) + chip('rooms', t.rooms) + chip('Talons at the end', t.talons) + chip('to verify', t.open) +
            '<span class="rte-chips-sep">scripts</span>' + rom + '</div>' +
            stateHtml(r, s) +
            '<table class="rte-steps"><colgroup><col class="rte-c-n"><col class="rte-c-kind"><col><col class="rte-c-mark"></colgroup><tbody>' + (rows || '<tr><td class="scr-empty">No step matches.</td></tr>') + '</tbody></table>' +
            notesHtml(r);
    }

    /** The room of the current step, as the state after it leaves it (an opened gourd is drawn opened). */
    function mapHtml(r: Route, s: Step): string {
        const ov = st.index!.rooms[s.room];
        const opened = (s.after.opened[s.room] || []).slice().sort((a, b) => a - b);
        const key = s.room + ':' + opened.join(',');
        const pic = st.pictures[key];
        if (!pic && st.index!.rom) { st.pictures[key] = 'pending'; post({ command: 'routesPicture', room: s.room, opened }); }
        const [m] = MARK[s.verdict];
        const head = '<div class="rte-map-h"><code>' + hex(s.room) + '</code> <b>' + esc(ov ? ov.name : '') + '</b> <span class="scr-dim">' + esc(ov ? ov.area : '') + '</span>' +
            '<span class="scr-seg rte-zoom">' + (['fit', 1, 2] as (number | 'fit')[]).map((z) => '<button class="scr-seg-btn' + (st.zoom === z ? ' scr-on' : '') + '" data-rte-zoom="' + z + '">' + (z === 'fit' ? 'Fit' : z + '×') + '</button>').join('') + '</span>' +
            '<button class="scr-btn rte-goto" data-rte-room="' + s.room + '" title="Open this room on the Maps tab">Maps ↗</button></div>';
        let body: string;
        if (!pic || pic === 'pending') body = '<div class="scr-empty">' + (st.index!.rom ? 'Drawing the room…' : 'No ROM: no map.') + '</div>';
        else if (pic.error || !pic.uri) body = '<div class="scr-empty">' + esc(pic.error || 'No picture') + '</div>';
        else body = '<div class="rte-map" id="rte-map"><div class="rte-map-in" style="aspect-ratio:' + pic.width + '/' + pic.height + (st.zoom === 'fit' ? '' : ';width:' + pic.width! * st.zoom + 'px') + '"><img src="' + pic.uri + '" alt="">' +
            '<svg viewBox="0 0 ' + pic.width + ' ' + pic.height + '" preserveAspectRatio="none">' + overlaySvg(s, ov) + '</svg></div></div>';
        const detail = '<div class="rte-detail"><div><span class="rte-kind rte-k-' + esc(s.kind) + '">' + esc(s.kind) + '</span> ' + esc(s.action) + '</div>' +
            '<div class="rte-rom rte-' + s.verdict + '"><b>' + m + '</b> ' + esc(s.note) + '</div>' +
            (s.assumed.length ? '<div class="scr-note">Assumed: ' + esc(s.assumed.join('; ')) + '</div>' : '') +
            (s.check ? '<div class="scr-note">To verify: ' + esc(s.check) + '</div>' : '') + '</div>';
        const nav = '<div class="rte-nav"><button class="scr-btn" data-rte-go="-1"' + (st.step <= 1 ? ' disabled' : '') + ' title="Previous step (←)">◀ Prev</button>' +
            '<span class="rte-nav-at">Step <b>' + s.n + '</b> / ' + r.steps.length + '</span>' +
            '<button class="scr-btn" data-rte-go="1"' + (st.step >= r.steps.length ? ' disabled' : '') + ' title="Next step (→)">Next ▶</button></div>';
        return head + body + detail + nav;
    }

    /** A step's target on the map: its trigger box or its enemy. */
    const targetSel = (x: Step): string => x.at ? '[data-rte-key="' + x.at + '"]' : x.enemy !== undefined ? '[data-rte-enemy="' + x.enemy + '"]' : '';

    /** Trigger boxes and spawns, the current step's target lit. */
    function overlaySvg(s: Step, ov: Overlay | undefined): string {
        if (!ov) return '';
        const boxes = ov.triggers.map((t) => '<rect class="rte-box rte-box-' + (t.key.charAt(0) === 'b' ? 'b' : 'step') + (s.at === t.key ? ' rte-lit' : '') + '" data-rte-key="' + t.key +
            '" x="' + t.x + '" y="' + t.y + '" width="' + t.w + '" height="' + t.h + '"><title>' + esc(t.label) + '</title></rect>').join('');
        const spawns = ov.spawns.map((e) => '<circle class="rte-spawn' + (s.enemy === e.index ? ' rte-lit' : '') + '" data-rte-enemy="' + e.index + '" cx="' + e.x + '" cy="' + e.y +
            '" r="10"><title>' + esc(e.name + ' (spawn ' + e.index + ', a candidate: the enter script branches on story state)') + '</title></circle>').join('');
        return boxes + spawns;
    }

    /** The hovered step's target outlined, when it is in the room on the map. */
    function markHover(): void {
        const r = current(), svg = document.querySelector('#rte-map svg');
        if (!r || !svg) return;
        svg.querySelectorAll('.rte-hov').forEach((el) => el.classList.remove('rte-hov'));
        const h = st.hover ? stepOf(r, st.hover) : undefined, s = stepOf(r, st.step);
        const sel = h && s && h.room === s.room ? targetSel(h) : '';
        if (sel) svg.querySelectorAll(sel).forEach((el) => el.classList.add('rte-hov'));
    }

    /** Scroll the map so the current step's target is in view. */
    function reveal(): void {
        const box = document.getElementById('rte-map');
        const t = box && box.querySelector<SVGGraphicsElement>('.rte-lit');
        if (!box || !t) return;
        const b = box.getBoundingClientRect(), r = t.getBoundingClientRect();
        box.scrollTop += r.top - b.top - b.height / 2 + r.height / 2;
        box.scrollLeft += r.left - b.left - b.width / 2 + r.width / 2;
    }

    /** The simulation sub-panel of step `st.sim`: asks the host once per route and step. */
    function simSide(r: Route): string {
        const s = stepOf(r, st.sim)!, key = r.id + '#' + s.n;
        if (!st.fights[key]) { st.fights[key] = 'pending'; post({ command: 'routesFight', route: r.id, n: s.n }); }
        return fightPanelHtml('Step ' + s.n + ' · ' + s.action, st.fights[key]);
    }

    function renderSide(reset: boolean): void {
        const r = current(), side = $('rte-side');
        if (!r || !stepOf(r, st.step)) { side.innerHTML = ''; return; }
        if (st.sim && stepOf(r, st.sim)) { side.innerHTML = simSide(r); return; }
        const keep = document.getElementById('rte-map');
        const top = keep ? keep.scrollTop : 0, left = keep ? keep.scrollLeft : 0;
        side.innerHTML = mapHtml(r, stepOf(r, st.step)!);
        const box = document.getElementById('rte-map');
        if (!box) return;
        if (reset) reveal(); else { box.scrollTop = top; box.scrollLeft = left; }
        markHover();
    }

    function renderMain(): void {
        const r = current();
        if (!r) { $('rte-mid').innerHTML = '<div class="scr-empty">Pick a route on the left.</div>'; $('rte-side').innerHTML = ''; return; }
        if (!stepOf(r, st.step)) st.step = 1;
        const mid = $('rte-mid'), top = mid.scrollTop, details = mid.querySelector('details');
        const open = !!(details && details.open);
        mid.innerHTML = midHtml(r);
        mid.scrollTop = top;
        if (open) mid.querySelector('details')!.open = true;
        mid.querySelector('.rte-cur')?.scrollIntoView({ block: 'nearest' });
        renderSide(true);
    }

    function render(): void {
        if (!st.index) { $('rte-rail').innerHTML = '<div class="scr-empty">' + esc(st.error || 'Loading…') + '</div>'; $('rte-mid').innerHTML = ''; $('rte-side').innerHTML = ''; return; }
        if (!current() && st.index.routes.length) st.sel = st.index.routes[0].id;
        $('rte-rail').innerHTML = railHtml();
        renderMain();
    }

    /** Go to step n; an open simulation follows when that step can be simulated, else the map comes back. */
    function moveTo(n: number): void {
        const r = current(), s = r && stepOf(r, n);
        if (!r || !s) return;
        st.step = n;
        if (st.sim) st.sim = (s.kind === 'fight' || s.kind === 'death') && s.enemy !== undefined ? n : 0;
        renderMain();
    }

    function go(delta: number): void {
        const r = current();
        if (!r) return;
        const n = Math.min(r.steps.length, Math.max(1, st.step + delta));
        if (n !== st.step) moveTo(n);
    }

    function request(): void { st.requested = true; post({ command: 'routesInit' }); }

    pane.addEventListener('click', (e) => {
        const t = (e.target as HTMLElement).closest<HTMLElement>('[data-rte-sim],[data-rte-pick],[data-rte-step],[data-rte-room],[data-rte-open],[data-rte-go],[data-rte-zoom]');
        if (!t) return;
        if (t.dataset.rteZoom) { st.zoom = t.dataset.rteZoom === 'fit' ? 'fit' : Number(t.dataset.rteZoom); renderSide(true); return; }
        if (t.dataset.rteOpen) { post({ command: 'routesOpen', file: t.dataset.rteOpen }); return; }
        if (t.dataset.rteSim !== undefined) {
            const n = Number(t.dataset.rteSim);
            st.sim = n === st.sim ? 0 : n;
            if (n) st.step = n;
            renderMain();
            return;
        }
        if (t.dataset.rteGo) { go(Number(t.dataset.rteGo)); return; }
        if (t.dataset.rteRoom) {
            document.querySelector<HTMLElement>('.tab[data-tab="rooms"]')?.click();
            if (gotoRoom) gotoRoom(Number(t.dataset.rteRoom));
            return;
        }
        if (t.dataset.rtePick) { st.sel = t.dataset.rtePick; st.step = 1; st.sim = 0; render(); return; }
        if (t.dataset.rteStep) { moveTo(Number(t.dataset.rteStep)); }
    });
    pane.addEventListener('mouseover', (e) => {
        const row = (e.target as HTMLElement).closest<HTMLElement>('[data-rte-step]');
        const n = row ? Number(row.dataset.rteStep) : 0;
        if (n !== st.hover) { st.hover = n; markHover(); }
    });
    pane.addEventListener('mouseleave', () => { if (st.hover) { st.hover = 0; markHover(); } });
    document.addEventListener('keydown', (e) => {
        if (pane.style.display === 'none' || (e.target as HTMLElement).closest('input,textarea,select')) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(1); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(-1); }
    });
    $('rte-search').addEventListener('input', (e) => { st.query = (e.target as HTMLInputElement).value.trim(); if (st.index) renderMain(); });
    document.querySelector('.tab[data-tab="routes"]')?.addEventListener('click', () => { if (!st.index && !st.requested) request(); });
    window.addEventListener('message', (ev) => {
        const msg = ev.data || {};
        if (msg.command === 'routesPicture') {
            st.pictures[msg.key] = msg.error ? { error: msg.error } : { uri: msg.uri, width: msg.width, height: msg.height };
            renderSide(true);
            return;
        }
        if (msg.command === 'routesFight') {
            st.fights[msg.route + '#' + msg.n] = msg;
            if (current()?.id === msg.route && st.sim === msg.n) renderSide(false);
            return;
        }
        if (msg.command !== 'routesIndex') return;
        if (msg.error) { st.error = msg.error; st.requested = false; } else st.index = { routes: msg.routes, rooms: msg.rooms, files: msg.files, problems: msg.problems, rom: msg.rom };
        render();
    });
    if (activeTab === 'routes') request();
}

export { setupRoutesTab };
