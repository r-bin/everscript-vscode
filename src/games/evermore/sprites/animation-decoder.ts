// Ownership: running an animation script, aligning and rendering its frames, and its script listing for the Sprites tab. Pure.

import { animationScript, characterPalette, characterPaletteAddress, characterHitbox, paletteAt, paletteAddresses, FACING_SOUTH } from '../maps/character-record';
import { runAnimation, MODE_INVULNERABLE } from '../maps/animation-vm';
import { facingScript } from '../maps/animation-table';
import { resolveCharacterSprite } from '../maps/character-animation';
import { MODE_CONTACT } from '../maps/hit-test';
import { disassembleScript } from '../maps/animation-opcodes';
import { readSpriteInfo, spriteAddresses } from '../maps/sprites';
import { composeAligned } from './frame-compose';
import { snesToRom } from '../maps/rom';
import { renderProjectiles } from './projectile-render';
import { projectileRecord } from '../maps/projectiles';
import { targetFor, buildTarget, hitTicks, DEFAULT_DISTANCE, OUT_OF_REACH_ABOVE, OUT_OF_REACH_BELOW } from './target';
import { hexLower } from '../../../platform';
import type { VmFrame, VmStrike } from '../maps/animation-vm-types';

type Rom = Uint8Array;
type Colours = Array<[number, number, number]>;
/** Which animation to play: a record offset, a key, or the Sprites tab's option object. */
interface AnimOpt {
    key?: string; label?: string; category?: string; animRec?: number; scriptAddr?: number; offset?: number;
    paletteAddr?: number; paletteForced?: boolean; oneShot?: boolean;
    target?: { on?: boolean; character?: number | null; distance?: number; paletteAddr?: number; name?: string };
}
type AnimArg = AnimOpt | string | number;
type Target = ReturnType<typeof buildTarget> & { hits?: ReturnType<typeof hitTicks>; hitsStill?: ReturnType<typeof hitTicks> };
/** A listed script line; `palette` and `projectile` carry what the tab previews under it. */
interface ListedLine {
    address: number; addrHex: string; bytesHex: string; text: string; endFrame: boolean; known: boolean;
    palette?: { addr: number; index: number; colors: string[] };
    spriteInfo?: { addr: number; addrHex: string; index: number; widthPx: number; heightPx: number };
    projectile?: { id: number; animRec: number; paletteAddr: number };
}

/** Resolve script address for a record, taking facing into account if directional. */
function resolveExternalScript(rom: Rom, animRec: number, facing: number) {
    return facingScript(rom, animRec, facing);
}

/** The script an animation option plays at a facing. */
function resolveScript(rom: Rom, characterId: number, animOpt: AnimArg, facing: number): number {
    if (typeof animOpt === 'string' || typeof animOpt === 'number') {
        return animationScript(rom, characterId, facing, typeof animOpt === 'number' ? animOpt : 0x32);
    }
    if (animOpt.category === 'external' || animOpt.category === 'weapon') {
        return resolveExternalScript(rom, animOpt.animRec ?? 0, facing) || animOpt.scriptAddr || 0;
    }
    if (animOpt.offset) return animationScript(rom, characterId, facing, animOpt.offset);
    if (animOpt.scriptAddr) return animOpt.scriptAddr;
    return animationScript(rom, characterId, facing, 0x32);
}

const SPEED_FACINGS: [string, number][] = [['N', 0], ['NE', 2], ['E', 4], ['SE', 6], ['S', 8], ['SW', 10], ['W', 12], ['NW', 14]];
const TICKS_PER_SECOND = 60;

/**
 * How fast an animation carries the character at each of the 8 facings: distance over the
 * repeating part of the cycle, split into x and y. The mover ($8FAD51, table $8FAF18) moves
 * a diagonal by the full step on both axes, and a four-pose record plays E's script for NE/SE
 * and W's for NW/SW, so walking NE climbs at E's speed: faster than walking N (the spear walk
 * steps 6 north/south, 8 east/west). Null when it does not move.
 */
