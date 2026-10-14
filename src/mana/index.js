// Ownership: stable CommonJS entry point for the Secret of Mana library.
//
// The library is TypeScript (src/mana/*.ts), compiled to src/mana/dist/ by
// `npm run build:mana`. This facade keeps `require('../mana')` working for JS.

let compiled;
try {
    compiled = require('./dist/index.js');
} catch (err) {
    throw new Error('src/mana: compiled output missing. Run `npm run build:mana`. Original error: ' + err.message);
}

module.exports = compiled;
