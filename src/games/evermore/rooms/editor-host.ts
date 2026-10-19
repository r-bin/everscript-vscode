// Ownership: the host side of the Rooms tab's map editor — every message the editor sends that
// needs the ROM: room tiles and stamps, converted Mana rooms, families, vanilla suggestions, deco,
// drafts, export / play ROM, PNG export. The radar (games/evermore/extension.js) routes them here
// and hands in what it owns as `ctx`:
//   post(message)       to the radar webview
//   roomRom(roomId)     { romBuf, roomId } for a ROM room or a converted room's image, or { error }
//   manaRooms           the Mana-room bridge (imports/mana), or null
//   exportChannel()     the "map export" output channel
//   openEmulator(rom)   the emulator panel with a built ROM
//   context             the extension context (global storage)

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as romReaders from '../rom-readers';
import { buildRoomTileOverlay, buildRoomMetatilePalette, buildComposedPreview, buildBlankRoom, buildFamilyPreviews } from '.';
import { missingRomText } from '../../../platform/roms/library';
import { errorText } from './editor-host-types';
import type { EditorMessage, EditorContext, EditorHandler } from './editor-host-types';
import { ROM_HANDLERS } from './editor-host-rom';
import { SUGGEST_HANDLERS } from './editor-host-suggest';

/**
 * Save the room currently on screen in the Rooms tab as a PNG.
 *
 * Distinct from `exportRoomMaps`, which asks for scope and layer up front:
 * this one takes its settings from the view, so the file matches the picture.
 */
async function exportRenderedRoomPng(msg: EditorMessage, _ctx: EditorContext) {
    const ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    const rom = romReaders.loadRomBuffer(ws, '');
    if (!rom) {
        vscode.window.showErrorMessage('Everscript: ' + missingRomText('evermore'));
        return;
    }
    const roomId = Number(msg.roomId);
    if (!Number.isInteger(roomId) || roomId < 0 || roomId > 0x7e) {
        vscode.window.showErrorMessage(`Everscript: invalid room id ${msg.roomId}.`);
        return;
    }

    const layer = typeof msg.layer === 'string' ? msg.layer : 'composite';
    const hex = roomId.toString(16).padStart(2, '0');
    const suffix = msg.objectStates ? '_obj-' + String(msg.objectStates).replace(/[:,]/g, '-') : '';
    const target = await vscode.window.showSaveDialog({
        saveLabel: 'Export PNG',
        filters: { 'PNG image': ['png'] },
        defaultUri: vscode.Uri.file(path.join(ws || os.homedir(), `room_0x${hex}_${layer}${suffix}.png`)),
    });
    if (!target) return;

    try {
        const overlay = buildRoomTileOverlay(rom, roomId, 0, 0, layer,
            typeof msg.overlay === 'string' ? msg.overlay : undefined, msg.objectStates);
        // buildRoomTileOverlay hands back a data URI because that is what the
        // webview needs; strip the prefix rather than render the room twice.
        const b64 = String(overlay.imageUri).slice(overlay.imageUri.indexOf(',') + 1);
        await vscode.workspace.fs.writeFile(target, Buffer.from(b64, 'base64'));
        const open = await vscode.window.showInformationMessage(
            `Everscript: exported room 0x${hex.toUpperCase()} (${overlay.imageWidth}\u00d7${overlay.imageHeight}).`,
            'Reveal');
        if (open) vscode.commands.executeCommand('revealFileInOS', target);
    } catch (err) {
        vscode.window.showErrorMessage(`Everscript: export failed \u2014 ${errorText(err)}`);
    }
}

