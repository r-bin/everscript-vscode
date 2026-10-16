'use strict';
// Ownership: `soe://maps/` — maps virtual file system at root level.
// Supports both custom maps (`soe://maps/custom/<name>`) and maps overall.

const { dir, file, json, text } = require('./nodes');
const { resolveAssets } = require('./rom-assets');
const { encodePng, decodeRoom, renderRoomComposite } = require('../maps');
const { hexId } = require('./resource-uri');

function resolveMaps(segments, rom, deps) {
    const [head, ...rest] = segments;
    if (head === undefined) {
        return dir([
            ['index.md', 'file'],
            ['custom', 'dir'],
        ], () => indexMarkdown());
    }
    if (head === 'index.md') {
        return text(() => indexMarkdown());
    }
    if (head === 'custom') {
        return resolveCustom(rest, rom, deps);
    }
    // Route room id or asset segment (e.g. 15, 38) to resolveAssets(['maps', ...segments])
    return resolveAssets(['maps', ...segments], rom, deps);
}

function resolveCustom(segments, rom, deps) {
    const [customName, leaf] = segments;
    if (customName === undefined) {
        return dir([
            ['index.json', 'file'],
        ], () => '# Custom Maps\n\nCustom maps compiled for testing or saved in the map editor.\n');
    }
    if (customName === 'index.json') {
        return json(() => ({ maps: [] }));
    }

    const renderPngNode = file(() => {
        if (!rom) throw new Error('ROM required for custom map render');
        const clean = (rom.length % 1024 === 512) ? rom.subarray(512) : rom;
        const rId = 0x15;
        const d = decodeRoom(clean, rId);
        if (!d) throw new Error('Custom room ' + hexId(rId, 2) + ' not found in ROM');
        return encodePng(renderRoomComposite(clean, d));
    });

    if (leaf === undefined) {
        return dir([
            ['render.png', 'file'],
            ['info.md', 'file'],
        ], () => '# Custom Map: ' + decodeURIComponent(customName) + '\n\nPreview and details for custom map `' + decodeURIComponent(customName) + '`.\n');
    }
    if (leaf === 'render.png') {
        return renderPngNode;
    }
    if (leaf === 'info.md') {
        return text(() => '# Custom Map: ' + decodeURIComponent(customName) + '\n\nCompiled into Room 0x15.\n');
    }
    return null;
}

function indexMarkdown() {
    return '# Secret of Evermore Maps\n\n'
        + '- [`custom/`](soe://maps/custom/) - Custom maps created in the map editor\n';
}

module.exports = { resolveMaps };
