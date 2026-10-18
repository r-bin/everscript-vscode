'use strict';
/**
 * Variant Analyzer for Secret of Evermore
 *
 * Performs static pattern scanning and headless emulator verification on an Evermore ROM
 * to locate and verify the 4 core content tables:
 *   1. string_keys
 *   2. map_table
 *   3. room_enter_scripts
 *   4. script_pointers
 *
 * Usage:
 *   node tools/variants/analyze-variant.js "/path/to/rom.sfc" [--write]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { hex, readHeader, analyzeStringKeys, analyzeMapTable, analyzeRoomEnterScripts, analyzeScriptPointers, analyzeMapPalettes, analyzeMapTileGraphics, analyzeScriptOpcodeTable, analyzeAnimateIds, analyzeSpriteBlocks, analyzeSongPackages } = require('./variant-scans');

async function runHeadlessBoot(romPath) {
    const CORE = path.join(__dirname, '../../src/core/emulator/core/snes9x2005-wasm/snes9x_2005.js');
    if (!fs.existsSync(CORE)) return { verified: false, error: 'snes9x core not found' };

    return new Promise((resolve) => {
        const transitions = [];
        let completed = false;

        function finish(res) {
            if (completed) return;
            completed = true;
            resolve(res);
        }

        const wasmPath = path.join(path.dirname(CORE), 'snes9x_2005.wasm');
        const wasmBinary = fs.readFileSync(wasmPath);
        const coreCode = fs.readFileSync(CORE, 'utf8');
        // Run core in isolated vm context to prevent variable conflicts
        const sandbox = {
            console,
            require,
            Buffer,
            setTimeout,
            clearTimeout,
            __dirname: path.dirname(CORE),
            __filename: CORE,
            Module: {
                wasmBinary,
                locateFile: f => path.join(path.dirname(CORE), f),
                onRuntimeInitialized: () => {
                    try {
                        const M = sandbox.Module;
                        const romBuf = fs.readFileSync(romPath);
                        const p = M._my_malloc(romBuf.length);
                        sandbox.HEAPU8.set(romBuf, p);
                        M._startWithRom(p, romBuf.length, 32040);

                        let lastRoom = -1;
                        for (let f = 0; f < 800; f++) {
                            M._mainLoop();
                            const r = M.readMemory(0x7E0ADB);
                            if (r !== lastRoom) {
                                transitions.push({ frame: f, room: `0x${hex(r)}` });
                                lastRoom = r;
                            }
                        }
                        finish({ verified: true, transitions });
                    } catch (err) {
                        finish({ verified: false, error: err.message });
                    }
                },
            },
        };

        const ctx = vm.createContext(sandbox);
        try {
            vm.runInContext(coreCode, ctx, { filename: CORE });
        } catch (err) {
            finish({ verified: false, error: err.message });
        }
    });
}

async function main() {
    const args = process.argv.slice(2);
    let romPath = args.find(a => !a.startsWith('--'));
    const doWrite = args.includes('--write');

    if (!romPath) {
        const os = require('os');
        const variantsDir = process.env.SOE_VARIANTS_DIR || path.join(os.homedir(), 'romhacking', 'evermore variants');
        romPath = path.join(variantsDir, 'Secret of Evermore (Germany).sfc');
    }

    if (!fs.existsSync(romPath)) {
        console.error(`ROM not found at: ${romPath}`);
        process.exit(1);
    }

    const rom = fs.readFileSync(romPath);
    const sha1 = crypto.createHash('sha1').update(rom).digest('hex');
    const header = readHeader(rom);

    console.log(`Analyzing: ${path.basename(romPath)}`);
    console.log(`SHA-1:   ${sha1}`);
    console.log(`Header:  ${header.title} (Region: 0x${hex(header.region)}, Version: 0x${hex(header.version)}, Checksum: $${hex(header.checksum, 4)})`);

    const stringKeys = analyzeStringKeys(rom);
    const mapTable = analyzeMapTable(rom);
    const mapPalettes = analyzeMapPalettes(rom);
    const mapTileGraphics = analyzeMapTileGraphics(rom);
    const roomEnter = analyzeRoomEnterScripts(rom);
    const scriptPointers = analyzeScriptPointers(rom);
    const scriptOpcode = analyzeScriptOpcodeTable(rom);
    const animateIds = analyzeAnimateIds(rom);
    const { sb16, sb8 } = analyzeSpriteBlocks(rom);
    const songPackages = analyzeSongPackages(rom);

    console.log('\n--- 1. string_keys ---');
    console.log(stringKeys);
    console.log('\n--- 2. map_table ---');
    console.log(mapTable);
    console.log('\n--- 3. map_palettes ---');
    console.log(mapPalettes);
    console.log('\n--- 4. map_tile_graphics ---');
    console.log(mapTileGraphics);
    console.log('\n--- 5. room_enter_scripts ---');
    console.log(roomEnter);
    console.log('\n--- 6. script_pointers ---');
    console.log(scriptPointers);
    console.log('\n--- 7. script_opcode_table ---');
    console.log(scriptOpcode);
    console.log('\n--- 8. animate_ids ---');
    console.log(animateIds);
    console.log('\n--- 9. sprite_blocks_16 & 8 ---');
    console.log({ sb16, sb8 });
    console.log('\n--- 10. song_packages ---');
    console.log(songPackages);

    console.log('\n--- Headless Emulator Verification ---');
    const emu = await runHeadlessBoot(romPath);
    console.log('Boot trace:', emu);

    // Determine variant id from sha1 or region
    let variantId = 'unknown';
    if (sha1 === '79e7738630fff5699217ef58ecc421bc8fcbcd89') variantId = 'us';
    else if (sha1 === '5e5c2082526690d05f962c3ffbd7e080c681bfa4') variantId = 'germany';
    else if (sha1 === 'ae17166919fdfdf26cc5771f83cfd19eaf71806c') variantId = 'europe';
    else if (sha1 === '8a430c9d6a3dcef974252fe8d946a0d619bb1a61') variantId = 'france';
    else if (sha1 === '4363ce4b19e76261f9325ac9a0cce27d97490df2') variantId = 'spain1';
    else if (sha1 === 'c29fe997740bd9b54a07fba7b2b5442a49245aac') variantId = 'spain2';

    if (doWrite && variantId !== 'unknown') {
        const jsonPath = path.join(__dirname, '../../src/games/evermore/variants.json');
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        if (stringKeys) {
            data.string_keys.variants[variantId] = {
                snes: stringKeys.snes,
                file: stringKeys.file,
                count: stringKeys.count,
                plainCount: stringKeys.plainCount,
                readers: stringKeys.readers,
                notes: `Discovered from signature A9 bb 00 85 28 A0 aa aa. Sample plain strings: ${stringKeys.sampleStrings.map(s => s.text).slice(0, 3).join(', ')}.`
            };
        }
        if (mapTable) {
            data.map_table.variants[variantId] = {
                snes: mapTable.snes,
                file: mapTable.file,
                count: mapTable.count,
                readers: mapTable.readers,
                notes: `Discovered from room blob loader signature. Room 0x61 points to blob at ${mapTable.sampleRooms[2].file}.`
            };
        }
        if (roomEnter) {
            data.room_enter_scripts.variants[variantId] = {
                snes: roomEnter.snes,
                file: roomEnter.file,
                count: roomEnter.count,
                readers: roomEnter.readers,
                notes: `Discovered from enter script multiplier routine.`
            };
        }
        if (scriptPointers) {
            data.script_pointers.variants[variantId] = {
                snes: scriptPointers.snes,
                file: scriptPointers.file,
                headerSnes: scriptPointers.headerSnes,
                headerFile: scriptPointers.headerFile,
                count: scriptPointers.count,
                readers: scriptPointers.readers,
                notes: `Script bank header at ${scriptPointers.headerSnes}, global pointer table at ${scriptPointers.snes}.`
            };
        }

        fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
        console.log(`\nUpdated ${jsonPath} with variant "${variantId}".`);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
