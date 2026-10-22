// Ownership: the Data tab's host side: answers the webview's requests. No VS
// Code dependency. extension.js injects the ROM loader, `post`, and the
// character list (the Characters tab's, with its thumbnails), so this domain
// never imports another feature.
//
//   page -> dataInit                      host -> dataIndex { tables, enums, palettes } | { error }
//   page -> dataPaletteSamples { family }  host -> dataPaletteSamples { family, samples } | { family, error }

import { tablesModel } from './model/tables';
import { enumsModel } from './model/enums';
import { palettesModel, mapPaletteSamples } from './model/palettes';
import type { CharacterInfo } from './model/palettes';
import * as maps from '../maps';
import { missingRomText } from '../../../platform/roms/library';

type Rom = Uint8Array;
interface Deps {
    post(message: object): void;
    loadRom(): Buffer | Uint8Array | null;
    /** Every character record: index, name, palette address, thumbnails (sprites/character-model.ts). */
    characters(rom: Rom): CharacterInfo[];
}

let _cache: { rom: Rom | null; index: object | null } = { rom: null, index: null };

const COMMANDS = new Set(['dataInit', 'dataPaletteSamples']);
const handlesDataMessage = (command: unknown): boolean => COMMANDS.has(String(command));

/** The formulas' ring-menu icons, in formula order, as PNG data URIs. */
function formulaIcons(rom: Rom): (string | null)[] {
    return Array.from({ length: maps.ALCHEMY_FORMULAS }, (_, i) => {
        const id = maps.alchemyIconId(rom, i);
        const img = id == null ? null : maps.renderItemIcon(rom, id);
        return img ? maps.encodePngDataUri(img) : null;
    });
}

function handleDataMessage(msg: { command: string; family?: number }, deps: Deps): void {
    const reply = msg.command === 'dataInit' ? 'dataIndex' : msg.command;
    const buf = deps.loadRom();
    if (!buf) { deps.post({ command: reply, error: missingRomText('evermore') }); return; }
    const rom = buf.length % 0x8000 === 0x200 ? buf.subarray(0x200) : buf;
    try {
        if (msg.command === 'dataPaletteSamples') {
            deps.post({ command: reply, family: msg.family, samples: mapPaletteSamples(rom, Number(msg.family)) });
            return;
        }
        if (_cache.rom !== rom || !_cache.index) {
            const chars = deps.characters(rom);
            _cache = { rom, index: { tables: tablesModel(rom, chars), enums: enumsModel(rom, chars, formulaIcons(rom)), palettes: palettesModel(rom, chars) } };
        }
        deps.post({ command: reply, ..._cache.index });
    } catch (err) {
        deps.post({ command: reply, family: msg.family, error: String(err instanceof Error ? err.message : err) });
    }
}

export { handlesDataMessage, handleDataMessage };
