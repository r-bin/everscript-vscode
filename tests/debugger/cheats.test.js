// TODO port to TS (docs/todo/port-to-ts.md)
// The emulator's CHEATS (games/evermore/emulator/webview/bottom-bar/01b-cheats.js) against what the practice ROM does
// in Everscript (everscript repo in/practice/main.evs: attribute(…), fake_atlas(), unlock(ITEM.MONEY)): which bytes,
// which bits, which values; switching off puts the game's own values back; a frame with nothing to fix writes nothing.
// Fake memory, no core. Run: node tests/debugger/cheats.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e)); failed++; }
}

const FILE = path.join(__dirname, '../../src/games/evermore/emulator/webview/bottom-bar/01b-cheats.js');
const BOY = 0x7E4E89, DOG = 0x7E4F37;

function page() {
    const mem = new Uint8Array(0x20000);
    const writes = [];
    const m = {
        readMemory: a => mem[a - 0x7E0000],
        writeMemory: (a, v) => { writes.push(a); mem[a - 0x7E0000] = v & 0xFF; },
    };
    const pills = {}, sounds = [];
    const ctx = vm.createContext({
        romLoaded: true, getModule: () => m, hasDebuggerApi: () => true, updateCheatsTab: () => {},
        setPillState: (id, on) => { pills[id] = on; }, playMenuSound: s => sounds.push(s),
    });
    vm.runInContext(fs.readFileSync(FILE, 'utf8'), ctx);
    const w16 = (a, v) => { mem[a - 0x7E0000] = v & 0xFF; mem[a - 0x7E0000 + 1] = v >> 8; };
    const r16 = a => mem[a - 0x7E0000] | (mem[a - 0x7E0000 + 1] << 8);
    const r24 = a => r16(a) | (mem[a - 0x7E0000 + 2] << 16);
    return { ctx, m, mem, writes, pills, sounds, w16, r16, r24, byte: a => mem[a - 0x7E0000] };
}

test('no clip and invincibility are the attribute() bits: FLAGS_2 (+$11) $04, FLAGS_1 (+$10) $02, Boy and Dog', () => {
    const p = page();
    p.mem[BOY + 0x11 - 0x7E0000] = 0x01;   // ALIVE stays
    p.ctx.setCheat('noclip', true);
    p.ctx.setCheat('invincible', true);
    for (const e of [BOY, DOG]) {
        assert.strictEqual(p.byte(e + 0x11) & 0x04, 0x04);
        assert.strictEqual(p.byte(e + 0x10) & 0x02, 0x02);
    }
    assert.strictEqual(p.byte(BOY + 0x11), 0x05, 'other bits untouched');
    p.ctx.setCheat('noclip', false);
    p.ctx.setCheat('invincible', false);
    assert.strictEqual(p.byte(BOY + 0x11), 0x01);
    assert.strictEqual(p.byte(DOG + 0x10), 0x00);
});

test('atlas is fake_atlas(): stat words and boosts $EFFF, atlas-glitch bit (+$14 $08); off puts the game\'s values back', () => {
    const p = page();
    const words = [0x7E0A3F, 0x7E0A41, 0x7E0A89, 0x7E0A8B, BOY + 0xA0, BOY + 0xA2, DOG + 0xA0, DOG + 0xA2];
    words.forEach((a, i) => p.w16(a, 0x20 + i));
    p.ctx.setCheat('atlas', true);
    for (const a of words) assert.strictEqual(p.r16(a), 0xEFFF, a.toString(16));
    assert.strictEqual(p.byte(BOY + 0x14) & 0x08, 0x08);
    assert.strictEqual(p.byte(DOG + 0x14) & 0x08, 0x08, 'the Dog\'s own flags (main.evs unfake_atlas writes the Boy\'s)');
    // A level up rebuilds a stat: that is the value to put back.
    p.w16(0x7E0A41, 0x0033);
    p.ctx.maintainCheats(p.m);
    assert.strictEqual(p.r16(0x7E0A41), 0xEFFF);
    p.ctx.setCheat('atlas', false);
    words.forEach((a, i) => assert.strictEqual(p.r16(a), a === 0x7E0A41 ? 0x0033 : 0x20 + i, a.toString(16)));
    assert.strictEqual(p.byte(BOY + 0x14) & 0x08, 0);
});

