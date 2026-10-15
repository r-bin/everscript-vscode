'use strict';
// Ownership: Mana's event-flag pieces as Evermore objects (Section 3).
//
// A Mana piece is placed only while its event flag is in its range ($00:CB90,
// docs/mana/README.md "Pieces and layers"), so the map changes tiles as the story moves
// on — the Potos ground breaking open is piece 13 of map $66, shown from flag $10 = 6.
// An Evermore object is exactly that: an area whose tiles change from state to state.
// Per event flag: state 0 is the map as drawn (every flag 0); each other flag value
// that changes what is placed is one more state, holding the cells it changes. A
// state's area is the box around every cell any state of that flag changes.

const mana = require('../mana');

const ALWAYS = (r) => r.min === 0 && r.max === 15;
const MAX_STATES = 16;

/**
 * `[{flag, values, x, y, w, h, frames: [{'dx,dy': {A, B}}]}]` — metatile ids per changed
 * cell for each state after state 0; `values[s]` is the first flag value showing state s.
 */
function flagObjects(rom, map) {
    const records = mana.readPlacements(rom, map.id).filter((r) => !ALWAYS(r));
    const flags = [...new Set(records.map((r) => r.flag))].sort((a, b) => a - b);
    const out = [];
    for (const flag of flags) {
        const mine = records.filter((r) => r.flag === flag);
        const seen = new Map();
        for (let v = 0; v < 16 && seen.size < MAX_STATES; v++) {
            const sig = mine.map((r) => (v >= r.min && v <= r.max ? 1 : 0)).join('');
            if (!seen.has(sig)) seen.set(sig, v);
        }
        const values = [...seen.values()];
        if (values.length < 2) continue;
        const states = values.slice(1).map((v) => {
            const layers = mana.assembleLayers(rom, map.id, (f) => (f === flag ? v : 0));
            const changed = new Map();
            for (let y = 0; y < map.h; y++) {
                for (let x = 0; x < map.w; x++) {
                    const a = layers.mem[mana.LAYER_A + y * mana.ROW + x];
                    const b = layers.sizeB ? layers.mem[mana.LAYER_B + (y % layers.sizeB.h) * mana.ROW + (x % layers.sizeB.w)] : -1;
                    if (a !== map.cell('A', x, y) || b !== map.cell('B', x, y)) changed.set(x + ',' + y, { A: a, B: b });
                }
            }
            return changed;
        });
        const cells = states.flatMap((s) => [...s.keys()].map((k) => k.split(',').map(Number)));
        if (!cells.length) continue;
        const x0 = Math.min(...cells.map((c) => c[0])), y0 = Math.min(...cells.map((c) => c[1]));
        const x1 = Math.max(...cells.map((c) => c[0])), y1 = Math.max(...cells.map((c) => c[1]));
        out.push({
            flag, values, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1,
            frames: states.map((s) => {
                const f = {};
                for (const [k, v] of s) { const [x, y] = k.split(',').map(Number); f[(x - x0) + ',' + (y - y0)] = v; }
                return f;
            }),
        });
    }
    return out;
}

module.exports = { flagObjects };
