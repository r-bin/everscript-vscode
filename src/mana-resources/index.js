'use strict';
// Ownership: entry point of the mana-resources domain: registers the read-only
// `som://` file system for Secret of Mana. Where to look for the ROM is injected
// by extension.js (settings and workspace), so this domain reads no config itself.

const vscode = require('vscode');
const { SomFileSystem } = require('./fs-provider');
const { findManaRom } = require('./rom-source');

const SCHEME = 'som';

/**
 * @param {vscode.ExtensionContext} context
 * @param {() => { manaRomPath?: string, romPath?: string, wsRoot?: string | null }} where
 * @returns {{ manaRom: () => { path: string, rom: Uint8Array } | null, refresh: () => void }}
 */
function registerManaResources(context, where) {
    const manaRom = () => findManaRom(where());
    const provider = new SomFileSystem(() => { const r = manaRom(); return r && r.rom; });
    context.subscriptions.push(
        provider,
        vscode.workspace.registerFileSystemProvider(SCHEME, provider, { isReadonly: true, isCaseSensitive: true }),
    );
    return { manaRom, refresh: () => provider.refresh() };
}

module.exports = { registerManaResources, SCHEME };
