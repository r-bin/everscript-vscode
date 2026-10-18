'use strict';
// CommonJS facade for the TypeScript script VM decoder (built to dist/ by `npm run build:ts`).

try {
    module.exports = require('../../../../dist/games/evermore/script-vm/index.js');
} catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND' && /dist[\\/]games[\\/]evermore[\\/]script-vm/.test(String(err.message))) {
        throw new Error('src/games/evermore/script-vm is TypeScript and has not been built. Run `npm run build:ts`.');
    }
    throw err;
}
