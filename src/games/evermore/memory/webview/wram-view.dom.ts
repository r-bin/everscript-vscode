// Ownership: the Memory tab's page chrome — its Bus | WRAM | ROM sub-bar, and on the
// WRAM grid the CDL coverage (a bar under each byte the recorder saw), the word starts
// it saw (two bytes joined, named or not) and the search box. State owned: `st` (the
// shown sub-view, the coverage, the query). The grid, its filters and the detail table
// stay in shared.js; the Bus and ROM views are the ROM feature's (`romShow`, rom-init.js).
// Bundled by tools/bundle-pages.mts as dist/webview/wram-view.js (global WramView); the
// radar page hands it shared.js's `recomputeRows` and rom-init.js's `romShow`, and
// declares `memShowView` for rom-init.js (memory/webview/index.ts).

type View = 'bus' | 'wram' | 'rom';
interface Coverage { lo: number; flags: number[]; words: number[]; none?: string }
/** The page functions this drives: shared.js's row filter, the ROM feature's view switch. */
interface Hooks { recomputeRows?: () => void; romShow?: ((view: View) => void) | null }

// wram.flags bits (src/platform/cdl/library.ts `WF`).
const WF = { READ: 1, WRITE: 2, WORD: 8, EXEC: 0x10, SCRIPT: 0x20, POINTER: 0x40, DMA: 0x80 };
const VIEW_KEY = 'mem-view';
const CDL_CLASSES = ['cdl-r', 'cdl-w', 'cdl-rw', 'cdl-x', 'wd0', 'wd1'];

const st = { view: 'wram' as View, cov: null as Coverage | null, asked: false, cdlOn: true, post: (_m: object): void => {}, hooks: {} as Hooks };

const hex = (n: number, w: number): string => n.toString(16).toUpperCase().padStart(w, '0');
const grid = (): HTMLElement | null => document.getElementById('wram-grid');

function loadView(): View | null {
    try { const v = localStorage.getItem(VIEW_KEY); return v === 'bus' || v === 'wram' || v === 'rom' ? v : null; } catch { return null; }
}
function saveView(v: View): void {
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage may be blocked */ }
}

/** The sub-bar and which sub-pane shows (Bus and ROM share the ROM feature's pane). */
function applyView(view: View): void {
    st.view = view;
    document.querySelectorAll<HTMLElement>('[data-mem-view]').forEach((b) => b.classList.toggle('mem-sub-on', b.dataset.memView === view));
    document.querySelectorAll<HTMLElement>('.mem-sub-pane').forEach((p) => {
        p.style.display = (p.dataset.mem === 'wram') === (view === 'wram') ? 'flex' : 'none';
    });
}

/** Draw the shown view: WRAM asks for its coverage once, Bus and ROM are drawn by the ROM feature. */
function drawView(): void {
    if (st.view === 'wram') askCoverage();
    else st.hooks.romShow?.(st.view);
}

/** Show one of the Memory tab's three views, switching to the Memory tab first. */
function memShowView(view: View): void {
    applyView(view);
    saveView(view);
    const tab = document.querySelector<HTMLElement>('.tab[data-tab="radar"]');
    if (tab && !tab.classList.contains('tab-active')) tab.click();
    drawView();
}

function askCoverage(refresh = false): void {
    const g = grid();
    if (!g || (st.asked && !refresh)) return;
    st.asked = true;
    st.post({ command: 'wramCdlRequest', lo: Number(g.dataset.lo), hi: Number(g.dataset.hi), refresh });
}

/** What the recorder saw a byte do, as a tooltip suffix. */
function flagText(f: number): string {
    const did = [f & WF.READ ? 'read' : '', f & WF.WRITE ? 'written' : '', f & WF.EXEC ? 'run as code' : '',
        f & WF.SCRIPT ? 'by scripts' : '', f & WF.POINTER ? 'as a pointer' : '', f & WF.DMA ? 'by DMA' : ''].filter(Boolean);
    return did.length ? did.join(', ') : '';
}

function cdlClass(f: number): string {
    if (f & WF.EXEC) return 'cdl-x';
    if ((f & WF.READ) && (f & WF.WRITE)) return 'cdl-rw';
    if (f & WF.WRITE) return 'cdl-w';
    return f & WF.READ ? 'cdl-r' : '';
}

