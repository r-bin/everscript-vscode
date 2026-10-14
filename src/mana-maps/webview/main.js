// Ownership: the Secret of Mana Maps webview: area list on the left, the chosen
// area's (or map's) pictures in the middle. Data comes from the #init JSON block;
// pictures are som://rom/maps/<id>.png through the webview base URL `somBase`.
// State owned here: selection and zoom (persisted with vscode.setState).
(function () {
    // @ts-ignore acquireVsCodeApi is provided by the webview host
    const vscode = acquireVsCodeApi();
    const init = JSON.parse(/** @type {HTMLElement} */ (document.getElementById('init')).textContent || '{}');
    const nav = /** @type {HTMLElement} */ (document.getElementById('areas'));
    const view = /** @type {HTMLElement} */ (document.getElementById('view'));
    const title = /** @type {HTMLElement} */ (document.getElementById('title'));
    const meta = /** @type {HTMLElement} */ (document.getElementById('meta'));

    /** @type {{ area: string | null, map: number | null, zoom: number }} */
    const state = Object.assign({ area: null, map: null, zoom: 1 }, vscode.getState() || {});
    /** @type {Map<number, { id: number, hex: string, w: number, h: number, area: string | null }>} */
    const maps = new Map((init.maps || []).map((/** @type {any} */ m) => [m.id, m]));
    /** @type {Array<{ name: string, slug: string, maps: number[], pictures: number[][] }>} */
    const areas = init.areas || [];

    /** @param {string} tag @param {string} [cls] @param {string} [text] */
    function el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    const label = (/** @type {number} */ id) => {
        const m = maps.get(id);
        return m ? `${m.hex} (${m.id}) · ${m.w}×${m.h}` : String(id);
    };

    function buildNav() {
        nav.textContent = '';
        for (const a of areas) {
            if (!a.maps.length) continue;
            const group = el('div', 'group');
            const row = el('div', 'area');
            row.append(el('span', '', a.name), el('span', 'n', String(a.maps.length)));
            row.dataset.area = a.slug;
            const list = el('div', 'maps');
            for (const id of a.maps) {
                const item = el('div', 'map', label(id));
                item.dataset.map = String(id);
                item.dataset.area = a.slug;
                list.append(item);
            }
            group.append(row, list);
            nav.append(group);
        }
    }

    function render() {
        nav.querySelectorAll('.sel').forEach(e => e.classList.remove('sel'));
        nav.querySelectorAll('.open').forEach(e => e.classList.remove('open'));
        document.querySelectorAll('.zoom button').forEach(b => b.classList.toggle('on', Number(/** @type {HTMLElement} */ (b).dataset.zoom) === state.zoom));
        view.textContent = '';
        const area = areas.find(a => a.slug === state.area);
        if (!area) {
            title.textContent = init.title || 'Secret of Mana';
            meta.textContent = `${maps.size} maps — pick an area`;
            return;
        }
        const row = nav.querySelector(`.area[data-area="${area.slug}"]`);
        if (row && row.parentElement) row.parentElement.classList.add('open');
        const one = state.map !== null && area.maps.includes(state.map);
        // One figure per picture: map ids that draw the same picture share it.
        const groups = one ? area.pictures.filter(g => g.includes(/** @type {number} */ (state.map)))
            .map(g => [/** @type {number} */ (state.map), ...g.filter(id => id !== state.map)]) : area.pictures;
        (one ? nav.querySelector(`.map[data-map="${state.map}"]`) : row)?.classList.add('sel');
        title.textContent = area.name;
        meta.textContent = one ? label(/** @type {number} */ (state.map)) : `${area.maps.length} maps, ${groups.length} pictures`;
        for (const [id, ...same] of groups) {
            const m = maps.get(id);
            if (!m) continue;
            const fig = el('figure');
            const img = /** @type {HTMLImageElement} */ (el('img'));
            img.src = `${init.somBase}maps/${m.hex}.png`;
            img.width = Math.round(m.w * 16 * state.zoom);
            img.height = Math.round(m.h * 16 * state.zoom);
            img.alt = `map ${m.hex}`;
            const also = same.length ? ` — same picture: ${same.map(s => (maps.get(s) || { hex: s }).hex).join(', ')}` : '';
            const cap = el('figcaption', '', label(id) + also);
            cap.dataset.map = String(id);
            fig.append(img, cap);
            view.append(fig);
        }
    }

    function select(/** @type {string | null} */ area, /** @type {number | null} */ map) {
        state.area = area;
        state.map = map;
        vscode.setState(state);
        render();
    }

    nav.addEventListener('click', ev => {
        const t = /** @type {HTMLElement | null} */ (ev.target instanceof Element ? ev.target.closest('[data-area]') : null);
        if (!t) return;
        if (t.dataset.map) select(t.dataset.area || null, Number(t.dataset.map));
        else select(t.dataset.area || null, null);
    });
    view.addEventListener('click', ev => {
        const t = /** @type {HTMLElement | null} */ (ev.target instanceof Element ? ev.target.closest('figcaption') : null);
        if (t && t.dataset.map) select(state.area, state.map === Number(t.dataset.map) ? null : Number(t.dataset.map));
    });
    document.querySelector('.zoom')?.addEventListener('click', ev => {
        const b = /** @type {HTMLElement | null} */ (ev.target instanceof Element ? ev.target.closest('button') : null);
        if (!b) return;
        state.zoom = Number(b.dataset.zoom) || 1;
        vscode.setState(state);
        render();
    });

    if (init.error) {
        view.append(el('div', 'message', init.error));
        title.textContent = 'Secret of Mana';
        return;
    }
    buildNav();
    if (!state.area && areas.length) state.area = areas[0].slug;
    render();
})();
