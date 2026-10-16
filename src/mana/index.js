// Ownership: stable CommonJS entry point for the Secret of Mana library.
//
// The library is TypeScript (src/mana/*.ts), compiled to dist/mana/ by
// `npm run build:ts`. This facade keeps `require('../mana')` working for JS.

let compiled;
try {
    compiled = require('../../dist/mana/index.js');
} catch (err) {
    throw new Error('src/mana: compiled output missing. Run `npm run build:ts`. Original error: ' + err.message);
}

module.exports = compiled;