/** Mark every grid byte with what the CDL saw, join word starts to their high byte, and keep rows with coverage visible. */
function paintCoverage(): void {
    const g = grid();
    if (!g) return;
    g.querySelectorAll<HTMLElement>('.cell').forEach((c) => {
        c.classList.remove(...CDL_CLASSES);
        if (c.dataset.baseTitle !== undefined) c.title = c.dataset.baseTitle;
    });
    g.querySelectorAll('.gr.gcdl').forEach((r) => r.classList.remove('gcdl'));
    const cov = st.cov;
    const note = document.getElementById('wram-cdl-note');
    if (note) note.textContent = !st.cdlOn || !cov ? '' : cov.none || coverageSummary(cov);
    if (st.cdlOn && cov && !cov.none) {
        const cell = (a: number) => g.querySelector<HTMLElement>('.cell[data-addr="' + a + '"]');
        const tip = (c: HTMLElement, more: string) => {
            if (c.dataset.baseTitle === undefined) c.dataset.baseTitle = c.title;
            c.title += (c.title === c.dataset.baseTitle ? '\nCDL: ' : ' · ') + more;
        };
        cov.flags.forEach((f, i) => {
            const cls = cdlClass(f), c = cls ? cell(cov.lo + i) : null;
            if (!c) return;
            c.classList.add(cls);
            tip(c, flagText(f));
            c.closest('.gr')?.classList.add('gcdl');
        });
        for (const a of cov.words) {
            const lo = cell(a), hi = cell(a + 1);
            if (!lo || !hi) continue;
            lo.classList.add('wd0');
            hi.classList.add('wd1');
            const span = '16-bit at $' + hex(a, 4) + '–$' + hex(a + 1, 4);
            tip(lo, span);
            tip(hi, span);
        }
    }
    st.hooks.recomputeRows?.();
}

function coverageSummary(cov: Coverage): string {
    const seen = cov.flags.filter((f) => f & (WF.READ | WF.WRITE | WF.EXEC)).length;
    return 'CDL: ' + seen + ' of ' + cov.flags.length + ' bytes seen · ' + cov.words.length + ' word starts';
}

/** `$7E2258`, `7e:2258`, `2258` → a WRAM offset; anything else is a name query. */
function parseAddr(q: string): number | null {
    const m = /^\$?(?:(7[ef]):?)?([0-9a-f]{1,5})$/i.exec(q.trim());
    if (!m) return null;
    const off = parseInt(m[2], 16);
    return m[1] ? ((parseInt(m[1], 16) - 0x7E) << 16 | (off & 0xFFFF)) : off;
}

/** Jump to an address, or mark the bytes and detail rows whose name contains the query. */
function search(q: string): void {
    const g = grid();
    if (!g) return;
    g.querySelectorAll('.cell.cq').forEach((c) => c.classList.remove('cq'));
    document.querySelectorAll('tr.dr.qhide').forEach((r) => r.classList.remove('qhide'));
    const query = q.trim().toLowerCase();
    if (!query) return;
    const addr = parseAddr(query);
    let first: HTMLElement | null = addr === null ? null : g.querySelector<HTMLElement>('.cell[data-addr="' + addr + '"]');
    if (!first) {
        g.querySelectorAll<HTMLElement>('.cell').forEach((c) => {
            if ((c.dataset.baseTitle ?? c.title).toLowerCase().includes(query)) { c.classList.add('cq'); if (!first) first = c; }
        });
        document.querySelectorAll<HTMLElement>('tr.dr').forEach((r) => r.classList.toggle('qhide', !(r.textContent || '').toLowerCase().includes(query)));
    }
    const hit = first as HTMLElement | null;
    if (!hit) return;
    hit.closest('.gr')?.classList.remove('hrow');
    hit.click();
}

function setupWramView(post: (m: object) => void, activeTab: string, hooks: Hooks): void {
    const pane = document.querySelector<HTMLElement>('.mem-pane');
    // A node-only harness (tests/memory/ui.test.js) runs the page bundle without a browser.
    if (!pane || !pane.dataset || pane.dataset.memBound || typeof window === 'undefined' || !window.addEventListener) return;
    pane.dataset.memBound = '1';
    st.post = post;
    st.hooks = hooks;
    pane.querySelectorAll<HTMLElement>('[data-mem-view]').forEach((b) => b.addEventListener('click', () => memShowView(b.dataset.memView as View)));
    const cdlBtn = document.getElementById('btn-cdl');
    cdlBtn?.addEventListener('click', () => { st.cdlOn = cdlBtn.classList.toggle('on'); paintCoverage(); });
    const input = document.getElementById('wram-search') as HTMLInputElement | null;
    input?.addEventListener('input', () => search(input.value));
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(input.value); });
    window.addEventListener('message', (ev: MessageEvent) => {
        const msg = ev.data || {};
        if (msg.command !== 'wramCdl') return;
        st.cov = { lo: msg.lo, flags: msg.flags || [], words: msg.words || [], none: msg.none };
        paintCoverage();
    });
    // The shown view draws now if Memory is the open tab, else the first time Memory opens.
    // A panel that last showed the old ROM tab opens on the ROM view.
    applyView(activeTab === 'rom' ? 'rom' : loadView() || 'wram');
    document.querySelector<HTMLElement>('.tab[data-tab="radar"]')?.addEventListener('click', drawView);
    if (!activeTab || activeTab === 'radar' || activeTab === 'rom') drawView();
}

export { setupWramView, memShowView, parseAddr, cdlClass };
