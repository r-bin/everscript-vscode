// Ownership: the Data tab's page — the Tables, Enums and Palettes views over
// the lists the host sends once (`dataIndex`, host.ts): a filterable rail, the
// selected list in the middle, and on the right a chart of the table, the
// selected enum entry, or the palette large. State owned: `st` (view,
// selections, filter). Bundled by tools/bundle-pages.mts as
// dist/webview/data-tab.js (global DataTab); the radar page calls
// DataTab.setupDataTab(post, activeTab) inside its own script.

interface Series { name: string; points: [number, number][] }
interface Table { id: string; group: string; title: string; addr: string; note: string; columns: string[]; rows: (string | number)[][]; chart?: { series: Series[]; x: string; y: string; xy?: boolean }; vfs?: string }
interface Entry { name: string; value: string; comment: string; vfs?: string }
interface EnumList { id: string; group: string; title: string; entries: Entry[] }
interface Palette { id: string; group: string; title: string; addr: string; colors: string[]; users: string[]; vfs?: string }
interface Index { tables: Table[]; enums: EnumList[]; palettes: Palette[] }
type ViewName = 'tables' | 'enums' | 'palettes';
type Item = Table | EnumList | Palette;

const SERIES_COLOURS = ['var(--vscode-charts-blue,#3794ff)', 'var(--vscode-charts-orange,#d18616)'];
const W = 420, H = 260, PAD = { l: 56, r: 12, t: 12, b: 30 };

const esc = (s: unknown): string => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const fmt = (v: number): string => Math.abs(v) >= 10000 ? v.toLocaleString('en-US') : String(Math.round(v * 100) / 100);
const vfsLink = (uri?: string, text = 'open in soe://'): string => uri ? '<a class="scr-script-link" data-dat-vfs="' + esc(uri) + '" title="' + esc(uri) + '">' + esc(text) + '</a>' : '';

