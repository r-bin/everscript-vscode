'use strict';
// CommonJS facade for the TypeScript script model (built to dist/ by `npm run build:ts`).

try {
    module.exports = require('../../../../dist/games/evermore/script-model/index.js');
} catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND' && /dist[\\/]games[\\/]evermore[\\/]script-model/.test(String(err.message))) {
        throw new Error('src/games/evermore/script-model is TypeScript and has not been built. Run `npm run build:ts`.');
    }
    throw err;
}
