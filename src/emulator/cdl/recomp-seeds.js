'use strict';

/**
 * emulator/cdl/recomp-seeds.js
 *
 * CDL -> snesrecomp analysis seeds (https://github.com/RetroPortingToolKit/snesrecomp):
 *   recomp/cfg/bankXX.cfg   one per bank code ran in (the runtime bank, e.g. $80, not $C0):
 *                           `func <name> <pc16> entry_mx:M,X` per recorded entry,
 *                           `data_region` for known regions (rooms, strings, tables),
 *                           observed indirect jumps/calls as comments
 *   recomp.sh               scaffold once, copy the seeds, `generate`, build the static library
 * The seeds only add roots and widths the recorder saw; snesrecomp's own analysis
 * still walks everything reachable from them and the vectors (`auto_vectors`).
 */

const fs = require('fs');
const path = require('path');
const { hex } = require('./rom-map');

const CDL_ACC_8 = 0x20, CDL_IDX_8 = 0x10;
const EXT_SEEN_M16 = 0x08, EXT_SEEN_X16 = 0x10;
const FLOW_CALL = 1, FLOW_INDIRECT = 8, FLOW_INTERRUPT = 0x10;

const RECOMP_SH = `#!/bin/sh
# Static recompilation with snesrecomp (https://github.com/RetroPortingToolKit/snesrecomp)
#   SNESRECOMP=/path/to/snesrecomp ./recomp.sh [rom]      (default: build/out.sfc, else rom.bin)
# Needs Python 3.9+, Rust/cargo (the first run builds snesrecomp's native analyzer;
# only a Windows CLI is released), and CMake + Ninja + a C compiler for the library.
# Output: recomp/project/ (generated/*.c + snesrecomp_game static library).
# Seeds: recomp/cfg/bank*.cfg from the CDL. The result is C for the game code, not a
# playable port: that still needs a host (frame driver) on top of snesrecomp's runner.
set -e
cd "$(dirname "$0")"
: "\${SNESRECOMP:?set SNESRECOMP to a snesrecomp checkout}"
PY="\${PYTHON:-python3}"
ROM="\${1:-build/out.sfc}"
[ -f "$ROM" ] || ROM=rom.bin
ROM="$(cd "$(dirname "$ROM")" && pwd)/$(basename "$ROM")"
OUT="$PWD/recomp/project"
if [ ! -f "$OUT/CMakeLists.txt" ]; then
  rm -rf "$OUT"
  echo "== scaffold (snesrecomp build)"
  "$PY" "$SNESRECOMP/snesrecomp_cli.py" build --rom "$ROM" --output "$OUT"
fi
rm -f "$OUT"/config/bank*.cfg
cp recomp/cfg/bank*.cfg "$OUT/config/"
echo "== generate with CDL seeds ($ROM)"
"$PY" "$SNESRECOMP/snesrecomp_cli.py" generate --rom "$ROM" --project-root "$OUT" \\
  --cfg-dir config --out-dir generated --cfg-roots --no-host-root-scan
if command -v cmake >/dev/null 2>&1 && command -v ninja >/dev/null 2>&1; then
  echo "== build static library"
  sh "$OUT/build.sh"
else
  echo "cmake/ninja not found: generated C is in $OUT/generated"
fi
`;

/** Runtime bus addresses each function entry was reached at (calls, interrupts). */
function entryAddresses(lib, map, index) {
    const at = new Map();   // rom offset -> Set(bus)
    for (const [key, kind] of lib.edges) {
        if (!(kind & (FLOW_CALL | FLOW_INTERRUPT))) continue;
        const to = key % 0x1000000;
        const off = map.busToRom(to);
        if (off < 0 || index.labels.get(off) !== 'func') continue;
        (at.get(off) || at.set(off, new Set()).get(off)).add(to);
    }
    return at;
}

/** Indirect jumps / calls (JMP (a), JMP (a,x), JML [a], JSR (a,x)) and their observed targets. */
function indirectSites(lib) {
    const sites = new Map();   // from bus -> [to bus]
    for (const [key, kind] of lib.edges) {
        if (!(kind & FLOW_INDIRECT) || (kind & FLOW_INTERRUPT)) continue;
        const from = Math.floor(key / 0x1000000), to = key % 0x1000000;
        (sites.get(from) || sites.set(from, []).get(from)).push(to);
    }
    return sites;
}