const HANDLERS: Record<string, EditorHandler> = {
    ...ROM_HANDLERS,
    ...SUGGEST_HANDLERS,
    requestRoomTiles(msg, ctx) {
        // Decode a vanilla room's collision grid on demand and send back
        // SVG path data for the Rooms tab map view. On demand rather than
        // in the tree JSON: 127 rooms of tile data would bloat every render.
        const roomId = Number(msg.roomId);
        const reply = { command: 'roomTiles', mapName: msg.mapName, roomId };
        try {
            // A ROM room, or a converted one's own image (radarRoomRom).
            const src = ctx.roomRom(roomId);
            if ('error' in src) {
                ctx.post({ ...reply, error: src.error });
                return;
            }
            // msg.overlay carries the top bar's feature flags. It used
            // to be dropped here, so every render came back bare and
            // the toggles looked dead however the user set them.
            const overlay = buildRoomTileOverlay(
                src.romBuf, src.roomId,
                Number(msg.originX) || 0, Number(msg.originY) || 0,
                msg.layer, typeof msg.overlay === 'string' ? msg.overlay : undefined,
                msg.objectStates, msg.animate === true, msg.header);
            // The reply names the room the tab asked about, not the image's slot.
            ctx.post({ ...reply, overlay: { ...overlay, roomId } });
        } catch (err) {
            ctx.post({ ...reply, error: errorText(err) });
        }
    },
    requestImportedRoom(msg, ctx) {
        // A converted room's details, built when it is opened (rooms-imported.js).
        const reply = { command: 'importedRoom', id: msg.id };
        try {
            const mana = ctx.manaRooms;
            const room: (ReturnType<NonNullable<typeof mana>['detail']> & { familyPreviews?: unknown }) | null = mana ? mana.detail(msg.id, msg.name) : null;
            // The family chips' art, drawn from the room's own image (two tiles each).
            const src = room && mana!.resolveRoom(room.romRoomId);
            if (room && src) room.familyPreviews = buildFamilyPreviews(src.rom, room.families.map((f) => f.id), 2);
            ctx.post(room ? { ...reply, room }
                : { ...reply, error: 'Needs both ROMs: an Evermore and a Secret of Mana ROM (Everscript: Switch ROM)' });
        } catch (err) {
            ctx.post({ ...reply, error: errorText(err) });
        }
    },
    requestRoomMetatiles(msg, ctx) {
        // The room's metatile dictionary — the stamps a map editor
        // can place. Its own request because the biggest room is a
        // 325 KB atlas, which nobody should pay for unless they
        // open the palette. See docs/map-format/map_editor_ui.md.
        const roomId = Number(msg.roomId);
        const reply = { command: 'roomMetatiles', mapName: msg.mapName, roomId };
        try {
            const src = ctx.roomRom(roomId);
            if ('error' in src) {
                ctx.post({ ...reply, error: src.error });
                return;
            }
            // `roomId`: the tab's id, also for a converted room drawn from its image's slot.
            const palette = { ...buildRoomMetatilePalette(src.romBuf, src.roomId, msg.layer, msg.bgPalette, msg.header), roomId };
            // `atlasOnly`: a header edit wants the stamps' pictures redrawn, nothing else.
            ctx.post({ ...reply, palette, atlasOnly: msg.atlasOnly === true });
        } catch (err) {
            ctx.post({ ...reply, error: errorText(err) });
        }
    },
    requestComposedPreview(msg, ctx) {
        // Swatches for metatiles the editor has composed but not
        // written. Rendered against the room they are for, so the
        // preview uses its families and palette.
        const roomId = Number(msg.roomId);
        const reply = { command: 'composedPreview', mapName: msg.mapName, roomId };
        try {
            // A ROM room, or the room a converted map's copy borrows from (radarRoomRom).
            const src = ctx.roomRom(roomId);
            if ('error' in src) {
                ctx.post({ ...reply, error: src.error });
                return;
            }
            const preview = buildComposedPreview(src.romBuf, src.roomId,
                Array.isArray(msg.drafts) ? msg.drafts : [], msg.layer, msg.extra);
            ctx.post({ ...reply, preview });
        } catch (err) {
            ctx.post({ ...reply, error: errorText(err) });
        }
    },
    requestBlankRoom(msg, ctx) {
        // A room that is not in the ROM. It borrows a real room's
        // graphics list and families, because a synthetic room
        // with its own one-entry Block 1 renders black — rule 7.1
        // of docs/map-format/building-a-room-from-scratch.md.
        const reply = { command: 'blankRoom', mapName: msg.mapName };
        try {
            // The donor is a ROM room, or a converted Secret of Mana room (a copy of one
            // borrows its graphics and families): radarRoomRom finds the image it lives in.
            const src = ctx.roomRom(Number(msg.borrowFrom) || 0x76);
            if ('error' in src) {
                ctx.post({ ...reply, error: src.error });
                return;
            }
            ctx.post({ ...reply, room: buildBlankRoom(src.romBuf, {
                widthTiles: msg.widthTiles, heightTiles: msg.heightTiles, borrowFrom: src.roomId,
                minTiles: msg.minTiles,
            }) });
        } catch (err) {
            ctx.post({ ...reply, error: errorText(err) });
        }
    },
    exportRoomPng(msg, ctx) {
        // Export exactly what the Rooms tab is showing — same
        // layer, overlay flags and object states — rather than a
        // separately-configured render, so what you save is what
        // you were looking at.
        // Not awaited: the message handler is synchronous, and the
        // export reports its own success and failure to the user.
        exportRenderedRoomPng(msg, ctx).catch((err) => {
            vscode.window.showErrorMessage(`Everscript: export failed — ${errorText(err)}`);
        });
    },
};

function handlesEditorMessage(command: string) {
    return Object.prototype.hasOwnProperty.call(HANDLERS, command);
}

function handleEditorMessage(msg: EditorMessage, ctx: EditorContext) {
    return HANDLERS[msg.command](msg, ctx);
}

export { handlesEditorMessage, handleEditorMessage };
