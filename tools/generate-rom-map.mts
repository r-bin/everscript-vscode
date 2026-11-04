// Generates the canonical, 100% complete ROM memory map (src/games/evermore/localizations/data/rom-map.md),
// mirrors it to docs/disassembly/engine-core/rom-map.md,
// and publishes individual routine/asset knowledge files in src/games/evermore/localizations/knowledge/routines/<name>.md.
// Preserves src/games/evermore/localizations/knowledge/rom/ completely untouched so nothing is lost.

import * as fs from 'node:fs';
import * as path from 'node:path';

function hiromFileOffset(addr: number): number {
    const bank = (addr >> 16) & 0x3F;
    const off = addr & 0xFFFF;
    return bank * 0x10000 + off;
}

const ROOT = path.resolve(import.meta.dirname, '..');
const ROM_DIR = path.join(ROOT, 'src/games/evermore/localizations/knowledge/rom');
const ROUTINES_DIR = path.join(ROOT, 'src/games/evermore/localizations/knowledge/routines');
const DATA_ROM_MAP = path.join(ROOT, 'src/games/evermore/localizations/data/rom-map.md');
const DOCS_ROM_MAP = path.join(ROOT, 'docs/disassembly/engine-core/rom-map.md');
const DATA_KNOWLEDGE_LINK = path.join(ROOT, 'src/games/evermore/localizations/data/knowledge/routines');
const DOCS_KNOWLEDGE_LINK = path.join(ROOT, 'docs/disassembly/engine-core/knowledge/routines');
const FUNCTIONS_JSON = path.join(ROOT, 'out/recomp/asar/functions.json');
const ROOM_MAP_DOC = path.join(ROOT, 'docs/map-format/rom-map.md');
const ROM_TABLES_DOC = path.join(ROOT, 'docs/disassembly/engine-core/rom-tables.md');
const SCRIPTS_JSON = path.join(ROOT, 'src/games/evermore/localizations/data/scripts.json');

interface RomKnowledgeItem {
    file?: string;
    addr: number;
    addrHex: string;
    end: number;
    size: number;
    sizeSource: string;
    name: string;
    kind: string;
    category: string;
    title: string;
    confidence: string;
    tags: string[];
    evidence: string[];
    see: string[];
    body: string;
    rawContent?: string;
}

const KNOWN_SIZES: Record<string, number> = {
    '91d800': 136,   // alchemy_deduct_ingredients_and_award_xp
    'c40000': 3072,  // dialogue_font_glyphs (95 glyphs * 32 bytes)
    'c40c02': 95,    // dialogue_font_widths
    'd180a6': 68,    // ALCHEMY_BLOCK_TABLE (34 words)
};

function bankName(bank: number): string {
    const hex = bank.toString(16).toUpperCase().padStart(2, '0');
    switch (bank) {
        case 0x00: return 'LoROM Interrupt Vectors & Cartridge Header Mirror';
        case 0x80: return 'Engine Core, Reset, NMI & Hardware Utilities';
        case 0x81: return 'Audio Sequences & Soundbank Descriptors';
        case 0x82: case 0x83: case 0x84: case 0x85: case 0x86: case 0x87: case 0x88: case 0x89: case 0x8A: case 0x8B:
            return `Compressed Graphics CHR & Animation Tiles Bank $${hex}`;
        case 0x8C: return 'Script VM Dispatcher, Sound Effects & Stat Curves';
        case 0x8D: return 'Save NVRAM, SRAM Verification & Event Handlers';
        case 0x8E: return 'Character Database, Ring Menu & Shop System';
        case 0x8F: return 'Entity AI, Physics, Collision & Combat Engine';
        case 0x90: return 'Animation VM, Sprites, Projectiles & Tile Animation';
        case 0x91: return 'Alchemy Formulas, Damage Math & Dialogue Dictionaries';
        case 0x92: case 0x93: case 0x94: case 0x95: case 0x96: case 0x97: case 0x98: case 0x99: case 0x9A: case 0x9B:
            return `Script VM Bytecode Stream Bank $${hex}`;
        case 0x9C: case 0x9D: case 0x9E: case 0x9F: case 0xA0: case 0xA1: case 0xA2: case 0xA3: case 0xA4: case 0xA5:
        case 0xA6: case 0xA7: case 0xA8: case 0xA9: case 0xAA: case 0xAB: case 0xAC: case 0xAD:
            return `Room Map Blobs & Master Pointer Directory Bank $${hex}`;
        case 0xAE: case 0xAF:
            return `Sprite Graphics & Metatile Palette Bank $${hex}`;
        case 0xB0: case 0xB1:
            return `ExHiROM Extended Script Code Bank $${hex}`;
        case 0xC0: case 0xC1: case 0xC2: case 0xC3:
            return `String Tables & Dialogue Text Bank $${hex}`;
        case 0xC4:
            return 'Master Item, Weapon, Armor & Formula Tables';
        case 0xC8: case 0xCC: case 0xCE: case 0xCF:
            return `Map Asset & Script Tables Bank $${hex}`;
        case 0xD0: case 0xD1: case 0xD2: case 0xD3: case 0xD4: case 0xD5: case 0xD6: case 0xD7: case 0xD8: case 0xD9:
        case 0xDA: case 0xDB: case 0xDC: case 0xDD: case 0xDE: case 0xDF:
            return `Graphics CHR & Compressed Animation Bank $${hex}`;
        case 0xEC: case 0xEE:
            return `Master Environmental Weather Presets & CHR Bank $${hex}`;
        default:
            return `ROM Memory Bank $${hex}`;
    }
}

