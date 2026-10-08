'use strict';
// The soe:// MCP server over real HTTP (src/mcp/protocol.js + server.js),
// with a stub file system: handshake, tools, resources, errors and the
// localhost-only guard. The live VS Code path is checked by hand / in a
// VS Code test instance (see the v0.180.0 commit).

const assert = require('assert');
const { createMcpHandler, mimeOf, hexdump } = require('../../src/mcp/protocol');
const { createMcpHttpServer } = require('../../src/mcp/server');

const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
const FILES = {
    'soe://rom/index.md': Buffer.from('# soe://rom/\n'),
    'soe://bus/7e0adb': Buffer.from('{"byte":97}'),
    'soe://rom/assets/icons/0056.png': PNG,
    'soe://rom/rom.sfc': Buffer.alloc(5000, 0xa9),
};
const handle = createMcpHandler({
    version: '9.9.9',
    read: async uri => { if (!(uri in FILES)) throw new Error('file not found'); return FILES[uri]; },
    list: async () => [['index.md', 'file'], ['assets', 'dir'], ['icon.png', 'link']],
});

let passed = 0, failed = 0;
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

let base, server;
async function rpc(method, params, { id = 1, headers = {} } = {}) {
    const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
        body: JSON.stringify(id === null ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id, method, params }),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
}

test('mimeOf: extension decides; a bare bus address is JSON', () => {
    assert.strictEqual(mimeOf('soe://rom/assets/icons/0056.png'), 'image/png');
    assert.strictEqual(mimeOf('soe://rom/header.json?rom=vanilla'), 'application/json');
    assert.strictEqual(mimeOf('soe://bus/7e0adb'), 'application/json');
    assert.strictEqual(mimeOf('soe://ram/2222[2].bin'), 'application/octet-stream');
});

test('hexdump caps at 4 KB and says how to read the rest', () => {
    const out = hexdump(Buffer.alloc(5000, 0x41));
    assert.match(out, /^5000 bytes\n00000000  41 41/);
    assert.match(out, /904 more bytes/);
});

test('initialize negotiates the protocol version', async () => {
    const r = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.result.protocolVersion, '2025-03-26');
    assert.deepStrictEqual(r.body.result.capabilities, { resources: {}, tools: {} });
    assert.strictEqual(r.body.result.serverInfo.version, '9.9.9');
    const latest = await rpc('initialize', { protocolVersion: '1999-01-01' });
    assert.strictEqual(latest.body.result.protocolVersion, '2025-06-18');
});

test('notifications get 202 and no body', async () => {
    const r = await rpc('notifications/initialized', undefined, { id: null });
    assert.strictEqual(r.status, 202);
    assert.strictEqual(r.body, null);
});

test('tools/list offers soe_list and soe_read, read-only', async () => {
    const { body } = await rpc('tools/list');
    assert.deepStrictEqual(body.result.tools.map(t => t.name), ['soe_list', 'soe_read']);
    assert.ok(body.result.tools.every(t => t.annotations.readOnlyHint));
});

test('soe_read: text, image, hex dump, and errors as tool results', async () => {
    const call = async uri => (await rpc('tools/call', { name: 'soe_read', arguments: { uri } })).body.result;
    assert.deepStrictEqual((await call('soe://bus/7e0adb')).content, [{ type: 'text', text: '{"byte":97}' }]);
    const img = (await call('soe://rom/assets/icons/0056.png')).content[0];
    assert.strictEqual(img.type, 'image');
    assert.strictEqual(img.mimeType, 'image/png');
    assert.ok(Buffer.from(img.data, 'base64').equals(PNG));
    assert.match((await call('soe://rom/rom.sfc')).content[0].text, /^5000 bytes\n00000000  a9 a9/);
    const missing = await call('soe://rom/nope.json');
    assert.strictEqual(missing.isError, true);
    assert.match(missing.content[0].text, /file not found/);
});

test('soe_list marks directories and links', async () => {
    const { body } = await rpc('tools/call', { name: 'soe_list', arguments: { uri: 'soe://rom' } });
    assert.strictEqual(body.result.content[0].text, '3 entries\nsoe://rom/index.md\nsoe://rom/assets/\nsoe://rom/icon.png  (link)');
});

test('bad arguments are protocol errors', async () => {
    const r = await rpc('tools/call', { name: 'soe_read', arguments: { uri: '/etc/passwd' } });
    assert.strictEqual(r.body.error.code, -32602);
    assert.strictEqual((await rpc('tools/call', { name: 'rm' })).body.error.code, -32602);
    assert.strictEqual((await rpc('nope/nope')).body.error.code, -32601);
});

test('resources: list, templates, read text and blob', async () => {
    const list = (await rpc('resources/list')).body.result.resources;
    assert.ok(list.some(r => r.uri === 'soe://ram/status.json'));
    const templates = (await rpc('resources/templates/list')).body.result.resourceTemplates;
    assert.ok(templates.some(t => t.uriTemplate === 'soe://bus/{addr}'));
    const md = (await rpc('resources/read', { uri: 'soe://rom/index.md' })).body.result.contents[0];
    assert.deepStrictEqual(md, { uri: 'soe://rom/index.md', mimeType: 'text/markdown', text: '# soe://rom/\n' });
    const png = (await rpc('resources/read', { uri: 'soe://rom/assets/icons/0056.png' })).body.result.contents[0];
    assert.strictEqual(png.blob, PNG.toString('base64'));
    assert.strictEqual((await rpc('resources/read', { uri: 'soe://rom/nope.json' })).body.error.code, -32002);
});

test('HTTP: only POST /mcp, only local Origin', async () => {
    assert.strictEqual((await fetch(base)).status, 405);
    assert.strictEqual((await fetch(base.replace('/mcp', '/x'), { method: 'POST' })).status, 404);
    assert.strictEqual((await rpc('ping', {}, { headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.strictEqual((await rpc('ping', {}, { headers: { Origin: 'http://localhost:1234' } })).status, 200);
    const bad = await fetch(base, { method: 'POST', body: '{nope' });
    assert.strictEqual((await bad.json()).error.code, -32700);
});

(async () => {
    server = createMcpHttpServer(handle);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}/mcp`;
    for (const t of tests) {
        try { await t.fn(); console.log('  ✓ ' + t.name); passed++; }
        catch (e) { console.error('  ✗ ' + t.name + '\n    ' + e.message); failed++; }
    }
    server.close();
    console.log('\n' + (passed + failed) + ' run: ' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
})();
