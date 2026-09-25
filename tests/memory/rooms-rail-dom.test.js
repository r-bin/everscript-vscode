'use strict';
// The Rooms tab's left rail, driven in a real browser against the real page.
//
// Unlike map-editor-dom.test.js, which hand-builds a DOM shaped like the
// editor's, this renders the *actual* `renderRadarHtml()` output — markup,
// the whole concatenated CSS bundle and the whole concatenated JS bundle —
// because the rail's whole job is structure plus cascade, and a hand-built
// harness would prove nothing about either.
//
// Every visibility assertion reads computed `display`, never the `.hidden`
// IDL property: Phase 6 shipped a dropdown that was visually open for three
// phases because an author `display` rule silently beat the UA's own
// `[hidden]{display:none}`, and the only test covering it asserted `.hidden`.
//
// Skips cleanly when no browser is installed, so a fresh clone still runs
// the suite.

const path = require('path');

const { renderRadarHtml } = require(path.join(__dirname, '..', '..', 'src', 'memory', 'render-radar'));

/** A live tree with one area node and one bare map node, like a real file. */
const ROOM_TREE = [
    { kind: 'area', name: 'Overworld', children: [
        { kind: 'map', name: 'boss_arena_draft_2', vanillaId: '0x33', relPath: 'x.evs',
            startLine: 1, endLine: 2, content: null, imageUri: null, imageDims: null },
        { kind: 'map', name: 'test_room_2', relPath: 'x.evs',
            startLine: 3, endLine: 4, content: null, imageUri: null, imageDims: null },
    ] },
    { kind: 'map', name: 'puzzle_wing', relPath: 'x.evs',
        startLine: 5, endLine: 6, content: null, imageUri: null, imageDims: null },
];

let passed = 0;
let failed = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log('  ✓ ' + name); passed += 1; }
    else { console.error('  ✗ ' + name + (detail ? '\n    ' + detail : '')); failed += 1; }
};

/** Computed display of the first node matching `sel`, or 'missing'. */
const displayOf = (page, sel) => page.evaluate((s) => {
    const n = document.querySelector(s);
    return n ? getComputedStyle(n).display : 'missing';
}, sel);

