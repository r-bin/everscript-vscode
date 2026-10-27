// Ownership: the Scripts tab's host side: answers the webview's requests.
// No VS Code dependency. extension.js injects the ROM loader, `post`, and the
// two capabilities that belong to other tabs: the animation catalogue and
// renderer (sprites) and the silent music player (music), so this domain never
// imports another feature.
//
// State owned: `_rooms` (room scripts + picture per room id, for the loaded ROM).
//
//   page -> scriptsInit                 host -> scriptsIndex { rooms, animations, music } | { error }
//   page -> scriptsRoom { id }          host -> scriptsRoom { id, room, picture }
//   page -> scriptsMap { id }           host -> scriptsMap { id, map, picture }
//   page -> scriptsMapView { id, key }  host -> scriptsMapView { id, key, panels } | { id, key, error }
//   page -> scriptsAnim { key, record, facing }   host -> scriptsAnim { key, anim } | { key, error }
//   page -> scriptsMusic { id, seconds }          host -> scriptsMusic { id, sequence, timeline } | { id, error }
//   page -> scriptsSim { room, key }    host -> scriptsSim { room, key, everscript, clusters } | { error }
//   page -> scriptsVariants { id }      host -> scriptsVariants { id, variants, pictures } | { id, error }   (the Rooms tab's worker, injected;
//                                       pictures[i]: the room with variant i's object states and palette set, null when it sets neither)

import { roomList, roomScripts, roomPicture } from './model/rooms';
import { alchemyModel } from './model/alchemy';
import { simulateScript, roomClusters } from './model/simulation';
import { mapSections } from './model/map-sections';
import { mapView, mapPicture } from './model/map-views';
import { missingRomText } from '../../../platform/roms/library';

const FACING_SOUTH = 8;

type Rom = Uint8Array;
/** A catalogue entry (sprites/animation-catalog.ts), as far as this tab reads it. */
interface CatalogEntry { record: number; recHex: string; label: string; facingCount: number; scriptHex: string; paletteAddr?: number; paletteCharacter: number; effect?: boolean }
/** A rendered animation (sprites/animation-decoder.ts): only the fields the slim copy keeps are typed. */
interface RenderedAnimation {
    width: number; height: number; originX: number; originY: number; complete: boolean; scriptHex: string; totalTicks: number; loopFrom: number;
    stoppedAtHex: string; facing: number; paletteColors: string[]; paletteAddr?: number; paletteIndex?: number; candidatePalettes?: unknown[]; script: unknown; shadow: unknown;
    frames: { png: string; ticks: number; lines: number[]; shadowPng?: string | null }[];
}
/** The page's request. */
interface Message { command: string; key?: string; id?: number | string; room?: number | string; record?: number | string; facing?: number | string; seconds?: number | string; paletteAddr?: number }
interface Deps {
    post(message: object): void;
    loadRom(): Buffer | Uint8Array | null;
    animations(rom: Rom): CatalogEntry[];
    renderAnimation(rom: Rom, characterId: number, animOpt: object, facing: number): RenderedAnimation | null;
    music: { list(rom: Rom): unknown; sequence(rom: Rom, id: number): unknown; timeline(rom: Rom, id: number, seconds: number): Promise<unknown> };
    /** Who stands in a ROM room per story state, and the instructions each runs (simulation/variants.ts, in a worker). */
    roomVariants(rom: Rom, id: number): Promise<Array<{ objects?: Array<[number, number]>; palette?: number }>>;
}

type RoomEntry = { room: ReturnType<typeof roomScripts>; picture: ReturnType<typeof roomPicture> };
let _rooms: { rom: Rom | null; byId: Map<number, RoomEntry> } = { rom: null, byId: new Map() };

const handlesScriptsMessage = (command: unknown): boolean => typeof command === 'string' && command.startsWith('scripts');

function loadRom(deps: Deps): Rom | null {
    const buf = deps.loadRom();
    if (!buf) return null;
    return buf.length % 0x8000 === 0x200 ? buf.subarray(0x200) : buf;
}

function roomEntry(rom: Rom, id: number): RoomEntry {
    if (_rooms.rom !== rom) _rooms = { rom, byId: new Map() };
    if (!_rooms.byId.has(id)) _rooms.byId.set(id, { room: roomScripts(rom, id), picture: roomPicture(rom, id) });
    return _rooms.byId.get(id)!;
}

/** A rendered animation, without the buffers the page does not draw. */
function slimAnimation(a: RenderedAnimation | null) {
    if (!a) return null;
    return {
        width: a.width, height: a.height, originX: a.originX, originY: a.originY,
        complete: a.complete, scriptHex: a.scriptHex, totalTicks: a.totalTicks, loopFrom: a.loopFrom,
        stoppedAtHex: a.stoppedAtHex, facing: a.facing, paletteColors: a.paletteColors,
        paletteAddr: a.paletteAddr, paletteIndex: a.paletteIndex,
        candidatePalettes: a.candidatePalettes || [],
        script: a.script,
        frames: a.frames.map((f) => ({ png: f.png, ticks: f.ticks, lines: f.lines, shadow: f.shadowPng || null })),
        shadow: a.shadow,
    };
}

