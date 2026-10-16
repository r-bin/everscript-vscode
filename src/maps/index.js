// Ownership: stable CommonJS entry point for the maps domain.
//
// The decoder itself is TypeScript (src/maps/*.ts), compiled to dist/maps/
// by `npm run build:ts`. This facade keeps `require('../maps')` working for
// JS consumers regardless of where the compiler emits.
//
// If this throws, the build step has not run — see package.json `build:ts`.

let compiled;
try {
    compiled = require('../../dist/maps/index.js');
} catch (err) {
    throw new Error(
        'src/maps: compiled output missing. Run `npm run build:ts` ' +
            '(it is wired into `npm test`, `npm run package` and `npm run deploy`). ' +
            'Original error: ' + err.message,
    );
}

module.exports = compiled;
