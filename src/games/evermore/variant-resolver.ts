// Ownership: Resolves ROM table offsets and variant identities for Secret of Evermore releases.
// Pure. No VS Code API, no filesystem.
// See docs/evermore-variants.md and src/games/evermore/variants.json.

import { readHeader, stripCopierHeader } from '../../platform/roms/header';
import variantsData from './variants.json';

export type EvermoreVariantId = 'us' | 'eu' | 'de' | 'fr' | 'es' | 'es-rev2';

export interface VariantTableVariantInfo {
    snes: string;
    file: string;
    count?: number;
    plainCount?: number;
    headerSnes?: string;
    headerFile?: string;
    countByte?: string;
    readers?: Array<{ pc: string; file: string; asm: string }>;
}

export interface VariantTableDefinition {
    name: string;
    description: string;
    entrySize: number;
    variants: Record<string, VariantTableVariantInfo>;
}

export const KNOWN_VARIANTS: Record<EvermoreVariantId, { id: EvermoreVariantId; name: string; sha1: string; base?: boolean }> = {
    us: { id: 'us', name: 'USA', sha1: '79e7738630fff5699217ef58ecc421bc8fcbcd89', base: true },
    eu: { id: 'eu', name: 'Europe', sha1: 'ae17166919fdfdf26cc5771f83cfd19eaf71806c' },
    de: { id: 'de', name: 'Germany', sha1: '5e5c2082526690d05f962c3ffbd7e080c681bfa4' },
    fr: { id: 'fr', name: 'France', sha1: '8a430c9d6a3dcef974252fe8d946a0d619bb1a61' },
    es: { id: 'es', name: 'Spain (Rev 1)', sha1: '4363ce4b19e76261f9325ac9a0cce27d97490df2' },
    'es-rev2': { id: 'es-rev2', name: 'Spain (Rev 2)', sha1: 'c29fe997740bd9b54a07fba7b2b5442a49245aac' },
};

const HASH_TO_VARIANT: Record<string, EvermoreVariantId> = {
    '79e7738630fff5699217ef58ecc421bc8fcbcd89': 'us',
    'ae17166919fdfdf26cc5771f83cfd19eaf71806c': 'eu',
    '5e5c2082526690d05f962c3ffbd7e080c681bfa4': 'de',
    '8a430c9d6a3dcef974252fe8d946a0d619bb1a61': 'fr',
    '4363ce4b19e76261f9325ac9a0cce27d97490df2': 'es',
    'c29fe997740bd9b54a07fba7b2b5442a49245aac': 'es-rev2',
};

const JSON_VARIANT_MAP: Record<string, string> = {
    us: 'us',
    usa: 'us',
    eu: 'europe',
    europe: 'europe',
    de: 'germany',
    germany: 'germany',
    fr: 'france',
    france: 'france',
    es: 'spain1',
    es1: 'spain1',
    spain: 'spain1',
    spain1: 'spain1',
    'es-rev2': 'spain2',
    es2: 'spain2',
    spain2: 'spain2',
};

/**
 * Identify which Secret of Evermore retail variant or revision a ROM is.
 * Fast O(1) header inspection first, falling back to SHA-1 matching.
 */
export function identifyEvermoreVariant(rom: Uint8Array): EvermoreVariantId {
    if (!rom || rom.length < 0x8000) return 'us';

    const stripped = stripCopierHeader(rom);
    const header = readHeader(stripped);

    if (header && header.title.startsWith('SECRET OF EVERMORE')) {
        switch (header.region) {
            case 0x01:
                return 'us';
            case 0x02:
                return 'eu';
            case 0x09:
                return 'de';
            case 0x06:
                return 'fr';
            case 0x08:
                return header.version >= 1 ? 'es-rev2' : 'es';
        }
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { createHash } = require('node:crypto');
        const hash = createHash('sha1').update(stripped).digest('hex');
        if (HASH_TO_VARIANT[hash]) return HASH_TO_VARIANT[hash];
    } catch {
        // Crypto unavailable; default to US
    }

    return 'us';
}

/**
 * Normalize variant identifier or extract it from a ROM buffer.
 */
export function toVariantId(variantOrRom?: string | Uint8Array): EvermoreVariantId {
    if (!variantOrRom) return 'us';
    if (typeof variantOrRom !== 'string') return identifyEvermoreVariant(variantOrRom);
    const lower = variantOrRom.toLowerCase().trim();
    if (lower === 'us' || lower === 'usa') return 'us';
    if (lower === 'eu' || lower === 'europe') return 'eu';
    if (lower === 'de' || lower === 'germany') return 'de';
    if (lower === 'fr' || lower === 'france') return 'fr';
    if (lower === 'es' || lower === 'es1' || lower === 'spain' || lower === 'spain1') return 'es';
    if (lower === 'es-rev2' || lower === 'es2' || lower === 'spain2') return 'es-rev2';
    return 'us';
}

/**
 * Map variant to key in variants.json ('us', 'europe', 'germany', 'france', 'spain1', 'spain2').
 */
