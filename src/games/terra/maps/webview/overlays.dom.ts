// Ownership: what the Terranigma Maps page draws over a room's picture — the cell types, collision, the exits and
// chests (Triggers), the map changes (Objects), the grid — and which chip shows each (a dock tab forces its chip on,
// as in the other games' editors). State lives on the editor `E` (editor.dom.ts); nothing is owned here.
// Coordinates are game pixels inside `#rg-px`.
import { blockedEdges, chestKind, collisionCells, diagonalSide, exitTargets, layerOf, mapWord, typeColor, typedCells } from './model';
import type { Editor, ViewState } from './editor.dom';

export type Chip = 'l0' | 'l1' | 'types' | 'collision' | 'triggers' | 'objects' | 'grid';
/** The overlay each dock tab shows while it is open (its chip is on and locked). */
const FORCED_BY: Partial<Record<Chip, [ViewState['tab'], string]>> = {
    collision: ['collision', 'Collision'], triggers: ['trigger', 'Trigger'], objects: ['object', 'Object'],
};
const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgEl(tag: string, attrs: Record<string, string | number>): SVGElement {
    const el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(k => el.setAttribute(k, String(attrs[k])));
    return el;
}

/** The tab that forces chip `key` on right now ('' when none). */
export function forcedBy(E: Editor, key: Chip): string {
    const f = FORCED_BY[key];
    return f && E.st.tab === f[0] ? f[1] : '';
}

/** Whether an overlay shows: its chip is on, or the open tab shows it. */
export function chipOn(E: Editor, key: Chip): boolean { return !!E.st[key] || !!forcedBy(E, key); }

/** The `<g>` an overlay draws into, emptied; null when it is not on the page or its chip is off. */
function layerGroup(id: string, on: boolean): Element | null {
    const g = document.getElementById(id);
    if (!g) return null;
    g.textContent = '';
    return on ? g : null;
}

export function stageTypes(E: Editor): void {
    const g = layerGroup('tm-types', E.st.types);
    if (!g) return;
    for (const [x, y, t] of typedCells(E.data)) {
        g.appendChild(svgEl('rect', { x: x * 16, y: y * 16, width: 16, height: 16, fill: typeColor(t), class: 'tm-type' }));
        const label = svgEl('text', { x: x * 16 + 8, y: y * 16 + 11, class: 'tm-type-label' });
        label.textContent = String(t);
        g.appendChild(label);
    }
}

const EDGE: Record<string, (x: number, y: number) => string> = {
    top: (x, y) => `M${x} ${y + 1}H${x + 16}`, bottom: (x, y) => `M${x} ${y + 15}H${x + 16}`,
    left: (x, y) => `M${x + 1} ${y}V${y + 16}`, right: (x, y) => `M${x + 15} ${y}V${y + 16}`,
};
const DIAG: Record<string, (x: number, y: number) => string> = {
    ul: (x, y) => `M${x} ${y}h16L${x} ${y + 16}z`, dr: (x, y) => `M${x + 16} ${y}v16h-16z`,
    ur: (x, y) => `M${x} ${y}h16v16z`, dl: (x, y) => `M${x} ${y}v16h16z`,
};

/**
 * Collision of layer 0: walls hatched; the diagonals (type 6 `/`, 7 `\`) as the triangle on the side facing the
 * walls next to them (model diagonalSide; just the line when the neighbours do not tell); for a type only some moves
 * pass, the edges that stop a move (dashed: only without a flag). The type the Collision tab shows is outlined.
 */
