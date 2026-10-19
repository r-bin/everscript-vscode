// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Tests for Terranigma Maps Page HTML rendering.
// Run: node tests/terra/terra-maps-page.test.js

const assert = require('assert');
const { renderTerraMapsHtml } = require('../../dist/games/terra/maps/page');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e.message)); failed++; }
}

console.log('\nTerranigma — Maps Page HTML Tests:');

test('renderTerraMapsHtml renders complete, CSP-compliant HTML', () => {
    const html = renderTerraMapsHtml({
        cspSource: 'vscode-webview:',
        nonce: 'testnonce123',
        init: {
            title: 'Terranigma — Maps',
            variant: 'Terranigma · eu',
            romPath: '/mock/path/terra.sfc',
            roomCount: 1104,
            usedCount: 750,
            unusedCount: 354,
            tableAOffset: '$0D:959C (0x06959C)',
            tableBOffset: '$0D:A28C (0x06A28C)',
            rooms: [
                {
                    id: 0x000A,
                    hexId: '0x000A',
                    name: 'Crysta',
                    busAddress: 0x9A8350,
                    busHex: '$9A:8350',
                    fileOffset: 0x1A8350,
                    fileHex: '0x1A8350',
                    isUsed: true,
                    spcTrack: 0x14,
                    rawBytes: [0x02, 0x14, 0x00],
                    opcodes: [
                        { opcode: 0x02, name: 'Play SPC Track', bytes: [0x02, 0x14], summary: 'SPC Track $14' },
                        { opcode: 0x00, name: 'End of Header', bytes: [0x00], summary: 'Terminates header' },
                    ],
                },
                {
                    id: 0x0008,
                    hexId: '0x0008',
                    name: 'Unused Slot',
                    busAddress: 0x000002,
                    busHex: '$00:0002',
                    fileOffset: null,
                    fileHex: '—',
                    isUsed: false,
                    spcTrack: null,
                    rawBytes: [],
                    opcodes: [],
                },
            ],
        },
    });

    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('Content-Security-Policy'));
    assert.ok(html.includes('nonce-testnonce123'));
    assert.ok(html.includes('Terranigma · eu'));
    assert.ok(html.includes('0x06959C'));
    assert.ok(html.includes('0x06A28C'));
    assert.ok(html.includes('Maps: ◐ Partial'));
    assert.ok(html.includes('Crysta'));
    assert.ok(html.includes('0x000A'));
    assert.ok(html.includes('Unused Slot'));
    assert.ok(html.includes('Play SPC Track'));
});

test('renderTerraMapsHtml escapes HTML in room attributes', () => {
    const html = renderTerraMapsHtml({
        cspSource: 'vscode-webview:',
        nonce: 'xyz',
        init: {
            title: 'Terranigma — Maps',
            variant: '<script>alert(1)</script>',
            romPath: null,
            roomCount: 1,
            usedCount: 1,
            unusedCount: 0,
            tableAOffset: '$0D:959C',
            tableBOffset: '$0D:A28C',
            rooms: [
                {
                    id: 1,
                    hexId: '0x0001',
                    name: '<img src=x onerror=alert(1)>',
                    busAddress: 0x9A8000,
                    busHex: '$9A:8000',
                    fileOffset: 0x1A8000,
                    fileHex: '0x1A8000',
                    isUsed: true,
                    spcTrack: null,
                    rawBytes: [],
                    opcodes: [],
                },
            ],
        },
    });

    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

