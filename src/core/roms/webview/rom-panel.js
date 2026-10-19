// TODO port to TS (docs/todo/port-to-ts.md)
// The ROM panel page: your ROMs per game (base marked ★), a feature table per ROM, a drop zone.
// State comes from src/core/roms/host.ts; every action goes back as a message.
(function () {
    const vscode = acquireVsCodeApi();
    const app = document.getElementById('app');
    const FEATURES = [
        ['maps', 'Maps'], ['map-editor', 'Map editor'], ['scripts', 'Scripts'], ['sprites', 'Sprites'],
        ['music', 'Music'], ['memory-names', 'Memory names'], ['emulator-panels', 'Emulator panels'],
        ['language', 'Everscript language'], ['knowledge', 'Knowledge base'],
    ];
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const name = p => p.split(/[\\/]/).pop();

    function what(r) {
        if (r.match === 'derived') return `${r.variant} + ${r.derivedKind}`;
        if (r.match === 'known') return r.variant;
        return 'unknown variant';
    }

    function support(game, rom, key) {
        const s = game && game.capabilities[key];
        if (!s) return ['—', 'unknown'];
        // Unknown variants have no address features: what we know is written for the base.
        if (rom.match === 'unknown') return ['—', 'unknown variant'];
        return s === 'full' ? ['✓', 'full'] : ['◐', 'partial'];
    }

    function render(state) {
        const games = new Map(state.games.map(g => [g.id, g]));
        const known = state.roms.filter(r => r.game);
        const other = state.roms.filter(r => !r.game);
        let out = '<header><h1>ROMs</h1><button data-act="add">Add ROM…</button></header>';
        if (!state.roms.length) {
            out += '<section class="drop empty">Drop a ROM file here, or use <b>Add ROM…</b>.<br>'
                + 'The plugin reads it where it is; nothing is copied.</section>';
            app.innerHTML = out;
            return;
        }
        for (const g of state.games) {
            const roms = known.filter(r => r.game === g.id).sort((a, b) => (b.path === g.basePath) - (a.path === g.basePath));
            out += `<section><h2>${esc(g.name)} <span class="dim">base: ${esc(g.base)}</span>`
                + ` <a href="#" data-act="docs" data-docs="${esc(g.docs)}">docs</a></h2>`;
            if (!roms.length) { out += `<p class="dim">No ${esc(g.name)} ROM yet.</p></section>`; continue; }
            out += '<table class="roms"><tr><th></th><th>Variant</th><th>Region</th><th>Hash</th><th>File</th><th></th></tr>';
            for (const r of roms) {
                const isBase = r.path === g.basePath;
                const sel = r.path === state.selected;
                out += `<tr class="${sel ? 'sel' : ''}"><td class="star" title="${isBase ? 'base ROM' : ''}">${isBase ? '★' : ''}</td>`
                    + `<td>${esc(what(r))}</td><td>$${(r.region ?? 0).toString(16).padStart(2, '0').toUpperCase()}${r.pal ? ' PAL' : ''}</td>`
                    + `<td>${esc(r.match)}</td><td title="${esc(r.path)}">${esc(name(r.path))}</td><td class="acts">`
                    + (sel ? '<span class="dim">selected</span>' : `<button data-act="select" data-path="${esc(r.path)}">Select</button>`)
                    + (!isBase && r.match === 'unknown' ? `<button data-act="base" data-path="${esc(r.path)}">Use as base</button>` : '')
                    + `<button data-act="remove" data-path="${esc(r.path)}" title="Remove from the list (the file stays)">✕</button></td></tr>`;
            }
            out += '</table>';
            out += '<table class="features"><tr><th>Feature</th>' + roms.map(r => `<th title="${esc(r.path)}">${esc(what(r))}</th>`).join('') + '</tr>';
            for (const [key, label] of FEATURES) {
                out += `<tr><td>${label}</td>` + roms.map(r => { const [m, t] = support(games.get(r.game), r, key); return `<td title="${t}">${m}</td>`; }).join('') + '</tr>';
            }
            out += '</table></section>';
        }
        if (other.length) {
            out += '<section><h2>Not a known game</h2><table class="roms">';
            for (const r of other) {
                out += `<tr><td>${esc(r.title || '(no header)')}</td><td title="${esc(r.path)}">${esc(name(r.path))}</td>`
                    + `<td class="acts"><button data-act="remove" data-path="${esc(r.path)}">✕</button></td></tr>`;
            }
            out += '</table></section>';
        }
        out += '<section class="drop">Drop more ROM files here.</section>';
        app.innerHTML = out;
    }

    app.addEventListener('click', e => {
        const el = e.target.closest('[data-act]');
        if (!el) return;
        e.preventDefault();
        vscode.postMessage({ command: el.dataset.act, path: el.dataset.path, docs: el.dataset.docs });
    });
    document.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('over'); });
    document.addEventListener('dragleave', () => document.body.classList.remove('over'));
    document.addEventListener('drop', e => {
        e.preventDefault();
        document.body.classList.remove('over');
        // Files dragged from the VS Code explorer arrive as a URI list (hold Shift while dropping).
        const list = (e.dataTransfer.getData('text/uri-list') || '').split(/\r?\n/).filter(l => l && !l.startsWith('#'));
        if (list.length) vscode.postMessage({ command: 'drop', uris: list });
        else vscode.postMessage({ command: 'add' });
    });
    window.addEventListener('message', e => { if (e.data.command === 'state') render(e.data.state); });
    vscode.postMessage({ command: 'ready' });
})();