async function main() {
    let chromium;
    try { ({ chromium } = require('playwright')); }
    catch { console.log('\nrooms rail DOM: playwright not installed — skipped'); return; }

    let browser;
    try { browser = await chromium.launch(); }
    catch (e) {
        console.log('\nrooms rail DOM: no browser available — skipped ('
            + String(e.message).split('\n')[0] + ')');
        return;
    }

    console.log('\nrooms rail DOM:');
    const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    const html = renderRadarHtml(
        { kind: 'function', name: 'f', startLine: 0, endLine: 10 },
        new Map(), [], new Map(), new Map(), ROOM_TREE, 'rooms', null);
    await page.setContent(html);

    // ── shape ────────────────────────────────────────────────────────────
    check('the rail renders as a flex column, so the footer can pin',
        await displayOf(page, '.rm-rail') === 'flex');
    check('the search field is visible and reachable',
        await page.evaluate(() => {
            const r = document.getElementById('rm-rail-q').getBoundingClientRect();
            return r.width > 40 && r.height > 10;
        }));
    check('the + New Map footer sits below the scroll box, not inside it',
        await page.evaluate(() => {
            const foot = document.querySelector('.rm-rail-foot');
            const scroll = document.getElementById('rm-rail-scroll');
            return !!foot && !!scroll && !scroll.contains(foot)
                && foot.getBoundingClientRect().top >= scroll.getBoundingClientRect().bottom - 1;
        }));
    // The rail is a sibling of #room-detail, so `.rg-theme` cannot reach it.
    // `.rg-rail` is its own token/font scope — and the four other tabs must
    // stay monospace.
    check('the rail is sans-serif, and only the rail',
        await page.evaluate(() => {
            const rail = getComputedStyle(document.querySelector('.rm-rail')).fontFamily;
            const mem = getComputedStyle(document.querySelector('.tab-pane[data-tab="radar"]')).fontFamily;
            return /sans-serif/.test(rail) && /monospace/.test(mem) && !/monospace/.test(rail);
        }));
    check('room ids stay monospace inside the sans-serif rail',
        await page.evaluate(() => /mono/i.test(
            getComputedStyle(document.querySelector('.rn-vid-tag')).fontFamily)));
    check('rows are the mock\'s 32px, not the old dense 10px line',
        await page.evaluate(() =>
            document.querySelector('#rm-live-tree li.rn-map').getBoundingClientRect().height) === 32);

    // ── the two groups ───────────────────────────────────────────────────
    // Custom open, Vanilla closed on load: the same information the pre-7b
    // `Live` default showed, with the 127-room catalogue one click away.
    check('Custom rooms is open on load',
        await displayOf(page, '#rm-live-tree') !== 'none');
    check('Vanilla rooms is collapsed on load (computed, not .hidden)',
        await displayOf(page, '#rm-vanilla-tree') === 'none');
    // e.target is the chevron span, not the button carrying data-rail-grp —
    // the exact bug webview-dom-safety §2 exists for.
    await page.click('.rm-grp-h[data-rail-grp="vanilla"] .rm-grp-chev');
    check('clicking the chevron glyph still opens the group',
        await displayOf(page, '#rm-vanilla-tree') !== 'none');
    check('and the chevron flips to match',
        await page.$eval('.rm-grp-h[data-rail-grp="vanilla"] .rm-grp-chev',
            (n) => n.textContent.trim()) === '▾');
    check('every vanilla area is present as a sub-group, by area not by act',
        await page.$$eval('#rm-vanilla-tree > ul > li.rn-area > .rn-area-label',
            (n) => n.map((e) => e.textContent.trim())).then((a) =>
            a.length >= 5 && a.includes('Prehistoria') && a.includes('Gothica')),
        'areas are the catalogue\'s own grouping — the mock\'s ACT 0..4 is its placeholder');

    // ── selection ────────────────────────────────────────────────────────
    await page.click('#rm-vanilla-tree li.vn-map');
    check('clicking a vanilla row selects it',
        await page.$eval('#rm-vanilla-tree li.vn-map', (n) => n.classList.contains('rsel')));
    check('and the row carries the accent bar the mock puts on a selection',
        await page.evaluate(() => {
            const bar = getComputedStyle(document.querySelector('li.rn-map.rsel'), '::before');
            return bar.width === '2px' && bar.backgroundColor !== 'rgba(0, 0, 0, 0)';
        }));
    // One combined list means one selection. Pre-7b each tree cleared only
    // its own `.rsel`, so a live and a vanilla row could both look selected.
    await page.click('#rm-live-tree li.rn-map[data-map="puzzle_wing"]');
    check('selecting a custom room clears the vanilla selection',
        await page.$$eval('.rn-map.rsel', (n) => n.length) === 1);
    check('and it is the right row',
        await page.$eval('.rn-map.rsel', (n) => n.dataset.map) === 'puzzle_wing');

    // ── area collapse ────────────────────────────────────────────────────
    await page.click('#rm-live-tree .rn-area-label');
    check('an area sub-group still collapses',
        await displayOf(page, '#rm-live-tree li.rn-area > ul.rt') === 'none');
    await page.click('#rm-live-tree .rn-area-label');
    check('and expands again',
        await displayOf(page, '#rm-live-tree li.rn-area > ul.rt') !== 'none');

    // ── search ───────────────────────────────────────────────────────────
    await page.fill('#rm-rail-q', 'sewers');
    const shown = await page.$$eval('li.rn-map', (n) => n
        .filter((e) => getComputedStyle(e).display !== 'none')
        .map((e) => e.textContent.trim()));
    check('search filters the list down to real matches',
        shown.length > 0 && shown.every((t) => /sewers/i.test(t)),
        JSON.stringify(shown));
    check('a group left with no matches is hidden entirely',
        await displayOf(page, '#rm-grp-live') === 'none');
    check('and a collapsed group is revealed so its matches are visible',
        await displayOf(page, '#rm-vanilla-tree') !== 'none');
    check('an area sub-header with no matches is hidden too',
        await page.evaluate(() => Array.from(document.querySelectorAll('li.rn-area'))
            .filter((a) => getComputedStyle(a).display !== 'none')
            .every((a) => !!a.querySelector('li.rn-map'))));
    // ids are as searchable as names — "0x12" is how a lot of this data reads.
    await page.fill('#rm-rail-q', '0x12');
    check('searching by room id works',
        await page.$$eval('li.rn-map', (n) => n
            .filter((e) => getComputedStyle(e).display !== 'none')
            .map((e) => e.dataset.vid)).then((v) => v.length === 1 && v[0] === '0x12'));

    await page.fill('#rm-rail-q', 'zzzzz');
    check('no matches shows an explicit empty state, not a blank rail',
        await displayOf(page, '#rm-rail-none') !== 'none');

    // Clearing restores the expansion state the user had, rather than
    // whatever the filter happened to force open.
    await page.fill('#rm-rail-q', '');
    check('clearing the search hides the empty state again',
        await displayOf(page, '#rm-rail-none') === 'none');
    check('every row comes back',
        await page.$$eval('li.rn-map.rm-off', (n) => n.length) === 0);
    await page.click('.rm-grp-h[data-rail-grp="vanilla"]');
    await page.fill('#rm-rail-q', 'sewers');
    await page.fill('#rm-rail-q', '');
    check('and a group the user closed stays closed through a search',
        await displayOf(page, '#rm-vanilla-tree') === 'none');

    // ── following an exit ────────────────────────────────────────────────
    // The one navigation path other code depends on (src/rooms/README.md
    // §Exits). Driven through the real delegated `[data-goto-map]` handler,
    // from the state that breaks it if it is not handled: the Vanilla group
    // closed *and* a filter hiding the row.
    await page.fill('#rm-rail-q', 'jungle');
    await page.evaluate(() => {
        document.querySelector('.rm-right').insertAdjacentHTML('afterbegin',
            '<a href="#" id="exit-probe" data-goto-map="0x12">Ebon Keep sewers</a>');
    });
    await page.click('#exit-probe');
    check('following an exit clears the filter on the way',
        await page.$eval('#rm-rail-q', (n) => n.value) === '');
    check('and opens the Vanilla group',
        await displayOf(page, '#rm-vanilla-tree') !== 'none');
    check('and lands on the destination room, selected',
        await page.$eval('.rn-map.rsel', (n) => n.dataset.vid) === '0x12');

    // ── + New Map ────────────────────────────────────────────────────────
    // A new map is a room of its own, under Custom rooms: "a new map creates
    // a new entry in custom rooms … you can only be in the vanilla room list
    // if you are a vanilla room". It used to open Strong Heart's Hut (0x34),
    // select it in the Vanilla list and draft over it. It still borrows that
    // room's graphics — through the draft, not the rail.
    await page.click('#rm-new-map');
    const made = await page.evaluate(() => {
        const sel = document.querySelectorAll('.rn-map.rsel');
        return {
            selected: sel.length,
            custom: sel[0] && sel[0].dataset.custom,
            inCustom: !!(sel[0] && sel[0].closest('#rm-live-tree')),
            label: sel[0] && sel[0].textContent,
            vanillaSelected: !!document.querySelector('.vn-map.rsel'),
            header: (document.querySelector('.rd-head .rd-name') || {}).textContent,
            vid: !!document.querySelector('.rd-head .rd-vid'),
            spawns: document.querySelectorAll('#rg-svg .svge-spawn, #rg-svg .svge-arrival').length,
        };
    });
    check('+ New Map adds an entry under Custom rooms and selects it',
        made.selected === 1 && !!made.custom && made.inCustom && /New map 1/.test(made.label)
        && /16×14/.test(made.label), JSON.stringify(made));
    check('and nothing in the Vanilla list is selected',
        !made.vanillaSelected, JSON.stringify(made));
    check('the room on screen is the new map, not Strong Heart\u2019s Hut',
        made.header === 'New map 1' && !made.vid && made.spawns === 0, JSON.stringify(made));
    // v0.71.0: "pressing new room multiple times does not open a new room,
    // if the current room is still in the default state/empty".
    await page.click('#rm-new-map');
    check('pressing it again on an untouched map reopens that map, no second entry',
        await page.evaluate(() => document.querySelectorAll('#rm-live-tree .cm-map').length === 1
            && document.querySelector('.cm-map.rsel').textContent.indexOf('New map 1') >= 0));
    // Once something is drawn a second press makes a second map —
    // map-editor-dom.test.js checks that, where the draft is reachable.

    // ── idempotent binding ───────────────────────────────────────────────
    // The rail node outlives its contents, so a second bind would stack a
    // second handler and every group toggle would cancel itself out
    // (webview-dom-safety §1). The shipped bundle wraps everything in one
    // IIFE, so the only way to re-run the binder against the real DOM is to
    // load a second copy of the file at global scope — which is exactly the
    // double-bind case.
    await page.addScriptTag({ path: path.join(__dirname, '..', '..',
        'src', 'rooms', 'webview', 'rooms-rail.js') });
    const before = await displayOf(page, '#rm-vanilla-tree');
    await page.click('.rm-grp-h[data-rail-grp="vanilla"]');
    const after = await displayOf(page, '#rm-vanilla-tree');
    check('binding the rail again does not double every click',
        (before === 'none') !== (after === 'none'),
        `display went ${before} -> ${after} after one click with the rail bound twice`);
    check('an id the catalogue does not list reports false rather than throwing',
        await page.evaluate(() => gotoVanillaRoom(0xffff)) === false);

    check('no uncaught errors in any of it', pageErrors.length === 0, pageErrors.join('; '));

    await browser.close();
    console.log(`\n  ${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
