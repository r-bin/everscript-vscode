'use strict';
// CommonJS facade for the TypeScript script simulation (its decoder is script-vm, bound in
// decoder.ts).

let api;
try {
    api = require('../../../../dist/games/evermore/simulation/index.js');
} catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND' && /dist[\\/]simulation/.test(String(err.message))) {
        throw new Error(
            'src/games/evermore/simulation is TypeScript and has not been built. Run `npm run build:ts` ' +
            '(npm test and npm run package do it for you).',
        );
    }
    throw err;
}

module.exports = api;
