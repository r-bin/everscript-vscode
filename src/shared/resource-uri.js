'use strict';
// Ownership: the grammar of `soe://` resource addresses. Pure: no VS Code API,
// no ROM access. docs/soe-filesystem-spec.md.
//
//   soe://<authority>/<segment>/<segment>?rom=vanilla
//
// The authority names the memory (`rom` = the cartridge, `ram` = the running
// emulator's WRAM), the path names what is read, the query names where it is
// read from. Every number in a path is hex without `$`.

const SCHEME = 'soe';

/** Split a URI's parts into what the file system routes on. */
function parseSoeParts(authority, path, query) {
    const segments = String(path || '').split('/').filter(Boolean).map(s => decodeURIComponent(s));
    const params = new URLSearchParams(String(query || ''));
    return { authority: String(authority || '').toLowerCase(), segments, rom: params.get('rom') };
}

/**
 * A file name that addresses bytes: `128000.bin`, `c4601f[20].bin`,
 * `2441.json`, `2258.0.json`. The length in brackets is hex like the address.
 * Null when the name is not of that shape.
 */
function parseAddressName(name) {
    const m = /^([0-9a-f]{1,6})(?:\[([0-9a-f]{1,5})\])?(?:\.([0-7]))?\.(bin|json)$/i.exec(String(name));
    if (!m) return null;
    const len = m[2] === undefined ? null : parseInt(m[2], 16);
    if (len === 0) return null;
    return {
        addr: parseInt(m[1], 16),
        len,
        bit: m[3] === undefined ? null : Number(m[3]),
        ext: m[4].toLowerCase(),
    };
}

/** `name` as a path segment: `MUD_PEPPER` and `Acid Rain` → `mud_pepper`, `acid_rain`. */
function slugify(name) {
    return String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** `0x38`, 2 → `38`: the hex spelling every path uses. */
function hexId(n, width) {
    return n.toString(16).padStart(width, '0');
}

module.exports = { SCHEME, parseSoeParts, parseAddressName, slugify, hexId };
