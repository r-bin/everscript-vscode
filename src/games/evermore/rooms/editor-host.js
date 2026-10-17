'use strict';
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

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const os = require('os');
const romReaders = require('../rom-readers');
const { buildRoomTileOverlay, buildRoomMetatilePalette, buildComposedPreview, buildBlankRoom, buildDraftCollision, buildExportRom, buildFamilySheet, buildFamilyCatalogue, buildFamilyPreviews, decoIndex, decoCells, buildDecoPreviews, buildWidgetPreviews, buildConstructGhost, relatedTiles, neighbourTiles, vanillaExamples, proceduralFill } = require('./index');
const { missingRomText } = require('../../../../dist/platform/roms/library');

/**
 * Save the room currently on screen in the Rooms tab as a PNG.
 *
 * Distinct from `exportRoomMaps`, which asks for scope and layer up front:
 * this one takes its settings from the view, so the file matches the picture.
 */
async function exportRenderedRoomPng(msg, ctx) {
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
        defaultUri: vscode.Uri.file(path.join(ws || require('os').homedir(), `room_0x${hex}_${layer}${suffix}.png`)),
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
        vscode.window.showErrorMessage(`Everscript: export failed \u2014 ${err && err.message || err}`);
    }
}

const HANDLERS = {
    requestRoomTiles(msg, ctx) {
        // Decode a vanilla room's collision grid on demand and send back
        // SVG path data for the Rooms tab map view. On demand rather than
        // in the tree JSON: 127 rooms of tile data would bloat every render.
        const roomId = Number(msg.roomId);
        const reply = { command: 'roomTiles', mapName: msg.mapName, roomId };
        try {
            // A ROM room, or a converted one's own image (radarRoomRom).
            const src = ctx.roomRom(roomId);
            if (src.error) {
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
            ctx.post({ ...reply, error: String(err && err.message || err) });
        }
    },
    requestImportedRoom(msg, ctx) {
        // A converted room's details, built when it is opened (rooms-imported.js).
        const reply = { command: 'importedRoom', id: msg.id };
        try {
            const room = ctx.manaRooms && ctx.manaRooms.detail(msg.id, msg.name);
            // The family chips' art, drawn from the room's own image (two tiles each).
            const src = room && ctx.manaRooms.resolveRoom(room.romRoomId);
            if (src) room.familyPreviews = buildFamilyPreviews(src.rom, room.families.map((f) => f.id), 2);
            ctx.post(room ? { ...reply, room }
                : { ...reply, error: 'Needs both ROMs: an Evermore and a Secret of Mana ROM (Everscript: Switch ROM)' });
        } catch (err) {
            ctx.post({ ...reply, error: String(err && err.message || err) });
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
            if (src.error) {
                ctx.post({ ...reply, error: src.error });
                return;
            }
            // `roomId`: the tab's id, also for a converted room drawn from its image's slot.
            const palette = { ...buildRoomMetatilePalette(src.romBuf, src.roomId, msg.layer, msg.bgPalette, msg.header), roomId };
            // `atlasOnly`: a header edit wants the stamps' pictures redrawn, nothing else.
            ctx.post({ ...reply, palette, atlasOnly: msg.atlasOnly === true });
        } catch (err) {
            ctx.post({ ...reply, error: String(err && err.message || err) });
        }
    },
    mapEditDraft(msg, ctx) {
        // The editor hands its draft over as JSON. Opened as an
        // untitled document rather than written anywhere: nothing
        // in this extension writes a ROM yet, and the draft is the
        // handover format for the verified Python encoder. See
        // docs/map-format/map_editor_ui.md.
        (async () => {
            try {
                const doc = await vscode.workspace.openTextDocument({
                    language: 'json',
                    content: JSON.stringify(msg.draft, null, 2),
                });
                await vscode.window.showTextDocument(doc, { preview: false });
            } catch (err) {
                vscode.window.showErrorMessage('Could not open the map draft: ' + String(err && err.message || err));
            }
        })();
    },
    mapExportRom(msg, ctx) {
        // A playable ROM: the vanilla ROM, extended, with this
        // custom map in Brian's room's slot and the intro jumping
        // there. Written only where the user picks, never over the
        // vanilla ROM. See docs/map-format/rom-export.md.
        (async () => {
            const reply = { command: 'mapExportRomDone' };
            const ch = ctx.exportChannel();
            ch.show(true);
            const draft = msg.draft || {};
            const mapName = msg.name || 'custom map';
            const timeStr = new Date().toLocaleTimeString();
            ch.appendLine(`[${timeStr}] [Export ROM] Starting compilation of "${mapName}"...`);
            ch.appendLine(`  Dimensions: ${draft.widthTiles || '?'}x${draft.heightTiles || '?'} tiles`);
            ch.appendLine(`  Triggers: stepOn: ${(draft.stepOn || []).length}, bTrigger: ${(draft.bTrigger || []).length}`);
            ch.appendLine(`  Objects: ${(draft.objects || []).length}, Cuttable: ${(draft.cut || []).length}`);
            try {
                const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
                const romPath = romReaders.resolveRomPath(_ws, '');
                if (!romPath) throw new Error(missingRomText('evermore'));
                ch.appendLine(`  Using vanilla ROM: ${romPath}`);
                const romBuf = romReaders.loadRomBuffer(_ws, '');
                if (!romBuf) throw new Error('Failed to load ROM buffer from ' + romPath);
                ch.appendLine('  Building custom room 0x15 blob and patching intro jump...');
                const { rom, report } = buildExportRom(romBuf, draft);
                ch.appendLine(`  Compiled successfully: ${report.blobBytes} bytes at $${report.blobAddress.toString(16).toUpperCase()}`);
                ch.appendLine(`  Metatiles: ${report.metatileCount}, animated channels: ${report.animated}`);

                const stem = String(mapName).replace(/[^\w.-]+/g, '_');
                const target = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(path.join(path.dirname(romPath), stem + '.sfc')),
                    filters: { 'SNES ROM': ['sfc', 'smc'] },
                    saveLabel: 'Export ROM',
                });
                if (!target) {
                    ch.appendLine('  Export cancelled by user.');
                    ctx.post({ ...reply, cancelled: true });
                    return;
                }
                if (path.resolve(target.fsPath) === path.resolve(romPath)) {
                    throw new Error('refusing to overwrite the vanilla ROM the export is built from');
                }
                fs.writeFileSync(target.fsPath, rom);
                ch.appendLine(`  [SUCCESS] ROM saved to: ${target.fsPath}`);
                ctx.post({ ...reply, path: target.fsPath, report });
                const pick = await vscode.window.showInformationMessage(
                    `Exported ${report.widthTiles}×${report.heightTiles} map into Brian's room (0x15) — `
                    + `${report.blobBytes} bytes at $${report.blobAddress.toString(16).toUpperCase()}. `
                    + (report.animated ? `${report.animated} animated tile${report.animated === 1 ? '' : 's'}. ` : '')
                    + (report.stillAnimated ? `${report.stillAnimated} more stay still (42 animations is the most a vanilla room runs). ` : '')
                    + 'The game starts in it.', 'Reveal');
                if (pick === 'Reveal') vscode.commands.executeCommand('revealFileInOS', target);
            } catch (err) {
                const error = String(err && err.message || err);
                ch.appendLine(`  [ERROR] ROM export failed: ${error}`);
                ctx.post({ ...reply, error });
                vscode.window.showErrorMessage('ROM export failed: ' + error);
            }
        })();
    },
    requestDraftCollision(msg, ctx) {
        // A drafted map's collision, drawn like a ROM room's —
        // a custom map has no ROM render to carry it.
        const reply = { command: 'draftCollision', key: msg.key };
        try {
            const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const romBuf = romReaders.loadRomBuffer(_ws, '');
            if (!romBuf) throw new Error(missingRomText('evermore'));
            ctx.post({ ...reply, ...buildDraftCollision(romBuf, msg.draft || {}) });
        } catch (err) {
            ctx.post({ ...reply, error: String(err && err.message || err) });
        }
    },
    mapPlayRom(msg, ctx) {
        // Export ROM without the file: the same ROM, straight into
        // the embedded emulator, the way a build's output is loaded.
        const reply = { command: 'mapExportRomDone' };
        const ch = ctx.exportChannel();
        ch.show(true);
        const draft = msg.draft || {};
        const mapName = msg.name || 'custom map';
        const timeStr = new Date().toLocaleTimeString();
        ch.appendLine(`[${timeStr}] [Play in Emulator] Starting compilation of "${mapName}"...`);
        ch.appendLine(`  Dimensions: ${draft.widthTiles || '?'}x${draft.heightTiles || '?'} tiles`);
        ch.appendLine(`  Triggers: stepOn: ${(draft.stepOn || []).length}, bTrigger: ${(draft.bTrigger || []).length}`);
        ch.appendLine(`  Objects: ${(draft.objects || []).length}, Cuttable: ${(draft.cut || []).length}`);
        try {
            const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const romPath = romReaders.resolveRomPath(_ws, '');
            if (!romPath) throw new Error(missingRomText('evermore'));
            ch.appendLine(`  Using vanilla ROM: ${romPath}`);
            const romBuf = romReaders.loadRomBuffer(_ws, '');
            if (!romBuf) throw new Error('Failed to load ROM buffer from ' + romPath);
            ch.appendLine('  Building custom room 0x15 blob and patching intro jump...');
            const { rom, report } = buildExportRom(romBuf, draft);
            ch.appendLine(`  Compiled successfully: ${report.blobBytes} bytes at $${report.blobAddress.toString(16).toUpperCase()}`);
            ch.appendLine(`  Metatiles: ${report.metatileCount}, animated channels: ${report.animated}`);

            // Stage temporary ROM file
            const stem = String(mapName).replace(/[^\w.-]+/g, '_');
            let tempDir = ctx.context.globalStorageUri ? ctx.context.globalStorageUri.fsPath : os.tmpdir();
            try {
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            } catch (_) {
                tempDir = os.tmpdir();
            }
            const tempPath = path.join(tempDir, stem + '_emulator.sfc');
            fs.writeFileSync(tempPath, rom);
            ch.appendLine(`  Staged temporary ROM: ${tempPath}`);

            const name = stem + '.sfc';
            const dataUrl = 'data:application/octet-stream;base64,' + Buffer.from(rom).toString('base64');
            ch.appendLine('  Launching emulator panel...');
            ctx.openEmulator( { dataUrl, name, romBuffer: rom, draft, filePath: tempPath, kind: 'editor' });
            ch.appendLine(`  [SUCCESS] Emulator launched with "${name}". Room 0x15 enter script will execute.`);
            ctx.post({ ...reply, played: name, tempPath, report });
        } catch (err) {
            const error = String(err && err.message || err);
            ch.appendLine(`  [ERROR] Play in emulator failed: ${error}`);
            ctx.post({ ...reply, error });
            vscode.window.showErrorMessage('Play in emulator failed: ' + error);
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
            if (src.error) {
                ctx.post({ ...reply, error: src.error });
                return;
            }
            const preview = buildComposedPreview(src.romBuf, src.roomId,
                Array.isArray(msg.drafts) ? msg.drafts : [], msg.layer, msg.extra);
            ctx.post({ ...reply, preview });
        } catch (err) {
            ctx.post({ ...reply, error: String(err && err.message || err) });
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
            if (src.error) {
                ctx.post({ ...reply, error: src.error });
                return;
            }
            ctx.post({ ...reply, room: buildBlankRoom(src.romBuf, {
                widthTiles: msg.widthTiles, heightTiles: msg.heightTiles, borrowFrom: src.roomId,
                minTiles: msg.minTiles,
            }) });
        } catch (err) {
            ctx.post({ ...reply, error: String(err && err.message || err) });
        }
    },
    requestFamilySheet(msg, ctx) {
        // Every graphic vanilla has drawn in one tile family, so
        // the family picker can show what a slot would buy.
        const reply = { command: 'familySheet', family: Number(msg.family) };
        try {
            const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const romBuf = romReaders.loadRomBuffer(_ws, '');
            if (!romBuf) {
                ctx.post({ ...reply, error: missingRomText('evermore') });
                return;
            }
            // A converted family lives in its room's image (src/games/evermore/imports/mana).
            const conv = ctx.manaRooms && ctx.manaRooms.resolveFamily(msg.family);
            ctx.post({ ...reply,
                sheet: conv ? buildFamilySheet(conv.rom, msg.family, conv.roomId)
                    : buildFamilySheet(romBuf, msg.family, msg.borrowFrom) });
        } catch (err) {
            ctx.post({ ...reply, error: String(err && err.message || err) });
        }
    },
    requestFamilyCatalogue(msg, ctx) {
        // Every family the ROM attests, so the picker can offer
        // more than the seven this room happens to load.
        const reply = { command: 'familyCatalogue' };
        try {
            const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const romBuf = romReaders.loadRomBuffer(_ws, '');
            if (!romBuf) {
                ctx.post({ ...reply, error: missingRomText('evermore') });
                return;
            }
            ctx.post({ ...reply, families: buildFamilyCatalogue(romBuf) });
        } catch (err) {
            ctx.post({ ...reply, error: String(err && err.message || err) });
        }
    },
    requestFamilyPreviews(msg, ctx) {
        // A strip of art per family, several families to one PNG,
        // so the picker can show what a slot would buy.
        const reply = { command: 'familyPreviews' };
        try {
            const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const romBuf = romReaders.loadRomBuffer(_ws, '');
            if (!romBuf) {
                ctx.post({ ...reply, error: missingRomText('evermore') });
                return;
            }
            ctx.post({ ...reply,
                previews: buildFamilyPreviews(romBuf, msg.families, msg.tiles),
                chips: !!msg.tiles });
        } catch (err) {
            ctx.post({ ...reply, error: String(err && err.message || err) });
        }
    },
    requestRelated(msg, ctx) {
        // What vanilla draws beside the tiles already in play.
        // One small reply the editor turns into a lookup, rather
        // than re-fetching every family sheet when the selection
        // moves. See docs/map-format/map-editor-window.md §2.
        const reply = { command: 'relatedTiles' };
        try {
            const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const romBuf = romReaders.loadRomBuffer(_ws, '');
            if (!romBuf) {
                ctx.post({ ...reply, error: missingRomText('evermore') });
                return;
            }
            ctx.post({ ...reply,
                seed: msg.graphics || [], related: relatedTiles(romBuf, msg.graphics) });
        } catch (err) {
            ctx.post({ ...reply, error: String(err && err.message || err) });
        }
    },
    requestNeighbours(msg, ctx) {
        // What vanilla draws on each side of the armed brush — the
        // LIKELY NEIGHBORS plus-shape. Its own seed, never mixed
        // into requestRelated's (plan doc §8a.1, §8b).
        const reply = { command: 'neighbourTiles' };
        try {
            const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const romBuf = romReaders.loadRomBuffer(_ws, '');
            if (!romBuf) {
                ctx.post({ ...reply, graphic: msg.graphic, error: missingRomText('evermore') });
                return;
            }
            ctx.post({ ...reply, ...neighbourTiles(romBuf, msg.graphic) });
        } catch (err) {
            ctx.post({ ...reply, graphic: msg.graphic, error: String(err && err.message || err) });
        }
    },
    requestVanillaExamples(msg, ctx) {
        const reply = { command: 'vanillaExamples' };
        try {
            const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const romBuf = romReaders.loadRomBuffer(_ws, '');
            if (!romBuf) {
                ctx.post({ ...reply, graphic: msg.graphic, error: missingRomText('evermore') });
                return;
            }
            ctx.post({ ...reply, graphic: msg.graphic, examples: vanillaExamples(romBuf, msg.graphic) });
        } catch (err) {
            ctx.post({ ...reply, graphic: msg.graphic, error: String(err && err.message || err) });
        }
    },
    requestProceduralFill(msg, ctx) {
        const reply = { command: 'proceduralFill' };
        try {
            const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const romBuf = romReaders.loadRomBuffer(_ws, '');
            if (!romBuf) {
                ctx.post({ ...reply, graphic: msg.graphic, error: missingRomText('evermore') });
                return;
            }
            const patch = proceduralFill(romBuf, msg.graphic, msg.layer, msg.width, msg.height, msg.seed);
            ctx.post({ ...reply, graphic: msg.graphic, layer: msg.layer, width: msg.width, height: msg.height, patch });
        } catch (err) {
            ctx.post({ ...reply, graphic: msg.graphic, error: String(err && err.message || err) });
        }
    },
    requestDeco(msg, ctx) {
        // The deco library: every distinct object vanilla places,
        // which is where gourds, pots and fire pits already live.
        const reply = { command: 'decoLibrary' };
        try {
            const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const romBuf = romReaders.loadRomBuffer(_ws, '');
            if (!romBuf) {
                ctx.post({ ...reply, error: missingRomText('evermore') });
                return;
            }
            if (msg.ghost) {
                // What an armed widget would stamp, at 1:1 (map-editor-preview.js).
                ctx.post({
                    command: 'decoGhost', key: msg.ghost.key, ghost: buildConstructGhost(romBuf, msg.ghost) });
            } else if (msg.cells !== undefined) {
                ctx.post({
                    command: 'decoCells', entry: decoCells(romBuf, msg.cells) });
            } else if (Array.isArray(msg.previews)) {
                ctx.post({
                    command: 'decoPreviews', previews: buildDecoPreviews(romBuf, msg.previews) });
            } else if (Array.isArray(msg.widgets)) {
                // Thumbnails for the user's own widgets (map-editor-widgets.js).
                ctx.post({
                    command: 'decoPreviews', mine: true, previews: buildWidgetPreviews(romBuf, msg.widgets) });
            } else {
                ctx.post({ ...reply, deco: decoIndex(romBuf) });
            }
        } catch (err) {
            ctx.post({ ...reply, error: String(err && err.message || err) });
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
            vscode.window.showErrorMessage(`Everscript: export failed — ${err && err.message || err}`);
        });
    },
};

function handlesEditorMessage(command) {
    return Object.prototype.hasOwnProperty.call(HANDLERS, command);
}

function handleEditorMessage(msg, ctx) {
    return HANDLERS[msg.command](msg, ctx);
}

module.exports = { handlesEditorMessage, handleEditorMessage };
