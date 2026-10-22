// Ownership: the Data tab's host side: answers the webview's one request with
// every list it shows. No VS Code dependency. extension.js injects the ROM
// loader, `post`, and the character list (the Characters tab's), so this
// domain never imports another feature.
//
//   page -> dataInit       host -> dataIndex { tables, enums, palettes } | { error }

import { tablesModel } from './model/tables';
import { enumsModel } from './model/enums';
import { palettesModel } from './model/palettes';
import type { CharacterPalette } from './model/palettes';
import { missingRomText } from '../../../platform/roms/library';

type Rom = Uint8Array;
interface Deps {
    post(message: object): void;
    loadRom(): Buffer | Uint8Array | null;
    /** Every character record: index, name, palette address (sprites/character-model.ts). */
    characters(rom: Rom): CharacterPalette[];
}

let _cache: { rom: Rom | null; index: object | null } = { rom: null, index: null };

const handlesDataMessage = (command: unknown): boolean => command === 'dataInit';

function handleDataMessage(msg: { command: string }, deps: Deps): void {
    const buf = deps.loadRom();
    if (!buf) { deps.post({ command: 'dataIndex', error: missingRomText('evermore') }); return; }
    const rom = buf.length % 0x8000 === 0x200 ? buf.subarray(0x200) : buf;
    try {
        if (_cache.rom !== rom || !_cache.index) {
            const chars = deps.characters(rom);
            _cache = { rom, index: { tables: tablesModel(rom), enums: enumsModel(rom, chars), palettes: palettesModel(rom, chars) } };
        }
        deps.post({ command: 'dataIndex', ..._cache.index });
    } catch (err) {
        deps.post({ command: 'dataIndex', error: String(err instanceof Error ? err.message : err) });
    }
}

export { handlesDataMessage, handleDataMessage };