/** Known regions merged where one ends exactly where the next starts. */
function mergedRegions(regions) {
    const out = [];
    for (const r of regions) {
        const last = out[out.length - 1];
        if (last && last.end === r.start && (last.start >> 16) === (r.start >> 16)) { last.end = r.end; last.names.push(r.name); }
        else out.push({ start: r.start, end: r.end, names: [r.name] });
    }
    return out;
}

function writeRecompSeeds({ lib, map, index, known, outDir }) {
    const cfgDir = path.join(outDir, 'recomp', 'cfg');
    fs.rmSync(cfgDir, { recursive: true, force: true });
    fs.mkdirSync(cfgDir, { recursive: true });

    const banks = new Map();   // runtime bank -> lines
    const bankLines = b => banks.get(b) || banks.set(b, []).get(b);
    let funcs = 0, mixed = 0;
    for (const [off, buses] of entryAddresses(lib, map, index)) {
        const c = lib.cdl[off], e = lib.ext[off];
        const m = []; if (e & EXT_SEEN_M16) m.push(0); if (c & CDL_ACC_8) m.push(1);
        const x = []; if (e & EXT_SEEN_X16) x.push(0); if (c & CDL_IDX_8) x.push(1);
        if (!m.length) m.push(1);
        if (!x.length) x.push(1);
        const note = m.length > 1 || x.length > 1 ? `    # entered with M${m.join('/')} X${x.join('/')}` : '';
        if (note) mixed++;
        for (const bus of buses) {
            const name = index.labelName(off) + (buses.size > 1 ? '_' + hex(bus >>> 16, 2) : '');
            bankLines(bus >>> 16).push(`func ${name} ${hex(bus & 0xFFFF, 4).toLowerCase()} entry_mx:${m[0]},${x[0]}${note}`);
            funcs++;
        }
    }

    const sites = indirectSites(lib);
    for (const [from, tos] of sites) {
        const targets = [...new Set(tos)].sort((a, b) => a - b).map(t => hex(t, 6));
        bankLines(from >>> 16).push(`# indirect at ${hex(from & 0xFFFF, 4)} -> ${targets.join(',')}  (observed; add an indirect_dispatch once the table is known)`);
    }

    // Known data, in the canonical bank and, for the upper half, the $80 mirror code reads it through.
    const data = ['# Known data regions (export seeds: rooms, strings, tables)'];
    const merged = mergedRegions(known.regions);
    for (const r of merged) {
        const bus = map.canonical(r.start), len = r.end - r.start;
        const what = r.names.length > 2 ? `${r.names[0]} .. ${r.names[r.names.length - 1]} (${r.names.length})` : r.names.join(', ');
        const range = b => `data_region ${hex(b >>> 16, 2).toLowerCase()} ${hex(b & 0xFFFF, 4).toLowerCase()} ${hex((b & 0xFFFF) + len, 5).toLowerCase()}    # ${what}`;
        data.push(range(bus));
        if (map.type === 'HiROM' && (bus & 0xFFFF) >= 0x8000 && r.start < 0x400000) data.push(range(0x800000 | (r.start & 0x3FFFFF)));
    }

    const b0 = bankLines(0);
    b0.unshift('auto_vectors');
    b0.push(...data);
    for (const [bank, lines] of [...banks].sort((a, b) => a[0] - b[0])) {
        const head = [`# Generated by Everscript from the CDL library (${lib.hash || ''}); regenerated on every export`, `bank = ${hex(bank, 2).toLowerCase()}`];
        fs.writeFileSync(path.join(cfgDir, `bank${hex(bank, 2).toLowerCase()}.cfg`), head.concat(lines).join('\n') + '\n');
    }
    fs.writeFileSync(path.join(outDir, 'recomp.sh'), RECOMP_SH, { mode: 0o755 });
    return {
        banks: banks.size, funcs, mixed, indirect: sites.size,
        step: `snesrecomp seeds: recomp/cfg/ with ${banks.size} bank cfgs, ${funcs} func entries (${mixed} entered with several M/X widths, first one used), ${sites.size} indirect sites as comments, ${merged.length} data regions (${known.regions.length} known regions merged). Run \`SNESRECOMP=/path/to/snesrecomp ./recomp.sh\`.`,
    };
}

module.exports = { writeRecompSeeds };
