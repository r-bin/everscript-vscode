'use strict';
// Ownership: what the Memory Radar shows for the cursor's scope in an .evs file — the memory map
// (memory-map.md), the enclosing fun/map/area/group, and the RAM addresses that scope reads and
// writes. Pure apart from reading memory-map.md; a document only needs lineCount / lineAt().

const fs = require('fs');
const path = require('path');
const { radarLifecycle, radarParseName, radarParseNotes } = require('../../../../dist/games/evermore/radar-utils');

function radarReadMemoryMap(filePath) {
    const map = new Map();
    if (!fs.existsSync(filePath)) return map;
    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
        if (!line.startsWith('|')) continue;
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length < 3) continue;
        const m = cells[0].match(/0x([0-9a-fA-F]{4})(?:[^0-9a-fA-F]*0x([0-9a-fA-F]{4}))?/);
        if (!m) continue;
        const start = parseInt(m[1], 16), end = m[2] ? parseInt(m[2], 16) : start;
        if (start > end) continue;
        const rawName = cells[1] || '';
        const nameParts = radarParseName(rawName);
        const name = nameParts[0] || rawName.replace(/<[^>]+>/g, '').trim();
        if (/^\s*\(gap/i.test(name)) continue;
        const notes = radarParseNotes(cells[3] || '');
        const typeStr = cells[2] || '';
        const isWord = /\bWord\b/i.test(typeStr);
        const effectiveEnd = (isWord && end === start) ? start + 1 : end;
        const entry = {
            name, nameParts, type: typeStr, notes,
            lifecycle: radarLifecycle(start, typeStr, notes),
            isWord, addrStart: start, addrEnd: effectiveEnd,
        };
        for (let a = start; a <= effectiveEnd; a++) {
            const ex = map.get(a);
            if (!ex || ex.addrStart < start) map.set(a, entry);
        }
    }
    return map;
}

function radarFindOpenBrace(document, fromLine) {
    for (let l = fromLine; l < Math.min(fromLine + 10, document.lineCount); l++) {
        if (document.lineAt(l).text.includes('{')) return l;
    }
    return -1;
}

function radarFindCloseBrace(document, ob) {
    let depth = 0;
    for (let l = ob; l < document.lineCount; l++) {
        for (const ch of document.lineAt(l).text.replace(/\/\/.*$/, '')) {
            if (ch === '{') depth++;
            else if (ch === '}') { depth--; if (depth === 0) return l; }
        }
    }
    return -1;
}

function radarDetectScope(document, cursorLine) {
    const declRe = /^\s*(fun|map|area|group)\s+([A-Za-z_][A-Za-z0-9_]*)\b/;
    for (let line = cursorLine; line >= 0; line--) {
        const m = declRe.exec(document.lineAt(line).text);
        if (!m) continue;
        const ob = radarFindOpenBrace(document, line);
        if (ob === -1) return { kind: m[1], name: m[2], startLine: line, endLine: line };
        const cb = radarFindCloseBrace(document, ob);
        return { kind: m[1], name: m[2], startLine: line, endLine: cb === -1 ? document.lineCount - 1 : cb };
    }
    return { kind: 'global', name: 'global', startLine: 0, endLine: document.lineCount - 1 };
}

