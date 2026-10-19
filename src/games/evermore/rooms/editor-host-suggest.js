// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Ownership: the map editor's suggestion messages — tile families (sheet, catalogue, previews),
// related and neighbouring tiles, vanilla examples, procedural fill, decorations. editor-host.js
// dispatches; `ctx` is described there.

const vscode = require('vscode');
const romReaders = require('../../../../dist/games/evermore/rom-readers');
const { buildFamilySheet, buildFamilyCatalogue, buildFamilyPreviews, decoIndex, decoCells, buildDecoPreviews, buildWidgetPreviews, buildConstructGhost, relatedTiles, neighbourTiles, vanillaExamples, proceduralFill } = require('./index');
const { missingRomText } = require('../../../../dist/platform/roms/library');

const SUGGEST_HANDLERS = {
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
};

module.exports = { SUGGEST_HANDLERS };
