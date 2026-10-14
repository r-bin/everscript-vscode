'use strict';
// CommonJS facade for the TypeScript script simulation. Injects the script
// decoder so src/simulation/*.ts depends on its public facade only.

let api;
try {
    api = require('./dist/index.js');
} catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND' && /simulation[\\/]dist/.test(String(err.message))) {
        throw new Error(
            'src/simulation is TypeScript and has not been built. Run `npm run build:simulation` ' +
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