function radarAnalyzeScope(document, startLine, endLine) {
    const refs = new Map();
    const pools = [];
    const argRefs = new Map();

    const add = (addr, line, rawText, source, isWrite) => {
        if (!refs.has(addr)) refs.set(addr, { reads: [], writes: [], sources: [] });
        const r = refs.get(addr);
        const entry = { line, text: rawText.trim() };
        if (isWrite) { if (!r.writes.some(x => x.line === line)) r.writes.push(entry); }
        else         { if (!r.reads.some(x => x.line === line))  r.reads.push(entry); }
        if (!r.sources.includes(source)) r.sources.push(source);
    };
    const addArg = (idx, line, rawText, isWrite) => {
        if (!argRefs.has(idx)) argRefs.set(idx, { reads: [], writes: [] });
        const r = argRefs.get(idx);
        const entry = { line, text: rawText.trim() };
        if (isWrite) { if (!r.writes.some(x => x.line === line)) r.writes.push(entry); }
        else         { if (!r.reads.some(x => x.line === line))  r.reads.push(entry); }
    };
    const isWrite = (text, hexLit) => {
        const h = hexLit.replace(/^0x/i, '');
        return new RegExp('<\\s*0x' + h + '[^>]*>\\s*(?:[+\\-*\\/&|^]|<<|>>)?=(?!=)', 'i').test(text) ||
               new RegExp('memory\\s*\\(\\s*0x' + h + '[^)]*\\)\\s*(?:[+\\-*\\/&|^]|<<|>>)?=(?!=)', 'i').test(text);
    };

    const seenPools = new Set();
    const addPool = (ps, pe, lineIdx) => {
        if (isNaN(ps) || isNaN(pe) || ps > pe) return;
        const key = ps + '-' + pe;
        if (seenPools.has(key)) return;
        seenPools.add(key);
        pools.push({ start: ps, end: pe, line: lineIdx, lc: radarLifecycle(ps, '', '') });
    };
    for (let i = 0; i < document.lineCount; i++) {
        const text = document.lineAt(i).text.replace(/\/\/.*$/, '');
        const poolM = text.match(/<\s*(0x[0-9a-fA-F]+)\s*>\s*\.\.\s*<\s*(0x[0-9a-fA-F]+)\s*>/);
        if (poolM) addPool(parseInt(poolM[1], 16), parseInt(poolM[2], 16), i);
    }
    const docDir = path.dirname(document.uri.fsPath);
    const mainEvsPath = path.join(docDir, 'main.evs');
    if (mainEvsPath !== document.uri.fsPath && fs.existsSync(mainEvsPath)) {
        const mainLines = fs.readFileSync(mainEvsPath, 'utf8').split(/\r?\n/);
        for (let i = 0; i < mainLines.length; i++) {
            const text = mainLines[i].replace(/\/\/.*$/, '');
            const poolM = text.match(/<\s*(0x[0-9a-fA-F]+)\s*>\s*\.\.\s*<\s*(0x[0-9a-fA-F]+)\s*>/);
            if (poolM) addPool(parseInt(poolM[1], 16), parseInt(poolM[2], 16), i);
        }
    }

    for (let i = startLine; i <= endLine; i++) {
        const rawText = document.lineAt(i).text;
        const text    = rawText.replace(/\/\/.*$/, '');
        if (/<\s*0x[0-9a-fA-F]+\s*>\s*\.\.\s*</.test(text)) continue;
        for (const m of text.matchAll(/\bmemory\s*\(\s*(0x[0-9a-fA-F]+)/g)) {
            const a = parseInt(m[1], 16);
            if (!isNaN(a)) add(a, i, rawText, 'memory()', isWrite(text, m[1]));
        }
        for (const m of text.matchAll(/<\s*(0x[0-9a-fA-F]+)/g)) {
            const a = parseInt(m[1], 16);
            if (!isNaN(a)) add(a, i, rawText, '<deref>', isWrite(text, m[1]));
        }
        for (const m of text.matchAll(/\barg\s*\[\s*(0x[0-9a-fA-F]+|\d+)\s*\]/g)) {
            const raw = m[1];
            const idx = raw.startsWith('0x') || raw.startsWith('0X') ? parseInt(raw, 16) : parseInt(raw, 10);
            if (!isNaN(idx)) {
                const argIsWrite = /\barg\s*\[\s*[^\]]+\]\s*(?:[+\-*\/&|^]|<<|>>)?=(?!=)/.test(text);
                addArg(idx, i, rawText, argIsWrite);
            }
        }
    }
    return { refs, pools, argRefs };
}

module.exports = { radarReadMemoryMap, radarDetectScope, radarAnalyzeScope };
