// Ownership: Secret of Mana 2D spatial map decompressor.
//
// Pure TypeScript port of SomMapCompressor.cs for decoding 2D map piece chunks
// stored across ROM Banks $0C, $0D, $0E, and $0F in Secret of Mana.
// Reference: docs/map-format/secret-of-mana-comparison-and-porting.md §1.4.

export interface DecodedMapPiece {
    width: number;
    height: number;
    data: Uint8Array;
}

interface MapStackInfo {
    stackWidth: number;
    stackHeight: number;
    data: Uint8Array;
    positions: number[];
}

/**
 * Decompress a Secret of Mana map chunk using the 2D spatial opcode algorithm.
 *
 * Byte range operations:
 * - 0x00..0xBF: Literal uncompressed metatile byte (0..191)
 * - 0xC0..0xC7: Repeat 1..8 times: previous decoded byte (decomp - 1)
 * - 0xC8..0xCF: Repeat 1..8 times: 2nd previous decoded byte (decomp - 2)
 * - 0xD0..0xD7: Repeat 1..8 times: 3rd previous decoded byte (decomp - 3)
 * - 0xD8..0xDF: Repeat 1..8 times: 4th previous decoded byte (decomp - 4)
 * - 0xE0 + m:   Copy from row above (m < 0x80) or 2 rows above (m >= 0x80)
 * - 0xE1..0xE7: Repeat 2..8 times: copy tile from row above
 * - 0xE8..0xEF + m: Pattern repeat from sliding buffer of previous 16 bytes
 * - 0xF0 + m:   Sequential tile index increment or decrement run
 * - 0xF1..0xF7: Sequential tile increment run (2..8 times)
 * - 0xF8..0xFD: Stack positions for multi-cell stamps
 * - 0xFE..0xFF: Stack piece definition
 */
export function decodeMapPiece(data: Uint8Array): DecodedMapPiece | null {
    if (!data || data.length < 2) return null;

    const mapStack: MapStackInfo[] = [];
    let inputPos = 0;
    const wRaw = data[inputPos++];
    const hRaw = data[inputPos++];
    const width = Math.floor(wRaw / 2) + 1;
    const height = Math.floor(hRaw / 2) + 1;
    const total = width * height;
    const out = new Uint8Array(total);
    let soFar = 0;

    while (soFar < total && inputPos < data.length) {
        const b = data[inputPos++];
        if (b >= 0xC0 && b <= 0xC7) {
            const count = b - 0xBF;
            for (let i = 0; i < count; i++) {
                if (soFar < total && soFar - (1 + i) >= 0) {
                    out[soFar] = out[soFar - (1 + i)];
                }
                soFar++;
            }
        } else if (b >= 0xC8 && b <= 0xCF) {
            const count = b - 0xC7;
            for (let i = 0; i < count; i++) {
                if (soFar < total && soFar - (2 + i) >= 0) {
                    out[soFar] = out[soFar - (2 + i)];
                }
                soFar++;
            }
        } else if (b >= 0xD0 && b <= 0xD7) {
            const count = b - 0xCF;
            for (let i = 0; i < count; i++) {
                if (soFar < total && soFar - (3 + i) >= 0) {
                    out[soFar] = out[soFar - (3 + i)];
                }
                soFar++;
            }
        } else if (b >= 0xD8 && b <= 0xDF) {
            const count = b - 0xD7;
            for (let i = 0; i < count; i++) {
                if (soFar < total && soFar - (4 + i) >= 0) {
                    out[soFar] = out[soFar - (4 + i)];
                }
                soFar++;
            }
        } else if (b === 0xE0) {
            const m = data[inputPos++];
            if (m < 0x80) {
                for (let i = 0; i <= m; i++) {
                    if (soFar < total && soFar - width >= 0) {
                        out[soFar] = out[soFar - width];
                    }
                    soFar++;
                }
            } else {
                const cnt = m % 0x80;
                for (let i = 0; i <= cnt; i++) {
                    if (soFar < total && soFar - (2 * width) >= 0) {
                        out[soFar] = out[soFar - (2 * width)];
                    }
                    soFar++;
                }
            }
        } else if (b >= 0xE1 && b <= 0xE7) {
            const count = b - 0xDF;
            for (let i = 0; i < count; i++) {
                if (soFar < total && soFar - width >= 0) {
                    out[soFar] = out[soFar - width];
                }
                soFar++;
            }
        } else if (b >= 0xE8 && b <= 0xEF) {
            const m = data[inputPos++];
            const word = new Uint8Array(16);
            for (let i = 0; i < 16; i++) {
                if (soFar - i - 1 >= 0) {
                    word[i] = out[soFar - i - 1];
                } else {
                    word[i] = 0;
                }
            }
            const iterations = (m % 0x80) + 1;
            for (let i = 0; i < iterations; i++) {
                if (b === 0xE8 && m < 0x80) {
                    if (soFar < total) out[soFar] = word[0];
                } else {
                    const numofprevs = 2 * (b - 0xE8) + Math.floor(m / 0x80);
                    const index = numofprevs - (i % (numofprevs + 1));
                    if (soFar < total) out[soFar] = word[index];
                }
                soFar++;
            }
        } else if (b === 0xF0) {
            let m = data[inputPos++];
            let upward = true;
            if (m >= 128) {
                m -= 128;
                upward = false;
            }
            for (let i = 0; i <= m; i++) {
                if (upward) {
                    if (soFar < total && soFar - (1 + i) >= 0) {
                        out[soFar] = (out[soFar - (1 + i)] + i + 1) & 0xFF;
                    }
                } else {
                    if (soFar < total && soFar - (1 + i) >= 0) {
                        out[soFar] = (out[soFar - (1 + i)] - i - 1) & 0xFF;
                    }
                }
                soFar++;
            }
        } else if (b >= 0xF1 && b <= 0xF7) {
            const count = b - 0xEF;
            for (let i = 0; i < count; i++) {
                if (soFar < total && soFar - (1 + i) >= 0) {
                    out[soFar] = (out[soFar - (1 + i)] + i + 1) & 0xFF;
                }
                soFar++;
            }
        } else if (b >= 0xF8 && b <= 0xFD) {
            const thisIndex = b - 0xF8;
            if (thisIndex < mapStack.length) {
                mapStack[thisIndex].positions.push(soFar);
                soFar++;
            }
        } else if (b === 0xFE || b === 0xFF) {
            const settings = out[0];
            const sWidth = (settings & 0x0F) + 1;
            const sHeight = ((settings & 0xF0) >> 4) + 1;
            const stackData = new Uint8Array(sWidth * sHeight);
            let sX = 0;
            let sY = 0;
            while (sY < sHeight) {
                if (sX + sY * sWidth + 1 < out.length) {
                    stackData[sY * sWidth + sX] = out[sX + sY * sWidth + 1];
                }
                sX++;
                if (sX >= sWidth) {
                    sX = 0;
                    sY++;
                }
            }
            soFar -= (sWidth * sHeight + 1);
            if (soFar < 0) soFar = 0;
            mapStack.push({ stackWidth: sWidth, stackHeight: sHeight, data: stackData, positions: [] });
        } else {
            out[soFar] = b;
            soFar++;
        }
    }

    for (const msi of mapStack) {
        for (const pos of msi.positions) {
            for (let y = 0; y < msi.stackHeight; y++) {
                for (let x = 0; x < msi.stackWidth; x++) {
                    const destIndex = pos + x + y * width;
                    if (destIndex < out.length) {
                        out[destIndex] = msi.data[y * msi.stackWidth + x];
                    }
                }
            }
        }
    }

    return { width, height, data: out };
}
