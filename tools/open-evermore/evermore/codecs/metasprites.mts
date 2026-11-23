// The `metasprites` kind (docs/open-evermore/resources.md §metasprites): composite sprite frames assembled from
// 16×16 and 8×8 sprite blocks across banks $CA–$D3.
//
// Facts used (src/games/evermore/maps/sprites.ts, knowledge routines/direct_sprite_draw_oam.md):
//   record    count (u8), first (u8: 6 if count >= 3, 2 if count > 0, 0 if count == 0); when count >= 3 a bounding
//             box (x:s8, y:s8, w:u8, h:u8) for viewport culling; then count chunks of 5 bytes
//   chunk     flags (bit 0: 16×16, bits 1-3: palette, 4-5: priority, 6: flipX, 7: flipY), x:s8, y:s8, block:u16
//   place     pinned to home address while animation scripts in _base/ reference them by address
import { createRequire } from 'node:module';
import type { Codec, CountOf, ImplodeContext, Item, NameAt, NameOf, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';

const require = createRequire(import.meta.url);
const { spriteAddresses, readSpriteInfo, scriptSprites } = require('../../../../dist/games/evermore/maps/sprites');
const { animationGroups } = require('../../../../dist/games/evermore/maps/animation-table');
const { readAllCharacters } = require('../../../../dist/games/evermore/sprites/character-model');
const { buildAnimationCatalog } = require('../../../../dist/games/evermore/sprites/animation-catalog');
const { busU8 } = require('../../../../dist/platform/snes/hirom');
const { hexLower: hex } = require('../../../../dist/platform');

export const KIND = 'metasprites';
const DIR = KIND;
const FORMAT = 'open-evermore/metasprite';
const CHUNK_SIZE = 5;

const s8 = (v: number): number => (v << 24) >> 24;

export interface MetaspriteChunkJson {
    block: string;
    size: 16 | 8;
    x: number;
    y: number;
    priority?: number;
    flip_x?: boolean;
    flip_y?: boolean;
    palette?: number;
}

export interface MetaspriteBoundsJson {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface MetaspriteJson {
    format: string;
    version: number;
    bounds?: MetaspriteBoundsJson;
    chunks: MetaspriteChunkJson[];
}

/** Determines category / character attribution for each sprite address in ROM. */
function buildAttributionMap(rom: Uint8Array): Map<number, string> {
    const chars = readAllCharacters(rom);
    const catalog = buildAnimationCatalog(rom, chars);

    const recordToOwners = new Map<number, any[]>();
    for (const entry of catalog) {
        recordToOwners.set(entry.record, entry.owners);
    }

    const groups = animationGroups(rom);
    const spriteToOwners = new Map<number, Set<string>>();

    for (const g of groups) {
        const owners = recordToOwners.get(g.record) || [];
        for (const script of g.scripts) {
            if (!script) continue;
            const sprites = scriptSprites(rom, script);
            for (const spr of sprites) {
                if (!spriteToOwners.has(spr)) spriteToOwners.set(spr, new Set());
                for (const o of owners) {
                    let name = 'misc';
                    if (o.kind === 'character') name = (o.name || `char_${o.id}`).toLowerCase().replace(/[^a-z0-9_]/g, '_');
                    else if (o.kind === 'weapon') name = 'boy';
                    else if (o.kind === 'alchemy') name = 'alchemy';
                    else if (o.kind === 'icon') name = 'icon';
                    else if (o.kind === 'projectile') name = 'projectile';
                    spriteToOwners.get(spr)!.add(name);
                }
            }
        }
    }

    const attribution = new Map<number, string>();
    for (const spr of spriteAddresses(rom)) {
        const owners = spriteToOwners.get(spr);
        if (!owners || owners.size === 0) {
            attribution.set(spr, 'misc');
        } else if (owners.size === 1) {
            attribution.set(spr, [...owners][0]);
        } else {
            attribution.set(spr, 'shared');
        }
    }
    return attribution;
}

export const METASPRITE_NAME_RE = /^(?:[a-z][a-z0-9_]{0,79}\/)?[a-z][a-z0-9_]{0,79}$/;

export const metaspritesCodec: Codec = {
    kind: KIND,
    version: 1,
    path: DIR,
    folder: `characters/${DIR}`,
    nameRe: METASPRITE_NAME_RE,

    defaultName: id => `frame_${id.toString(16).padStart(4, '0')}`,

    canonical(path, bytes) {
        if (path === `${DIR}/${ENUM}`) return [path, bytes];
        const v = JSON.parse(readText(bytes)) as MetaspriteJson;
        return [path, json(v)];
    },

    explode(rom, name, _options, _countOf, _nameAt) {
        const files: Tree = new Map(), names: string[] = [], pool = [], homes = [];
        const addrs: number[] = spriteAddresses(rom);
        const attribution = buildAttributionMap(rom);

        for (let id = 0; id < addrs.length; id++) {
            const addr = addrs[id];
            const info = readSpriteInfo(rom, addr);
            const owner = attribution.get(addr) || 'misc';
            const fullName = `${owner}/frame_${hex(addr, 6)}`;
            names.push(fullName);

            const chunksJson: MetaspriteChunkJson[] = info.chunks.map((c: any) => {
                const blockKind = c.large ? 'sprite_blocks_16' : 'sprite_blocks_8';
                const blockName = name(blockKind, c.block);
                const chunk: MetaspriteChunkJson = {
                    block: blockName,
                    size: c.large ? 16 : 8,
                    x: c.x,
                    y: c.y,
                };
                if (c.priority) chunk.priority = c.priority;
                if (c.flipX) chunk.flip_x = true;
                if (c.flipY) chunk.flip_y = true;
                if (c.palette) chunk.palette = c.palette;
                return chunk;
            });

            const metasprite: MetaspriteJson = {
                format: FORMAT,
                version: 1,
                chunks: chunksJson,
            };

            if (info.chunks.length >= 3) {
                metasprite.bounds = {
                    x: s8(busU8(rom, addr + 2)),
                    y: s8(busU8(rom, addr + 3)),
                    w: busU8(rom, addr + 4),
                    h: busU8(rom, addr + 5),
                };
            }

            files.set(`${DIR}/${fullName}.json`, json(metasprite));

            const fileAt = addr & 0x3FFFFF;
            pool.push({ start: fileAt, end: fileAt + info.size });
            homes.push({
                key: `${DIR}/${fullName}`,
                at: fileAt,
                length: info.size,
                sha1: sha1(rom.subarray(fileAt, fileAt + info.size)),
            });
        }

        files.set(`${DIR}/${ENUM}`, enumFile({
            kind: KIND,
            limit: addrs.length,
            names,
            why: 'the composite sprite records in banks $CA–$D3 ($80:9033)',
        }));

        return { files, pool, tables: [], homes };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
            const m = new RegExp(`^${DIR}/([^/]+/[^/]+)\\.json$`).exec(path);
            if (m) {
                names.add(m[1]);
            } else {
                const single = new RegExp(`^${DIR}/([^/]+)\\.json$`).exec(path);
                if (single) names.add(single[1]);
                else findings.warning('unknown-file', path, '', 'a metasprite is <character>/<name>.json; ignored');
            }
        }
        return names;
    },

    encode(ctx, names) {
        const items: Item[] = [];
        const blocks16Ids = ctx.ids.get('sprite_blocks_16');
        const blocks8Ids = ctx.ids.get('sprite_blocks_8');

        for (const n of names) {
            const path = `${DIR}/${n}.json`;
            const key = `${DIR}/${n}`;
            const fileBytes = ctx.tree.get(path);
            if (!fileBytes) continue;

            let doc: MetaspriteJson;
            try {
                doc = JSON.parse(readText(fileBytes));
            } catch (e) {
                ctx.findings.error('parse-error', path, '', (e as Error).message);
                continue;
            }

            const chunks = doc.chunks ?? [];
            const count = chunks.length;
            const first = count >= 3 ? 6 : 2;
            const size = count ? first + CHUNK_SIZE * count : 2;
            const bytes = new Uint8Array(size);

            bytes[0] = count;
            bytes[1] = first;

            if (count >= 3) {
                let bx = doc.bounds?.x;
                let by = doc.bounds?.y;
                let bw = doc.bounds?.w;
                let bh = doc.bounds?.h;

                // Auto-compute bounding box if not provided
                if (bx === undefined || by === undefined || bw === undefined || bh === undefined) {
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    for (const c of chunks) {
                        const sz = c.size ?? 16;
                        minX = Math.min(minX, c.x);
                        minY = Math.min(minY, c.y);
                        maxX = Math.max(maxX, c.x + sz);
                        maxY = Math.max(maxY, c.y + sz);
                    }
                    bx = minX;
                    by = minY;
                    bw = maxX - minX;
                    bh = maxY - minY;
                }

                bytes[2] = bx & 0xFF;
                bytes[3] = by & 0xFF;
                bytes[4] = bw & 0xFF;
                bytes[5] = bh & 0xFF;
            }

            for (let i = 0; i < count; i++) {
                const c = chunks[i];
                const off = first + CHUNK_SIZE * i;
                const is16 = c.size !== 8;

                // Resolve block index
                let blockId = 0;
                if (typeof c.block === 'number') {
                    blockId = c.block;
                } else if (typeof c.block === 'string') {
                    const idMap = is16 ? blocks16Ids : blocks8Ids;
                    const resolved = idMap?.get(c.block);
                    if (resolved !== undefined) {
                        blockId = resolved;
                    } else if (c.block.startsWith('$') || c.block.startsWith('0x')) {
                        blockId = parseInt(c.block.replace(/^(\$|0x)/, ''), 16);
                    } else {
                        const m = /_([0-9a-f]+)$/i.exec(c.block);
                        if (m) blockId = parseInt(m[1], 16);
                    }
                }

                let flags = is16 ? 1 : 0;
                if (c.palette) flags |= (c.palette & 7) << 1;
                if (c.priority) flags |= (c.priority & 3) << 4;
                if (c.flip_x) flags |= 0x40;
                if (c.flip_y) flags |= 0x80;

                bytes[off] = flags;
                bytes[off + 1] = (c.x ?? 0) & 0xFF;
                bytes[off + 2] = (c.y ?? 0) & 0xFF;
                bytes[off + 3] = blockId & 0xFF;
                bytes[off + 4] = (blockId >> 8) & 0xFF;
            }

            const home = ctx.base.homes.get(key);
            if (!home) {
                ctx.findings.error('no-room', path, '', `metasprite "${n}" has no home record in _base`);
                continue;
            }

            // Pinned to home address
            items.push({
                key,
                file: path,
                bytes,
                rule: {
                    above: home.at,
                    below: home.at + size,
                    bankOffset: home.at & 0xFFFF,
                },
            });
        }

        return items;
    },

    tables(_ctx, _placed) {
        return [];
    },
};
