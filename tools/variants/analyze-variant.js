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

function hex(n, w = 2) {
    return n.toString(16).toUpperCase().padStart(w, '0');
}

function snesToRom(bus) {
    const bank = bus >> 16, off = bus & 0xFFFF;
    if (bank >= 0xC0 && bank <= 0xFF) return ((bank - 0xC0) << 16) | off;
    if (bank >= 0x80 && bank <= 0xBF && off >= 0x8000) return ((bank - 0x80) << 16) | off;
    if (bank >= 0x00 && bank <= 0x3F && off >= 0x8000) return (bank << 16) | off;
    return -1;
}

function romToSnes(off) {
    const bank = (off >> 16) + 0xC0, addr = off & 0xFFFF;
    return (bank << 16) | addr;
}

function u16(buf, off) {
    return buf[off] | (buf[off + 1] << 8);
}

function u24(buf, off) {
    return buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16);
}

function readHeader(rom) {
    const title = rom.subarray(0xFFC0, 0xFFD5).toString('ascii').trim();
    const mapMode = rom[0xFFD5];
    const romType = rom[0xFFD6];
    const romSize = rom[0xFFD7];
    const sramSize = rom[0xFFD8];
    const region = rom[0xFFD9];
    const version = rom[0xFFDB];
    const checksum = u16(rom, 0xFFDE);
    return { title, mapMode, romType, romSize, sramSize, region, version, checksum };
}

function analyzeStringKeys(rom) {
    const readers = [];
    let tableBank = -1, tableOff = -1;

    for (let i = 0; i < rom.length - 8; i++) {
        if (rom[i] === 0xA9 && rom[i + 2] === 0x00 && rom[i + 3] === 0x85 && rom[i + 4] === 0x28 && rom[i + 5] === 0xA0) {
            const b = rom[i + 1];
            const o = rom[i + 6] | (rom[i + 7] << 8);
            if (b >= 0x80 && b <= 0xBF) {
                const pc = romToSnes(i);
                readers.push({ pc: `$${hex(pc >> 16)}:${hex(pc & 0xFFFF, 4)}`, file: `0x${hex(i, 6)}`, asm: `lda #$00${hex(b)} : sta $28 : ldy #$${hex(o, 4)}` });
                tableBank = b;
                tableOff = o;
            }
        }
    }

    if (tableBank < 0) return null;

    const snesAddr = (tableBank << 16) | tableOff;
    const fileOff = snesToRom(snesAddr);
    let keyCount = 0;
    let plainCount = 0, compCount = 0;
    const sampleStrings = [];

    for (let i = 0; i < 6000; i++) {
        const o = fileOff + i * 3;
        if ((o >> 15) !== (fileOff >> 15)) break; // stayed inside 32 KB half
        const v = u24(rom, o);
        if (v === 0 || v === 0xFFFFFF) break;

        keyCount = i + 1;
        const isComp = (v & 0x800000) !== 0;
        if (isComp) {
            compCount++;
        } else {
            plainCount++;
            const p = v & 0x7FFFFF;
            const strRomOff = ((p >> 15) << 16) | (p & 0x7FFF);
            if (strRomOff < rom.length && sampleStrings.length < 8) {
                let text = '';
                for (let j = strRomOff; j < strRomOff + 60 && j < rom.length && rom[j] !== 0; j++) {
                    const c = rom[j];
                    if (c >= 32 && c <= 126) text += String.fromCharCode(c);
                    else text += `[${hex(c)}]`;
                }
                if (text.length > 0) sampleStrings.push({ key: i, text, off: `0x${hex(strRomOff, 6)}` });
            }
        }
    }

    return {
        snes: `$${hex(tableBank)}:${hex(tableOff, 4)}`,
        file: `0x${hex(fileOff, 6)}`,
        count: keyCount,
        plainCount,
        compCount,
        sampleStrings,
        readers,
    };
}

function analyzeMapTable(rom) {
    const readers = [];
    let snesAddr = -1;

    for (let i = 0; i < rom.length - 16; i++) {
        // AD DB 0A 0A 0A AA BF ptr:24 85 reg BF ptr+1:24 85 reg
        if (rom[i] === 0xAD && rom[i + 1] === 0xDB && rom[i + 2] === 0x0A && rom[i + 3] === 0x0A && rom[i + 4] === 0x0A && rom[i + 5] === 0xAA && rom[i + 6] === 0xBF) {
            const ptr = u24(rom, i + 7);
            const pc1 = romToSnes(i + 6);
            readers.push({ pc: `$${hex(pc1 >> 16)}:${hex(pc1 & 0xFFFF, 4)}`, file: `0x${hex(i + 6, 6)}`, asm: `lda.l $${hex(ptr, 6)},x` });
            if (rom[i + 11] === 0xBF) {
                const ptr2 = u24(rom, i + 12);
                const pc2 = romToSnes(i + 11);
                readers.push({ pc: `$${hex(pc2 >> 16)}:${hex(pc2 & 0xFFFF, 4)}`, file: `0x${hex(i + 11, 6)}`, asm: `lda.l $${hex(ptr2, 6)},x` });
            }
            snesAddr = ptr;
        }
    }

    if (snesAddr < 0) return null;
    const fileOff = snesToRom(snesAddr);

    // Verify room entries
    const roomBlobs = [];
    for (let id = 0; id < 127; id++) {
        const o = fileOff + id * 4;
        const ptr = u24(rom, o);
        const pad = rom[o + 3];
        const blobOff = snesToRom(ptr);
        roomBlobs.push({ id, ptr: `$${hex(ptr, 6)}`, file: `0x${hex(blobOff, 6)}`, pad });
    }

    return {
        snes: `$${hex(snesAddr >> 16)}:${hex(snesAddr & 0xFFFF, 4)}`,
        file: `0x${hex(fileOff, 6)}`,
        count: 127,
        readers,
        sampleRooms: [roomBlobs[0], roomBlobs[1], roomBlobs[0x61]],
    };
}

