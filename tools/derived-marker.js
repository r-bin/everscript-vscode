'use strict';
// Builders mark their output as derived from a base ROM (docs/architecture/multi-game.md §4).
// The format lives in src/games/evermore/derived.ts; run `npm run build:ts` first.
const crypto = require('crypto');
const { writeDerivedMarker } = require('../dist/games/evermore/derived');

/** Writes the marker for `kind` at file offset `at` of `image`, naming `base` (the clean ROM bytes). */
function markDerived(image, base, at, kind) {
    const baseSha1 = crypto.createHash('sha1').update(base).digest('hex');
    writeDerivedMarker(image, at, { baseSha1, kind });
}

module.exports = { markDerived };
