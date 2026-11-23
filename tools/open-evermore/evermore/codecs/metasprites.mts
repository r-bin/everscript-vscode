// The `metasprites` kind (docs/open-evermore/resources.md §metasprites): composite sprite frames assembled from
// 16×16 and 8×8 sprite blocks across banks $CA–$D3, exploded into `sprites/metasprites/<owner>/frame_<addr>.json`.
//
// Facts used (src/games/evermore/maps/sprites.ts, knowledge routines/direct_sprite_draw_oam.md):
//   record    count (u8), first (u8: 6 if count >= 3, 2 if count > 0, 0 if count == 0); when count >= 3 a bounding
//             box (x:s8, y:s8, w:u8, h:u8) for viewport culling; then count chunks of 5 bytes
//   chunk     flags (bit 0: 16×16, bits 1-3: palette, 4-5: priority, 6: flipX, 7: flipY), x:s8, y:s8, block:u16
//   place     pinned to home address (or same-length renamed home) while animation scripts in _base/ name them by address
import { createRequire } from 'node:module';
import type { Codec, CountOf, Item, NameAt, NameOf } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { analyzeAnimationGroups } from './animation-groups.mts';

const require = createRequire(import.meta.url);
const { spriteAddresses, readSpriteInfo, scriptSprites } = require('../../../../dist/games/evermore/maps/sprites');
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

/** Determine owner category for each sprite address from `animation_groups` attribution. */
function buildAttributionMap(rom: Uint8Array, name: NameOf, countOf: CountOf, nameAt: NameAt): Map<number, string> {
    const { groups } = analyzeAnimationGroups(rom, name, countOf, nameAt);
    const spriteToOwners = new Map<number, Set<string>>();

    for (const g of groups) {
        const owners = new Set<string>();
        for (const u of g.usedBy) {
            if (u.startsWith('character:')) owners.add(u.slice('character:'.length).split('.')[0]);
            else if (u.startsWith('weapon:') || u.startsWith('ammo:')) owners.add('boy');
            else if (u.startsWith('dog_form:')) owners.add('dog');
            else if (u.startsWith('alchemy:')) owners.add('alchemy');
            else if (u.startsWith('ring_item:')) owners.add('icon');
            else if (u.startsWith('projectile:')) owners.add('projectile');
        }
        if (owners.size === 0) {
            const folder = g.full.includes('/') ? g.full.split('/')[0] : 'misc';
            if (folder !== 'misc' && folder !== 'placeholder') owners.add(folder);
        }
        for (const sc of g.scripts) {
            if (!sc) continue;
            for (const spr of scriptSprites(rom, sc) as number[]) {
                let s = spriteToOwners.get(spr);
                if (!s) spriteToOwners.set(spr, s = new Set());
                for (const o of owners) s.add(o);
            }
        }
    }

    const attribution = new Map<number, string>();
    for (const spr of spriteAddresses(rom) as number[]) {
        const owners = spriteToOwners.get(spr);
        attribution.set(spr, !owners || owners.size === 0 ? 'misc' : owners.size === 1 ? [...owners][0] : 'shared');
    }
    return attribution;
}

export const METASPRITE_NAME_RE = /^(?:[a-z][a-z0-9_]{0,79}\/)?[a-z][a-z0-9_]{0,79}$/;