export function toJsonVariantKey(variantOrRom?: string | Uint8Array): string {
    const id = toVariantId(variantOrRom);
    return JSON_VARIANT_MAP[id] || 'us';
}

const typedVariantsData = variantsData as Record<string, VariantTableDefinition>;

/**
 * Get table definition and variant-specific metadata.
 */
export function getTableInfo(tableKey: string, variantOrRom?: string | Uint8Array): VariantTableVariantInfo | null {
    const table = typedVariantsData[tableKey];
    if (!table) return null;
    const vKey = toJsonVariantKey(variantOrRom);
    return table.variants[vKey] || table.variants['us'] || null;
}

/**
 * Resolve the ROM file offset (numeric integer) for a table in the specified variant or ROM.
 */
export function getTableFileOffset(tableKey: string, variantOrRom?: string | Uint8Array): number {
    const info = getTableInfo(tableKey, variantOrRom);
    if (!info?.file) return 0;
    return parseInt(info.file, 16);
}

/**
 * Resolve the item count for a table in the specified variant or ROM.
 */
export function getTableCount(tableKey: string, variantOrRom?: string | Uint8Array): number {
    const info = getTableInfo(tableKey, variantOrRom);
    return info?.count ?? 0;
}

// Convenient typed accessors for all core tables

export function getMapTableOffset(variantOrRom?: string | Uint8Array): number {
    return getTableFileOffset('map_table', variantOrRom);
}

export function getMapPalettesOffset(variantOrRom?: string | Uint8Array): number {
    return getTableFileOffset('map_palettes', variantOrRom);
}

export function getMapTileGraphicsOffset(variantOrRom?: string | Uint8Array): number {
    return getTableFileOffset('map_tile_graphics', variantOrRom);
}

export function getStringKeysOffset(variantOrRom?: string | Uint8Array): number {
    return getTableFileOffset('string_keys', variantOrRom);
}

export function getStringKeysCount(variantOrRom?: string | Uint8Array): number {
    return getTableCount('string_keys', variantOrRom);
}

export function getRoomEnterScriptsOffset(variantOrRom?: string | Uint8Array): number {
    return getTableFileOffset('room_enter_scripts', variantOrRom);
}

export function getScriptPointersOffset(variantOrRom?: string | Uint8Array): number {
    return getTableFileOffset('script_pointers', variantOrRom);
}

export function getScriptHeaderOffset(variantOrRom?: string | Uint8Array): number {
    const info = getTableInfo('script_pointers', variantOrRom);
    return info?.headerFile ? parseInt(info.headerFile, 16) : 0x128000;
}

export function getScriptOpcodeTableOffset(variantOrRom?: string | Uint8Array): number {
    return getTableFileOffset('script_opcode_table', variantOrRom);
}

export function getAnimateIdsOffset(variantOrRom?: string | Uint8Array): number {
    return getTableFileOffset('animate_ids', variantOrRom);
}

export function getAnimationRecordsOffset(variantOrRom?: string | Uint8Array): number {
    return getTableFileOffset('animation_records', variantOrRom);
}

export function getAnimationVmDispatchOffset(variantOrRom?: string | Uint8Array): number {
    return getTableFileOffset('animation_vm_dispatch', variantOrRom);
}

export function getCharacterRecordsOffset(variantOrRom?: string | Uint8Array): number {
    return getTableFileOffset('character_records', variantOrRom);
}

export function getEnemyIndexOffset(variantOrRom?: string | Uint8Array): number {
    return getTableFileOffset('enemy_index', variantOrRom);
}

export function getSongPackagesOffset(variantOrRom?: string | Uint8Array): number {
    return getTableFileOffset('song_packages', variantOrRom);
}

export function getSpriteBlocks16Offset(variantOrRom?: string | Uint8Array): number {
    return getTableFileOffset('sprite_blocks_16', variantOrRom);
}

export function getSpriteBlocks8Offset(variantOrRom?: string | Uint8Array): number {
    return getTableFileOffset('sprite_blocks_8', variantOrRom);
}

export function getResetVector(variantOrRom?: string | Uint8Array): VariantTableVariantInfo | null {
    return getTableInfo('reset_vector', variantOrRom);
}

export function getNmiVector(variantOrRom?: string | Uint8Array): VariantTableVariantInfo | null {
    return getTableInfo('nmi_vector', variantOrRom);
}

export function getIrqVector(variantOrRom?: string | Uint8Array): VariantTableVariantInfo | null {
    return getTableInfo('irq_vector', variantOrRom);
}

export function getScriptVmDispatcher(variantOrRom?: string | Uint8Array): VariantTableVariantInfo | null {
    return getTableInfo('script_vm_dispatcher', variantOrRom);
}

export function getStringDecoder(variantOrRom?: string | Uint8Array): VariantTableVariantInfo | null {
    return getTableInfo('string_decoder', variantOrRom);
}

export function getRoomLoader(variantOrRom?: string | Uint8Array): VariantTableVariantInfo | null {
    return getTableInfo('room_loader', variantOrRom);
}
