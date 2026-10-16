// Ownership: stable CommonJS entry point for the Secret of Mana library.
//
// The library is TypeScript (src/games/mana/decoder/*.ts), compiled to dist/games/mana/decoder/ by
// `npm run build:ts`. This facade keeps `require('…/games/mana/decoder')` working for JS.

let compiled;
try {
    compiled = require('../../../../dist/games/mana/decoder/index.js');
} catch (err) {
    throw new Error('src/games/mana/decoder: compiled output missing. Run `npm run build:ts`. Original error: ' + err.message);
}

module.exports = compiled;
