// CRC-32 (IEEE 802.3, the one PNG, zip and the TAS movie formats use). The one copy (docs/cleanup.md 5.1).

const TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

/** Running CRC over more bytes; start with 0xFFFFFFFF, end with `crc32Finish`. */
export function crc32Update(crc: number, bytes: ArrayLike<number>): number {
    for (let i = 0; i < bytes.length; i++) crc = TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return crc >>> 0;
}

export function crc32Finish(crc: number): number {
    return (crc ^ 0xffffffff) >>> 0;
}

export function crc32(bytes: ArrayLike<number>): number {
    return crc32Finish(crc32Update(0xffffffff, bytes));
}
