'use strict';
// Ownership: a custom map's export archive — one .zip with the room blob,
// the editor document, a sample everscript file, the stamps it uses and a
// README. Pure: takes the vanilla ROM and the webview's payload, returns
// the archive bytes.
//
// The format is docs/map-format/custom-map-files.md §4.

const { buildExportRom, BRIAN_ROOM } = require('./rom-export');
const { mapDocument } = require('../data/custom-store');
const { buildZip } = require('../../shared/zip');

/** `New map 1` -> `new_map_1`: a file name every tool accepts. */
function mapSlug(name) {
    const s = String(name || 'map').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return s || 'map';
}

const hex = (n, w) => '0x' + Number(n).toString(16).padStart(w || 2, '0');

/**
 * The sample script: the everscript repo's `in/test_noinclude.evs` pattern —
 * the intro skips into the map, the enter script arms the Boy and fades in.
 * `start` is in the 8px units `load_map` takes.
 */
function sampleEvs(m, start, triggers) {
    const ident = mapSlug(m.name);
    const lines = [
        `// ${m.name} — a custom map from the Everscript map editor.`,
        '//',
        `// ${ident}.bin is the room blob. Export ROM writes it into Brian's room`,
        `// (MAP.BRIAN = ${hex(BRIAN_ROOM)}) and patches the intro and the enter script the`,
        '// way this file describes; this is the same thing as everscript source, to',
        '// start from. Needs the everscript core (in/core) for MEMORY, fade_in and',
        '// load_map — see in/test_noinclude.evs for a copy of them.',
        '',
        '@install(ADDRESS.INTRO_FIRST_CODE_EXECUTED)',
        'fun intro_skip() {',
        `    load_map(MAP.BRIAN, ${hex(start.x)}, ${hex(start.y)});`,
        '}',
        '',
        `map ${ident}(MAP.BRIAN) {`,
        '    enum entrance {',
        `        start = entrance(${hex(start.x)}, ${hex(start.y)}, NONE)`,
        '    }',
        '',
        '    @install()',
        '    fun trigger_enter() {',
        '        // A spear, so cuttable grass can be cut.',
        '        MEMORY.GAIN_WEAPON = GAIN_WEAPON.SPEAR_4;',
        '        fade_in();',
        '    }',
    ];
    if (triggers.length) {
        lines.push('', '    // Triggers drawn in the editor (metatile boxes, inclusive). They have no');
        lines.push('    // script yet — the blob carries none of them.');
        for (const t of triggers) {
            lines.push(`    //   ${t.kind === 'bTrigger' ? 'B-trigger ' : 'step-on   '} [${t.x},${t.y} : ${t.x + t.w - 1},${t.y + t.h - 1}]`
                + (typeof t.scriptId === 'number' ? ` script ${hex(t.scriptId)}` : ''));
        }
    }
    lines.push('};', '');
    return lines.join('\n');
}

function readme(m, slug, report, stampCount) {
    return [
        `# ${m.name}`,
        '',
        'A custom map exported by the Everscript VS Code extension\'s map editor.',
        'The format is documented in the extension\'s',
        '`docs/map-format/custom-map-files.md`.',
        '',
        '| File | What it is |',
        '|---|---|',
        `| \`${slug}.bin\` | the room blob, as written into room ${hex(BRIAN_ROOM)} |`,
        `| \`${slug}.map.json\` | the editor document — open it again in the editor |`,
        `| \`${slug}.evs\` | a sample everscript file that enters the map |`,
        '| `stamps.json` | every metatile the map uses, with its three words |',
        '',
        `- ${report.widthTiles}×${report.heightTiles} metatiles, graphics from room ${hex(m.borrow)}`,
        `- blob: ${report.blobBytes} bytes, ${report.metatiles} metatiles in its dictionary, `
            + `${report.wramBytes} of 32768 WRAM bytes`,
        `- ${stampCount} distinct stamps; ${report.cuttable} cuttable cells`,
        '',
    ].join('\n');
}

/**
 * `input` is `{map: {key, name, borrow, w, h, saved}, draft, stamps}`:
 * `draft` is the Export ROM payload (map-editor-rom-export.js
 * romExportPayload), `stamps` the webview's list of stamps in use.
 * Returns `{zip, fileName, report}`; throws if the map does not encode.
 */
function buildCustomMapArchive(vanilla, input) {
    const m = input.map;
    const slug = mapSlug(m.name);
    const built = buildExportRom(vanilla, input.draft);
    const doc = mapDocument(m, { created: m.created });
    const stamps = (input.stamps || []).map((s) => ({
        index: s.index, layer1: s.layer1, layer2: s.layer2, collision: s.collision,
        level: (s.collision >> 4) & 3, cells: s.cells || 0, cut: s.cut || 0,
    }));
    const placed = (m.saved && m.saved.placed) || [];
    const triggers = placed.filter((p) => !p.removed && (p.kind === 'bTrigger' || p.kind === 'stepOn'));
    const files = [
        { name: `${slug}/${slug}.bin`, data: built.blob },
        { name: `${slug}/${slug}.map.json`, data: JSON.stringify(doc, null, 2) },
        { name: `${slug}/${slug}.evs`, data: sampleEvs(m, built.report.start, triggers) },
        { name: `${slug}/stamps.json`, data: JSON.stringify({
            format: 'everscript-custom-map-stamps', version: 1, borrow: m.borrow, stamps,
        }, null, 2) },
        { name: `${slug}/README.md`, data: readme(m, slug, built.report, stamps.length) },
    ];
    return { zip: buildZip(files), fileName: slug + '.zip', report: built.report };
}

module.exports = { buildCustomMapArchive, mapSlug, sampleEvs };
