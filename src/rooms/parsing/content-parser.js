'use strict';
// Ownership: parsing .evs map block text → room entity data (initMap, entrances, enemies, objects, transitions).
// Pure function: reads one file, returns structured data. No caching, no side effects.

const fs = require('fs');
const { parseEvsNum } = require('../../shared/radar-utils');

/**
 * Parse the content of a single map block from a .evs file.
 * @param {string}  filePath  Absolute path to the .evs file.
 * @param {number}  startLine 0-based line of the opening `map NAME(...) {`.
 * @param {number}  endLine   0-based line of the closing `}`.
 * @returns {{initMap, entrances, enemies, objects, transitions, triggerNames}}
 */
function parseRoomContent(filePath, startLine, endLine) {
    let lines;
    try { lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/); }
    catch { return { initMap: null, entrances: [], enemies: [], objects: [], transitions: [] }; }

    const out = {
        initMap: null,
        entrances: [],
        enemies: [],
        objects: [],
        transitions: [],
        triggerNames: { stepOn: [], bTrigger: [] },
    };
    const objSeen = new Set();
    const objDesc = new Map();
    let inStepOnEnum = false, inBTrigEnum = false, enumDepth = 0;
    const end = Math.min(endLine, lines.length - 1);

    for (let i = startLine; i <= end; i++) {
        const raw = lines[i];
        const inlineCommentM = raw.match(/\/\/(.*)$/);
        const comment = inlineCommentM ? inlineCommentM[1].trim() : '';
        const t = raw.replace(/\/\/.*$/, '').trim();

        // Enum member name tracking for stepon_trigger / b_trigger
        if (!inStepOnEnum && !inBTrigEnum) {
            const em = t.match(/\benum\s+(stepon_trigger|b_trigger)\b/);
            if (em) { inStepOnEnum = em[1] === 'stepon_trigger'; inBTrigEnum = !inStepOnEnum; enumDepth = 0; }
        }
        if (inStepOnEnum || inBTrigEnum) {
            const prevD = enumDepth;
            for (const c of t) { if (c === '{') enumDepth++; else if (c === '}') enumDepth--; }
            if (prevD === 1) {
                const mm = t.match(/^\s*([A-Za-z_]\w*)\s*=/);
                if (mm) {
                    if (inStepOnEnum) out.triggerNames.stepOn.push(mm[1]);
                    else              out.triggerNames.bTrigger.push(mm[1]);
                }
            }
            if (enumDepth <= 0) { inStepOnEnum = inBTrigEnum = false; enumDepth = 0; }
        }

        // Commented object descriptions: // object[N] = val; // description
        const commentedObjM = comment.match(/\bobject\[(\w+)\]\s*=\s*[^;]+;?\s*(?:\/\/\s*(.+))?/);
        if (commentedObjM) {
            const idx = commentedObjM[1];
            const desc = commentedObjM[2] ? commentedObjM[2].trim() : '';
            if (!objDesc.has(idx) && desc) objDesc.set(idx, desc);
        }

        // init_map(x1, y1, x2, y2)
        if (!out.initMap) {
            const m = t.match(/\binit_map\s*\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)\)/);
            if (m) out.initMap = { x1: parseEvsNum(m[1]), y1: parseEvsNum(m[2]), x2: parseEvsNum(m[3]), y2: parseEvsNum(m[4]), line: i };
        }

        // NAME = entrance(x, y, DIR)
        const ent = t.match(/([A-Za-z_]\w*)\s*=\s*entrance\s*\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)\)/);
        if (ent) out.entrances.push({ name: ent[1], x: parseEvsNum(ent[2]), y: parseEvsNum(ent[3]), dir: ent[4].trim(), line: i });

        // add_enemy(TYPE, x, y, ...)
        const ae = t.match(/\badd_enemy\s*\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)/);
        if (ae && !isNaN(parseEvsNum(ae[2]))) out.enemies.push({ type: ae[1].trim(), x: parseEvsNum(ae[2]), y: parseEvsNum(ae[3]), dynamic: false, line: i });

        // add_basic_souls_enemy / add_*souls*_enemy variants
        const abe = t.match(/\badd_\w*souls\w*_enemy\s*\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)\)/);
        if (abe && !isNaN(parseEvsNum(abe[2]))) out.enemies.push({ type: abe[1].trim(), x: parseEvsNum(abe[2]), y: parseEvsNum(abe[3]), dynamic: true, line: i });

        // object[N] = val
        const obj = t.match(/\bobject\[(\w+)\]/);
        if (obj && !objSeen.has(obj[1])) {
            objSeen.add(obj[1]);
            const desc = comment.replace(/^\/\/\s*/, '').replace(/object\[.*?\]\s*=\s*[^;]+;?\s*/, '').trim()
                        || objDesc.get(obj[1]) || '';
            out.objects.push({ index: obj[1], line: i, desc });
        }

        // map_transition(target, via, dir)
        const mt = t.match(/\bmap_transition\s*\(\s*([^,)]+),\s*([^,)]+),\s*([^,)]+)\)/);
        if (mt) out.transitions.push({ target: mt[1].trim(), via: mt[2].trim(), dir: mt[3].trim(), line: i });
    }

    // Fill descriptions from commented lines for live-code objects
    for (const o of out.objects) {
        if (!o.desc && objDesc.has(o.index)) o.desc = objDesc.get(o.index);
    }

    // Fill object index gaps (object[0x05] implies 0x00..0x04 exist)
    if (out.objects.length > 0) {
        const parseIdx = s => parseInt(s, (s.startsWith('0x') || s.startsWith('0X')) ? 16 : 10);
        const maxIdx = Math.max(...out.objects.map(o => parseIdx(o.index)));
        const seenIdxs = new Set(out.objects.map(o => parseIdx(o.index)));
        for (let i = 0; i <= maxIdx; i++) {
            if (!seenIdxs.has(i))
                out.objects.push({ index: '0x' + i.toString(16).padStart(2, '0'), line: -1, desc: '' });
        }
        out.objects.sort((a, b) => parseIdx(a.index) - parseIdx(b.index));
    }

    return out;
}

module.exports = { parseRoomContent };