test('infinite HP keeps current HP (+$2A) at 999 or more; heal sets it to max HP ($0A35 / $0A7F)', () => {
    const p = page();
    p.w16(BOY + 0x2A, 12);
    p.w16(DOG + 0x2A, 1500);
    p.ctx.setCheat('hp', true);
    assert.strictEqual(p.r16(BOY + 0x2A), 999);
    assert.strictEqual(p.r16(DOG + 0x2A), 1500, 'more than 999 stays');
    p.ctx.setCheat('hp', false);
    p.w16(0x7E0A35, 250);
    p.w16(0x7E0A7F, 180);
    p.ctx.healParty(p.m);
    assert.strictEqual(p.r16(BOY + 0x2A), 250);
    assert.strictEqual(p.r16(DOG + 0x2A), 180);
});

test('money is unlock(ITEM.MONEY): 6,666,666 in each 24-bit purse (talons, jewels, gold, credits)', () => {
    const p = page();
    p.mem[0x0AD2] = 0x77;   // the byte after credits is not touched
    p.ctx.giveMoney(p.m);
    for (const a of [0x7E0AC6, 0x7E0AC9, 0x7E0ACC, 0x7E0ACF]) assert.strictEqual(p.r24(a), 6666666);
    assert.strictEqual(p.mem[0x0AD2], 0x77);
});

test('weapon levels are unlock(ITEM.WEAPON_LEVEL_3) + DOG_LEVEL_3: $0ADD..$0AF7 and the Dog\'s $0B07 to $0300', () => {
    const p = page();
    const words = [];
    for (let a = 0x7E0ADD; a <= 0x7E0AF7; a += 2) words.push(a);
    words.forEach(a => p.w16(a, 0x0100));
    p.w16(0x7E0AEF, 0x01C4);   // a weapon part way through level 1
    p.w16(0x7E0B07, 0x012A);   // the Dog
    p.w16(0x7E0AF9, 0x1234);   // past the bazooka: not a level
    p.ctx.maxWeaponLevels(p.m);
    for (const a of words.concat([0x7E0B07])) assert.strictEqual(p.r16(a), 0x0300, a.toString(16));
    assert.strictEqual(p.r16(0x7E0AF9), 0x1234);
    p.w16(0x7E0ADF, 0x0310);   // already past it: kept
    p.ctx.maxWeaponLevels(p.m);
    assert.strictEqual(p.r16(0x7E0ADF), 0x0310);
});

test('a frame with nothing to fix writes nothing (a recording gets W events only when the game changed something)', () => {
    const p = page();
    for (const id of ['noclip', 'invincible', 'atlas', 'hp']) p.ctx.setCheat(id, true);
    p.writes.length = 0;
    p.ctx.maintainCheats(p.m);
    assert.deepStrictEqual(p.writes, []);
    p.w16(BOY + 0x2A, 900);   // a hit
    p.ctx.maintainCheats(p.m);
    assert.deepStrictEqual(p.writes, [BOY + 0x2A, BOY + 0x2B]);
    assert.strictEqual(p.ctx.cheatsActive(), true);
});

test('the CHEATS rows: toggles 0-3, heal, money, weapon levels, disable all; pills follow', () => {
    const p = page();
    p.ctx.cheatMenuRow(3, 1);
    assert.strictEqual(p.pills['menu-val-cheat-hp'], true);
    p.ctx.cheatMenuRow(2);
    assert.strictEqual(p.pills['menu-val-cheat-atlas'], true);
    p.ctx.cheatMenuRow(5);
    assert.strictEqual(p.r24(0x7E0AC6), 6666666);
    p.ctx.cheatMenuRow(6);
    assert.strictEqual(p.r16(0x7E0B07), 0x0300);
    p.ctx.cheatMenuRow(7);
    assert.strictEqual(p.ctx.cheatsActive(), false);
    assert.strictEqual(p.pills['menu-val-cheat-atlas'], false);
    const html = fs.readFileSync(path.join(__dirname, '../../src/games/evermore/emulator/webview/menu-tabs.html'), 'utf8');
    const panel = html.slice(html.indexOf('id="menu-panel-4"'), html.indexOf('id="menu-panel-5"') > 0 ? html.indexOf('id="menu-panel-5"') : undefined);
    const actions = [...panel.matchAll(/data-row="(\d)" data-action="([\w-]+)"/g)].map(x => x[2]);
    assert.deepStrictEqual(actions, ['toggle-cheat-noclip', 'toggle-cheat-invincible', 'toggle-cheat-atlas', 'toggle-cheat-hp',
        'action-cheat-heal', 'action-cheat-money', 'action-cheat-weapons', 'action-cheat-disable-all'], 'menu rows in CHEAT_ROWS order');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
