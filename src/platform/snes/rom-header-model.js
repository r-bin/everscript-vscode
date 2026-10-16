'use strict';

function readAscii(buf, offset, length) {
    return buf.slice(offset, offset + length).toString('ascii').replace(/\0+$/, '').trimEnd();
}

function readU16(buf, offset) {
    return buf[offset] | (buf[offset + 1] << 8);
}

function scoreHeaderCandidate(buf, headerOffset) {
    if (headerOffset < 0 || headerOffset + 0x30 > buf.length) return -1;
    const title = readAscii(buf, headerOffset, 21);
    const mapMode = buf[headerOffset + 0x15];
    const checksumComplement = readU16(buf, headerOffset + 0x1c);
    const checksum = readU16(buf, headerOffset + 0x1e);
    let score = 0;
    if (title && /^[\x20-\x7e]+$/.test(title)) score += 3;
    if (((checksum ^ checksumComplement) & 0xffff) === 0xffff) score += 4;
    if ([0x20, 0x21, 0x30, 0x31, 0x35].includes(mapMode)) score += 2;
    return score;
}

function decodeMapMode(mapMode) {
    const mode = mapMode & 0x0f;
    const fastRom = (mapMode & 0x10) !== 0;
    const mapType = mode === 0x00 ? 'LoROM'
        : mode === 0x01 ? 'HiROM'
        : mode === 0x05 ? 'ExHiROM'
        : 'Unknown';
    return {
        raw: mapMode,
        fastRom,
        mapType,
        description: `${fastRom ? 'FastROM ' : ''}${mapType}`.trim(),
    };
}

function parseHeaderAt(buf, headerOffset, layout) {
    const mapMode = decodeMapMode(buf[headerOffset + 0x15]);
    const romSizeShift = buf[headerOffset + 0x17];
    const ramSizeShift = buf[headerOffset + 0x18];
    return {
        layout,
        headerOffset,
        title: readAscii(buf, headerOffset, 21),
        mapMode,
        cartridgeType: buf[headerOffset + 0x16],
        romSizeCode: romSizeShift,
        romSizeBytes: romSizeShift ? (1 << romSizeShift) * 1024 : 0,
        ramSizeCode: ramSizeShift,
        ramSizeBytes: ramSizeShift ? (1 << ramSizeShift) * 1024 : 0,
        destinationCode: buf[headerOffset + 0x19],
        developerId: buf[headerOffset + 0x1a],
        version: buf[headerOffset + 0x1b],
        checksumComplement: readU16(buf, headerOffset + 0x1c),
        checksum: readU16(buf, headerOffset + 0x1e),
        nativeVectors: {
            cop: readU16(buf, headerOffset + 0x24),
            brk: readU16(buf, headerOffset + 0x26),
            abort: readU16(buf, headerOffset + 0x28),
            nmi: readU16(buf, headerOffset + 0x2a),
            reset: readU16(buf, headerOffset + 0x2c),
            irq: readU16(buf, headerOffset + 0x2e),
        },
    };
}

function parseSnesRomHeader(buf) {
    const candidates = [
        { layout: 'LoROM', offset: 0x7fc0 },
        { layout: 'HiROM', offset: 0xffc0 },
        { layout: 'ExHiROM', offset: 0x40ffc0 },
    ].filter((candidate) => candidate.offset + 0x30 <= buf.length);

    let best = null;
    for (const candidate of candidates) {
        const score = scoreHeaderCandidate(buf, candidate.offset);
        if (!best || score > best.score) best = { ...candidate, score };
    }
    if (!best || best.score < 0) return null;
    return parseHeaderAt(buf, best.offset, best.layout);
}

module.exports = {
    decodeMapMode,
    parseSnesRomHeader,
};