export const metaspritesCodec: Codec = {
    kind: KIND,
    version: 2,
    path: DIR,
    folder: `sprites/${DIR}`,
    nameRe: METASPRITE_NAME_RE,

    defaultName: id => `frame_${id.toString(16).padStart(4, '0')}`,

    canonical(path, bytes) {
        if (path === `${DIR}/${ENUM}`) return [path, bytes];
        const v = JSON.parse(readText(bytes)) as MetaspriteJson;
        return [path, json(v)];
    },

    explode(rom, name, _options, countOf, nameAt) {
        const files: Tree = new Map(), names: string[] = [], pool = [], homes = [];
        const addrs: number[] = spriteAddresses(rom);
        const isRoundTrip = countOf(KIND) !== undefined;
        const attribution = isRoundTrip ? null : buildAttributionMap(rom, name, countOf, nameAt);

        for (let id = 0; id < addrs.length; id++) {
            const addr = addrs[id], fileAt = addr & 0x3FFFFF;
            const info = readSpriteInfo(rom, addr);
            const owner = attribution?.get(addr) || 'misc';
            const fullName = (isRoundTrip ? nameAt(KIND, fileAt) : undefined) ?? `${owner}/frame_${hex(addr, 6)}`;
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
            const m = /^metasprites\/((?:[^/_][^/]*\/)?[^/_][^/]*)\.json$/.exec(path);
            if (m) names.add(m[1]);
            else findings.warning('unknown-file', path, '', 'a metasprite is <owner>/<name>.json or <name>.json in sprites/metasprites/; ignored');
        }
        return names;
    },

    encode(ctx, names) {
        const items: Item[] = [];
        const blocks16Ids = ctx.ids.get('sprite_blocks_16');
        const blocks8Ids = ctx.ids.get('sprite_blocks_8');
        const vanillaHomes = [...ctx.base.homes].filter(([k]) => k.startsWith(`${DIR}/`)).sort((a, b) => a[1].at - b[1].at);
        const homeOf = (n: string) => {
            const own = ctx.base.homes.get(`${DIR}/${n}`);
            if (own) return own;
            const id = ctx.ids.get(KIND)?.get(n);
            if (id === undefined || !vanillaHomes[id]) return undefined;
            return names.has(vanillaHomes[id][0].slice(DIR.length + 1)) ? undefined : vanillaHomes[id][1];
        };

        for (const n of names) {
            const path = `${DIR}/${n}.json`;
            const key = `${DIR}/${n}`;
            if (!METASPRITE_NAME_RE.test(n)) {
                ctx.findings.error('bad-name', path, '', `"${n}": snake_case (or <owner>/<name>), at most 80 characters each`);
                continue;
            }
            const fileBytes = ctx.tree.get(path);
            if (!fileBytes) continue;

            let doc: MetaspriteJson;
            try {
                doc = JSON.parse(readText(fileBytes));
            } catch (e) {
                ctx.findings.error('parse-error', path, '', (e as Error).message);
                continue;
            }

            if (!doc || typeof doc !== 'object' || doc.format !== FORMAT || doc.version !== 1) {
                ctx.findings.error('schema', path, '/format', `"${FORMAT}", version 1`);
                continue;
            }
            if (!Array.isArray(doc.chunks) || doc.chunks.length > 255) {
                ctx.findings.error('invalid-value', path, '/chunks', 'an array of 0-255 chunks');
                continue;
            }

            const chunks = doc.chunks;
            const count = chunks.length;
            const first = count >= 3 ? 6 : 2;
            const size = count ? first + CHUNK_SIZE * count : 2;
            const bytes = new Uint8Array(size);
            let ok = true;

            bytes[0] = count;
            bytes[1] = first;

            if (count >= 3) {
                let bx = doc.bounds?.x;
                let by = doc.bounds?.y;
                let bw = doc.bounds?.w;
                let bh = doc.bounds?.h;

                if (doc.bounds !== undefined) {
                    if (!Number.isInteger(bx) || bx! < -128 || bx! > 127) { ctx.findings.error('invalid-value', path, '/bounds/x', 'an integer -128..127'); ok = false; }
                    if (!Number.isInteger(by) || by! < -128 || by! > 127) { ctx.findings.error('invalid-value', path, '/bounds/y', 'an integer -128..127'); ok = false; }
                    if (!Number.isInteger(bw) || bw! < 0 || bw! > 255) { ctx.findings.error('invalid-value', path, '/bounds/w', 'an integer 0..255'); ok = false; }
                    if (!Number.isInteger(bh) || bh! < 0 || bh! > 255) { ctx.findings.error('invalid-value', path, '/bounds/h', 'an integer 0..255'); ok = false; }
                } else {
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    for (const c of chunks) {
                        const sz = c?.size === 8 ? 8 : 16, cx = Number(c?.x) || 0, cy = Number(c?.y) || 0;
                        minX = Math.min(minX, cx);
                        minY = Math.min(minY, cy);
                        maxX = Math.max(maxX, cx + sz);
                        maxY = Math.max(maxY, cy + sz);
                    }
                    bx = minX;
                    by = minY;
                    bw = maxX - minX;
                    bh = maxY - minY;
                }

                bytes[2] = (bx ?? 0) & 0xFF;
                bytes[3] = (by ?? 0) & 0xFF;
                bytes[4] = (bw ?? 0) & 0xFF;
                bytes[5] = (bh ?? 0) & 0xFF;
            }

            for (let i = 0; i < count; i++) {
                const c = chunks[i];
                if (!c || typeof c !== 'object') {
                    ctx.findings.error('invalid-value', path, `/chunks/${i}`, 'a chunk object');
                    ok = false;
                    continue;
                }
                if (c.size !== 16 && c.size !== 8) {
                    ctx.findings.error('invalid-value', path, `/chunks/${i}/size`, '16 or 8');
                    ok = false;
                }
                if (!Number.isInteger(c.x) || c.x < -128 || c.x > 127) {
                    ctx.findings.error('invalid-value', path, `/chunks/${i}/x`, 'an integer -128..127');
                    ok = false;
                }
                if (!Number.isInteger(c.y) || c.y < -128 || c.y > 127) {
                    ctx.findings.error('invalid-value', path, `/chunks/${i}/y`, 'an integer -128..127');
                    ok = false;
                }
                if (c.priority !== undefined && (!Number.isInteger(c.priority) || c.priority < 0 || c.priority > 3)) {
                    ctx.findings.error('invalid-value', path, `/chunks/${i}/priority`, 'an integer 0..3');
                    ok = false;
                }
                if (c.palette !== undefined && (!Number.isInteger(c.palette) || c.palette < 0 || c.palette > 7)) {
                    ctx.findings.error('invalid-value', path, `/chunks/${i}/palette`, 'an integer 0..7');
                    ok = false;
                }
                if (c.flip_x !== undefined && typeof c.flip_x !== 'boolean') {
                    ctx.findings.error('invalid-value', path, `/chunks/${i}/flip_x`, 'a boolean');
                    ok = false;
                }
                if (c.flip_y !== undefined && typeof c.flip_y !== 'boolean') {
                    ctx.findings.error('invalid-value', path, `/chunks/${i}/flip_y`, 'a boolean');
                    ok = false;
                }

                const is16 = c.size !== 8;
                const idMap = is16 ? blocks16Ids : blocks8Ids;
                const blockDir = is16 ? 'blocks_16' : 'blocks_8';
                let blockId: number | null = null;
                if (idMap && typeof c.block === 'string' && !c.block.startsWith('$') && !c.block.startsWith('0x')) {
                    const resolved = idMap.get(c.block);
                    if (resolved === undefined) {
                        ctx.findings.error('unknown-reference', path, `/chunks/${i}/block`, `"${c.block}" is no entry in sprites/${blockDir}/`);
                        ok = false;
                    } else blockId = resolved;
                } else if (typeof c.block === 'number' && Number.isInteger(c.block) && c.block >= 0 && c.block <= 0xFFFF) {
                    blockId = c.block;
                } else if (typeof c.block === 'string') {
                    const mHex = /^(?:\$|0x)([0-9a-f]+)$/i.exec(c.block);
                    const mTail = !idMap ? /_([0-9a-f]+)$/i.exec(c.block) : null;
                    const hexStr = mHex?.[1] ?? mTail?.[1];
                    if (hexStr) {
                        const v = parseInt(hexStr, 16);
                        if (v >= 0 && v <= 0xFFFF) blockId = v;
                    }
                    if (blockId === null) {
                        ctx.findings.error(idMap ? 'unknown-reference' : 'invalid-value', path, `/chunks/${i}/block`, `a block name in sprites/${blockDir}/`);
                        ok = false;
                    }
                } else {
                    ctx.findings.error('invalid-value', path, `/chunks/${i}/block`, `a block name in sprites/${blockDir}/`);
                    ok = false;
                }

                if (!ok || blockId === null) continue;
                const off = first + CHUNK_SIZE * i;
                let flags = is16 ? 1 : 0;
                if (c.palette) flags |= (c.palette & 7) << 1;
                if (c.priority) flags |= (c.priority & 3) << 4;
                if (c.flip_x) flags |= 0x40;
                if (c.flip_y) flags |= 0x80;

                bytes[off] = flags;
                bytes[off + 1] = c.x & 0xFF;
                bytes[off + 2] = c.y & 0xFF;
                bytes[off + 3] = blockId & 0xFF;
                bytes[off + 4] = (blockId >> 8) & 0xFF;
            }

            if (!ok) continue;
            const home = homeOf(n);
            if (!home) {
                ctx.findings.error('no-room', path, '', `metasprite "${n}" has no home record in _base`);
                continue;
            }
            if (size !== home.length) {
                ctx.findings.error('no-room', path, '/chunks', `${size} bytes (vanilla record is ${home.length} bytes at $${hex(home.at, 6)}: animation scripts name frames by 24-bit address)`);
                continue;
            }

            // Pinned to home address
            items.push({
                key,
                file: path,
                bytes,
                rule: {
                    above: home.at,
                    below: home.at + home.length,
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