/** The chart's ranges and pixel mappings; a path (`xy`) is centred on 0 with equal pixels per unit on both axes. */
function scales(c: NonNullable<Table['chart']>) {
    const pts = c.series.flatMap((s) => s.points);
    let x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
    let y0 = Math.min(0, ...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
    if (c.xy) {
        const aspect = (H - PAD.t - PAD.b) / (W - PAD.l - PAD.r);
        const m = Math.max(Math.abs(x0), Math.abs(x1), Math.max(Math.abs(y0), Math.abs(y1)) / aspect);
        x0 = -m; x1 = m; y0 = -m * aspect; y1 = m * aspect;
    }
    const sx = (v: number) => PAD.l + (v - x0) / (x1 - x0 || 1) * (W - PAD.l - PAD.r);
    const sy = (v: number) => H - PAD.b - (v - y0) / (y1 - y0 || 1) * (H - PAD.t - PAD.b);
    return { x0, x1, y0, y1, sx, sy };
}

function setupDataTab(post: (msg: object) => void, activeTab: string): void {
    // A node-only harness (tests/memory/ui.test.js) runs the page script without a browser.
    if (typeof window === 'undefined' || !window.addEventListener) return;
    const pane = document.querySelector<HTMLElement>('.dat-pane');
    if (!pane || !pane.dataset || pane.dataset.datBound) return;
    pane.dataset.datBound = '1';
    const st = { view: 'tables' as ViewName, index: null as Index | null, error: '', requested: false, query: '', sel: {} as Record<ViewName, string>, entry: -1 };
    const $ = (id: string) => document.getElementById(id)!;

    const list = (): Item[] => (st.index ? st.index[st.view] : []);
    const current = (): Item | undefined => list().find((x) => x.id === st.sel[st.view]);
    const haystack = (x: Item): string => x.title + ' ' + x.group + ' ' + ('addr' in x ? x.addr : '') +
        ('entries' in x ? ' ' + x.entries.map((e) => e.name + ' ' + e.value).join(' ') : '') + ('users' in x ? ' ' + x.users.join(' ') : '');

    function railHtml(): string {
        const q = st.query.toLowerCase();
        // Each group once, in the order its first item comes.
        const groups = new Map<string, Item[]>();
        list().forEach((x) => { if (!q || haystack(x).toLowerCase().indexOf(q) >= 0) groups.set(x.group, (groups.get(x.group) || []).concat(x)); });
        const out: string[] = [];
        groups.forEach((items, group) => items.forEach((x, i) => {
            if (!i) out.push('<div class="scr-group">' + esc(group) + '</div>');
            const sub = 'entries' in x ? x.entries.length + '' : 'colors' in x ? '<span class="dat-mini">' + x.colors.slice(1).map((c) => '<i style="background:' + c + '"></i>').join('') + '</span>' : esc(x.addr);
            out.push('<div class="scr-item' + (x.id === st.sel[st.view] ? ' scr-sel' : '') + '" data-dat-pick="' + esc(x.id) + '"><span class="scr-item-main">' + esc(x.title) + '</span><span class="scr-item-sub">' + sub + '</span></div>');
        }));
        return out.join('') || '<div class="scr-empty">Nothing matches.</div>';
    }

    function gridHtml(columns: string[], rows: string[][]): string {
        return '<table class="scr-rows dat-grid"><thead><tr>' + columns.map((c) => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' +
            rows.map((r, i) => '<tr data-dat-row="' + i + '"' + (st.view === 'enums' && i === st.entry ? ' class="scr-lit"' : '') + '>' + r.map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
    }

    function chartHtml(t: Table): string {
        const c = t.chart!;
        const { x0, x1, y0, y1, sx, sy } = scales(c);
        const ticks = (a: number, b: number) => [0, 1, 2, 3, 4].map((k) => a + (b - a) * k / 4);
        const grid = ticks(y0, y1).map((v) => '<line class="dat-gridline" x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + sy(v) + '" y2="' + sy(v) + '"/><text class="dat-tick" x="' + (PAD.l - 6) + '" y="' + (sy(v) + 4) + '" text-anchor="end">' + fmt(v) + '</text>').join('') +
            ticks(x0, x1).map((v) => '<text class="dat-tick" x="' + sx(v) + '" y="' + (H - PAD.b + 16) + '" text-anchor="middle">' + fmt(v) + '</text>').join('');
        const lines = c.series.map((s, i) => '<polyline fill="none" stroke="' + SERIES_COLOURS[i] + '" stroke-width="2" stroke-linejoin="round" points="' +
            s.points.map((p) => sx(p[0]).toFixed(1) + ',' + sy(p[1]).toFixed(1)).join(' ') + '"/>').join('');
        const legend = c.series.length > 1 ? '<div class="dat-legend">' + c.series.map((s, i) => '<span><i style="background:' + SERIES_COLOURS[i] + '"></i>' + esc(s.name) + '</span>').join('') + '</div>' : '';
        return legend + '<div class="dat-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" data-dat-chart>' + grid +
            '<line class="dat-axis" x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + sy(c.xy ? 0 : y0) + '" y2="' + sy(c.xy ? 0 : y0) + '"/>' + lines +
            '<line class="dat-cross" x1="0" x2="0" y1="' + PAD.t + '" y2="' + (H - PAD.b) + '" visibility="hidden"/>' +
            c.series.map((_, i) => '<circle class="dat-dot" r="4" fill="' + SERIES_COLOURS[i] + '" visibility="hidden"/>').join('') + '</svg>' +
            '<div class="dat-tip" hidden></div></div><div class="scr-dim dat-axes">x: ' + esc(c.x) + ' · y: ' + esc(c.y) + '</div>';
    }

    /** Crosshair + tooltip: the nearest point by x (a path: the nearest point). */
    function onChartMove(svg: SVGSVGElement, e: MouseEvent): void {
        const t = current() as Table | undefined;
        if (!t || !t.chart) return;
        const r = svg.getBoundingClientRect();
        const mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height;
        const c = t.chart;
        const { sx, sy } = scales(c);
        const dots = svg.querySelectorAll<SVGCircleElement>('.dat-dot');
        const tip = svg.parentElement!.querySelector<HTMLElement>('.dat-tip')!;
        const cross = svg.querySelector<SVGLineElement>('.dat-cross')!;
        const lines: string[] = [];
        c.series.forEach((s, i) => {
            let best = s.points[0], bd = Infinity;
            s.points.forEach((p, k) => {
                const d = c.xy ? (sx(p[0]) - mx) ** 2 + (sy(p[1]) - my) ** 2 : Math.abs(sx(p[0]) - mx);
                if (d < bd) { bd = d; best = p; if (c.xy) lines[0] = esc(c.x.split(' ')[0]) + ' tick ' + k; }
            });
            dots[i].setAttribute('cx', String(sx(best[0]))); dots[i].setAttribute('cy', String(sy(best[1]))); dots[i].setAttribute('visibility', 'visible');
            if (!c.xy && i === 0) lines.push(esc(c.x) + ' ' + fmt(best[0]));
            lines.push(esc(s.name) + ': ' + (c.xy ? '(' + fmt(best[0]) + ', ' + fmt(best[1]) + ')' : fmt(best[1])));
            if (i === 0) { cross.setAttribute('x1', String(sx(best[0]))); cross.setAttribute('x2', String(sx(best[0]))); }
        });
        cross.setAttribute('visibility', c.xy ? 'hidden' : 'visible');
        tip.innerHTML = lines.join('<br>');
        tip.hidden = false;
        tip.style.left = Math.min(r.width - 140, (mx / W) * r.width + 12) + 'px';
        tip.style.top = Math.max(0, (my / H) * r.height - 20) + 'px';
    }

    function swatchesHtml(p: Palette, big: boolean): string {
        return '<div class="dat-swatches' + (big ? ' dat-big' : '') + '">' + p.colors.map((c, i) =>
            '<div class="dat-sw"><i style="background:' + (i ? c : 'transparent') + '"' + (i ? '' : ' class="dat-clear"') + '></i><span>' + i + (big ? ' ' + (i ? c : 'transparent') : '') + '</span></div>').join('') + '</div>';
    }

    function renderMain(): void {
        const mid = $('dat-mid'), side = $('dat-side');
        const x = current();
        if (!x) { mid.innerHTML = '<div class="scr-empty">Pick something on the left.</div>'; side.innerHTML = ''; return; }
        const head = '<div class="scr-h">' + esc(x.title) + ' <span class="scr-dim">' + esc('addr' in x ? x.addr : x.group) + '</span></div>';
        if ('rows' in x) {
            mid.innerHTML = head + '<div class="scr-sub">' + esc(x.note) + ' ' + vfsLink(x.vfs) + '</div>' + gridHtml(x.columns, x.rows.map((r) => r.map((c) => esc(typeof c === 'number' ? fmt(c) : c))));
            side.innerHTML = x.chart ? '<div class="scr-side-h">' + esc(x.title) + '</div>' + chartHtml(x) : '<div class="scr-empty">The raw words of a table the knowledge base names; no chart.</div>';
        } else if ('entries' in x) {
            mid.innerHTML = head + '<div class="scr-sub">' + x.entries.length + ' entries · click one for details</div>' +
                gridHtml(['name', 'value', 'comment'], x.entries.map((e) => [esc(e.name), '<code>' + esc(e.value) + '</code>', esc(e.comment) + ' ' + vfsLink(e.vfs, '↗')]));
            const e = x.entries[st.entry];
            side.innerHTML = e ? '<div class="scr-side-h">' + esc(x.title) + '.' + esc(e.name) + '</div><table class="scr-rows scr-fields"><tbody>' +
                '<tr><td>value</td><td class="scr-s"><code>' + esc(e.value) + '</code></td></tr>' + (e.comment ? '<tr><td>comment</td><td class="scr-s">' + esc(e.comment) + '</td></tr>' : '') +
                (e.vfs ? '<tr><td>soe://</td><td class="scr-s">' + vfsLink(e.vfs, e.vfs) + '</td></tr>' : '') + '</tbody></table>'
                : '<div class="scr-empty">' + esc(x.group) + ' · ' + x.entries.length + ' entries. Pick one in the middle.</div>';
        } else {
            mid.innerHTML = head + swatchesHtml(x, true) + (x.vfs ? '<div class="scr-sub">' + vfsLink(x.vfs) + '</div>' : '');
            side.innerHTML = '<div class="scr-side-h">Used by · ' + x.users.length + '</div>' +
                (x.users.length ? '<div class="dat-users">' + x.users.map((u) => '<div>' + esc(u) + '</div>').join('') + '</div>' : '<div class="scr-note">Named by an animation script only.</div>');
        }
    }

    function render(): void {
        pane!.querySelectorAll<HTMLElement>('[data-dat-view]').forEach((b) => b.classList.toggle('scr-on', b.dataset.datView === st.view));
        if (!st.index) { $('dat-rail').innerHTML = '<div class="scr-empty">' + esc(st.error || 'Loading…') + '</div>'; $('dat-mid').innerHTML = ''; $('dat-side').innerHTML = ''; return; }
        if (!st.sel[st.view] && list().length) st.sel[st.view] = list()[0].id;
        $('dat-rail').innerHTML = railHtml();
        renderMain();
    }

    function request(): void { st.requested = true; post({ command: 'dataInit' }); }

    pane.addEventListener('click', (e) => {
        const t = (e.target as HTMLElement).closest<HTMLElement>('[data-dat-view],[data-dat-pick],[data-dat-vfs],[data-dat-row]');
        if (!t) return;
        if (t.dataset.datVfs) { post({ command: 'openVfs', uri: t.dataset.datVfs }); return; }
        if (t.dataset.datView) { st.view = t.dataset.datView as ViewName; st.entry = -1; render(); return; }
        if (t.dataset.datPick) { st.sel[st.view] = t.dataset.datPick; st.entry = -1; $('dat-rail').innerHTML = railHtml(); renderMain(); return; }
        if (t.dataset.datRow && st.view === 'enums') { st.entry = Number(t.dataset.datRow); renderMain(); }
    });
    pane.addEventListener('mousemove', (e) => {
        const svg = (e.target as Element).closest<SVGSVGElement>('[data-dat-chart]');
        if (svg) onChartMove(svg, e);
    });
    pane.addEventListener('mouseleave', () => pane.querySelectorAll<HTMLElement>('.dat-tip').forEach((t) => { t.hidden = true; }), true);
    $('dat-search').addEventListener('input', (e) => { st.query = (e.target as HTMLInputElement).value.trim(); if (st.index) $('dat-rail').innerHTML = railHtml(); });
    document.querySelector('.tab[data-tab="data"]')?.addEventListener('click', () => { if (!st.index && !st.requested) request(); });
    window.addEventListener('message', (ev) => {
        const msg = ev.data || {};
        if (msg.command !== 'dataIndex') return;
        if (msg.error) { st.error = msg.error; st.requested = false; } else st.index = { tables: msg.tables, enums: msg.enums, palettes: msg.palettes };
        render();
    });
    if (activeTab === 'data') request();
}

export { setupDataTab };
