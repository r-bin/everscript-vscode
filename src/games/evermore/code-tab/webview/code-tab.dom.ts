// Ownership: the Code tab's page — every known routine (`codeIndex`, host.ts): a searchable rail by
// bank; in the middle the picked routine's place, who calls it and what it calls (links), and one
// of its versions (asm with comments, reconstructed C, C from another source), each read from the
// host only when shown; on the right its knowledge entry, WRAM, open work and files.
// State owned: `st` (index, search, selection, history, routine and text caches).
// Bundled by tools/bundle-pages.mts as dist/webview/code-tab.js (global CodeTab); the radar page
// calls CodeTab.setupCodeTab(post, activeTab) inside its own script.

import { asmHtml, cHtml, mdHtml, esc } from './code-listing.dom';
import type { Known } from './code-listing.dom';

type Version = 'asm' | 'c' | 'pseudo';
interface Row { name: string; title: string; category: string | null; confidence: string | null; us: string; addr: string | null; c: boolean; todo: number }
interface Routine {
    name: string; title: string; kind: string | null; category: string | null; confidence: string | null; us: string; addr: string | null; located: string;
    body: string; evidence: string[]; see: string[]; entry: string; instructions: number; commented: number; fields: number[]; io: number[];
    calls: { addr: string; name: string | null; title: string | null }[]; callers: { name: string; title: string }[];
    wram: { addr: string; access: string[]; viaDb: boolean; name: string | null; title: string | null }[];
    todo: { kind: string; label: string; detail: string }[];
    versions: { asm: string; c: { file: string; source: string } | null; pseudo: { file: string; source: string } | null };
}
type Pending<T> = T | 'pending' | { error: string };

const VERSION_LABEL: Record<Version, [string, string]> = {
    asm: ['ASM', 'The routine as the ROM has it, with our comments (soe://rom/code/<name>/<name>.asm)'],
    c: ['C', 'Its reconstructed C (reconstructed-c/)'],
    pseudo: ['Pseudo-C', 'C from another source: a curated docs block or the snesrecomp mechanical lift'],
};
const hexNum = (s: string | null): number => (s ? parseInt(s.replace('$', ''), 16) : -1);
const bankOf = (r: Row): string => r.us.slice(1, 3);

