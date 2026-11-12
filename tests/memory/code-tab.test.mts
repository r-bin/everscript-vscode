// Code tab (src/games/evermore/code-tab): the host against a stub soe:// reader (no ROM), the new
// soe://rom/code/<name>/routine.json and .pseudo.c on the ROM of the ROM library, and the page in
// headless Chromium answered by the real host reading the VFS: rail and filter, a routine with its
// callers and calls as links, the asm read when shown, C and Pseudo-C, a call followed and back,
// a branch jump, the deep search. ROM checks skip without the Evermore ROM; the page without playwright.
// `CODE_TAB_SHOT=<dir>` saves screenshots.
// Run: node tests/memory/code-tab.test.mts
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { handlesCodeMessage, handleCodeMessage, buildCodeTabHtml } = require('../../dist/games/evermore/code-tab');
const { renderRadarHtml } = require('../../dist/games/evermore/memory/render-radar');

let passed = 0, failed = 0;
async function test(name: string, fn: () => unknown): Promise<void> {
    try { await fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + ((e as Error)?.stack || e)); failed++; }
}

type Msg = Record<string, any>;
/** The host with `read` answering from `files` (uri → text). */
const stubDeps = (files: Record<string, string>, out: Msg[], opened: string[] = []) => ({
    post: (m: Msg) => out.push(m),
    read: async (uri: string) => { if (!(uri in files)) throw new Error('not found: ' + uri); return files[uri]; },
    open: (uri: string) => opened.push(uri),
});

async function unit(): Promise<void> {
    console.log('\nCode tab — unit');
    await test('scaffold: pane, search, three columns; the radar carries the tab and its script', () => {
        const html = buildCodeTabHtml();
        for (const id of ['code-search', 'code-rail', 'code-mid', 'code-side', 'code-back']) assert.ok(html.includes('id="' + id + '"'), id);
        const radar = renderRadarHtml({ kind: 'function', name: 'f', startLine: 0, endLine: 1 }, new Map(), [], new Map(), new Map(), [], 'radar', null);
        assert.ok(radar.includes('data-tab="code"') && radar.includes('CodeTab.setupCodeTab') && !radar.includes('__CODE_JS__'));
    });
    await test('host: index slimmed, a version read only from routine.json, paths refused, open', async () => {
        assert.ok(handlesCodeMessage('codeInit') && !handlesCodeMessage('scriptsInit'));
        const B = 'soe://rom/code/';
        const files = {
            [B + 'index.json']: JSON.stringify([{ name: 'a_b', title: 'T', category: null, confidence: 'likely', us: '$808000', addr: '$808000', c: 'x.c:1', todo: ['magic'], entry: 'e' }]),
            [B + 'a_b/routine.json']: JSON.stringify({ name: 'a_b', versions: { asm: 'a_b.asm', c: null, pseudo: { file: 'a_b.pseudo.c', source: 's' } } }),
            [B + 'a_b/a_b.asm']: '; asm', [B + 'a_b/a_b.pseudo.c']: '// pseudo',
        };
        const out: Msg[] = [], opened: string[] = [];
        const deps = stubDeps(files, out, opened);
        await handleCodeMessage({ command: 'codeInit' }, deps);
        assert.deepStrictEqual(out.pop(), { command: 'codeIndex', canOpen: true, routines: [{ name: 'a_b', title: 'T', category: null, confidence: 'likely', us: '$808000', addr: '$808000', c: true, todo: 1 }] });
        await handleCodeMessage({ command: 'codeText', name: 'a_b', version: 'pseudo' }, deps);
        assert.strictEqual(out.pop()!.text, '// pseudo');
        await handleCodeMessage({ command: 'codeText', name: 'a_b', version: 'c' }, deps);
        assert.ok(/No c version/.test(out.pop()!.error));
        await handleCodeMessage({ command: 'codeRoutine', name: '../x' }, deps);
        assert.ok(out.pop()!.error);
        await handleCodeMessage({ command: 'codeOpen', name: 'a_b', file: '../../x' }, deps);
        await handleCodeMessage({ command: 'codeOpen', name: 'a_b', file: 'a_b.asm' }, deps);
        assert.deepStrictEqual(opened, [B + 'a_b/a_b.asm']);
        await handleCodeMessage({ command: 'codeInit' }, stubDeps({}, out));
        const failed = out.pop()!;
        assert.ok(failed.command === 'codeIndex' && /not found/.test(failed.error), 'a failed index answers as codeIndex');
    });
}

