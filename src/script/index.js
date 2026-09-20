'use strict';
// CommonJS facade for the TypeScript script decoder.
//
// The rest of the extension is CommonJS, so it requires this rather than
// reaching into dist/ — which also means one clear message when the build
// has not been run instead of a bare MODULE_NOT_FOUND from somewhere deep.

let api;
try {
    api = require('./dist/index.js');
} catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND' && /script[\\/]dist/.test(String(err.message))) {
        throw new Error(
            'src/script is TypeScript and has not been built. Run `npm run build:script` ' +
            '(npm test and npm run package do it for you).',
        );
    }
    throw err;
}

module.exports = api;