function setupCodeTab(post: (msg: object) => void, activeTab: string): void {
    // A node-only harness (tests/memory/ui.test.js) runs the page script without a browser.
    if (typeof window === 'undefined' || !window.addEventListener) return;
    const pane = document.querySelector<HTMLElement>('.code-pane');
    if (!pane || !pane.dataset || pane.dataset.codeBound) return;
    pane.dataset.codeBound = '1';
    const st = {
        rows: null as Row[] | null, error: '', requested: false, canOpen: false, known: { names: new Set<string>(), byAddr: new Map<number, string>() } as Known,
        query: '', onlyC: false, bytes: false, deep: null as { q: string; hits: Map<string, string[]> | 'pending' | { error: string } } | null,
        sel: '', version: 'asm' as Version, back: [] as string[],
        routines: {} as Record<string, Pending<Routine>>, texts: {} as Record<string, Pending<string>>,
    };
    const $ = (id: string) => document.getElementById(id)!;

    function visible(): Row[] {
        const rows = st.rows || [];
        const deep = st.deep && st.deep.hits instanceof Map ? st.deep.hits : null;
        const q = st.query.toLowerCase().replace(/^(\$|0x)/, '').replace(':', '');
        return rows.filter((r) => (!st.onlyC || r.c) && (deep ? deep.has(r.name)
            : !q || r.name.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || r.us.toLowerCase().includes(q) || (r.addr || '').toLowerCase().includes(q)));
    }

    function renderRail(): void {
        if (!st.rows) { $('code-rail').innerHTML = '<div class="scr-empty">' + esc(st.error || 'Loading…') + '</div>'; return; }
        const rows = visible(), out: string[] = [];
        const deep = st.deep?.hits;
        if (deep === 'pending') out.push('<div class="scr-empty">Searching…</div>');
        else if (deep && !(deep instanceof Map)) out.push('<div class="scr-empty">' + esc(deep.error) + '</div>');
        else if (deep) out.push('<div class="code-deep">Deep search “' + esc(st.deep!.q) + '”: ' + deep.size + ' · <a class="code-link" data-code-clear="1">clear</a></div>');
        let bank = '';
        for (const r of rows) {
            if (bankOf(r) !== bank) { bank = bankOf(r); out.push('<div class="scr-group">Bank $' + bank + '</div>'); }
            const why = deep instanceof Map ? (deep.get(r.name) || []).join('; ') : '';
            out.push('<div class="scr-item' + (r.name === st.sel ? ' scr-sel' : '') + '" data-code-go="' + esc(r.name) + '" title="' + esc(r.title + (why ? '\n' + why : '')) + '">' +
                '<span class="scr-item-main">' + (r.category ? esc(r.category) + ' ' : '') + esc(r.name) + '</span>' +
                (r.c ? '<span class="code-badge" title="Has reconstructed C">C</span>' : '') +
                '<span class="scr-item-sub">' + esc(r.addr || '—') + '</span></div>');
        }
        $('code-rail').innerHTML = out.join('') || '<div class="scr-empty">No routine matches.</div>';
        $('code-count').textContent = rows.length + ' of ' + st.rows.length;
    }

    function refsHtml(r: Routine): string {
        const chip = (name: string, title: string | null) => '<a class="scr-chip code-link" data-code-go="' + esc(name) + '" title="' + esc(title || '') + '">' + esc(name) + '</a>';
        const callers = r.callers.length ? r.callers.map((c) => chip(c.name, c.title)).join('')
            : '<span class="scr-dim">no known routine calls it directly (tables and indirect jumps are not followed)</span>';
        const calls = r.calls.length ? r.calls.map((c) => (c.name ? chip(c.name, c.title) : '<span class="scr-chip code-unknown" title="No knowledge entry yet">' + esc(c.addr) + '</span>')).join('')
            : '<span class="scr-dim">nothing</span>';
        return '<div class="code-refs"><span class="scr-chips-h">Called by ' + r.callers.length + '</span><div class="code-chips">' + callers + '</div></div>' +
            '<div class="code-refs"><span class="scr-chips-h">Calls ' + r.calls.length + '</span><div class="code-chips">' + calls + '</div></div>';
    }

    function textHtml(r: Routine): string {
        const t = st.texts[r.name + '|' + st.version];
        if (t === undefined || t === 'pending') return '<div class="scr-empty">Reading…</div>';
        if (typeof t !== 'string') return '<div class="scr-empty">' + esc(t.error) + '</div>';
        return st.version === 'asm' ? asmHtml(t, st.known, st.bytes) : cHtml(t, st.known);
    }

    function renderMid(): void {
        const r = st.routines[st.sel];
        if (!st.sel) { $('code-mid').innerHTML = '<div class="scr-empty">Pick a routine.</div>'; return; }
        if (r === undefined || r === 'pending') { $('code-mid').innerHTML = '<div class="scr-empty">Reading ' + esc(st.sel) + '…</div>'; return; }
        if ('error' in r) { $('code-mid').innerHTML = '<div class="scr-empty">' + esc(r.error) + '</div>'; return; }
        const where = r.located === 'moved' ? 'this ROM <b>' + esc(r.addr) + '</b>' : r.located === 'missing' ? 'not found in this ROM' : r.located === 'unchecked' ? 'unchecked (no US ROM to compare)' : '';
        const seg = (Object.keys(VERSION_LABEL) as Version[]).map((v) => {
            const has = v === 'asm' || !!r.versions[v], src = v === 'asm' ? '' : r.versions[v]?.source || 'none';
            return '<button class="scr-seg-btn' + (v === st.version ? ' scr-on' : '') + '" data-code-ver="' + v + '"' + (has ? '' : ' disabled') +
                ' title="' + esc(VERSION_LABEL[v][1] + (src ? '\n' + src : '')) + '">' + VERSION_LABEL[v][0] + '</button>';
        }).join('');
        const file = st.version === 'asm' ? r.versions.asm : r.versions[st.version]?.file;
        $('code-mid').innerHTML =
            '<div class="code-head"><div class="code-title">' + esc(r.title) + '</div>' +
            '<div class="code-meta"><code>' + esc(r.name) + '</code> · US ' + esc(r.us) + (where ? ' · ' + where : '') +
            (r.category ? ' · ' + esc(r.category) : '') + ' · ' + esc(r.confidence || 'no confidence') + ' · ' + r.instructions + ' instructions, ' + r.commented + ' commented</div></div>' +
            refsHtml(r) +
            '<div class="code-bar"><div class="scr-seg">' + seg + '</div>' +
            (st.version !== 'asm' && r.versions[st.version] ? '<span class="scr-dim code-src">' + esc(r.versions[st.version]!.source) + '</span>' : '') +
            (st.canOpen && file ? '<a class="code-link code-open" data-code-open="' + esc(file) + '" title="Open in an editor">open ↗</a>' : '') + '</div>' +
            '<div class="code-text">' + textHtml(r) + '</div>';
    }

    function renderSide(): void {
        const r = st.routines[st.sel];
        if (!r || r === 'pending' || 'error' in r) { $('code-side').innerHTML = ''; return; }
        const sec = (h: string, body: string) => '<div class="code-sec"><div class="code-sec-h">' + h + '</div>' + body + '</div>';
        const out = [sec('Knowledge', '<div class="code-md">' + mdHtml(r.body, st.known) + '</div>')];
        if (r.evidence.length) out.push(sec('Evidence', '<ul>' + r.evidence.map((e) => '<li>' + esc(e) + '</li>').join('') + '</ul>'));
        if (r.wram.length) out.push(sec('WRAM ' + r.wram.length, '<table class="code-wram">' + r.wram.map((u) =>
            '<tr><td><code>' + esc(u.addr) + '</code>' + (u.viaDb ? ' <span class="scr-dim">(DB $7E)</span>' : '') + '</td><td title="' + esc(u.title || '') + '">' + esc(u.name || '') +
            '</td><td class="scr-dim">' + esc(u.access.join(', ')) + '</td></tr>').join('') + '</table>'));
        const hex = (v: number, d: number) => '$' + v.toString(16).toUpperCase().padStart(d, '0');
        if (r.fields.length) out.push(sec('Record fields', r.fields.map((v) => '<code>+' + hex(v, 2) + '</code>').join(' ')));
        if (r.io.length) out.push(sec('Hardware registers', r.io.map((v) => '<code>' + hex(v, 4) + '</code>').join(' ')));
        out.push(sec('Open work', r.todo.length ? '<ul>' + r.todo.map((t) => '<li><b>' + esc(t.label) + '</b> — ' + esc(t.detail) + '</li>').join('') + '</ul>' : '<span class="scr-dim">None known.</span>'));
        if (st.canOpen) out.push(sec('Files', ['info.md', 'routine.json', r.versions.asm].concat(r.versions.c ? [r.versions.c.file] : []).concat(r.versions.pseudo ? [r.versions.pseudo.file] : [])
            .map((f) => '<a class="code-link" data-code-open="' + esc(f) + '">' + esc(f) + '</a>').join(' · ') + '<div class="scr-dim">entry: ' + esc(r.entry) + '</div>'));
        $('code-side').innerHTML = out.join('');
    }

    /** Ask for what the selection shows and is not cached: the routine, then the chosen version's text. */
    function fetch(): void {
        const r = st.routines[st.sel];
        if (r === undefined) { st.routines[st.sel] = 'pending'; post({ command: 'codeRoutine', name: st.sel }); return; }
        if (r === 'pending' || 'error' in r) return;
        if (st.version !== 'asm' && !r.versions[st.version]) st.version = 'asm';
        const key = r.name + '|' + st.version;
        if (st.texts[key] === undefined) { st.texts[key] = 'pending'; post({ command: 'codeText', name: r.name, version: st.version }); }
    }

    function show(): void { fetch(); renderMid(); renderSide(); }

    function select(name: string, remember = true): void {
        if (!name || name === st.sel) return;
        if (remember && st.sel) st.back.push(st.sel);
        st.sel = name;
        ($('code-back') as HTMLButtonElement).disabled = !st.back.length;
        renderRail();
        $('code-rail').querySelector('.scr-sel')?.scrollIntoView({ block: 'nearest' });
        $('code-mid').scrollTop = 0;
        show();
    }

    function back(): void { const name = st.back.pop(); if (name) select(name, false); ($('code-back') as HTMLButtonElement).disabled = !st.back.length; }

    function request(): void { st.requested = true; post({ command: 'codeInit' }); }

    pane.addEventListener('click', (e) => {
        const t = (e.target as HTMLElement).closest<HTMLElement>('[data-code-go],[data-code-ver],[data-code-line],[data-code-open],[data-code-clear]');
        if (!t) return;
        if (t.dataset.codeGo) { select(t.dataset.codeGo); return; }
        if (t.dataset.codeVer) { st.version = t.dataset.codeVer as Version; show(); return; }
        if (t.dataset.codeOpen) { post({ command: 'codeOpen', name: st.sel, file: t.dataset.codeOpen }); return; }
        if (t.dataset.codeClear) { st.deep = null; st.query = ''; ($('code-search') as HTMLInputElement).value = ''; renderRail(); return; }
        const row = pane.querySelector<HTMLElement>('tr[data-code-at="' + t.dataset.codeLine + '"]');
        if (row) { row.scrollIntoView({ block: 'center' }); row.classList.remove('code-flash'); void row.offsetWidth; row.classList.add('code-flash'); }
    });
    $('code-back').addEventListener('click', back);
    document.addEventListener('keydown', (e) => {
        if (pane.style.display === 'none') return;
        if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    });
    const search = $('code-search') as HTMLInputElement;
    search.addEventListener('input', () => { st.query = search.value.trim(); st.deep = null; renderRail(); });
    search.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !search.value.trim()) return;
        st.deep = { q: search.value.trim(), hits: 'pending' };
        post({ command: 'codeSearch', q: st.deep.q });
        renderRail();
    });
    $('code-only-c').addEventListener('change', (e) => { st.onlyC = (e.target as HTMLInputElement).checked; renderRail(); });
    $('code-bytes').addEventListener('change', (e) => { st.bytes = (e.target as HTMLInputElement).checked; pane.querySelector('.code-asm')?.classList.toggle('code-nobytes', !st.bytes); });
    document.querySelector('.tab[data-tab="code"]')?.addEventListener('click', () => { if (!st.rows && !st.requested) request(); });
    window.addEventListener('message', (ev) => {
        const msg = ev.data || {};
        if (msg.command === 'codeIndex') {
            if (msg.error) { st.error = msg.error; st.requested = false; renderRail(); return; }
            st.rows = msg.routines as Row[];
            st.canOpen = !!msg.canOpen;
            st.known = { names: new Set(st.rows.map((r) => r.name)), byAddr: new Map() };
            for (const r of st.rows) { const a = hexNum(r.addr); if (a >= 0) { st.known.byAddr.set(a, r.name); st.known.byAddr.set(a ^ 0x400000, r.name); } }
            renderRail();
            if (st.sel) show();
        } else if (msg.command === 'codeSearch') {
            if (!st.deep || st.deep.q !== msg.q) return;
            st.deep.hits = msg.error ? { error: msg.error } : new Map((msg.hits as { name: string; why: string[] }[]).map((h) => [h.name, h.why]));
            renderRail();
        } else if (msg.command === 'codeRoutine') {
            st.routines[msg.name] = msg.error ? { error: msg.error } : msg.routine;
            if (msg.name === st.sel) show();
        } else if (msg.command === 'codeText') {
            st.texts[msg.name + '|' + msg.version] = msg.error ? { error: msg.error } : msg.text;
            if (msg.name === st.sel && msg.version === st.version) renderMid();
        }
    });
    if (activeTab === 'code') request();
}

export { setupCodeTab };
