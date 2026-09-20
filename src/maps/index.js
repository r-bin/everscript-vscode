// Ownership: stable CommonJS entry point for the maps domain.
//
// The decoder itself is TypeScript (src/maps/*.ts), compiled to src/maps/dist/
// by `npm run build:maps`. This facade keeps `require('../maps')` working for
// JS consumers regardless of where the compiler emits.
//
// If this throws, the build step has not run — see package.json `build:maps`.

let compiled;
try {
    compiled = require('./dist/index.js');
} catch (err) {
    throw new Error(
        'src/maps: compiled output missing. Run `npm run build:maps` ' +
            '(it is wired into `npm test`, `npm run package` and `npm run deploy`). ' +
            'Original error: ' + err.message,
    );
}

module.exports = compiled;