export function stageCollision(E: Editor): void {
    const g = layerGroup('tm-coll', chipOn(E, 'collision'));
    if (!g) return;
    let walls = '', diag = '', lines = '', edges = '', gated = '', picked = '';
    for (const [cx, cy, t] of collisionCells(E.data, E.ctx.rules)) {
        const x = cx * 16, y = cy * 16, rule = E.ctx.rules[t];
        if (rule.look === 'wall') walls += `M${x} ${y}h16v16h-16z`;
        else if (rule.look === 'diagonal') {
            const side = diagonalSide(E.data, E.ctx.rules, cx, cy);
            if (side) diag += DIAG[side](x, y);
            else lines += t === 7 ? `M${x} ${y}l16 16` : `M${x} ${y + 16}l16 -16`;
        }
        else for (const e of blockedEdges(rule)) { if (e.gated) gated += EDGE[e.side](x, y); else edges += EDGE[e.side](x, y); }
        if (t === E.st.ctype) picked += `M${x + 0.5} ${y + 0.5}h15v15h-15z`;
    }
    if (E.st.ctype !== null && E.ctx.rules[E.st.ctype]?.look === 'open') {
        const l = layerOf(E.data, 0);
        if (l) l.cells.forEach((w, i) => { if (mapWord(w).type === E.st.ctype) picked += `M${(i % l.w) * 16 + 0.5} ${Math.floor(i / l.w) * 16 + 0.5}h15v15h-15z`; });
    }
    const add = (d: string, cls: string) => { if (d) g.appendChild(svgEl('path', { d, class: cls })); };
    add(walls, 'tm-wall'); add(diag, 'tm-wall'); add(lines, 'tm-edge'); add(edges, 'tm-edge'); add(gated, 'tm-edge tm-gated'); add(picked, 'tm-ctype');
}

/** The Triggers: each exit rectangle with the room it leads to, each chest's cell; the selected one is outlined. */
export function stageTriggers(E: Editor): void {
    const g = layerGroup('tm-exits', chipOn(E, 'triggers'));
    if (!g) return;
    const label = (x: number, y: number, text: string) => {
        const t = svgEl('text', { x, y, class: 'tm-exit-label' });
        t.textContent = text;
        g.appendChild(t);
    };
    (E.data.exits || []).forEach((e, i) => {
        const cls = 'tm-exit' + (e.targets.length > 1 || e.targets[0]?.flag !== null ? ' tm-exit-flag' : '') + (i === E.st.exit ? ' sel' : '');
        g.appendChild(svgEl('rect', { x: e.x * 16 + 1, y: e.y * 16 + 1, width: e.w * 16 - 2, height: e.h * 16 - 2, rx: 2, class: cls }));
        label(e.x * 16 + 3, e.y * 16 + 10, '→' + exitTargets(e));
    });
    (E.data.chests || []).forEach((c, i) => {
        const drawn = chestKind(E.ctx.data, c);
        const cls = 'tm-chest' + (drawn === 'chest' ? '' : ' tm-chest-other') + (i === E.st.chest ? ' sel' : '');
        g.appendChild(svgEl('rect', { x: c.x * 16 + 1, y: c.y * 16 + 1, width: 14, height: 14, rx: 2, class: cls }));
        label(c.x * 16 + 2, c.y * 16 - 2, '#' + i);
    });
}

/** The Objects: the cells each map change writes (the selected one filled, a copy's source dashed). */
export function stageChanges(E: Editor): void {
    const g = layerGroup('tm-changes', chipOn(E, 'objects'));
    if (!g) return;
    (E.data.changes || []).forEach((c, i) => {
        const sel = i === E.st.change;
        const d = c.cells.map(([, x, y]) => `M${x * 16 + 0.5} ${y * 16 + 0.5}h15v15h-15z`).join('');
        if (d) g.appendChild(svgEl('path', { d, class: 'tm-change' + (sel ? ' sel' : '') }));
        if (sel) for (const e of c.edits) if (e.kind === 'copy') {
            g.appendChild(svgEl('rect', { x: e.from[0] * 16, y: e.from[1] * 16, width: e.w * 16, height: e.h * 16, class: 'tm-change-src' }));
        }
        const first = c.cells[0];
        if (first) {
            const t = svgEl('text', { x: first[1] * 16 + 2, y: first[2] * 16 + 10, class: 'tm-exit-label' });
            t.textContent = 'bit ' + c.bit;
            g.appendChild(t);
        }
    });
}

export function stageGrid(E: Editor): void {
    const g = layerGroup('rg-grid', E.st.grid);
    if (!g) return;
    let d = '';
    for (let x = 16; x < E.W; x += 16) d += 'M' + x + ' 0V' + E.H;
    for (let y = 16; y < E.H; y += 16) d += 'M0 ' + y + 'H' + E.W;
    g.appendChild(svgEl('path', { d, class: 'tm-grid' }));
}