function movementSpeeds(rom: Rom, characterId: number, animOpt: AnimArg) {
    const out: Record<string, object> = {};
    let any = false;
    for (const [name, f] of SPEED_FACINGS) {
        const script = resolveScript(rom, characterId, animOpt, f);
        if (!script) continue;
        const run = runAnimation(rom, script, f, { oneShot: isOneShot(animOpt) });
        const samples = run.frames.flatMap((fr) => fr.motion);
        if (!samples.length) continue;
        const from: number[] = run.loopFrom > 0 ? samples[run.loopFrom - 1] : [0, 0];
        const to = samples[samples.length - 1];
        const ticks = samples.length - (run.loopFrom > 0 ? run.loopFrom : 0);
        const dx = to[0] - from[0];
        const dy = to[1] - from[1];
        const dist = Math.hypot(dx, dy);
        if (dist) any = true;
        const per = (v: number): number => (ticks ? v / ticks : 0);
        out[name] = {
            facing: f, px: Math.round(dist), ticks,
            perTick: per(dist), perSecond: per(dist) * TICKS_PER_SECOND,
            xPerTick: per(dx), yPerTick: per(dy),
        };
    }
    return any ? out : null;
}

/**
 * Decode and render all frames for a character's animation.
 * Returns aligned PNG frames, hold durations in 60Hz ticks, sprite addresses, chunks, and strike boxes.
 */
