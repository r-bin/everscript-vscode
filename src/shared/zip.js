'use strict';
// Ownership: writing a .zip archive. Pure; no dependency beyond node's zlib.
//
// The subset every unzip tool reads: local file headers, a central
// directory and its end record; deflate (method 8), no zip64, no
// encryption. Enough for an export of a few small files.

const zlib = require('zlib');

let _crcTable = null;
function crc32(buf) {
    if (!_crcTable) {
        _crcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            _crcTable[n] = c >>> 0;
        }
    }
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = _crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time, as the zip headers want them. */
function dosTime(d) {
    return {
        time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
        date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
}

/**
 * `[{name, data}]` -> a zip Buffer. `data` is a Buffer, a Uint8Array or a
 * string (written as UTF-8). Names use `/` and are stored as UTF-8.
 */
function buildZip(files, when) {
    const t = dosTime(when || new Date());
    const locals = [];
    const central = [];
    let offset = 0;
    for (const f of files) {
        const name = Buffer.from(f.name, 'utf8');
        const raw = typeof f.data === 'string' ? Buffer.from(f.data, 'utf8') : Buffer.from(f.data);
        const packed = zlib.deflateRawSync(raw);
        const crc = crc32(raw);
        const head = Buffer.alloc(30);
        head.writeUInt32LE(0x04034b50, 0);
        head.writeUInt16LE(20, 4);        // version needed
        head.writeUInt16LE(0x0800, 6);    // flags: UTF-8 names
        head.writeUInt16LE(8, 8);         // deflate
        head.writeUInt16LE(t.time, 10);
        head.writeUInt16LE(t.date, 12);
        head.writeUInt32LE(crc, 14);
        head.writeUInt32LE(packed.length, 18);
        head.writeUInt32LE(raw.length, 22);
        head.writeUInt16LE(name.length, 26);
        head.writeUInt16LE(0, 28);
        locals.push(head, name, packed);

        const dir = Buffer.alloc(46);
        dir.writeUInt32LE(0x02014b50, 0);
        dir.writeUInt16LE(20, 4);         // made by
        dir.writeUInt16LE(20, 6);         // needed
        dir.writeUInt16LE(0x0800, 8);
        dir.writeUInt16LE(8, 10);
        dir.writeUInt16LE(t.time, 12);
        dir.writeUInt16LE(t.date, 14);
        dir.writeUInt32LE(crc, 16);
        dir.writeUInt32LE(packed.length, 20);
        dir.writeUInt32LE(raw.length, 24);
        dir.writeUInt16LE(name.length, 28);
        dir.writeUInt32LE(offset, 42);
        central.push(dir, name);
        offset += head.length + name.length + packed.length;
    }
    const dirBuf = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(dirBuf.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, dirBuf, end]);
}

/** Read back what buildZip wrote: `[{name, data}]`. For tests and checks. */
function readZip(buf) {
    const out = [];
    const endAt = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (endAt < 0) throw new Error('not a zip: no end record');
    const count = buf.readUInt16LE(endAt + 10);
    let p = buf.readUInt32LE(endAt + 16);
    for (let i = 0; i < count; i++) {
        if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory entry');
        const method = buf.readUInt16LE(p + 10);
        const crc = buf.readUInt32LE(p + 16);
        const size = buf.readUInt32LE(p + 20);
        const nameLen = buf.readUInt16LE(p + 28);
        const extra = buf.readUInt16LE(p + 30);
        const note = buf.readUInt16LE(p + 32);
        const local = buf.readUInt32LE(p + 42);
        const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
        const lname = buf.readUInt16LE(local + 26);
        const lextra = buf.readUInt16LE(local + 28);
        const body = buf.slice(local + 30 + lname + lextra, local + 30 + lname + lextra + size);
        const data = method === 8 ? zlib.inflateRawSync(body) : Buffer.from(body);
        if (crc32(data) !== crc) throw new Error(name + ': CRC mismatch');
        out.push({ name, data });
        p += 46 + nameLen + extra + note;
    }
    return out;
}

module.exports = { buildZip, readZip, crc32 };
