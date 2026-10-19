// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Build and Run drops every ROM-derived cache after a successful build
// (src/extension.js). A throw there aborts the build before the ROM reaches
// the emulator, which is how a stale PREVIEW_CACHE reference broke F5.

const rooms = require('../../dist/games/evermore/rooms');
const romReaders = require('../../dist/games/evermore/rom-readers');

try {
    romReaders.invalidateRomBuffer();
    rooms.invalidateRoomRenders();
    rooms.invalidateMetatilePalettes();
    console.log('  [PASS] post-build cache invalidation runs');
} catch (e) {
    console.error('  [FAIL] post-build cache invalidation: ' + e.message);
    process.exit(1);
}
