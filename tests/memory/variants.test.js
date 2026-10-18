'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    identifyEvermoreVariant,
    toVariantId,
    toJsonVariantKey,
    getTableFileOffset,
    getTableCount,
    getMapTableOffset,
    getMapPalettesOffset,
    getMapTileGraphicsOffset,
    getStringKeysOffset,
    getStringKeysCount,
    getRoomEnterScriptsOffset,
    getScriptPointersOffset,
    getScriptHeaderOffset,
    getScriptOpcodeTableOffset,
    getAnimateIdsOffset,
    getAnimationRecordsOffset,
    getAnimationVmDispatchOffset,
    getCharacterRecordsOffset,
    getEnemyIndexOffset,
    getSongPackagesOffset,
    getSpriteBlocks16Offset,
    getSpriteBlocks8Offset,
} = require('../../dist/games/evermore/variant-resolver');

// 1. Alias normalization
assert.strictEqual(toVariantId('us'), 'us');
assert.strictEqual(toVariantId('usa'), 'us');
assert.strictEqual(toVariantId('eu'), 'eu');
assert.strictEqual(toVariantId('europe'), 'eu');
assert.strictEqual(toVariantId('de'), 'de');
assert.strictEqual(toVariantId('germany'), 'de');
assert.strictEqual(toVariantId('fr'), 'fr');
assert.strictEqual(toVariantId('france'), 'fr');
assert.strictEqual(toVariantId('es'), 'es');
assert.strictEqual(toVariantId('spain'), 'es');
assert.strictEqual(toVariantId('spain1'), 'es');
assert.strictEqual(toVariantId('es-rev2'), 'es-rev2');
assert.strictEqual(toVariantId('spain2'), 'es-rev2');

// 2. Table offset verification across variants
// Map table (US: 0x1FFDE7, PAL: 0x20FDE5)
assert.strictEqual(getMapTableOffset('us'), 0x1FFDE7);
assert.strictEqual(getMapTableOffset('eu'), 0x20FDE5);
assert.strictEqual(getMapTableOffset('de'), 0x20FDE5);
assert.strictEqual(getMapTableOffset('fr'), 0x20FDE5);
assert.strictEqual(getMapTableOffset('es'), 0x20FDE5);
assert.strictEqual(getMapTableOffset('es-rev2'), 0x20FDE5);

// Map palettes (US: 0x1CC322, PAL: 0x1DC323)
assert.strictEqual(getMapPalettesOffset('us'), 0x1CC322);
assert.strictEqual(getMapPalettesOffset('eu'), 0x1DC323);
assert.strictEqual(getMapPalettesOffset('de'), 0x1DC323);
assert.strictEqual(getMapPalettesOffset('fr'), 0x1DC323);
assert.strictEqual(getMapPalettesOffset('es'), 0x1DC323);
assert.strictEqual(getMapPalettesOffset('es-rev2'), 0x1DC323);

// Map tile graphics (US/FR/ES: 0x2E0000, EU/DE: 0x2F0000)
assert.strictEqual(getMapTileGraphicsOffset('us'), 0x2E0000);
assert.strictEqual(getMapTileGraphicsOffset('eu'), 0x2F0000);
assert.strictEqual(getMapTileGraphicsOffset('de'), 0x2F0000);
assert.strictEqual(getMapTileGraphicsOffset('fr'), 0x2E0000);
assert.strictEqual(getMapTileGraphicsOffset('es'), 0x2E0000);
assert.strictEqual(getMapTileGraphicsOffset('es-rev2'), 0x2E0000);

// String keys (US: 0x11D000, PAL: 0x128000)
assert.strictEqual(getStringKeysOffset('us'), 0x11D000);
assert.strictEqual(getStringKeysOffset('eu'), 0x128000);
assert.strictEqual(getStringKeysOffset('de'), 0x128000);
assert.strictEqual(getStringKeysCount('us'), 3002);
assert.strictEqual(getStringKeysCount('de'), 3087);

// Script pointers & headers (US: 0x128294/0x128000, PAL: 0x138294/0x138000)
assert.strictEqual(getScriptPointersOffset('us'), 0x128294);
assert.strictEqual(getScriptPointersOffset('eu'), 0x138294);
assert.strictEqual(getScriptHeaderOffset('us'), 0x128000);
assert.strictEqual(getScriptHeaderOffset('eu'), 0x138000);

// Animate IDs (US: 0x043C92, EU/DE: 0x0442D2, FR/ES: 0x0342D2)
assert.strictEqual(getAnimateIdsOffset('us'), 0x043C92);
assert.strictEqual(getAnimateIdsOffset('eu'), 0x0442D2);
assert.strictEqual(getAnimateIdsOffset('de'), 0x0442D2);
assert.strictEqual(getAnimateIdsOffset('fr'), 0x0342D2);
assert.strictEqual(getAnimateIdsOffset('es'), 0x0342D2);

// Sprite blocks 16x16 (US: 0x2C0000, EU/DE: 0x2E0000, FR/ES: 0x2D0000)
assert.strictEqual(getSpriteBlocks16Offset('us'), 0x2C0000);
assert.strictEqual(getSpriteBlocks16Offset('eu'), 0x2E0000);
assert.strictEqual(getSpriteBlocks16Offset('de'), 0x2E0000);
assert.strictEqual(getSpriteBlocks16Offset('fr'), 0x2D0000);
assert.strictEqual(getSpriteBlocks16Offset('es'), 0x2D0000);