/** A soe:// reader over `resolveRom` (what the extension's file system answers), for one ROM. */
function vfsReader(rom: Uint8Array) {
    const { resolveRom } = require('../../dist/games/evermore/resources/rom-files');
    return async (uri: string): Promise<string> => {
        const [p, query] = uri.replace(/^soe:\/\/rom\//, '').split('?');
        const node = resolveRom(p.split('/'), rom, { query: query || '' });
        if (!node || !node.read) throw new Error('not found: ' + uri);
        return String(await node.read());
    };
}

async function romChecks(read: (uri: string) => Promise<string>): Promise<void> {
    console.log('\nCode tab — ROM (soe://rom/code/)');
    await test('routine.json: entry, place, calls by name, callers, versions', async () => {
        const r = JSON.parse(await read('soe://rom/code/main_loop_entry/routine.json'));
        assert.strictEqual(r.name, 'main_loop_entry');
        assert.strictEqual(r.us, r.addr);
        assert.ok(r.calls.filter((c: Msg) => c.name).length >= 10, 'calls named');
        assert.ok(r.callers.length >= 1, 'callers');
        assert.ok(r.versions.asm === 'main_loop_entry.asm' && r.versions.c && r.versions.pseudo);
        assert.ok(r.instructions > 0 && Array.isArray(r.todo) && Array.isArray(r.wram));
    });
    await test('.pseudo.c is another source than reconstructed-c/; none says so', async () => {
        const p = await read('soe://rom/code/main_loop_entry/main_loop_entry.pseudo.c');
        assert.ok(/Source: (curated|snesrecomp)/.test(p), p.slice(0, 200));
        assert.ok((await read('soe://rom/code/reset_handler/reset_handler.pseudo.c')).includes('no C from another source'));
    });
}

async function dom(read: (uri: string) => Promise<string>): Promise<void> {
    let chromium;
    try { ({ chromium } = require('playwright')); } catch { console.log('\nCode tab DOM: playwright not installed — skipped'); return; }
    let browser;
    try { browser = await chromium.launch(); } catch { console.log('\nCode tab DOM: no browser — skipped'); return; }
    console.log('\nCode tab — DOM');
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    const errors: string[] = [];
    page.on('pageerror', (e: Error) => errors.push(String(e)));
    const stub = '<script>window.__posted=[];window.acquireVsCodeApi=function(){return{postMessage:function(m){window.__posted.push(m)},getState:function(){return null},setState:function(){}}};<\/script>';
    const html = renderRadarHtml({ kind: 'function', name: 'f', startLine: 0, endLine: 1 }, new Map(), [], new Map(), new Map(), [], 'radar', null);
    await page.setContent(html.replace('<head>', '<head>' + stub));
    const opened: string[] = [];
    const deps = { post: (m: Msg) => out.push(m), read, open: (u: string) => opened.push(u) };
    const out: Msg[] = [];
    const pump = async () => {
        for (let i = 0; i < 6; i++) {
            const asked: Msg[] = await page.evaluate(() => (window as any).__posted.splice(0));
            for (const m of asked) if (handlesCodeMessage(m.command)) await handleCodeMessage(m, deps);
            const answers = out.splice(0);
            for (const m of answers) await page.evaluate((x: Msg) => window.postMessage(x, '*'), m);
            await page.waitForTimeout(30);
            if (!asked.length && !answers.length) return;
        }
    };
    const shot = async (name: string) => { if (process.env.CODE_TAB_SHOT) await page.screenshot({ path: path.join(process.env.CODE_TAB_SHOT, 'code-' + name + '.png') }); };
    await test('opening the tab lists every routine by bank', async () => {
        await page.click('.tab[data-tab="code"]');
        await pump();
        assert.ok(await page.locator('#code-rail .scr-item').count() > 1000);
        assert.ok(await page.locator('#code-rail .scr-group').count() > 10);
    });
    await test('filter, pick: callers and calls are links, the asm arrives as text when shown', async () => {
        await page.fill('#code-search', 'main_loop_entry');
        assert.strictEqual(await page.locator('#code-rail .scr-item').count(), 1);
        await page.click('#code-rail [data-code-go="main_loop_entry"]');
        await pump();
        assert.ok(await page.locator('#code-mid .code-refs a[data-code-go]').count() >= 11);
        assert.ok(await page.locator('#code-mid .code-asm tr').count() > 10);
        assert.ok(await page.locator('#code-mid .code-asm .code-ins a.code-link').count() >= 5, 'calls in the asm link');
        assert.ok(await page.locator('#code-mid .code-asm .code-note').filter({ hasText: /\w/ }).count() > 5, 'comments');
        assert.ok((await page.textContent('#code-side'))!.includes('Open work'));
        await shot('asm');
    });
    await test('C and Pseudo-C, each read once; a routine name in C links', async () => {
        await page.click('[data-code-ver="c"]');
        await pump();
        assert.ok(await page.locator('#code-mid pre.code-c').count() === 1);
        assert.ok(await page.locator('#code-mid pre.code-c .code-cmt').count() > 0);
        await shot('c');
        await page.click('[data-code-ver="pseudo"]');
        await pump();
        assert.ok((await page.textContent('#code-mid pre.code-c'))!.includes('Source:'));
        await page.click('[data-code-ver="asm"]');
        const asked: Msg[] = await page.evaluate(() => (window as any).__posted.slice());
        assert.ok(!asked.some((m) => m.command === 'codeText'), 'the asm is cached');
    });
    await test('a call followed, then back; a branch jumps to its line', async () => {
        const to = await page.getAttribute('#code-mid .code-refs a[data-code-go] >> nth=-1', 'data-code-go');
        await page.click('#code-mid .code-refs a[data-code-go] >> nth=-1');
        await pump();
        assert.ok((await page.textContent('#code-mid .code-meta'))!.includes(to!));
        await page.click('#code-back');
        await pump();
        assert.ok((await page.textContent('#code-mid .code-meta'))!.includes('main_loop_entry'));
        const jump = page.locator('#code-mid a.code-jump').first();
        if (await jump.count()) { await jump.click(); assert.ok(await page.locator('#code-mid tr.code-flash').count() === 1); }
        await page.click('#code-side [data-code-open$=".asm"]');
        await pump();
        assert.deepStrictEqual(opened, ['soe://rom/code/main_loop_entry/main_loop_entry.asm']);
    });
    await test('deep search (Enter) finds routines by an asm comment', async () => {
        await page.fill('#code-search', 'Force Blank');
        assert.strictEqual(await page.locator('#code-rail [data-code-go="reset_handler"]').count(), 0, 'not in its name or title');
        await page.press('#code-search', 'Enter');
        await pump();
        assert.ok(await page.locator('#code-rail [data-code-go="reset_handler"]').count() === 1);
        assert.ok((await page.textContent('#code-rail .code-deep'))!.includes('Deep search'));
        await shot('deep');
    });
    await test('no page errors', () => assert.deepStrictEqual(errors, []));
    await browser.close();
}

await unit();
const romPath: string | null = require('../../dist/games').romPath('evermore');
if (romPath && fs.existsSync(romPath)) {
    let rom: Uint8Array = fs.readFileSync(romPath);
    if (rom.length % 0x8000 === 0x200) rom = rom.subarray(0x200);
    const read = vfsReader(rom);
    await romChecks(read);
    await dom(read);
} else console.log('\nCode tab: no Evermore ROM — ROM and DOM checks skipped');
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