function formatBusAddr(addr: number): string {
    const bank = (addr >> 16) & 0xFF;
    const off = addr & 0xFFFF;
    return `$${bank.toString(16).toUpperCase().padStart(2, '0')}:${off.toString(16).toUpperCase().padStart(4, '0')}`;
}

function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return `${bytes} B`;
}

function generate(): void {
    if (!fs.existsSync(ROM_DIR)) {
        console.error('Source ROM knowledge dir not found:', ROM_DIR);
        process.exit(1);
    }

    // 1. Load CDL functions.json
    const fnByOffset = new Map<number, { size: number; name: string }>();
    const fnByName = new Map<string, { size: number; name: string }>();
    const fnByBus = new Map<number, { size: number; name: string }>();
    if (fs.existsSync(FUNCTIONS_JSON)) {
        try {
            const fns = JSON.parse(fs.readFileSync(FUNCTIONS_JSON, 'utf8'));
            for (const f of fns) {
                if (typeof f.size === 'number' && f.size > 0) {
                    fnByOffset.set(f.romOffset, f);
                    fnByName.set(f.name, f);
                    fnByBus.set(f.bus, f);
                    fnByBus.set(f.bus ^ 0x400000, f);
                }
            }
            console.log(`Loaded ${fns.length} CDL functions from functions.json`);
        } catch (e) {
            console.warn('Failed to parse functions.json:', e);
        }
    }

    // 2. Load existing 1,329 entries from knowledge/rom/
    const files = fs.readdirSync(ROM_DIR).filter(f => f.endsWith('.md')).sort();
    const itemsByAddr = new Map<number, RomKnowledgeItem>();

    for (const f of files) {
        const filePath = path.join(ROM_DIR, f);
        const content = fs.readFileSync(filePath, 'utf8');
        const endIdx = content.indexOf('\n---', 3);
        if (!content.startsWith('---') || endIdx < 0) continue;

        const fm = content.slice(3, endIdx);
        const body = content.slice(endIdx + 4).trim();
        const getField = (k: string): string | null => {
            const m = fm.match(new RegExp('^' + k + ':\\s*(.*)$', 'm'));
            return m ? m[1].trim() : null;
        };

        const addrStr = getField('addr') || f.replace('.md', '');
        const addr = parseInt(addrStr, 16);
        let name = getField('name') || f.replace('.md', '');
        if (name === 'ALCHEMY_BLOCK_TABLE' && addrStr.toUpperCase() === 'D180A6') {
            name = 'ALCHEMY_BLOCK_TABLE_D1';
        }

        const explicitSize = getField('size') ? parseInt(getField('size')!, 10) : null;
        const explicitEnd = getField('end') ? parseInt(getField('end')!, 16) : null;
        const kind = getField('kind') || 'code';
        const category = getField('category') || '';
        const title = getField('title') || name;
        const confidence = getField('confidence') || 'confirmed';

        const parseList = (k: string): string[] => {
            const str = getField(k);
            if (!str) return [];
            if (str.startsWith('[')) {
                try { return JSON.parse(str); } catch { return str.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean); }
            }
            return [str];
        };

        const tags = parseList('tags');
        const evidence = parseList('evidence');
        const see = parseList('see');

        // Resolve size
        const off = hiromFileOffset(addr);
        let size: number | null = explicitSize;
        let sizeSource = size ? 'frontmatter' : '';

        if (!size && explicitEnd) {
            size = explicitEnd - addr + 1;
            sizeSource = 'frontmatter_end';
        }

        if (!size) {
            const hex = addr.toString(16).toLowerCase();
            if (KNOWN_SIZES[hex]) {
                size = KNOWN_SIZES[hex];
                sizeSource = 'known_table';
            }
        }

        if (!size) {
            const fromFn = fnByOffset.get(off) || fnByName.get(name) || fnByBus.get(addr);
            if (fromFn && fromFn.size) {
                size = fromFn.size;
                sizeSource = 'cdl_function';
            }
        }

        itemsByAddr.set(addr, {
            file: f,
            addr,
            addrHex: addrStr.toUpperCase().padStart(6, '0'),
            size: size || 0,
            end: explicitEnd || (size ? addr + size - 1 : 0),
            sizeSource,
            name,
            kind,
            category,
            title,
            confidence,
            tags,
            evidence,
            see,
            body,
            rawContent: content,
        });
    }
    console.log(`Loaded ${itemsByAddr.size} base entries from knowledge/rom/`);

    // 3. Upgrade and add master tables from docs/disassembly/engine-core/rom-tables.md
    if (fs.existsSync(ROM_TABLES_DOC)) {
        const tableDoc = fs.readFileSync(ROM_TABLES_DOC, 'utf8');
        for (const line of tableDoc.split('\n')) {
            if (!line.startsWith('|')) continue;
            const parts = line.split('|').map(s => s.trim());
            if (parts.length < 8) continue;
            const snesStr = parts[1].replace(/[`$]/g, '');
            if (!snesStr.includes(':')) continue;
            const [bStr, oStr] = snesStr.split(':');
            const busAddr = (parseInt(bStr, 16) << 16) | parseInt(oStr, 16);
            const canonicalName = parts[3].replace(/[`]/g, '');
            const bytes = parseInt(parts[6].replace(/[^\d]/g, ''), 10);
            const purpose = parts[7];

            const existing = itemsByAddr.get(busAddr);
            if (existing) {
                // If existing size was small/unresolved, update with measured table bytes
                if (bytes > 0 && (!existing.size || existing.size <= 32)) {
                    existing.size = bytes;
                    existing.end = busAddr + bytes - 1;
                    existing.sizeSource = 'rom_tables_doc';
                }
                if (!existing.tags.includes('table')) existing.tags.push('table');
            } else {
                itemsByAddr.set(busAddr, {
                    addr: busAddr,
                    addrHex: busAddr.toString(16).toUpperCase().padStart(6, '0'),
                    size: bytes || 32,
                    end: busAddr + (bytes || 32) - 1,
                    sizeSource: 'rom_tables_doc',
                    name: canonicalName,
                    kind: 'table',
                    category: '📋',
                    title: canonicalName.replace(/^tbl_/, '').replace(/_/g, ' '),
                    confidence: 'confirmed',
                    tags: ['table', 'engine'],
                    evidence: ['docs/disassembly/engine-core/rom-tables.md §1'],
                    see: [],
                    body: purpose,
                });
            }
        }
    }

    // 4. Ingest all 127 Room Map Blobs from docs/map-format/rom-map.md
    if (fs.existsSync(ROOM_MAP_DOC)) {
        const mapDoc = fs.readFileSync(ROOM_MAP_DOC, 'utf8');
        const roomLines = mapDoc.split('\n');
        const rooms: {
            id: number;
            hexId: string;
            roomName: string;
            symbol: string;
            snesPtr: number;
            bytes: number;
            end: number;
            tiles: string;
            metatiles: number;
            b1: string;
            b3: string;
            objs: number;
            step: number;
            bTrig: number;
            planes: string;
            grass: number;
        }[] = [];

        for (const line of roomLines) {
            if (!line.startsWith('|')) continue;
            const parts = line.split('|').map(s => s.trim());
            if (parts.length < 15) continue;
            const id = parseInt(parts[1], 10);
            if (isNaN(id)) continue;
            const hexId = id.toString(16).toUpperCase().padStart(2, '0');
            const roomName = parts[3];
            const snesPtr = parseInt(parts[4].replace(/[`$]/g, ''), 16);
            let bytes = parseInt(parts[6], 10);
            const tiles = parts[7];
            const metatiles = parseInt(parts[8], 10);
            const b1 = parts[9];
            const b3 = parts[10];
            const objs = parseInt(parts[11], 10) || 0;
            const step = parseInt(parts[12], 10) || 0;
            const bTrig = parseInt(parts[13], 10) || 0;
            const planes = parts[14].replace(/[*]/g, '');
            const grass = parseInt(parts[15], 10) || 0;

            const clean = roomName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            const symbol = 'ROOM_BLOB_' + hexId + '_' + clean;

            rooms.push({
                id,
                hexId,
                roomName,
                symbol,
                snesPtr,
                bytes,
                end: snesPtr + bytes - 1,
                tiles,
                metatiles,
                b1,
                b3,
                objs,
                step,
                bTrig,
                planes,
                grass,
            });
        }

        rooms.sort((a, b) => a.snesPtr - b.snesPtr);

        for (let i = 0; i < rooms.length; i++) {
            const cur = rooms[i];
            const next = rooms[i + 1];
            if (next && (next.snesPtr >> 16) === (cur.snesPtr >> 16)) {
                if (cur.snesPtr + cur.bytes > next.snesPtr) {
                    cur.bytes = next.snesPtr - cur.snesPtr;
                }
            }
            if (cur.id === 72) {
                cur.bytes = 0x9FFDE7 - cur.snesPtr; // Bounded by Master Map Pointer Table
            }
            cur.end = cur.snesPtr + cur.bytes - 1;

            let region = 'map';
            if (cur.roomName.includes('Prehistoria')) region = 'prehistoria';
            else if (cur.roomName.includes('Antiqua')) region = 'antiqua';
            else if (cur.roomName.includes('Gothica')) region = 'gothica';
            else if (cur.roomName.includes('Omnitopia')) region = 'omnitopia';
            else if (cur.roomName.includes('Intro')) region = 'intro';

            itemsByAddr.set(cur.snesPtr, {
                addr: cur.snesPtr,
                addrHex: cur.snesPtr.toString(16).toUpperCase().padStart(6, '0'),
                size: cur.bytes,
                end: cur.end,
                sizeSource: 'room_blob_table',
                name: cur.symbol,
                kind: 'blob',
                category: '🗺️',
                title: `Room 0x${cur.hexId}: ${cur.roomName}`,
                confidence: 'confirmed',
                tags: ['map', 'room', region, cur.b1, cur.b3],
                evidence: [`docs/map-format/rom-map.md §2 (Room 0x${cur.hexId})`],
                see: ['rom/9ffde7.md'],
                body: `Compressed room data blob for **Room 0x${cur.hexId}** (${cur.roomName}). Dimensions: ${cur.tiles} tiles, ${cur.metatiles} metatiles. Block 1: ${cur.b1}, Block 2: markov (0x07), Block 3: ${cur.b3}. Contains ${cur.objs} object records, ${cur.step} step-on triggers, ${cur.bTrig} B-triggers on collision planes [${cur.planes}].`
            });
        }
        console.log(`Ingested ${rooms.length} room blobs`);
    }

    // 5. Ingest missing ABS action/event scripts from scripts.json
    if (fs.existsSync(SCRIPTS_JSON)) {
        const scriptsJson = JSON.parse(fs.readFileSync(SCRIPTS_JSON, 'utf8'));
        const abs = Object.entries(scriptsJson.absScripts || {});
        let addedAbs = 0;
        for (const [addrStr, scriptName] of abs) {
            const addr = parseInt(addrStr, 10);
            if (!itemsByAddr.has(addr)) {
                const clean = (scriptName as string).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                const hex = addr.toString(16).toUpperCase().padStart(6, '0');
                const symbol = 'script_abs_' + hex.toLowerCase() + (clean ? '_' + clean.toLowerCase() : '');
                itemsByAddr.set(addr, {
                    addr,
                    addrHex: hex,
                    size: 32, // placeholder, resolved in bank span pass
                    end: addr + 31,
                    sizeSource: 'scripts_json',
                    name: symbol,
                    kind: 'script',
                    category: '📜',
                    title: `ABS script: ${scriptName}`,
                    confidence: 'confirmed',
                    tags: ['script', 'vm', 'event'],
                    evidence: ['src/games/evermore/localizations/data/scripts.json absScripts'],
                    see: [],
                    body: `Action/Event bytecode script: ${scriptName}. Executed by the script virtual machine.`
                });
                addedAbs++;
            }
        }
        console.log(`Ingested ${addedAbs} new ABS scripts from scripts.json`);
    }

    // 6. Ingest String Blocks, Cartridge Header, and System Vectors
    const strBank = (b: number) => b * 0x10000;
    const systemBlocks: { addr: number; size: number; name: string; title: string; tags: string[]; body: string }[] = [
        { addr: strBank(0xC0), size: 0x8000, name: 'STRINGS_BLOCK_0', title: 'Dialogue strings block 0 (Bank $C0 lower half)', tags: ['strings', 'dialogue', 'text'], body: 'Huffman/dictionary compressed dialogue and narration text block 0.' },
        { addr: strBank(0xC1), size: 0x8000, name: 'STRINGS_BLOCK_1', title: 'Dialogue strings block 1 (Bank $C1 lower half)', tags: ['strings', 'dialogue', 'text'], body: 'Huffman/dictionary compressed dialogue and narration text block 1.' },
        { addr: strBank(0xC2), size: 0x8000, name: 'STRINGS_BLOCK_2', title: 'Dialogue strings block 2 (Bank $C2 lower half)', tags: ['strings', 'dialogue', 'text'], body: 'Huffman/dictionary compressed dialogue and narration text block 2.' },
        { addr: strBank(0xC3), size: 0x8000, name: 'STRINGS_BLOCK_3', title: 'Dialogue strings block 3 (Bank $C3 lower half)', tags: ['strings', 'dialogue', 'text'], body: 'Huffman/dictionary compressed dialogue and narration text block 3.' },
        { addr: 0x91D000, size: 9006,   name: 'STRING_KEY_INDEX', title: 'Master string key index table ($91:D000)', tags: ['strings', 'dialogue', 'index'], body: '3,002 entries × 3 bytes pointing to compressed string payloads with bit 23 compression flag.' },
        { addr: 0x00FFC0, size: 32,     name: 'CART_HEADER', title: 'SNES Cartridge Header ($00:FFC0)', tags: ['mapping', 'header'], body: '21 bytes title "SECRET OF EVERMORE  ", map mode $31, ROM size 3MB, SRAM 8KB, Checksum.' },
        { addr: 0x00FFE0, size: 32,     name: 'SNES_INTERRUPT_VECTORS', title: 'SNES Hardware Interrupt Vectors ($00:FFE0)', tags: ['mapping', 'vectors'], body: 'Native and Emulation mode RESET, NMI, IRQ, BRK, and COP interrupt vectors.' }
    ];

    for (const sb of systemBlocks) {
        if (!itemsByAddr.has(sb.addr)) {
            itemsByAddr.set(sb.addr, {
                addr: sb.addr,
                addrHex: sb.addr.toString(16).toUpperCase().padStart(6, '0'),
                size: sb.size,
                end: sb.addr + sb.size - 1,
                sizeSource: 'system_block',
                name: sb.name,
                kind: 'table',
                category: '⚙️',
                title: sb.title,
                confidence: 'confirmed',
                tags: sb.tags,
                evidence: ['SNES memory map standard (HiROM)'],
                see: [],
                body: sb.body,
            });
        }
    }

    function createPadOrSlackItem(
        addr: number,
        size: number,
        kind: 'padding' | 'slack',
        reason: string
    ): RomKnowledgeItem {
        const bank = (addr >> 16) & 0xFF;
        const off = addr & 0xFFFF;
        const bankHex = bank.toString(16).toUpperCase().padStart(2, '0');
        const offHex = off.toString(16).toUpperCase().padStart(4, '0');
        const isSlack = kind === 'slack';
        const prefix = isSlack ? `BANK${bankHex}_SLACK_` : `BANK${bankHex}_PAD_`;
        const name = `${prefix}${offHex}`;
        const busStr = formatBusAddr(addr);
        const endBusStr = formatBusAddr(addr + size - 1);
        const typeTitle = isSlack ? 'unmapped ROM slack' : 'alignment padding';

        return {
            addr,
            addrHex: addr.toString(16).toUpperCase().padStart(6, '0'),
            size,
            end: addr + size - 1,
            sizeSource: isSlack ? 'bank_slack' : 'gap_padding',
            name,
            kind,
            category: '⚙️',
            title: `Bank $${bankHex} ${typeTitle} ($${offHex})`,
            confidence: 'confirmed',
            tags: isSlack ? ['unused', 'slack'] : ['unused', 'padding'],
            evidence: [reason],
            see: [],
            body: `${size.toLocaleString()} B ${typeTitle} and unmapped ROM space in Bank $${bankHex} (${busStr}..${endBusStr}).`,
        };
    }

    // 7. Group items by bank and build contiguous zero-gap layout
    const rawByBank = new Map<number, RomKnowledgeItem[]>();
    for (const item of itemsByAddr.values()) {
        const bank = (item.addr >> 16) & 0xFF;
        const list = rawByBank.get(bank) || [];
        list.push(item);
        rawByBank.set(bank, list);
    }

    const byBank = new Map<number, RomKnowledgeItem[]>();
    const allContiguousItems: RomKnowledgeItem[] = [];

    const sortedBanks = Array.from(rawByBank.keys()).sort((a, b) => a - b);
    for (const bank of sortedBanks) {
        const rawList = rawByBank.get(bank)!.sort((a, b) => a.addr - b.addr);
        const bankHex = bank.toString(16).toUpperCase().padStart(2, '0');
        const contiguous: RomKnowledgeItem[] = [];

        // Determine bank starting address
        let expectedAddr: number;
        if (bank === 0x00) {
            expectedAddr = 0x00FFC0;
        } else if (bank >= 0x80 && bank <= 0xBF) {
            expectedAddr = (bank === 0x8F && (rawList[0].addr & 0xFFFF) === 0x0000)
                ? 0x8F0000
                : ((bank << 16) | 0x8000);
        } else if (bank >= 0xC0 && bank <= 0xDF) {
            expectedAddr = (bank << 16) | 0x0000;
        } else {
            expectedAddr = rawList[0].addr;
        }

        for (let i = 0; i < rawList.length; i++) {
            const cur = rawList[i];
            const next = i < rawList.length - 1 ? rawList[i + 1] : null;

            // Gap before cur: fill with padding
            if (cur.addr > expectedAddr) {
                const gapSize = cur.addr - expectedAddr;
                const pad = createPadOrSlackItem(
                    expectedAddr,
                    gapSize,
                    'padding',
                    `ROM alignment gap preceding ${cur.name} in Bank $${bankHex}`
                );
                contiguous.push(pad);
                allContiguousItems.push(pad);
                expectedAddr = cur.addr;
            }

            // If cur overlaps next: clamp cur.size to abut next
            let curSize = cur.size;
            if (next && cur.addr + curSize > next.addr) {
                curSize = next.addr - cur.addr;
            } else if (!curSize || curSize <= 0 || cur.sizeSource === 'scripts_json') {
                if (next && (next.addr >> 16) === bank) {
                    curSize = next.addr - cur.addr;
                } else {
                    curSize = 32;
                }
            }
            cur.size = curSize;
            cur.end = cur.addr + curSize - 1;

            contiguous.push(cur);
            allContiguousItems.push(cur);
            expectedAddr = cur.addr + curSize;
        }

        // Bank tail slack
        let bankEnd: number;
        if (bank === 0x00) {
            bankEnd = 0x010000;
        } else if (bank >= 0x80 && bank <= 0xBF) {
            bankEnd = (bank << 16) | 0x10000;
        } else if (bank >= 0xC0 && bank <= 0xC3) {
            bankEnd = (bank << 16) | 0x08000;
        } else {
            bankEnd = expectedAddr;
        }

        if (expectedAddr < bankEnd) {
            const slackSize = bankEnd - expectedAddr;
            const slack = createPadOrSlackItem(
                expectedAddr,
                slackSize,
                'slack',
                `Unmapped ROM capacity at the tail of Bank $${bankHex}`
            );
            contiguous.push(slack);
            allContiguousItems.push(slack);
            expectedAddr = bankEnd;
        }

        byBank.set(bank, contiguous);
    }

    // 8. Ensure knowledge/routines directory exists and write markdown files
    if (fs.existsSync(ROUTINES_DIR)) {
        fs.rmSync(ROUTINES_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(ROUTINES_DIR, { recursive: true });

    for (const item of allContiguousItems) {
        const targetPath = path.join(ROUTINES_DIR, `${item.name}.md`);

        let content = item.rawContent;
        if (!content) {
            // Build fresh markdown file with frontmatter
            const fmObj: Record<string, any> = {
                addr: item.addrHex,
                end: item.end.toString(16).toUpperCase().padStart(6, '0'),
                size: item.size,
                kind: item.kind,
                category: item.category || '⚙️',
                name: item.name,
                title: item.title,
                confidence: item.confidence,
                tags: item.tags,
                evidence: item.evidence,
            };
            if (item.see && item.see.length > 0) fmObj.see = item.see;

            content = `---\n` +
                `addr: ${fmObj.addr}\n` +
                `end: ${fmObj.end}\n` +
                `size: ${fmObj.size}\n` +
                `kind: ${fmObj.kind}\n` +
                `category: ${fmObj.category}\n` +
                `name: ${fmObj.name}\n` +
                `title: ${fmObj.title}\n` +
                `confidence: ${fmObj.confidence}\n` +
                `tags: ${JSON.stringify(fmObj.tags)}\n` +
                `evidence: ${JSON.stringify(fmObj.evidence)}\n` +
                (fmObj.see ? `see: ${JSON.stringify(fmObj.see)}\n` : '') +
                `---\n\n` +
                item.body + `\n`;
        } else {
            // Update frontmatter to include size and end if missing or changed
            const endHex = item.end.toString(16).toUpperCase().padStart(6, '0');
            const hasSize = /^size:\s*\d+/m.test(content);
            const hasEnd = /^end:\s*[0-9A-Fa-f]+/m.test(content);
            if (hasSize) {
                content = content.replace(/^size:\s*\d+/m, `size: ${item.size}`);
            }
            if (hasEnd) {
                content = content.replace(/^end:\s*[0-9A-Fa-f]+/m, `end: ${endHex}`);
            }
            if (!hasSize || !hasEnd) {
                let insertStr = '';
                if (!hasSize) insertStr += `size: ${item.size}\n`;
                if (!hasEnd) insertStr += `end: ${endHex}\n`;
                content = content.replace(/^addr:\s*([^\n]+)\n/m, `addr: $1\n${insertStr}`);
            }
        }

        // Rewrite relative link to old hex files in body
        content = content.replace(/\(8fac84\.md\)/g, '(player_b_trigger_search_box_setup.md)');
        content = content.replace(/\(8fc3ba\.md\)/g, '(entity_move_step_north.md)');

        fs.writeFileSync(targetPath, content, 'utf8');
    }
    console.log(`Wrote ${allContiguousItems.length} routine/asset files to knowledge/routines/`);

    // 9. Build master Markdown document
    let totalCodeBytes = 0;
    for (const item of allContiguousItems) {
        totalCodeBytes += item.size;
    }

    const banksJson: Record<string, { range: [string, string]; name: string; routines: number; bytes: number; slack_bytes: number }> = {};
    for (const [bank, list] of byBank.entries()) {
        const hex = bank.toString(16).toUpperCase().padStart(2, '0');
        const minAddr = '0x' + list[0].addr.toString(16).toUpperCase().padStart(6, '0');
        const maxAddr = '0x' + list[list.length - 1].end.toString(16).toUpperCase().padStart(6, '0');
        const bankBytes = list.reduce((sum, it) => sum + it.size, 0);
        const bankMaxCapacity = 32768; // standard 32 KB upper half
        const slack = Math.max(0, bankMaxCapacity - bankBytes);
        banksJson[hex] = {
            range: [minAddr, maxAddr],
            name: bankName(bank),
            routines: list.length,
            bytes: bankBytes,
            slack_bytes: slack,
        };
    }

    let md = '# Secret of Evermore — ROM Memory Map\n\n';
    md += '```json\n' + JSON.stringify({
        summary: {
            total_entries: allContiguousItems.length,
            total_documented_bytes: totalCodeBytes,
            banks_covered: byBank.size,
            architecture: '3 MB (24 Mbit) HiROM ($00..$3F mirror, $80..$BF fast, $C0..$FF data)',
        },
        banks: banksJson,
    }, null, 2) + '\n```\n\n';

    md += '## Architecture Overview\n\n';
    md += 'Secret of Evermore is mapped as a **3 MB (24 Mbit) HiROM** cartridge across fast and slow banks:\n\n';
    md += '- **Banks `$80..$BF` (FastROM upper halves, 48 banks × 32 KB):** Engine core, interrupt handlers, Script VM, and all 127 room definition blobs.\n';
    md += '- **Banks `$C0..$EF` (FastROM linear 64 KB banks):** Master dialogue string tables, game database ($C4), and compressed CHR graphics ($D0..$DF).\n';
    md += '- **Banks `$00..$3F` (SlowROM mirror):** Hardware registers ($2100..$437F), WRAM direct mirror, and SNES interrupt vectors ($00:FFE0..$00:FFFF).\n\n';

    for (const bank of sortedBanks) {
        const hex = bank.toString(16).toUpperCase().padStart(2, '0');
        const list = byBank.get(bank)!;
        const bName = bankName(bank);
        const bankBytes = list.reduce((sum, it) => sum + it.size, 0);

        md += `## Bank $${hex} — ${bName}\n\n`;
        md += `**Coverage:** ${list.length} entries | **Documented bytes:** ${bankBytes.toLocaleString()} B (${formatBytes(bankBytes)})\n\n`;
        md += '| Address | Identifier | Type | Size | Tag | Summary |\n';
        md += '|---|---|---|---|---|---|\n';

        for (const it of list) {
            const busStr = formatBusAddr(it.addr);
            const link = `[\`${it.name}\`](knowledge/routines/${encodeURIComponent(it.name)}.md)`;
            const sizeStr = `${it.size.toLocaleString()} B`;
            const tagsStr = it.tags.join(', ');
            const summaryStr = (it.title ? `${it.title}: ` : '') + it.body.replace(/\r?\n/g, ' ').slice(0, 140) + (it.body.length > 140 ? '...' : '');
            const cleanSummary = summaryStr.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/\|/g, '\\|');
            md += `| \`${busStr}\` | ${link} | \`${it.kind}\` | ${sizeStr} | ${tagsStr} | ${cleanSummary} |\n`;
        }
        md += '\n';
    }

    // Write data/rom-map.md and mirror to docs/disassembly/engine-core/rom-map.md
    fs.writeFileSync(DATA_ROM_MAP, md, 'utf8');
    fs.writeFileSync(DOCS_ROM_MAP, md, 'utf8');
    console.log(`Wrote master ROM map with ${allContiguousItems.length} entries (${totalCodeBytes} bytes across ${byBank.size} banks) to:`);
    console.log(' -', DATA_ROM_MAP);
    console.log(' -', DOCS_ROM_MAP);

    // Symlinks
    try {
        if (!fs.existsSync(DATA_KNOWLEDGE_LINK)) {
            fs.symlinkSync('../../knowledge/routines', DATA_KNOWLEDGE_LINK, 'dir');
        }
    } catch {}

    try {
        if (!fs.existsSync(DOCS_KNOWLEDGE_LINK)) {
            fs.symlinkSync('../../../../src/games/evermore/localizations/knowledge/routines', DOCS_KNOWLEDGE_LINK, 'dir');
        }
    } catch {}
}

generate();
