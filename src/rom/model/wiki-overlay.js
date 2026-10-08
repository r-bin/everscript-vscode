'use strict';
// Ownership: reading extra point names out of the wiki's ROM map
// (wiki/rom/Rom-Map.md, §4 "Complete ROM Memory Map"). Pure.
//
// A §4 row with size "—" is a point: `| $8C:805B | — | 🧠 Name | Area | Notes |`.
// Names the built-in list (points.js) lacks are added, so a routine documented
// in the wiki shows up in the tab without a release.

const ROW = /^\|\s*\$([0-9A-F]{2}):([0-9A-F]{4})\s*\|\s*—\s*\|\s*(\S+)\s+(.+?)\s*\|[^|]*\|\s*(.*?)\s*\|\s*$/i;

/** @returns {{bus:number, cat:string, name:string, notes:string}[]} */
function parseWikiPoints(markdown) {
    const out = [];
    for (const line of String(markdown || '').split('\n')) {
        const m = ROW.exec(line);
        if (!m) continue;
        out.push({ bus: parseInt(m[1] + m[2], 16), cat: m[3], name: m[4], notes: m[5] });
    }
    return out;
}

/** Built-in points plus the wiki's, built-in winning on the same address. */
function mergePoints(builtIn, wiki) {
    const seen = new Set(builtIn.map(p => p.bus & 0x3FFFFF));
    return builtIn.concat(wiki.filter(p => !seen.has(p.bus & 0x3FFFFF)));
}

module.exports = { parseWikiPoints, mergePoints };