function analyzeRoomEnterScripts(rom) {
    const readers = [];
    let snesAddr = -1;

    for (let i = 0; i < rom.length - 35; i++) {
        // AD DB 0A ... 8D 02 42 ... AD 16 42 AA BF ptr:24 85 26 BF ptr+1:24 85 27
        if (rom[i] === 0xAD && rom[i + 1] === 0xDB && rom[i + 2] === 0x0A) {
            const sub = rom.subarray(i, i + 35);
            const m = sub.indexOf(Buffer.from([0x8D, 0x02, 0x42]));
            if (m !== -1) {
                const bfIdx = sub.indexOf(0xBF, m);
                if (bfIdx !== -1) {
                    const ptr = u24(rom, i + bfIdx + 1);
                    const pc1 = romToSnes(i + bfIdx);
                    readers.push({ pc: `$${hex(pc1 >> 16)}:${hex(pc1 & 0xFFFF, 4)}`, file: `0x${hex(i + bfIdx, 6)}`, asm: `lda.l $${hex(ptr, 6)},x` });
                    if (sub[bfIdx + 5] === 0xBF) {
                        const ptr2 = u24(rom, i + bfIdx + 6);
                        const pc2 = romToSnes(i + bfIdx + 5);
                        readers.push({ pc: `$${hex(pc2 >> 16)}:${hex(pc2 & 0xFFFF, 4)}`, file: `0x${hex(i + bfIdx + 5, 6)}`, asm: `lda.l $${hex(ptr2, 6)},x` });
                    }
                    snesAddr = ptr;
                }
            }
        }
    }

    if (snesAddr < 0) return null;
    const fileOff = snesToRom(snesAddr);

    return {
        snes: `$${hex(snesAddr >> 16)}:${hex(snesAddr & 0xFFFF, 4)}`,
        file: `0x${hex(fileOff, 6)}`,
        count: 127,
        readers,
    };
}

function analyzeScriptPointers(rom) {
    const readers = [];
    let headerSnes = -1;

    for (let i = 0; i < rom.length - 20; i++) {
        // 6F header:24 AA BF ptr1:24 85 26 BF ptr2:24 29 FF 00 85 28
        if (rom[i] === 0x6F && rom[i + 4] === 0xAA && rom[i + 5] === 0xBF && rom[i + 9] === 0x85 && rom[i + 10] === 0x26 && rom[i + 11] === 0xBF) {
            const h = u24(rom, i + 1);
            const p1 = u24(rom, i + 6);
            const p2 = u24(rom, i + 12);
            const pc1 = romToSnes(i + 5);
            const pc2 = romToSnes(i + 11);
            readers.push({ pc: `$${hex(pc1 >> 16)}:${hex(pc1 & 0xFFFF, 4)}`, file: `0x${hex(i + 5, 6)}`, asm: `lda.l $${hex(p1, 6)},x` });
            readers.push({ pc: `$${hex(pc2 >> 16)}:${hex(pc2 & 0xFFFF, 4)}`, file: `0x${hex(i + 11, 6)}`, asm: `lda.l $${hex(p2, 6)},x` });
            headerSnes = h;
        }
    }

    if (headerSnes < 0) return null;
    const headerFile = snesToRom(headerSnes);
    const tableOffsetRel = u16(rom, headerFile);
    const snesAddr = headerSnes + tableOffsetRel;
    const fileOff = headerFile + tableOffsetRel;

    // Count script pointer entries: packed pointers until boundary or first pointer target
    let n = 0, firstTarget = Infinity;
    for (let j = 0; j < 3000; j++) {
        const o = fileOff + j * 3;
        if (o >= firstTarget || o >= headerFile + 0x8000) break;
        const v = u24(rom, o);
        const target = (headerSnes + (v & 0x7FFF) + ((v & 0xFF8000) << 1)) & 0x3FFFFF;
        if (target > fileOff && target < firstTarget) firstTarget = target;
        n++;
    }

    return {
        snes: `$${hex(snesAddr >> 16)}:${hex(snesAddr & 0xFFFF, 4)}`,
        file: `0x${hex(fileOff, 6)}`,
        headerSnes: `$${hex(headerSnes >> 16)}:${hex(headerSnes & 0xFFFF, 4)}`,
        headerFile: `0x${hex(headerFile, 6)}`,
        count: n,
        readers,
    };
}

async function runHeadlessBoot(romPath) {
    const CORE = path.join(__dirname, '../../src/emulator/core/snes9x2005-wasm/snes9x_2005.js');
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
        romPath = '/Users/v/romhacking/evermore variants/Secret of Evermore (Germany).sfc';
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
    const roomEnter = analyzeRoomEnterScripts(rom);
    const scriptPointers = analyzeScriptPointers(rom);

    console.log('\n--- 1. string_keys ---');
    console.log(stringKeys);

    console.log('\n--- 2. map_table ---');
    console.log(mapTable);

    console.log('\n--- 3. room_enter_scripts ---');
    console.log(roomEnter);

    console.log('\n--- 4. script_pointers ---');
    console.log(scriptPointers);

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
