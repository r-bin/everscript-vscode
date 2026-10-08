'use strict';

// Builds a standalone "call-graph galaxy" HTML page from a recorded CDL library:
// functions (by bank), call edges, WRAM reads / writes, ROM data + DMA sources,
// I/O registers and Everscript scripts, with disassembly per function.
// Dev tool only — not part of the extension. See README.md.
//
//   node tools/call-graph-galaxy/build.js --rom "<path to .smc/.sfc>"
//        [--lib <cdl-library root>] [--memory-map <memory-map.md>] [--out <file.html>] [--json <file.json>]

const fs = require('fs');
const os = require('os');
const path = require('path');
const SRC = path.join(__dirname, '..', '..', 'src', 'emulator');
const { CdlLibrary, stripCopierHeader } = require(path.join(SRC, 'cdl', 'library'));
const { createRomMap, hex } = require(path.join(SRC, 'cdl', 'rom-map'));
const { buildIndex, SPACE, XR } = require(path.join(SRC, 'cdl', 'xref-index'));
const { decodeAt, formatInstruction } = require(path.join(SRC, 'cdl', 'disasm'));
const { getActiveAddressLookup } = require(path.join(SRC, 'address-lookup'));

const MAX_ASSETS = 160;          // ROM data regions kept (most-read first)
const MIN_PAGE_USERS = 4;        // unnamed 64-byte WRAM pages need this many functions
const ASM_LINES = 14;            // disassembly lines per function
const SCRIPT_SPAN = 0x400;       // script instruction belongs to the nearest known start within this
const INTERPRETER_FETCH = 0xCCD0A6; // SoE script opcode fetch (see cdl/README.md, script attribution)

const IO = {
    0x2100: 'INIDISP', 0x2102: 'OAMADDL', 0x2104: 'OAMDATA', 0x2105: 'BGMODE', 0x2107: 'BG1SC', 0x210B: 'BG12NBA',
    0x210D: 'BG1HOFS', 0x210E: 'BG1VOFS', 0x2115: 'VMAIN', 0x2116: 'VMADDL', 0x2118: 'VMDATAL', 0x2121: 'CGADD',
    0x2122: 'CGDATA', 0x212C: 'TM', 0x2140: 'APUIO0', 0x2141: 'APUIO1', 0x2142: 'APUIO2', 0x2143: 'APUIO3',
    0x2180: 'WMDATA', 0x2181: 'WMADDL', 0x4200: 'NMITIMEN', 0x4202: 'WRMPYA', 0x4203: 'WRMPYB', 0x4204: 'WRDIVL',
    0x4206: 'WRDIVB', 0x420B: 'MDMAEN', 0x420C: 'HDMAEN', 0x4210: 'RDNMI', 0x4212: 'HVBJOY', 0x4214: 'RDDIVL',
    0x4216: 'RDMPYL', 0x4218: 'JOY1L', 0x4300: 'DMAP0', 0x4301: 'BBAD0', 0x4302: 'A1T0L', 0x4305: 'DAS0L',
};
const REGIONS = [
    [0x0000, 0x01FF, 'Direct page'], [0x0200, 0x02FF, 'Engine'], [0x0300, 0x0FFF, 'Entities & stats'],
    [0x1000, 0x2257, 'Engine'], [0x2258, 0x24FF, 'Save file'], [0x2500, 0x2833, 'Engine'],
    [0x2834, 0x2BFF, 'Room scratch'], [0x2C00, 0x3FFF, 'Script VM'], [0x4000, 0xFFFF, 'Buffers'],
    [0x10000, 0x1FFFF, 'Bank $7F'],
];

function args() {
    const a = process.argv.slice(2), o = {};
    for (let i = 0; i < a.length; i += 2) o[a[i].replace(/^--/, '')] = a[i + 1];
    if (!o.rom) { console.error('usage: build.js --rom <rom> [--lib <dir>] [--memory-map <md>] [--out <html>] [--json <json>]'); process.exit(1); }
    o.lib = o.lib || path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'rbin.everscript', 'cdl-library');
    o['memory-map'] = o['memory-map'] || path.join(__dirname, '..', '..', '..', 'everscript', '.github', 'memory-map.md');
    o.out = o.out || path.join(__dirname, 'out', 'call-graph-galaxy.html');
    return o;
}

/** memory-map.md section 4 rows: | 0x0a37 | 🧑 BOY_CURRENT_HP | Word | ... */
function readMemoryMap(file) {
    const at = new Map();
    if (!fs.existsSync(file)) { console.warn('memory map not found, WRAM stays unnamed:', file); return at; }
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\|\s*0x([0-9a-fA-F]{4,5})\s*\|\s*([^|]+?)\s*\|\s*(\w+)?/);
        if (!m) continue;
        const raw = m[2].split(/<br\s*\/?>/i)[0].replace(/<[^>]+>/g, '').replace(/\s*\(0x[0-9a-f]+\)\s*$/i, '').trim();
        const emoji = (raw.match(/^\p{Extended_Pictographic}️?/u) || [''])[0];
        const entry = { addr: parseInt(m[1], 16), name: raw.slice(emoji.length).trim(), emoji, size: /word/i.test(m[3] || '') ? 2 : 1 };
        for (let i = 0; i < entry.size; i++) if (!at.has(entry.addr + i)) at.set(entry.addr + i, entry);
    }
    return at;
}