// Sprite blocks 8x8 (US/FR/ES: 0x180000, EU/DE: 0x190000)
assert.strictEqual(getSpriteBlocks8Offset('us'), 0x180000);
assert.strictEqual(getSpriteBlocks8Offset('eu'), 0x190000);
assert.strictEqual(getSpriteBlocks8Offset('de'), 0x190000);
assert.strictEqual(getSpriteBlocks8Offset('fr'), 0x180000);
assert.strictEqual(getSpriteBlocks8Offset('es'), 0x180000);

// Invariants across all retail releases
for (const v of ['us', 'eu', 'de', 'fr', 'es', 'es-rev2']) {
    assert.strictEqual(getCharacterRecordsOffset(v), 0x0EB678);
    assert.strictEqual(getEnemyIndexOffset(v), 0x0EB55A);
    assert.strictEqual(getAnimationVmDispatchOffset(v), 0x108000);
    assert.strictEqual(getSongPackagesOffset(v), 0x019903);
}

// 3. Header identification on synthetic ROM buffers
function makeRom(region, version) {
    const rom = new Uint8Array(0x10000);
    // Write HiROM header at 0xFFC0
    const title = 'SECRET OF EVERMORE   ';
    for (let i = 0; i < title.length; i++) {
        rom[0xFFC0 + i] = title.charCodeAt(i);
    }
    rom[0xFFC0 + 0x15] = 0x31; // HiROM FastROM
    rom[0xFFC0 + 0x17] = 0x0C; // 4MB
    rom[0xFFC0 + 0x19] = region;
    rom[0xFFC0 + 0x1B] = version;
    rom[0xFFC0 + 0x1C] = 0x00;
    rom[0xFFC0 + 0x1D] = 0x00;
    rom[0xFFC0 + 0x1E] = 0xFF;
    rom[0xFFC0 + 0x1F] = 0xFF; // checksum complement pair
    return rom;
}

assert.strictEqual(identifyEvermoreVariant(makeRom(0x01, 0x00)), 'us');
assert.strictEqual(identifyEvermoreVariant(makeRom(0x02, 0x00)), 'eu');
assert.strictEqual(identifyEvermoreVariant(makeRom(0x09, 0x00)), 'de');
assert.strictEqual(identifyEvermoreVariant(makeRom(0x06, 0x00)), 'fr');
assert.strictEqual(identifyEvermoreVariant(makeRom(0x08, 0x00)), 'es');
assert.strictEqual(identifyEvermoreVariant(makeRom(0x08, 0x02)), 'es-rev2');

// Dynamic access directly passing ROM buffer
const gerRom = makeRom(0x09, 0x00);
assert.strictEqual(getMapTableOffset(gerRom), 0x20FDE5);
assert.strictEqual(getMapPalettesOffset(gerRom), 0x1DC323);
assert.strictEqual(getMapTileGraphicsOffset(gerRom), 0x2F0000);
assert.strictEqual(getStringKeysOffset(gerRom), 0x128000);

// 4. Vectors and ASM dispatchers across variants
const {
    getResetVector,
    getNmiVector,
    getIrqVector,
    getScriptVmDispatcher,
    getStringDecoder,
    getRoomLoader,
} = require('../../dist/games/evermore/variant-resolver');

for (const v of ['us', 'eu', 'de', 'fr', 'es', 'es-rev2']) {
    assert.strictEqual(getResetVector(v).snes, '$00:8020');
    assert.strictEqual(getResetVector(v).vector, '$00:FFFC');
    assert.strictEqual(getResetVector(v).target, '$80:802D');
    assert.strictEqual(getNmiVector(v).snes, '$00:823A');
    assert.strictEqual(getNmiVector(v).target, '$80:823E');
    assert.strictEqual(getIrqVector(v).snes, '$00:84EA');
    assert.strictEqual(getIrqVector(v).target, '$80:84EE');
}

// Displaced ASM routines: US vs PAL
assert.strictEqual(getScriptVmDispatcher('us').snes, '$8C:D0A6');
assert.strictEqual(getScriptVmDispatcher('de').snes, '$CC:D47E');
assert.strictEqual(getStringDecoder('us').snes, '$8C:CCF5');
assert.strictEqual(getStringDecoder('de').snes, '$CC:D0B8');
assert.strictEqual(getRoomLoader('us').snes, '$90:8F60');
assert.strictEqual(getRoomLoader('de').snes, '$D0:8F65');

// 5. Test VFS resolveTables with dynamic variant addresses
const { resolveTables } = require('../../dist/games/evermore/resources/table-files');

(async () => {
    const usVfs = resolveTables(['room-pointer-table', 'info.json'], makeRom(0x01, 0x00));
    const usInfo = JSON.parse(await usVfs.read());
    assert.strictEqual(usInfo.addressHex, '$9ffde7');
    assert.strictEqual(usInfo.fileOffsetHex, '$1ffde7');

    const gerVfs = resolveTables(['room-pointer-table', 'info.json'], gerRom);
    const gerInfo = JSON.parse(await gerVfs.read());
    assert.strictEqual(gerInfo.addressHex, '$a0fde5');
    assert.strictEqual(gerInfo.fileOffsetHex, '$20fde5');

    const gerStringsVfs = resolveTables(['string-key-table', 'info.json'], gerRom);
    const gerStringsInfo = JSON.parse(await gerStringsVfs.read());
    assert.strictEqual(gerStringsInfo.addressHex, '$928000');
    assert.strictEqual(gerStringsInfo.fileOffsetHex, '$128000');

    console.log('✓ Evermore variant resolver & VFS tests passed');
})().catch(err => {
    console.error(err);
    process.exit(1);
});
