// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Static scans of an Evermore ROM for the tables a release keeps elsewhere: the content tables
// (string keys, map table, room enter scripts, script pointers) and the asset tables found by their
// code (palettes, tile graphics, opcode table, animate ids, sprite blocks, song packages).
// analyze-variant.js runs them and checks the results headlessly.

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

function analyzeMapPalettes(rom) {
    for (let i = 0x100000; i < 0x110000; i++) {
        if (rom[i] === 0x0A && rom[i + 1] === 0x0A && rom[i + 2] === 0x0A && rom[i + 3] === 0x0A && rom[i + 4] === 0x0A && rom[i + 5] === 0x69) {
            const off = u16(rom, i + 6);
            for (let j = i + 8; j < i + 35; j++) {
                if (rom[j] === 0xA9 && rom[j + 1] >= 0x90) {
                    const bank = rom[j + 1];
                    const snes = (bank << 16) | off;
                    const pc1 = romToSnes(i + 5);
                    const pc2 = romToSnes(j);
                    return {
                        snes: `$${hex(bank)}:${hex(off, 4)}`,
                        file: `0x${hex(snesToRom(snes), 6)}`,
                        count: 365,
                        readers: [
                            { pc: `$${hex(pc1 >> 16)}:${hex(pc1 & 0xFFFF, 4)}`, file: `0x${hex(i + 5, 6)}`, asm: `adc #$${hex(off, 4)}` },
                            { pc: `$${hex(pc2 >> 16)}:${hex(pc2 & 0xFFFF, 4)}`, file: `0x${hex(j, 6)}`, asm: `lda #$${hex(bank)}` }
                        ]
                    };
                }
            }
        }
    }
    return null;
}

function analyzeMapTileGraphics(rom) {
    for (let i = 0x100000; i < 0x110000; i++) {
        if (rom[i] === 0xBF && rom[i + 2] === 0x00 && (rom[i + 3] === 0xEE || rom[i + 3] === 0xEF)) {
            const ptr = u24(rom, i + 1);
            const pc = romToSnes(i);
            return {
                snes: `$${hex(ptr >> 16)}:${hex(ptr & 0xFFFF, 4)}`,
                file: `0x${hex(snesToRom(ptr), 6)}`,
                count: 6688,
                readers: [{ pc: `$${hex(pc >> 16)}:${hex(pc & 0xFFFF, 4)}`, file: `0x${hex(i, 6)}`, asm: `lda.l $${hex(ptr, 6)},x` }]
            };
        }
    }
    return null;
}

function analyzeScriptOpcodeTable(rom) {
    for (let i = 0x0CD000; i < 0x0CE000; i++) {
        if (rom[i] === 0xAA && rom[i + 1] === 0xFC) {
            const addr = u16(rom, i + 2);
            const pc = romToSnes(i + 1);
            return {
                snes: `$8C:${hex(addr, 4)}`,
                file: `0x${hex(snesToRom(((0x8C << 16) | addr)), 6)}`,
                count: 176,
                readers: [{ pc: `$${hex(pc >> 16)}:${hex(pc & 0xFFFF, 4)}`, file: `0x${hex(i + 1, 6)}`, asm: `jsr ($${hex(addr, 4)},x)` }]
            };
        }
    }
    return null;
}

function analyzeAnimateIds(rom) {
    for (let i = 0x0C0000; i < 0x0E0000; i++) {
        if (rom[i] === 0xFA && rom[i + 1] === 0x30 && rom[i + 2] === 0x06 && rom[i + 3] === 0xBF) {
            const ptr = u24(rom, i + 4);
            const pc = romToSnes(i + 3);
            return {
                snes: `$${hex(ptr >> 16)}:${hex(ptr & 0xFFFF, 4)}`,
                file: `0x${hex(snesToRom(ptr), 6)}`,
                count: 212,
                readers: [{ pc: `$${hex(pc >> 16)}:${hex(pc & 0xFFFF, 4)}`, file: `0x${hex(i + 3, 6)}`, asm: `lda.l $${hex(ptr, 6)},x` }]
            };
        }
    }
    return null;
}

function analyzeSpriteBlocks(rom) {
    let sb16 = null, sb8 = null;
    for (let i = 0x008000; i < 0x00B000; i++) {
        if (rom[i] === 0xBF && (rom[i + 3] >= 0xEC && rom[i + 3] <= 0xEE) && rom[i + 1] === 0x00 && rom[i + 2] === 0x00) {
            const ptr = u24(rom, i + 1);
            const pc = romToSnes(i);
            sb16 = {
                snes: `$${hex(ptr >> 16)}:${hex(ptr & 0xFFFF, 4)}`,
                file: `0x${hex(snesToRom(ptr), 6)}`,
                count: 4854,
                readers: [{ pc: `$${hex(pc >> 16)}:${hex(pc & 0xFFFF, 4)}`, file: `0x${hex(i, 6)}`, asm: `lda.l $${hex(ptr, 6)},x` }]
            };
        }
        if (rom[i] === 0xBF && (rom[i + 3] === 0xD8 || rom[i + 3] === 0xD9) && rom[i + 1] === 0x00 && rom[i + 2] === 0x00) {
            const ptr = u24(rom, i + 1);
            const pc = romToSnes(i);
            sb8 = {
                snes: `$${hex(ptr >> 16)}:${hex(ptr & 0xFFFF, 4)}`,
                file: `0x${hex(snesToRom(ptr), 6)}`,
                count: 6265,
                readers: [{ pc: `$${hex(pc >> 16)}:${hex(pc & 0xFFFF, 4)}`, file: `0x${hex(i, 6)}`, asm: `lda.l $${hex(ptr, 6)},x` }]
            };
        }
    }
    return { sb16, sb8 };
}

function analyzeSongPackages(rom) {
    const count = rom[0x019900] + 1;
    return {
        snes: '$81:9903',
        file: '0x019903',
        count,
        countByte: '$81:9900'
    };
}

module.exports = { hex, readHeader, analyzeStringKeys, analyzeMapTable, analyzeRoomEnterScripts, analyzeScriptPointers, analyzeMapPalettes, analyzeMapTileGraphics, analyzeScriptOpcodeTable, analyzeAnimateIds, analyzeSpriteBlocks, analyzeSongPackages };