function build(o) {
    const romFile = fs.readFileSync(o.rom);
    const lib = new CdlLibrary(o.lib, romFile, {});
    if (!lib.manifest) throw new Error(`no CDL library for this ROM under ${o.lib} (sha1 ${lib.hash}); record one in the emulator first`);
    const rom = stripCopierHeader(romFile);
    const map = createRomMap(rom);
    const idx = buildIndex(lib, map);
    const named = readMemoryMap(o['memory-map']);
    const regionOf = a => (REGIONS.find(r => a >= r[0] && a <= r[1]) || [0, 0, '?'])[2];

    const nodes = new Map(), edges = new Map();
    const addEdge = (s, t, type) => { const k = s + '>' + t + '>' + type; const e = edges.get(k); if (e) e.w++; else edges.set(k, { s, t, type, w: 1 }); };

    // functions
    const entries = idx.entries;
    for (let i = 0; i < entries.length; i++) {
        const off = entries[i];
        const next = entries[i + 1] && (entries[i + 1] >>> 16) === (off >>> 16) ? entries[i + 1] : ((off | 0xFFFF) + 1);
        let bytes = 0, hits = 0;
        for (let p = off; p < next; p++) if (lib.cdl[p] & 1) { bytes++; hits += lib.romHits[p]; }
        const resolve = (t, w) => { const ro = map.busToRom(t); if (ro < 0) return null; return idx.labelName(ro) || (w === 'rel' ? '$' + hex(t & 0xFFFF, 4) : null); };
        const asm = [];
        for (let p = off; asm.length < ASM_LINES && p < next && (lib.cdl[p] & 1);) {
            const ins = decodeAt(rom, p, lib.cdl[p], lib.ext[p]);
            if (!ins) break;
            const a = map.canonical(p);
            asm.push(hex(a & 0xFFFF, 4) + '  ' + (formatInstruction(ins, a, resolve) || ins.mnemonic.toLowerCase()));
            p += ins.len;
            if (/^(RTS|RTL|RTI|JMP|JML|BRA|BRL)$/.test(ins.mnemonic)) break;
        }
        const bus = map.canonical(off);
        nodes.set('f' + off, { id: 'f' + off, kind: 'func', label: 'func_' + hex(bus, 6), bank: hex(bus >>> 16, 2), bytes, hits, asm, callers: (idx.callers.get(off) || []).length });
    }
    const vectors = map.header && map.header.nativeVectors;
    if (vectors) for (const [k, v] of Object.entries(vectors)) { const n = nodes.get('f' + map.busToRom(v)); if (n) n.vector = k.toUpperCase(); }

    // calls / jumps
    for (const [key, kind] of lib.edges) {
        const fo = map.busToRom(Math.floor(key / 0x1000000)), to = map.busToRom(key % 0x1000000);
        if (fo < 0 || to < 0) continue;
        const a = idx.functionOf(fo), b = nodes.has('f' + to) ? to : idx.functionOf(to);
        if (a < 0 || b < 0 || a === b) continue;
        addEdge('f' + a, 'f' + b, (kind & 0x11) ? 'call' : 'jump');
    }

    // data xrefs
    const dataLabels = [...idx.labels].filter(([, k]) => k !== 'func' && k !== 'loc').sort((a, b) => a[0] - b[0]);
    const assetOf = off => {
        let lo = 0, hi = dataLabels.length - 1, best = null;
        while (lo <= hi) { const m = (lo + hi) >> 1; if (dataLabels[m][0] <= off) { best = dataLabels[m]; lo = m + 1; } else hi = m - 1; }
        return best && (best[0] >>> 16) === (off >>> 16) ? best : null;
    };
    const wramNode = a => {
        const n = named.get(a);
        if (n) return { id: 'w' + n.addr, label: n.name, emoji: n.emoji, addr: n.addr, named: true };
        const page = a & ~0x3F;
        return { id: 'w' + page + 'p', label: '$' + (page >= 0x10000 ? '7F:' : '7E:') + hex(page & 0xFFFF, 4) + '–' + hex((page + 0x3F) & 0xFFFF, 4), addr: page, named: false };
    };
    for (const [key, flags] of lib.xrefs) {
        const pc = Math.floor(key / 0x4000000), sa = key % 0x4000000, space = sa >>> 24, addr = sa & 0xFFFFFF;
        const po = map.busToRom(pc); if (po < 0) continue;
        const f = idx.functionOf(po); if (f < 0) continue;
        const fid = 'f' + f;
        if (space === SPACE.WRAM) {
            const w = wramNode(addr);
            if (!nodes.has(w.id)) nodes.set(w.id, Object.assign({ kind: 'wram', region: regionOf(w.addr), funcs: new Set() }, w));
            nodes.get(w.id).funcs.add(fid);
            if (flags & XR.READ) addEdge(fid, w.id, 'read');
            if (flags & XR.WRITE) addEdge(fid, w.id, 'write');
        } else if (space === SPACE.ROM) {
            const a = assetOf(addr); if (!a) continue;
            const id = 'a' + a[0], bus = map.canonical(a[0]);
            if (!nodes.has(id)) nodes.set(id, { id, kind: 'asset', label: a[1] + '_' + hex(bus, 6), sub: a[1], bank: hex(bus >>> 16, 2), funcs: new Set(), dma: false, target: '' });
            const n = nodes.get(id); n.funcs.add(fid);
            if (flags & XR.DMA) {
                n.dma = true;
                n.target = flags & XR.DMA_VRAM ? 'VRAM' : flags & XR.DMA_CGRAM ? 'CGRAM' : n.target || 'WRAM';
                addEdge(fid, id, 'dma');
            } else addEdge(fid, id, 'rom');
        } else if (space === SPACE.IO) {
            const r = addr & 0xFFFF; if (!IO[r]) continue;
            const id = 'i' + r;
            if (!nodes.has(id)) nodes.set(id, { id, kind: 'io', label: IO[r], addr: r, funcs: new Set() });
            nodes.get(id).funcs.add(fid);
            addEdge(fid, id, flags & XR.WRITE ? 'iow' : 'ior');
        }
    }

    // scripts (attributed WRAM touches), grouped to the nearest known script start
    const lk = getActiveAddressLookup(rom, null);
    const starts = [...lk.lookupMap.keys()].sort((a, b) => a - b);
    const scriptOf = a => {
        let lo = 0, hi = starts.length - 1, b = -1;
        while (lo <= hi) { const m = (lo + hi) >> 1; if (starts[m] <= a) { b = starts[m]; lo = m + 1; } else hi = m - 1; }
        return b >= 0 && a - b < SCRIPT_SPAN ? b : (a & ~0xFF);
    };
    for (const [key] of lib.scriptXrefs) {
        const s = Math.floor(key / 0x20000), addr = key % 0x20000, start = scriptOf(s), id = 's' + start;
        if (!nodes.has(id)) {
            const info = lk.lookupMap.get(start);
            nodes.set(id, { id, kind: 'script', label: info ? info.name : 'script_' + hex(start, 6), tag: info ? info.shortTag : '', addr: hex(start, 6), instrs: new Set(), touched: new Set() });
        }
        const n = nodes.get(id); n.instrs.add(s); n.touched.add(addr);
    }
    const interpOff = map.busToRom(INTERPRETER_FETCH);
    const interp = interpOff >= 0 ? idx.functionOf(interpOff) : -1;
    for (const n of nodes.values()) {
        if (n.kind !== 'script') continue;
        n.bulk = n.touched.size > 64;
        for (const a of n.touched) { const w = wramNode(a); if (w.named && nodes.has(w.id)) addEdge(n.id, w.id, 'script'); }
        if (interp >= 0) addEdge(n.id, 'f' + interp, 'runs');
    }

    // prune for legibility
    const keepAssets = new Set([...nodes.values()].filter(n => n.kind === 'asset')
        .sort((a, b) => b.funcs.size - a.funcs.size || b.dma - a.dma).slice(0, MAX_ASSETS).map(n => n.id));
    for (const [id, n] of nodes) {
        if (n.kind === 'asset' && !keepAssets.has(id)) nodes.delete(id);
        if (n.kind === 'wram' && !n.named && n.funcs.size < MIN_PAGE_USERS) nodes.delete(id);
    }

    const out = {
        meta: { title: map.header ? map.header.title : '', sha1: lib.hash, recorded: lib.manifest.updated, hasHits: lib.hasHits, interp: interp >= 0 ? 'f' + interp : null },
        nodes: [], links: [],
    };
    for (const n of nodes.values()) {
        const v = Object.assign({}, n);
        if (v.funcs) { v.users = v.funcs.size; delete v.funcs; }
        if (v.instrs) { v.instrs = v.instrs.size; v.touches = v.touched.size; delete v.touched; }
        out.nodes.push(v);
    }
    for (const e of edges.values()) if (nodes.has(e.s) && nodes.has(e.t)) out.links.push(e);
    return out;
}

const o = args();
const graph = build(o);
const json = JSON.stringify(graph);
const html = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8').replace('__DATA__', () => json.replace(/</g, '\\u003c'));
fs.mkdirSync(path.dirname(o.out), { recursive: true });
fs.writeFileSync(o.out, html);
if (o.json) fs.writeFileSync(o.json, JSON.stringify(graph, null, 1));
const count = k => graph.nodes.filter(n => n.kind === k).length;
console.log(`${o.out}: ${count('func')} functions, ${count('wram')} WRAM, ${count('asset')} assets, ${count('io')} I/O, ${count('script')} scripts, ${graph.links.length} links${graph.meta.hasHits ? '' : ' (no hit counts in this library)'}`);