function renderAnimation(rom: Rom, characterId: number, animOpt: AnimArg = {}, requestedFacing = FACING_SOUTH): any {
    const facing = attackFacing(rom, characterId, animOpt, requestedFacing);
    const scriptAddr = resolveScript(rom, characterId, animOpt, facing);
    if (!scriptAddr) return null;

    // Run the script the way the engine does: holds are checkpoints, counted
    // loops repeat, and a strike lasts exactly the ticks that run it.
    // A script that never sets a sprite (the shared damage knock-back) keeps showing
    // what the character had on: its standing sprite for this facing.
    const initialSprite = Number.isInteger(characterId) ? resolveCharacterSprite(rom, characterId, facing) : null;
    // The Boy's and Dog's scripts set +0x42/+0x44 to values (e.g. −132/−144) that cannot be
    // hurt offsets; until that is explained their hurt region stays at the default.
    const playerSlot = characterId === 0 || characterId === 1;
    const run = runAnimation(rom, scriptAddr, facing, { initialSprite, oneShot: isOneShot(animOpt) });
    const script = scriptListing(rom, scriptAddr);
    if (!run.frames.length) {
        return { projectiles: [], width: 0, height: 0, originX: 0, originY: 0, complete: run.complete, scriptAddr,
            scriptHex: hex6(scriptAddr), frames: [], strikeBoxes: [], script, totalTicks: run.totalTicks,
            stoppedAtHex: run.stoppedAt ? hex6(run.stoppedAt) : null };
    }

    const strikes = distinctStrikes(run.frames);
    // A palette the viewer picked wins; then one the script loads itself (command 0x4b).
    const optObj: AnimOpt = typeof animOpt === 'object' ? animOpt : {};
    const paletteAddr = optObj.paletteForced ? optObj.paletteAddr : run.palette || optObj.paletteAddr;
    const colours = paletteAddr ? paletteAt(rom, paletteAddr) : characterPalette(rom, characterId);
    // Harry and Vigor draw some chunks with their second palette (+0x0B).
    const colours2 = secondPalette(rom, characterId);
    const { width, height, originX, originY, images, buffers, infos } = composeAligned(rom, run.frames, colours, colours2);
    // The second sprite slot (usually the shadow) as its own layer: it stays on the
    // ground while height lifts the main sprite.
    const shadow = run.frames.some((f) => f.sprite2 && f.sprite2 !== f.sprite)
        ? composeAligned(rom, run.frames.map((f) => ({ sprite: f.sprite2 })), colours)
        : null;
    const frames = [];

    for (let i = 0; i < images.length; i++) {
        const info = infos[i];
        const pngDataUri = images[i];
        const bufInfo = buffers && buffers[i];

        // The chunks for inspection: block, offset, flags (`0x0000 @ -12, -31, flags 10`).
        const chunkList = (info ? info.chunks : []).map((ch) => ({
            blockHex: '0x' + ch.block.toString(16).padStart(4, '0'),
            block: ch.block,
            x: ch.x,
            y: ch.y,
            flagsHex: ch.flags.toString(16).padStart(2, '0'),
            flags: ch.flags,
            large: ch.large,
            flipX: ch.flipX,
            flipY: ch.flipY,
            priority: ch.priority,
            summary: `0x${ch.block.toString(16).padStart(4, '0')} @ ${ch.x}, ${ch.y}, flags ${ch.flags.toString(16).padStart(2, '0')}${ch.flipX ? ' [flipX]' : ''}${ch.flipY ? ' [flipY]' : ''}`,
        }));

        const f = run.frames[i];
        frames.push({
            frameIndex: i,
            png: pngDataUri,
            pngBuf: bufInfo ? bufInfo.pngBuf : null,
            rgba: bufInfo ? bufInfo.rgba : null,
            ticks: f.ticks,
            spriteAddr: f.sprite || 0,
            spriteHex: f.sprite ? hex6(f.sprite) : '—',
            strikeBox: f.strikeBox || null,
            lines: f.lines,
            step: f.step,
            random: f.random || null,
            spawns: f.spawns,
            mode: f.mode,
            invulnerable: (f.mode & MODE_INVULNERABLE) !== 0,
            contact: (f.mode & MODE_CONTACT) !== 0,
            segments: f.segments ? { sprites: f.segments.sprites.map(hex6), ticks: f.segments.ticks } : null,
            hurt: playerSlot ? [0, -16] : f.hurt,
            motion: f.motion,
            shadowPng: shadow && f.sprite2 ? shadow.images[i] : null,
            chunks: chunkList,
        });
    }

    // The second character: where it stands decides where aimed projectiles go.
    const targetOpt = optObj.target && optObj.target.on ? optObj.target : null;
    let target: Target | null = null;
    if (targetOpt) {
        const character: number = targetOpt.character != null ? targetOpt.character : targetFor(rom, characterId, null);
        const distance: number = typeof targetOpt.distance === 'number' && Number.isFinite(targetOpt.distance) ? targetOpt.distance : DEFAULT_DISTANCE;
        target = buildTarget(rom, (id, f) => renderAnimation(rom, id, { offset: 0x32, paletteAddr: targetOpt.paletteAddr || 0 }, f), {
            character, distance, facing, name: targetOpt.name || '',
        });
    }
    const projectiles = renderProjectiles(rom, run.frames, facing, colours, target);
    if (target) {
        // Hits as drawn with the walk path, and with the entity kept in place (Walk path off).
        const radius = Number.isInteger(characterId) ? characterHitbox(rom, characterId).radius : 0;
        target.hits = hitTicks(run.frames, projectiles.spawns, target, radius, false);
        target.hitsStill = hitTicks(run.frames, projectiles.spawns, target, radius, true);
        const hits = target.hits, still = target.hitsStill;
        (projectiles.spawns as (Omit<typeof projectiles.spawns[number], 'ends'> & { cutWalk?: number; cutStill?: number; ends?: string })[]).forEach((sp, k) => {
            if (k in hits.cut) { sp.cutWalk = hits.cut[k]; sp.ends = 'hit'; }
            if (k in still.cut) sp.cutStill = still.cut[k];
        });
    }
    const segmentSprites = renderSegmentSprites(rom, run.frames, colours, colours2);

    return {
        width,
        height,
        originX,
        originY,
        complete: run.complete,
        scriptAddr,
        scriptHex: hex6(scriptAddr),
        frames,
        strikeBoxes: strikes,
        script,
        totalTicks: run.totalTicks,
        stoppedAtHex: run.stoppedAt ? hex6(run.stoppedAt) : null,
        projectiles,
        moves: run.moves,
        speeds: run.moves ? movementSpeeds(rom, characterId, animOpt) : null,
        loopFrom: run.loopFrom,
        initialSprite: initialSprite ? hex6(initialSprite) : null,
        segmentSprites,
        target,
        reach: { above: OUT_OF_REACH_ABOVE, below: OUT_OF_REACH_BELOW },
        scriptPalette: run.palette ? '$' + run.palette.toString(16) : null,
        // The palette the frames are drawn in, for the header swatch.
        paletteAddr: paletteAddr || characterPaletteAddress(rom, characterId),
        paletteIndex: paletteAddresses(rom).indexOf((paletteAddr || characterPaletteAddress(rom, characterId)) & 0xffff),
        paletteColors: colours.map(([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')),
        facing,
        facingRounded: facing !== requestedFacing,
        shadow: shadow ? { width: shadow.width, height: shadow.height, originX: shadow.originX, originY: shadow.originY } : null,
    };
}

/**
 * Starting an attack ($9082D8) rounds the facing (+0x22) to four directions through `$90815B`
 * when the attack record has only four poses (record +2 bit 14, `$908343`): diagonals become
 * east or west. Everything the attack does — steps, projectiles — then goes that way, so a
 * spear thrown facing NE flies east. No other animation start writes the facing back.
 */
const FOUR_POSES = 0x40;
const ROUND_TO_FOUR = [0, 4, 4, 4, 8, 12, 12, 12];
const ATTACK_FIELDS = new Set([0x38, 0x3a, 0x3c, 0x3e]);
function isAttackStart(opt: AnimArg | undefined): boolean {
    if (!opt || typeof opt !== 'object') return typeof opt === 'number' && ATTACK_FIELDS.has(opt);
    if (opt.category === 'external') return false;
    if (/^w_atk/.test(opt.key || '')) return true;
    return typeof opt.offset === 'number' && ATTACK_FIELDS.has(opt.offset) && !/^w_|^d_/.test(opt.key || '');
}
function attackFacing(rom: Rom, characterId: number, opt: AnimArg, facing: number): number {
    if (!isAttackStart(opt)) return facing;
    let rec = opt && typeof opt === 'object' ? opt.animRec : 0;
    if (!rec && Number.isInteger(characterId)) {
        const field = typeof opt === 'number' ? opt : (opt as AnimOpt).offset!;
        rec = rom[snesToRom(0x8eb678 + characterId * 74 + field)] | (rom[snesToRom(0x8eb678 + characterId * 74 + field + 1)] << 8);
    }
    if (!rec) return facing;
    const flags = rom[snesToRom(0xc40003 + rec)];
    return flags & FOUR_POSES ? ROUND_TO_FOUR[(facing & 0x0e) >> 1] : facing;
}

const hex6 = (v: number): string => '$' + hexLower(v, 6);

/** A character's second palette (+0x0B), or null when it has none. */
function secondPalette(rom: Rom, characterId: number): Colours | null {
    if (!Number.isInteger(characterId)) return null;
    const rec = 0x8eb678 + characterId * 74 + 0x0b;
    const o = snesToRom(rec);
    const addr = rom[o] | (rom[o + 1] << 8);
    return addr ? paletteAt(rom, addr) : null;
}

/**
 * Attacks, damage, death, spoils and casting end on `end_check`, which hands the entity
 * back to its AI; idles, walks and runs loop. Record fields from +0x38 on are the former.
 */
const ONE_SHOT_LABEL = /attack|damage|knockback|death|spoils|cast|dodge|hurt/i;
function isOneShot(opt: AnimArg | undefined): boolean {
    if (!opt || typeof opt !== 'object') return typeof opt === 'number' && opt >= 0x38;
    if (typeof opt.oneShot === 'boolean') return opt.oneShot;
    if (typeof opt.offset === 'number') return opt.offset >= 0x38;
    if (/^w_(atk|charge|damage)/.test(opt.key || '') || /^d_slot[4-8]$/.test(opt.key || '')) return true;
    return ONE_SHOT_LABEL.test(String(opt.label || opt.key || ''));
}

/** Each distinct segment sprite, composed once, keyed by address. */
function renderSegmentSprites(rom: Rom, frames: VmFrame[], colours: Colours, secondPaletteFor: Colours | null) {
    const out: Record<string, object> = {};
    for (const f of frames) {
        if (!f.segments) continue;
        for (const sprite of f.segments.sprites) {
            const key = hex6(sprite);
            if (key in out) continue;
            const c = composeAligned(rom, [{ sprite }], colours, secondPaletteFor);
            out[key] = { png: c.images[0], width: c.width, height: c.height, originX: c.originX, originY: c.originY };
        }
    }
    return out;
}

/** The script's reachable commands, as the webview lists them. */
const PALETTE_OP = 0x4b;
const PROJECTILE_OP = 0x4c;
const colourHex = ([r, g, b]: [number, number, number]): string => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

/**
 * The script as listed in the Script tab. Lines that load something carry what the tab
 * previews under them: `palette` (address and its 16 colours), `projectile` (the record's
 * own animation and palette, 0 = the thrower's).
 */
function scriptListing(rom: Rom, scriptAddr: number) {
    const allPals = paletteAddresses(rom);
    const allSprites = spriteAddresses(rom);
    return disassembleScript(rom, scriptAddr).map((l) => {
        const line: ListedLine = {
            address: l.address,
            addrHex: l.address.toString(16).padStart(6, '0'),
            bytesHex: l.bytes.map((b) => b.toString(16).padStart(2, '0')).join(' '),
            text: l.text,
            endFrame: l.endFrame,
            known: l.known,
        };
        const op = l.bytes[0] & 0x7f;
        if (l.known && op === PALETTE_OP) {
            const addr = l.bytes[1] | (l.bytes[2] << 8);
            const pIdx = allPals.indexOf(addr & 0xffff);
            line.palette = { addr, index: pIdx >= 0 ? pIdx : 0, colors: paletteAt(rom, addr).map(colourHex) };
        } else if (l.known && op === PROJECTILE_OP) {
            const p = projectileRecord(rom, l.bytes[1] | (l.bytes[2] << 8));
            line.projectile = { id: p.id, animRec: p.animRecord, paletteAddr: p.palette };
        }
        // Extract sprite address if this line sets a sprite
        const sprMatch = /\$([0-9a-f]{6})/i.exec(l.text);
        if (l.known && sprMatch && /^(sprite|hud_|segments)/.test(l.text)) {
            const sprAddr = parseInt(sprMatch[1], 16);
            const sprIdx = allSprites.indexOf(sprAddr);
            try {
                const info = readSpriteInfo(rom, sprAddr);
                let minX = 0, minY = 0, maxX = 1, maxY = 1;
                for (const c of info.chunks) {
                    const sz = c.large ? 16 : 8;
                    if (c.x < minX) minX = c.x;
                    if (c.y < minY) minY = c.y;
                    if (c.x + sz > maxX) maxX = c.x + sz;
                    if (c.y + sz > maxY) maxY = c.y + sz;
                }
                line.spriteInfo = {
                    addr: sprAddr,
                    addrHex: '$' + sprAddr.toString(16).padStart(6, '0'),
                    index: sprIdx >= 0 ? sprIdx : 0,
                    widthPx: maxX - minX,
                    heightPx: maxY - minY,
                };
            } catch (_) {
                line.spriteInfo = {
                    addr: sprAddr,
                    addrHex: '$' + sprAddr.toString(16).padStart(6, '0'),
                    index: sprIdx >= 0 ? sprIdx : 0,
                    widthPx: 0,
                    heightPx: 0,
                };
            }
        }
        return line;
    });
}

/** Each distinct strike box the run produced, in order. */
function distinctStrikes(frames: VmFrame[]) {
    const out: VmStrike[] = [];
    const seen = new Set<string>();
    for (const f of frames) {
        const b = f.strikeBox;
        if (!b) continue;
        const k = `${b.dx},${b.dy},${b.width},${b.height}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(b);
    }
    return out;
}

export { renderAnimation, resolveExternalScript };
