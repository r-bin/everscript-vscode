// Ownership: the Routes tab's page — the routes the host sends once (`routesIndex`, host.ts): a
// rail of routes and their variants, the selected route as runs of steps per room in the middle,
// and on the right the route's terms and open questions, or the selected step against its room's
// scripts. State owned: `st` (selection, filter). Bundled by tools/bundle-pages.mts as
// dist/webview/routes-tab.js (global RoutesTab); the radar page calls
// RoutesTab.setupRoutesTab(post, activeTab) inside its own script.

type CheckState = 'ok' | 'differs' | 'missing' | 'none';
interface Step { n: number; room: number; kind: string; action: string; who?: string; claim?: string; talons?: number; tally: number; to?: number; toName?: string; check?: string; rom: { state: CheckState; text: string }; inherited: boolean }
interface Run { room: number; hex: string; name: string; area: string; steps: Step[] }
interface Facts { loot: { trigger: string; kind: string; item: string; amount: number }[]; exits: { trigger: string; to: number }[] }
interface Route {
    id: string; routeId: string; title: string; note: string; base: string | null; startName: string; runs: Run[]; facts: Record<string, Facts>;
    route: { status: string; game: string; version: string; start: { room: number; note: string }; endpoint: string; source?: string; assumptions: string[]; questions: string[] };
    totals: { steps: number; rooms: number; talons: number; open: number; ok: number; differs: number; missing: number };
}
interface Index { routes: Route[]; files: { id: string; file: string; source?: string }[]; problems: string[]; rom: boolean }

const esc = (s: unknown): string => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const hex = (n: number): string => '0x' + n.toString(16).padStart(2, '0').toUpperCase();
const MARK: Record<CheckState, [string, string]> = {
    ok: ['✓', 'The room scripts agree'], differs: ['≠', 'The room scripts say otherwise'], missing: ['✗', 'Not in the room scripts'], none: ['·', 'Nothing to check in the room scripts'],
};