function index(rom: Rom, deps: Deps) {
    const animations = deps.animations(rom).map((e): { record: number; recHex: string; label: string; facings: number; scriptHex: string; effect?: boolean } => ({
        record: e.record, recHex: e.recHex, label: e.label, facings: e.facingCount, scriptHex: e.scriptHex,
    }));
    const alchemy = alchemyModel(rom);
    const effects = new Set(alchemy.effects);
    // A record no character owns but a formula's block names: call it after the formulas.
    const named = new Map<number, string[]>();
    alchemy.formulas.forEach((f) => f.records.forEach((r) => named.set(r.record, (named.get(r.record) || []).concat(f.name))));
    animations.forEach((a) => {
        if (effects.has(a.record)) a.effect = true;
        if (named.has(a.record) && a.label === 'no known owner') a.label = 'alchemy · ' + [...new Set(named.get(a.record))].join(', ');
    });
    return {
        rooms: roomList(),
        animations,
        music: deps.music.list(rom),
    };
}

/**
 * @param msg  webview message
 * @param deps {post, loadRom: () => Buffer|null,
 *              animations(rom): catalogue entries (sprites/animation-catalog.ts),
 *              renderAnimation(rom, characterId, animOpt, facing) (sprites/animation-decoder.ts),
 *              music: {list(rom), sequence(rom, id), timeline(rom, id, seconds): Promise} (music/)}
 */
function failed(msg: Message, deps: Deps, error: string): void {
    deps.post({ command: msg.command === 'scriptsInit' ? 'scriptsIndex' : msg.command, key: msg.key, id: msg.id, room: msg.room, error });
}

function handleScriptsMessage(msg: Message, deps: Deps): void {
    const rom = loadRom(deps);
    if (!rom) { failed(msg, deps, missingRomText('evermore')); return; }
    try {
        switch (msg.command) {
            case 'scriptsInit':
                deps.post({ command: 'scriptsIndex', ...index(rom, deps) });
                return;
            case 'scriptsRoom': {
                const id = Number(msg.id);
                const { room, picture } = roomEntry(rom, id);
                deps.post({ command: 'scriptsRoom', id, room, picture });
                return;
            }
            case 'scriptsAnim': {
                const entry = deps.animations(rom).find((e) => e.record === Number(msg.record));
                if (!entry) { deps.post({ command: 'scriptsAnim', key: msg.key, error: 'No animation record ' + msg.record }); return; }
                const opt = { key: 'record', category: 'external', animRec: entry.record, paletteAddr: msg.paletteAddr || entry.paletteAddr || 0, paletteForced: !!msg.paletteAddr };
                const facing = Number.isInteger(Number(msg.facing)) ? Number(msg.facing) : FACING_SOUTH;
                const anim = deps.renderAnimation(rom, entry.paletteCharacter, opt, facing);
                deps.post({ command: 'scriptsAnim', key: msg.key, anim: slimAnimation(anim) });
                return;
            }
            case 'scriptsMap': {
                const id = Number(msg.id);
                deps.post({ command: 'scriptsMap', id, map: mapSections(rom, id), picture: mapPicture(rom, id) });
                return;
            }
            case 'scriptsMapView': {
                deps.post({ command: 'scriptsMapView', ...mapView(rom, Number(msg.id), String(msg.key || 'header')) });
                return;
            }
            case 'scriptsMusic': {
                const id = Number(msg.id);
                const sequence = deps.music.sequence(rom, id);
                deps.music.timeline(rom, id, Number(msg.seconds) || 60)
                    .then((timeline) => deps.post({ command: 'scriptsMusic', id, sequence, timeline }))
                    .catch((err) => deps.post({ command: 'scriptsMusic', id, sequence, error: String(err instanceof Error ? err.message : err) }));
                return;
            }
            case 'scriptsVariants': {
                const id = Number(msg.id);
                deps.roomVariants(rom, id)
                    .then((variants) => deps.post({
                        command: 'scriptsVariants', id, variants,
                        // A variant that sets object states or the palette set shows its own picture (Thraxx's chamber
                        // without Thraxx, Coleoptera's in white).
                        pictures: variants.map((v) => ((v.objects && v.objects.length) || v.palette
                            ? roomPicture(rom, id, Object.fromEntries(v.objects || []), v.palette || 0) : null)),
                    }))
                    .catch((err) => deps.post({ command: 'scriptsVariants', id, variants: [], error: String(err instanceof Error ? err.message : err) }));
                return;
            }
            case 'scriptsSim': {
                const id = Number(msg.room);
                const { room } = roomEntry(rom, id);
                const s = room.scripts && room.scripts.find((x) => x.key === msg.key);
                deps.post({
                    command: 'scriptsSim', room: id, key: msg.key,
                    everscript: s ? simulateScript(rom, s.address, s.key) : null,
                    clusters: roomClusters(rom, id),
                });
                return;
            }
        }
    } catch (err) {
        failed(msg, deps, String(err instanceof Error ? err.message : err));
    }
}

export { handlesScriptsMessage, handleScriptsMessage };
