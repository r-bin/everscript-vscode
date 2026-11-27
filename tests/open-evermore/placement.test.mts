// Open Evermore, the manifest's placement (tools/open-evermore/placement.mts; docs/open-evermore/manifest.md §1.4,
// mapping.md §3): a setting narrows a kind's rules, never widens them. Synthetic rules; no ROM, no dist/.
// Run: node tests/open-evermore/placement.test.mts
import assert from 'node:assert';
import type { Item } from '../../tools/open-evermore/codec.mts';
import { Findings } from '../../tools/open-evermore/findings.mts';
import { applyPlacement, narrow, readPlacement } from '../../tools/open-evermore/placement.mts';

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + ((e as Error).stack || e)); failed++; }
}
const STRINGS = { lowerHalf: true, noCrossBank: true, below: 0x400000 };
const TEXTS = { above: 0x040000, below: 0x050000, noCrossBank: true };

test('banks narrow a rule; a half that agrees is kept', () => {
    assert.deepStrictEqual(narrow(STRINGS, { banks: { from: 0x00, to: 0x04 }, half: 'lower' }), { lowerHalf: true, noCrossBank: true, above: 0, below: 0x040000 });
    assert.deepStrictEqual(narrow({ upperHalf: true }, { banks: { from: 0x30, to: 0x40 } }), { upperHalf: true, above: 0x300000, below: 0x400000 });
});

test('a setting outside the rule is refused: another bank, the other half, outside a window', () => {
    assert.match(narrow(TEXTS, { banks: { from: 0x05, to: 0x06 } }) as string, /must lie in \$C4:0000–\$C4:FFFF/);
    assert.match(narrow(STRINGS, { half: 'upper' }) as string, /lower half/);
    assert.match(narrow({ window: { from: 0x12, to: 0x40 } }, { half: 'lower' }) as string, /upper half/);
    assert.match(narrow({ window: { from: 0x12, to: 0x40 } }, { banks: { from: 0x00, to: 0x10 } }) as string, /window is banks \$92-\$BF/);
    assert.deepStrictEqual(narrow({ window: { from: 0x12, to: 0x40 } }, { banks: { from: 0x20, to: 0x30 } }), { window: { from: 0x20, to: 0x30 } });
    assert.match(narrow({ bankOffset: 0xB678 }, { half: 'lower' }) as string, /upper half/);
});

test('the manifest: kinds, fields and values are checked', () => {
    const f = new Findings();
    const s = readPlacement({ strings: { banks: '$C0-$C3' }, texts: { half: 'upper' } }, ['strings', 'texts'], f);
    assert.strictEqual(f.list.length, 0);
    assert.deepStrictEqual(s.get('strings'), { banks: { from: 0, to: 4 } });
    const g = new Findings();
    readPlacement({ nothing: {}, strings: { banks: '$40', speed: 'fast', half: 'middle' } }, ['strings'], g);
    assert.deepStrictEqual(g.list.map(x => x.pointer).sort(), ['/placement/nothing', '/placement/strings/banks', '/placement/strings/half', '/placement/strings/speed']);
});

test('applied to a kind: every item narrowed, generated tables untouched, one error for all that do not fit', () => {
    const item = (key: string, rule: Item['rule'], generated = false): Item => ({ key, file: key, bytes: new Uint8Array(4), rule, generated });
    const items = [item('texts/a', TEXTS), item('texts/b', { ...TEXTS, above: 0x041000, below: 0x041004 }), item('texts/_table', { noCrossBank: true }, true)];
    const f = new Findings();
    applyPlacement('texts', items, readPlacement({ texts: { half: 'upper' } }, ['texts'], f), f);
    assert.strictEqual(f.list.length, 0);
    assert.ok(items[0].rule.upperHalf && items[1].rule.upperHalf && !items[2].rule.upperHalf);
    const g = new Findings();
    applyPlacement('texts', items, readPlacement({ texts: { banks: '$C5' } }, ['texts'], g), g);
    assert.strictEqual(g.list.length, 1);
    assert.strictEqual(g.list[0].rule, 'rule-loosened');
    assert.match(g.list[0].message, /texts\/a and 1 more/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
