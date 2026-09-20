'use strict';
// Loot parity: regenerate SoEScriptDumper's `sniffflags.inc` from our own
// extraction and require it to come back identical.
//
// This is an unusually strong check, and worth explaining. That file is not
// hand-written — upstream *generated* it by running `LootData::to_flag()`
// over every B-trigger in the ROM. So it is a complete, independently
// produced record of every sniff spot: which flag marks it taken, what it
// gives, which room it is in and which object it is. Reproducing all 593
// lines exactly means the extraction agrees with the reference on every
// pickup in the game, not on a sample.
//
// It also settles a design question. Nothing here runs the game: the values
// are literal writes in the script, so reading them is enough.
//
// Skips (does not fail) when the ROM or the SoETilesViewer checkout is
// unavailable, since neither is committed to this repo.

const fs = require('fs');
const path = require('path');

const script = require('../../src/script');
const names = require('../../src/script/names.json');

const HOME = process.env.HOME || '';
const VIEWER = process.env.SOE_TILES_VIEWER ||
    path.join(HOME, 'Documents', 'GitHub', 'SoETilesViewer');
const FLAGS = process.env.SOE_SNIFF_FLAGS || path.join(VIEWER, 'SoEScriptDumper', 'sniffflags.inc');
const ROM = process.env.EVERSCRIPT_ROM ||
    path.join(VIEWER, 'SoEScriptDumper', 'Secret of Evermore (U) [!].smc');

const MAP_COUNT = 0x80;
// Both directions, because either alone is easy to game: recall alone lets us
// emit junk, precision alone lets us emit one line.
const MIN_RECALL = 1;
const MIN_PRECISION = 1;

function skip(reason) {
    console.log(`SKIP script-loot: ${reason}`);
    process.exit(0);
}

const hex = (n, w) => (n >>> 0).toString(16).padStart(w, '0');

/** `prizes`, the dumper's item names, keyed by item id. */
const PRIZES = names.ramValues[String(0x2391)] || {};

/** Upstream trims the region prefix: "Gothica - Dark Forest" → "Dark Forest". */
function shortMapName(mapId) {
    const full = names.maps[String(mapId)];
    if (!full) return `MAP 0x${hex(mapId, 2)}`;
    const dash = full.indexOf('- ');
    return dash >= 0 ? full.slice(dash + 2) : full;
}

/** One line of sniffflags.inc, byte for byte as `LootData::to_flag()` writes it. */
function flagLine(mapId, facts) {
    const named = PRIZES[String(facts.item.value)];
    const item = named ? named.split('(')[0] : `0x${hex(facts.item.value, 4)} `;
    const bit = 1 << facts.checkFlag.bit;
    return `{{0x${hex(facts.checkFlag.addr, 4)}, bm2bp(0x${hex(bit, 2)})}, ` +
        `"Sniffed ${item}in ${shortMapName(mapId)} (#${facts.objectId === null ? 0 : facts.objectId})"},`;
}

function main() {
    if (!fs.existsSync(ROM)) skip(`ROM not found at ${ROM}`);
    if (!fs.existsSync(FLAGS)) skip(`sniffflags.inc not found at ${FLAGS}`);

    const rom = new Uint8Array(fs.readFileSync(ROM));
    const want = fs.readFileSync(FLAGS, 'utf8')
        .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//'));

    const got = [];
    const seen = new Set();
    let pickups = 0;
    let literal = 0;
    let asEverscript = 0;

    for (let mapId = 0; mapId < MAP_COUNT; mapId++) {
        let model;
        try { model = script.buildRoomScriptModel(rom, mapId); } catch { continue; }
        for (const trigger of [...model.bTrigger, ...model.stepOn]) {
            asEverscript += trigger.everscript.length;
            for (const facts of trigger.loot) {
                pickups += 1;
                if (facts.item && facts.item.encoding !== 'expression') literal += 1;
                if (facts.kind !== 'sniff' || !facts.item || !facts.checkFlag) continue;
                // Upstream keys its dedup on where the item value lives, so
                // the same pickup reached from several triggers counts once.
                if (seen.has(facts.item.at)) continue;
                seen.add(facts.item.at);
                got.push(flagLine(mapId, facts));
            }
        }
    }

    const wanted = new Set(want);
    const produced = new Set(got);
    const hits = got.filter((l) => wanted.has(l)).length;
    const recall = want.length ? hits / want.length : 0;
    const precision = got.length ? hits / got.length : 0;

    console.log(`script-loot: ${pickups} pickups, ${literal} with a literal item`);
    console.log(`  rendered as Everscript : ${asEverscript}`);
    console.log(`  sniff flags generated  : ${got.length} (upstream has ${want.length})`);
    console.log(`  recall                 : ${hits}/${want.length} (${(recall * 100).toFixed(1)}%)`);
    console.log(`  precision              : ${hits}/${got.length} (${(precision * 100).toFixed(1)}%)`);

    let failures = 0;
    const missing = want.filter((l) => !produced.has(l));
    const extra = got.filter((l) => !wanted.has(l));
    for (const l of missing.slice(0, 5)) console.error(`  MISSING ${l}`);
    for (const l of extra.slice(0, 5)) console.error(`  EXTRA   ${l}`);
    if (recall < MIN_RECALL) { failures += 1; console.error(`  FAIL recall ${recall} < ${MIN_RECALL}`); }
    if (precision < MIN_PRECISION) { failures += 1; console.error(`  FAIL precision ${precision} < ${MIN_PRECISION}`); }
    if (pickups !== literal) {
        failures += 1;
        console.error(`  FAIL ${pickups - literal} pickups do not write a literal item — that would need a simulator`);
    }

    if (failures) { console.error(`\nscript-loot: ${failures} failure(s)`); process.exit(1); }
    console.log('script-loot: every sniff flag in sniffflags.inc reproduced exactly');
}

main();
