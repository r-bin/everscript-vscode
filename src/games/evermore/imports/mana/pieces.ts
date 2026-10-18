// Ownership: Mana's event-flag pieces as Evermore objects (Section 3).
//
// An Evermore object is an area whose tiles change from state to state — exactly what a Mana event-flag
// piece is. The pieces themselves (per flag, state 0 as drawn, one state per flag value that changes the
// cells, the box around every changed cell) are Mana's own and live in the library, `src/games/mana/decoder/flag-pieces.ts`
// (the Secret of Mana editor shows them too); this file only names them as Evermore objects.
// `[{flag, values, x, y, w, h, frames: [{'dx,dy': {A, B}}]}]`.

import * as mana from '../../../mana/decoder';

/** @param {Uint8Array} rom @param {import('../../../mana/decoder').ManaMap} map */
function flagObjects(rom: Uint8Array, map: import('../../../mana/decoder').ManaMap) {
    return mana.flagPieces(rom, map);
}

export { flagObjects };
