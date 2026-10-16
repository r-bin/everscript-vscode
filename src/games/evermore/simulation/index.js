'use strict';
// CommonJS facade for the TypeScript script simulation. Injects the script
// decoder so src/games/evermore/simulation/*.ts depends on its public facade only.

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

const script = require('../script');

module.exports = {
    ...api,
    /** `createSimulator(rom)` with the repo's decoder bound in. */
    createSimulator: (rom) => api.createSimulator(rom, script),
};
