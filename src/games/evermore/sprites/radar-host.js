'use strict';
// Ownership: the host side of the radar's Characters tab — animations, palette grids, list
// thumbnails, raw sprites, drawn from the ROM. The radar routes these messages here with `ctx`:
//   post(message)            to the radar webview
//   spritesBundle(romBuf)    the cached characters / raw sprite index (games/evermore/extension.js)

const vscode = require('vscode');
const romReaders = require('../rom-readers');
const { renderAnimation, renderRawSprite, listPalettes, renderInPalettes, thumbFor } = require('./index');
const { missingRomText } = require('../../../../dist/platform/roms/library');

const HANDLERS = {
    getSpriteAnimation(msg, ctx) {
        try {
            const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const romBuf = romReaders.loadRomBuffer(_ws, '');
            if (!romBuf) {
                ctx.post({ command: 'spriteAnimationData', animation: null, error: missingRomText('evermore') });
                return;
            }
            const anim = renderAnimation(romBuf, msg.characterId, msg.animOpt, msg.facing);
            ctx.post({ command: 'spriteAnimationData', animation: anim });
        } catch (err) {
            ctx.post({ command: 'spriteAnimationData', animation: null, error: String(err && err.message || err) });
        }
    },
    getPaletteGrid(msg, ctx) {
        try {
            const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const romBuf = romReaders.loadRomBuffer(_ws, '');
            const bundle = ctx.spritesBundle(romBuf);
            const grid = romBuf ? renderInPalettes(romBuf, msg.sprite, listPalettes(bundle.characters)) : [];
            ctx.post({ command: 'paletteGridData', sprite: msg.sprite, grid, target: msg.target || 'char' });
        } catch (err) {
            ctx.post({ command: 'paletteGridData', sprite: msg.sprite, grid: [], error: String(err && err.message || err) });
        }
    },
    getThumbs(msg, ctx) {
        // Lazy list thumbnails: the webview asks only for rows scrolled into view.
        try {
            const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const romBuf = romReaders.loadRomBuffer(_ws, '');
            const thumbs = {};
            if (romBuf) for (const item of (msg.items || []).slice(0, 200)) thumbs[item.key] = thumbFor(romBuf, item);
            ctx.post({ command: 'thumbsData', thumbs });
        } catch (err) {
            ctx.post({ command: 'thumbsData', thumbs: {}, error: String(err && err.message || err) });
        }
    },
    getRawSprite(msg, ctx) {
        try {
            const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const romBuf = romReaders.loadRomBuffer(_ws, '');
            if (!romBuf) {
                ctx.post({ command: 'rawSpriteData', sprite: null, error: missingRomText('evermore') });
                return;
            }
            const sprite = renderRawSprite(romBuf, msg.address, msg.paletteAddr);
            ctx.post({ command: 'rawSpriteData', sprite });
        } catch (err) {
            ctx.post({ command: 'rawSpriteData', sprite: null, error: String(err && err.message || err) });
        }
    },
};

function handlesSpritesMessage(command) {
    return Object.prototype.hasOwnProperty.call(HANDLERS, command);
}

function handleSpritesMessage(msg, ctx) {
    return HANDLERS[msg.command](msg, ctx);
}

module.exports = { handlesSpritesMessage, handleSpritesMessage };
