// Extract vanilla Secret of Evermore opening 2-minute attract sequence assets at build time.
// Decodes the user's local clean ROM at runtime (AGENTS.md Rule 0.1).
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { boot, stripHeader, REPO } from '../tools/c-to-rom/emu.mts';

export async function extractAssets(romPath?: string): Promise<void> {
    let path = romPath || process.env.EVERMORE_ROM;
    if (!path) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            path = require('../tools/rom.js').baseRomOrExit('evermore');
        } catch {
            // Fallback: look for base ROM in repository root
            const files = readdirSync(REPO);
            const found = files.find(f => (f.endsWith('.sfc') || f.endsWith('.smc')) && !f.includes('intro-replay'));
            if (found) path = join(REPO, found);
        }
    }
    if (!path || !existsSync(path)) {
        throw new Error(`Base clean ROM not found. Specify via EVERMORE_ROM env var or tools/rom.js.`);
    }

    console.log(`Extracting 2-minute attract loop assets from ${path}...`);
    const rom = stripHeader(readFileSync(path));
    const core = await boot(rom);

    const scenes = [
        { frame: 120, id: 'logo', name: 'Squaresoft Logo' },
        { frame: 600, id: 'mansion', name: 'Prologue: Mansion' },
        { frame: 1000, id: 'lab', name: 'Prologue: Laboratory' },
        { frame: 2200, id: 'title', name: 'Title Screen' },
        { frame: 3000, id: 'prehistoria', name: 'Demo 1: Prehistoria' },
        { frame: 3600, id: 'antiqua', name: 'Demo 2: Antiqua' },
        { frame: 4800, id: 'gothica', name: 'Demo 3: Gothica' },
        { frame: 5700, id: 'omnitopia', name: 'Demo 4: Omnitopia' },
    ];

    const extracted: Array<{
        id: string;
        name: string;
        pal: Buffer;
        map: Buffer;
        tiles: Buffer;
        logoMap1?: Buffer;
        logoMap3?: Buffer;
        logoTiles1?: Buffer;
        logoTiles3?: Buffer;
    }> = [];

    let sceneIdx = 0;
    for (let frame = 1; frame <= 5700; frame++) {
        core.frame(0);
        if (sceneIdx < scenes.length && frame === scenes[sceneIdx].frame) {
            const sc = scenes[sceneIdx];
            const M = core.M;
            const vramPtr = M._getSpacePtr(0);
            const cgramPtr = M._getSpacePtr(1);
            const heap = Buffer.from((globalThis as any).HEAPU8.buffer);

            const pal = Buffer.from(heap.subarray(cgramPtr, cgramPtr + 512));

            if (sc.id === 'logo') {
                const logoMap1 = Buffer.from(heap.subarray(vramPtr + 0x0000, vramPtr + 0x0800)); // 2048
                const logoMap3 = Buffer.from(heap.subarray(vramPtr + 0x1000, vramPtr + 0x1800)); // 2048
                const logoTiles3 = Buffer.from(heap.subarray(vramPtr + 0x4000, vramPtr + 0x5800)); // 6144
                const logoTiles1 = Buffer.from(heap.subarray(vramPtr + 0x8000, vramPtr + 0xA800)); // 10240
                extracted.push({
                    id: sc.id,
                    name: sc.name,
                    pal,
                    map: Buffer.alloc(0),
                    tiles: Buffer.alloc(0),
                    logoMap1,
                    logoMap3,
                    logoTiles1,
                    logoTiles3,
                });
                console.log(`  [${sc.id}] Extracted Squaresoft logo (pal=${pal.length}b, tiles=${logoTiles1.length + logoTiles3.length}b)`);
            } else {
                const map = Buffer.from(heap.subarray(vramPtr + 0x0000, vramPtr + 0x1800)); // 6144
                const tiles = Buffer.from(heap.subarray(vramPtr + 0x4000, vramPtr + 0xC000)); // 32768
                extracted.push({
                    id: sc.id,
                    name: sc.name,
                    pal,
                    map,
                    tiles,
                });
                console.log(`  [${sc.id}] Extracted ${sc.name} (pal=${pal.length}b, map=${map.length}b, tiles=${tiles.length}b)`);
            }
            sceneIdx++;
        }
    }

    function formatArray(name: string, data: Uint8Array): string {
        let out = `const uint8_t ${name}[${data.length}] = {\n`;
        for (let i = 0; i < data.length; i += 16) {
            const chunk = Array.from(data.subarray(i, Math.min(i + 16, data.length)));
            out += '    ' + chunk.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ') + ',\n';
        }
        out += '};\n\n';
        return out;
    }

    let cSource = '/* Generated at build time from clean ROM - do not edit manually */\n';
    cSource += '#include "assets.h"\n\n';

    // 1. Output raw arrays
    for (const sc of extracted) {
        cSource += formatArray(`scene_pal_${sc.id}`, sc.pal);
        if (sc.id === 'logo') {
            cSource += formatArray('logo_map1', sc.logoMap1!);
            cSource += formatArray('logo_map3', sc.logoMap3!);
            cSource += formatArray('logo_tiles1', sc.logoTiles1!);
            cSource += formatArray('logo_tiles3', sc.logoTiles3!);
        } else {
            cSource += formatArray(`scene_map_${sc.id}`, sc.map);
            cSource += formatArray(`scene_tiles_${sc.id}`, sc.tiles);
        }
    }

    // 2. Output scene table
    cSource += 'const scene_desc_t g_replay_scenes[NUM_REPLAY_SCENES] = {\n';

    // Scene 0: Logo
    cSource += '    {\n';
    cSource += '        "Squaresoft Logo",\n';
    cSource += '        scene_pal_logo, sizeof(scene_pal_logo),\n';
    cSource += '        logo_map1, sizeof(logo_map1),\n';
    cSource += '        logo_map3, sizeof(logo_map3),\n';
    cSource += '        logo_tiles1, sizeof(logo_tiles1),\n';
    cSource += '        logo_tiles3, sizeof(logo_tiles3),\n';
    cSource += '        0, 0, 0, 0,\n';
    cSource += '        0x79, 0x00, 0x00, 0x08, 0x44, 0x02, 0x05, 0x02, 0x02, 0x63,\n';
    cSource += '        180 /* hold frames (3 seconds) */\n';
    cSource += '    },\n';

    // Scene 1: Mansion
    cSource += '    {\n';
    cSource += '        "Prologue: Mansion",\n';
    cSource += '        scene_pal_mansion, sizeof(scene_pal_mansion),\n';
    cSource += '        0, 0, 0, 0, 0, 0, 0, 0,\n';
    cSource += '        scene_map_mansion, sizeof(scene_map_mansion),\n';
    cSource += '        scene_tiles_mansion, sizeof(scene_tiles_mansion),\n';
    cSource += '        0x39, 0x00, 0x04, 0x08, 0x22, 0x00, 0x17, 0x00, 0x02, 0x00,\n';
    cSource += '        600 /* hold frames (10 seconds) */\n';
    cSource += '    },\n';

    // Scene 2: Lab
    cSource += '    {\n';
    cSource += '        "Prologue: Laboratory",\n';
    cSource += '        scene_pal_lab, sizeof(scene_pal_lab),\n';
    cSource += '        0, 0, 0, 0, 0, 0, 0, 0,\n';
    cSource += '        scene_map_lab, sizeof(scene_map_lab),\n';
    cSource += '        scene_tiles_lab, sizeof(scene_tiles_lab),\n';
    cSource += '        0x39, 0x00, 0x04, 0x08, 0x22, 0x00, 0x17, 0x00, 0x02, 0x00,\n';
    cSource += '        600 /* hold frames (10 seconds) */\n';
    cSource += '    },\n';

    // Scene 3: Title Screen
    cSource += '    {\n';
    cSource += '        "Title Screen",\n';
    cSource += '        scene_pal_title, sizeof(scene_pal_title),\n';
    cSource += '        0, 0, 0, 0, 0, 0, 0, 0,\n';
    cSource += '        scene_map_title, sizeof(scene_map_title),\n';
    cSource += '        scene_tiles_title, sizeof(scene_tiles_title),\n';
    cSource += '        0x39, 0x00, 0x04, 0x08, 0x22, 0x00, 0x17, 0x00, 0x02, 0x00,\n';
    cSource += '        1200 /* hold frames (20 seconds) */\n';
    cSource += '    },\n';

    // Scene 4: Prehistoria
    cSource += '    {\n';
    cSource += '        "Demo 1: Prehistoria",\n';
    cSource += '        scene_pal_prehistoria, sizeof(scene_pal_prehistoria),\n';
    cSource += '        0, 0, 0, 0, 0, 0, 0, 0,\n';
    cSource += '        scene_map_prehistoria, sizeof(scene_map_prehistoria),\n';
    cSource += '        scene_tiles_prehistoria, sizeof(scene_tiles_prehistoria),\n';
    cSource += '        0x39, 0x00, 0x04, 0x08, 0x22, 0x00, 0x17, 0x11, 0x02, 0x02,\n';
    cSource += '        1000 /* hold frames (16.6 seconds) */\n';
    cSource += '    },\n';

    // Scene 5: Antiqua
    cSource += '    {\n';
    cSource += '        "Demo 2: Antiqua",\n';
    cSource += '        scene_pal_antiqua, sizeof(scene_pal_antiqua),\n';
    cSource += '        0, 0, 0, 0, 0, 0, 0, 0,\n';
    cSource += '        scene_map_antiqua, sizeof(scene_map_antiqua),\n';
    cSource += '        scene_tiles_antiqua, sizeof(scene_tiles_antiqua),\n';
    cSource += '        0x39, 0x00, 0x04, 0x08, 0x22, 0x00, 0x17, 0x00, 0x02, 0x00,\n';
    cSource += '        1000 /* hold frames (16.6 seconds) */\n';
    cSource += '    },\n';

    // Scene 6: Gothica
    cSource += '    {\n';
    cSource += '        "Demo 3: Gothica",\n';
    cSource += '        scene_pal_gothica, sizeof(scene_pal_gothica),\n';
    cSource += '        0, 0, 0, 0, 0, 0, 0, 0,\n';
    cSource += '        scene_map_gothica, sizeof(scene_map_gothica),\n';
    cSource += '        scene_tiles_gothica, sizeof(scene_tiles_gothica),\n';
    cSource += '        0x39, 0x00, 0x04, 0x08, 0x22, 0x00, 0x17, 0x00, 0x02, 0x00,\n';
    cSource += '        1000 /* hold frames (16.6 seconds) */\n';
    cSource += '    },\n';

    // Scene 7: Omnitopia
    cSource += '    {\n';
    cSource += '        "Demo 4: Omnitopia",\n';
    cSource += '        scene_pal_omnitopia, sizeof(scene_pal_omnitopia),\n';
    cSource += '        0, 0, 0, 0, 0, 0, 0, 0,\n';
    cSource += '        scene_map_omnitopia, sizeof(scene_map_omnitopia),\n';
    cSource += '        scene_tiles_omnitopia, sizeof(scene_tiles_omnitopia),\n';
    cSource += '        0x39, 0x00, 0x04, 0x08, 0x22, 0x00, 0x17, 0x11, 0x02, 0x02,\n';
    cSource += '        1000 /* hold frames (16.6 seconds) */\n';
    cSource += '    },\n';

    cSource += '};\n';

    const outPath = join(REPO, 'standalone-c-rom', 'assets.c');
    writeFileSync(outPath, cSource);
    console.log(`Wrote ${outPath} (${cSource.length} bytes)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await extractAssets(process.argv[2]);
}
