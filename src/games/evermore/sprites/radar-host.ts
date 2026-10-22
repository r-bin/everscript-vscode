// Ownership: the host side of the radar's Characters tab — animations, palette grids, list
// thumbnails, raw sprites, drawn from the ROM. The radar routes these messages here with `ctx`:
//   post(message)            to the radar webview
//   spritesBundle(romBuf)    the cached characters / raw sprite index (games/evermore/extension.js)

import * as vscode from 'vscode';
import * as romReaders from '../rom-readers';
import { renderAnimation, renderRawSprite, listPalettes, renderInPalettes, thumbFor } from '.';
import { missingRomText } from '../../../platform/roms/library';

/** The radar's request and what it gives the handlers. */
interface Message { characterId: number; animOpt: Parameters<typeof renderAnimation>[2]; facing: number; sprite: number; target?: string; items?: { key: string }[]; address: number; paletteAddr?: number; uri?: string; command: string }
interface Context { post(message: object): void; spritesBundle(rom: Buffer | null): { characters: Parameters<typeof listPalettes>[0] } }
const errText = (err: unknown): string => String(err instanceof Error ? err.message : err);

const HANDLERS: Record<string, (msg: Message, ctx: Context) => void> = {
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
            ctx.post({ command: 'spriteAnimationData', animation: null, error: errText(err) });
        }
    },
    getPaletteGrid(msg: Message, ctx: Context) {
        try {
            const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const romBuf = romReaders.loadRomBuffer(_ws, '');
            const bundle = ctx.spritesBundle(romBuf);
            const grid = romBuf ? renderInPalettes(romBuf, msg.sprite, listPalettes(bundle.characters)) : [];
            ctx.post({ command: 'paletteGridData', sprite: msg.sprite, grid, target: msg.target || 'char' });
        } catch (err) {
            ctx.post({ command: 'paletteGridData', sprite: msg.sprite, grid: [], error: errText(err) });
        }
    },
    getThumbs(msg: Message, ctx: Context) {
        // Lazy list thumbnails: the webview asks only for rows scrolled into view.
        try {
            const _ws  = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
            const romBuf = romReaders.loadRomBuffer(_ws, '');
            const thumbs: Record<string, unknown> = {};
            if (romBuf) for (const item of (msg.items || []).slice(0, 200)) thumbs[item.key] = thumbFor(romBuf, item as Parameters<typeof thumbFor>[1]);
            ctx.post({ command: 'thumbsData', thumbs });
        } catch (err) {
            ctx.post({ command: 'thumbsData', thumbs: {}, error: errText(err) });
        }
    },
    getRawSprite(msg: Message, ctx: Context) {
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
            ctx.post({ command: 'rawSpriteData', sprite: null, error: errText(err) });
        }
    },
    openVfs(msg) {
        if (msg.uri) {
            try {
                vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(msg.uri));
            } catch (_) {}
        }
    },
};

function handlesSpritesMessage(command: string): boolean {
    return Object.prototype.hasOwnProperty.call(HANDLERS, command);
}

function handleSpritesMessage(msg: Message, ctx: Context) {
    HANDLERS[msg.command](msg, ctx);
}

export { handlesSpritesMessage, handleSpritesMessage };
