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
        { frame: 120, id: 'logo', name: 'Squaresoft Logo', hold: 180 },
        { frame: 600, id: 'mansion', name: 'Prologue: Mansion', hold: 400 },
        { frame: 1100, id: 'lab', name: 'Prologue: Laboratory', hold: 400 },
        { frame: 2200, id: 'title', name: 'Title Screen', hold: 600 },
        { frame: 3000, id: 'prehistoria', name: 'Demo 1: Prehistoria', hold: 400 },
        { frame: 3600, id: 'antiqua', name: 'Demo 2: Antiqua', hold: 400 },
        { frame: 4800, id: 'gothica', name: 'Demo 3: Gothica', hold: 400 },
        { frame: 5700, id: 'omnitopia', name: 'Demo 4: Omnitopia', hold: 400 },
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
        bgmode: number;
        bg1sc: number;
        bg2sc: number;
        bg3sc: number;
        bg12nba: number;
        bg34nba: number;
        tm: number;
        ts: number;
        cgwsel: number;
        cgadsub: number;
        bg1_scroll_x: number;
        bg1_scroll_y: number;
        bg2_scroll_x: number;
        bg2_scroll_y: number;
        bg3_scroll_x: number;
        bg3_scroll_y: number;
        hold: number;
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

            const bgmode = M._readMemory(0x2105);
            const bg1sc = M._readMemory(0x2107);
            const bg2sc = M._readMemory(0x2108);
            const bg3sc = M._readMemory(0x2109);
            const bg12nba = M._readMemory(0x210B);
            const bg34nba = M._readMemory(0x210C);
            const tm = M._readMemory(0x212C);
            const ts = M._readMemory(0x212D);
            const cgwsel = M._readMemory(0x2130);
            const cgadsub = M._readMemory(0x2131);

            const bg1_scroll_x = M._readMemory(0x7E010E) | (M._readMemory(0x7E010F) << 8);
            const bg1_scroll_y = M._readMemory(0x7E0110) | (M._readMemory(0x7E0111) << 8);
            const bg2_scroll_x = M._readMemory(0x7E0112) | (M._readMemory(0x7E0113) << 8);
            const bg2_scroll_y = M._readMemory(0x7E0114) | (M._readMemory(0x7E0115) << 8);
            const bg3_scroll_x = M._readMemory(0x7E0116) | (M._readMemory(0x7E0117) << 8);
            const bg3_scroll_y = M._readMemory(0x7E0118) | (M._readMemory(0x7E0119) << 8);

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
                    bgmode, bg1sc, bg2sc, bg3sc, bg12nba, bg34nba, tm, ts, cgwsel, cgadsub,
                    bg1_scroll_x, bg1_scroll_y, bg2_scroll_x, bg2_scroll_y, bg3_scroll_x, bg3_scroll_y,
                    hold: sc.hold,
                });
                console.log(`  [${sc.id}] Extracted Squaresoft logo (pal=${pal.length}b, tiles=${logoTiles1.length + logoTiles3.length}b, scroll=(${bg1_scroll_x},${bg1_scroll_y}))`);
            } else {
                const map = Buffer.from(heap.subarray(vramPtr + 0x0000, vramPtr + 0x1800)); // 6144
                const tiles = Buffer.from(heap.subarray(vramPtr + 0x4000, vramPtr + 0xC000)); // 32768
                extracted.push({
                    id: sc.id,
                    name: sc.name,
                    pal,
                    map,
                    tiles,
                    bgmode, bg1sc, bg2sc, bg3sc, bg12nba, bg34nba, tm, ts, cgwsel, cgadsub,
                    bg1_scroll_x, bg1_scroll_y, bg2_scroll_x, bg2_scroll_y, bg3_scroll_x, bg3_scroll_y,
                    hold: sc.hold,
                });
                console.log(`  [${sc.id}] Extracted ${sc.name} (pal=${pal.length}b, map=${map.length}b, tiles=${tiles.length}b, scroll=(${bg1_scroll_x},${bg1_scroll_y}))`);
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
    for (const sc of extracted) {
        cSource += '    {\n';
        cSource += `        "${sc.name}",\n`;
        cSource += `        scene_pal_${sc.id}, sizeof(scene_pal_${sc.id}),\n`;
        if (sc.id === 'logo') {
            cSource += `        logo_map1, sizeof(logo_map1),\n`;
            cSource += `        logo_map3, sizeof(logo_map3),\n`;
            cSource += `        logo_tiles1, sizeof(logo_tiles1),\n`;
            cSource += `        logo_tiles3, sizeof(logo_tiles3),\n`;
            cSource += `        0, 0, 0, 0,\n`;
        } else {
            cSource += `        0, 0, 0, 0, 0, 0, 0, 0,\n`;
            cSource += `        scene_map_${sc.id}, sizeof(scene_map_${sc.id}),\n`;
            cSource += `        scene_tiles_${sc.id}, sizeof(scene_tiles_${sc.id}),\n`;
        }
        cSource += `        0x${sc.bgmode.toString(16).padStart(2, '0')}, 0x${sc.bg1sc.toString(16).padStart(2, '0')}, 0x${sc.bg2sc.toString(16).padStart(2, '0')}, 0x${sc.bg3sc.toString(16).padStart(2, '0')},\n`;
        cSource += `        0x${sc.bg12nba.toString(16).padStart(2, '0')}, 0x${sc.bg34nba.toString(16).padStart(2, '0')},\n`;
        cSource += `        0x${sc.tm.toString(16).padStart(2, '0')}, 0x${sc.ts.toString(16).padStart(2, '0')}, 0x${sc.cgwsel.toString(16).padStart(2, '0')}, 0x${sc.cgadsub.toString(16).padStart(2, '0')},\n`;
        cSource += `        ${sc.bg1_scroll_x}, ${sc.bg1_scroll_y},\n`;
        cSource += `        ${sc.bg2_scroll_x}, ${sc.bg2_scroll_y},\n`;
        cSource += `        ${sc.bg3_scroll_x}, ${sc.bg3_scroll_y},\n`;
        cSource += `        ${sc.hold} /* hold frames */\n`;
        cSource += '    },\n';
    }
    cSource += '};\n';

    const outPath = join(REPO, 'standalone-c-rom', 'assets.c');
    writeFileSync(outPath, cSource);
    console.log(`Wrote ${outPath} (${cSource.length} bytes)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await extractAssets(process.argv[2]);
}