/** `gotoRoom`: the Maps tab's room opener (rooms/webview), handed in by the page. */
function setupRoutesTab(post: (msg: object) => void, activeTab: string, gotoRoom: ((id: number) => void) | null): void {
    // A node-only harness (tests/memory/ui.test.js) runs the page script without a browser.
    if (typeof window === 'undefined' || !window.addEventListener) return;
    const pane = document.querySelector<HTMLElement>('.rte-pane');
    if (!pane || !pane.dataset || pane.dataset.rteBound) return;
    pane.dataset.rteBound = '1';
    const st = { index: null as Index | null, error: '', requested: false, sel: '', step: 0, query: '' };
    const $ = (id: string) => document.getElementById(id)!;

    const current = (): Route | undefined => st.index?.routes.find((r) => r.id === st.sel);
    const steps = (r: Route): Step[] => r.runs.flatMap((x) => x.steps);
    const matches = (s: Step, run: Run): boolean => !st.query ||
        [s.action, s.who, s.claim, s.check, s.kind, run.name, run.hex].join(' ').toLowerCase().indexOf(st.query.toLowerCase()) >= 0;

    function railHtml(): string {
        const out: string[] = [];
        st.index!.routes.forEach((r) => {
            if (!r.base) out.push('<div class="scr-group">' + esc(r.title) + ' · ' + esc(r.route.status) + '</div>');
            out.push('<div class="scr-item' + (r.base ? ' rte-variant' : '') + (r.id === st.sel ? ' scr-sel' : '') + '" data-rte-pick="' + esc(r.id) + '">' +
                '<span class="scr-item-main">' + esc(r.title) + '</span><span class="scr-item-sub">' + r.totals.steps + ' steps</span></div>');
        });
        return out.join('') || '<div class="scr-empty">No routes.</div>';
    }

    function chip(label: string, value: string | number, cls = ''): string {
        return '<span class="rte-chip ' + cls + '"><b>' + esc(value) + '</b> ' + esc(label) + '</span>';
    }

    function midHtml(r: Route): string {
        const t = r.totals;
        const rom = st.index!.rom
            ? chip('agree', t.ok, 'rte-ok') + chip('differ', t.differs, t.differs ? 'rte-differs' : '') + chip('not found', t.missing, t.missing ? 'rte-missing' : '')
            : chip('ROM', 'no', 'rte-missing');
        const head = '<div class="scr-h">' + esc(r.title) + (r.base ? ' <span class="scr-dim">variant of ' + esc(r.base) + '</span>' : '') + '</div>' +
            (r.note ? '<div class="scr-sub">' + esc(r.note) + '</div>' : '') +
            '<div class="rte-chips">' + chip('steps', t.steps) + chip('rooms', t.rooms) + chip('Talons as drafted', t.talons) + chip('to verify', t.open) +
            '<span class="rte-chips-sep">room scripts</span>' + rom + '</div>';
        const runs = r.runs.map((run) => {
            const rows = run.steps.filter((s) => matches(s, run)).map((s) => {
                const [m, title] = MARK[s.rom.state];
                return '<tr data-rte-step="' + s.n + '"' + (s.n === st.step ? ' class="scr-lit"' : '') + (s.inherited ? ' data-rte-inherited' : '') + '>' +
                    '<td class="rte-n">' + s.n + '</td>' +
                    '<td><span class="rte-kind rte-k-' + esc(s.kind) + '">' + esc(s.kind) + '</span></td>' +
                    '<td class="rte-act">' + esc(s.action) + (s.who ? ' <span class="scr-dim">· ' + esc(s.who) + '</span>' : '') +
                    (s.to !== undefined ? '<div class="scr-dim">→ <code>' + hex(s.to) + '</code> ' + esc(s.toName || '') + '</div>' : '') + '</td>' +
                    '<td class="rte-claim">' + esc(s.claim || '') + '</td>' +
                    '<td class="rte-tally" title="Talons as drafted, carried forward">' + s.tally + '</td>' +
                    '<td class="rte-mark rte-' + s.rom.state + '" title="' + esc(title) + '">' + m + '</td></tr>';
            }).join('');
            if (!rows) return '';
            return '<section class="rte-run"><div class="rte-run-h"><code>' + esc(run.hex) + '</code> <b>' + esc(run.name) + '</b> <span class="scr-dim">' + esc(run.area) + '</span>' +
                '<button class="scr-btn rte-goto" data-rte-room="' + run.room + '" title="Open this room on the Maps tab">Map ↗</button></div>' +
                '<table class="rte-steps"><thead><tr><th>#</th><th>kind</th><th>action</th><th>draft says</th><th title="Talons as drafted">Talons</th><th title="Checked against the room scripts">ROM</th></tr></thead><tbody>' + rows + '</tbody></table></section>';
        }).join('');
        return head + (runs || '<div class="scr-empty">No step matches.</div>');
    }

    function list(title: string, items: string[]): string {
        return items.length ? '<div class="rte-sec"><div class="scr-side-h">' + esc(title) + '</div><ul class="rte-list">' + items.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '';
    }

    function routeSide(r: Route): string {
        const file = st.index!.files.find((f) => f.id === r.routeId);
        const row = (k: string, v: string) => '<tr><td>' + esc(k) + '</td><td class="scr-s">' + v + '</td></tr>';
        return '<div class="scr-side-h">Route</div><table class="scr-rows scr-fields"><tbody>' +
            row('status', esc(r.route.status)) + row('game', esc(r.route.game + ' · ' + r.route.version)) +
            row('start', '<code>' + hex(r.route.start.room) + '</code> ' + esc(r.startName) + (r.route.start.note ? '<div class="scr-dim">' + esc(r.route.start.note) + '</div>' : '')) +
            row('endpoint', esc(r.route.endpoint)) +
            (file ? row('file', '<a class="scr-script-link" data-rte-open="' + esc(file.file) + '">' + esc(file.file.split(/[\\/]/).pop()) + '</a>') : '') +
            (file && file.source ? row('notes', '<a class="scr-script-link" data-rte-open="' + esc(file.source) + '">' + esc(file.source.split('/').pop()) + '</a>') : '') +
            '</tbody></table>' +
            list('Assumptions', r.route.assumptions) +
            '<div class="rte-sec"><div class="scr-side-h">Odds</div><div class="scr-note">Not built. Each fight needs its damage distribution and its XP reward, and a replay carries the levels forward (routes.md). Until then the route lists steps and what the room scripts confirm.</div></div>' +
            list('Open questions', r.route.questions) +
            list('Problems in the route files', st.index!.problems);
    }

    function stepSide(r: Route, s: Step): string {
        const f = r.facts[hex(s.room)];
        const [m] = MARK[s.rom.state];
        const exits = f ? f.exits.map((e) => e.trigger + ' → ' + hex(e.to)) : [];
        const wanted = new Set([s.claim && /talon/i.test(s.claim) ? 'MONEY' : '', ...(f ? f.loot.filter((l) => s.rom.text.indexOf(l.trigger) >= 0).map((l) => l.item) : [])]);
        const loot = f ? f.loot.filter((l) => wanted.has(l.item)).map((l) => l.trigger + ': ' + (l.item === 'MONEY' ? l.amount + ' Talons' : l.amount + ' × ' + l.item.toLowerCase())) : [];
        return '<div class="rte-back"><a class="scr-script-link" data-rte-step="0">← Route</a></div>' +
            '<div class="scr-side-h">Step ' + s.n + ' · ' + esc(s.kind) + '</div>' +
            '<div class="rte-action">' + esc(s.action) + '</div>' +
            '<table class="scr-rows scr-fields"><tbody>' +
            '<tr><td>room</td><td class="scr-s"><code>' + hex(s.room) + '</code> ' + esc(r.runs.find((x) => x.room === s.room)?.name || '') + '</td></tr>' +
            (s.who ? '<tr><td>who</td><td class="scr-s">' + esc(s.who) + '</td></tr>' : '') +
            (s.claim ? '<tr><td>draft says</td><td class="scr-s">' + esc(s.claim) + '</td></tr>' : '') +
            '<tr><td>Talons</td><td class="scr-s">' + s.tally + ' after this step (as drafted)</td></tr>' +
            (s.inherited ? '<tr><td>from</td><td class="scr-s">' + esc(r.base || '') + '</td></tr>' : '') +
            '</tbody></table>' +
            '<div class="rte-sec"><div class="scr-side-h">Room scripts <span class="rte-mark rte-' + s.rom.state + '">' + m + '</span></div><div class="rte-rom rte-' + s.rom.state + '">' + esc(s.rom.text) + '</div></div>' +
            (s.check ? '<div class="rte-sec"><div class="scr-side-h">To verify</div><div class="scr-note">' + esc(s.check) + '</div></div>' : '') +
            list('Money and matching pickups here', loot) + list('Exits from ' + hex(s.room), exits) +
            '<button class="scr-btn" data-rte-room="' + s.room + '">Open ' + hex(s.room) + ' in Maps ↗</button>';
    }

    function renderMain(): void {
        const r = current();
        if (!r) { $('rte-mid').innerHTML = '<div class="scr-empty">Pick a route on the left.</div>'; $('rte-side').innerHTML = ''; return; }
        $('rte-mid').innerHTML = midHtml(r);
        const s = steps(r).find((x) => x.n === st.step);
        $('rte-side').innerHTML = s ? stepSide(r, s) : routeSide(r);
    }

    function render(): void {
        if (!st.index) { $('rte-rail').innerHTML = '<div class="scr-empty">' + esc(st.error || 'Loading…') + '</div>'; $('rte-mid').innerHTML = ''; $('rte-side').innerHTML = ''; return; }
        if (!current() && st.index.routes.length) st.sel = st.index.routes[0].id;
        $('rte-rail').innerHTML = railHtml();
        renderMain();
    }

    function request(): void { st.requested = true; post({ command: 'routesInit' }); }

    pane.addEventListener('click', (e) => {
        const t = (e.target as HTMLElement).closest<HTMLElement>('[data-rte-pick],[data-rte-step],[data-rte-room],[data-rte-open]');
        if (!t) return;
        if (t.dataset.rteOpen) { post({ command: 'routesOpen', file: t.dataset.rteOpen }); return; }
        if (t.dataset.rteRoom) {
            document.querySelector<HTMLElement>('.tab[data-tab="rooms"]')?.click();
            if (gotoRoom) gotoRoom(Number(t.dataset.rteRoom));
            return;
        }
        if (t.dataset.rtePick) { st.sel = t.dataset.rtePick; st.step = 0; render(); return; }
        if (t.dataset.rteStep !== undefined) { st.step = Number(t.dataset.rteStep) === st.step ? 0 : Number(t.dataset.rteStep); renderMain(); }
    });
    $('rte-search').addEventListener('input', (e) => { st.query = (e.target as HTMLInputElement).value.trim(); if (st.index) renderMain(); });
    document.querySelector('.tab[data-tab="routes"]')?.addEventListener('click', () => { if (!st.index && !st.requested) request(); });
    window.addEventListener('message', (ev) => {
        const msg = ev.data || {};
        if (msg.command !== 'routesIndex') return;
        if (msg.error) { st.error = msg.error; st.requested = false; } else st.index = { routes: msg.routes, files: msg.files, problems: msg.problems, rom: msg.rom };
        render();
    });
    if (activeTab === 'routes') request();
}

export { setupRoutesTab };
