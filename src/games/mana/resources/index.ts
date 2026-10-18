// Ownership: entry point of games/mana/resources: registers the read-only
// `som://` file system for Secret of Mana. Which ROM file is injected by
// extension.js (the ROM library), so this domain reads no config itself.

import * as vscode from 'vscode';
import { SomFileSystem } from './fs-provider';
import { findManaRom } from './rom-source';

const SCHEME = 'som';

/**
 * @param {vscode.ExtensionContext} context
 * @param {() => { path?: string | null }} where
 * @returns {{ manaRom: () => { path: string, rom: Uint8Array } | null, refresh: () => void }}
 */
function registerManaResources(context: vscode.ExtensionContext, where: () => { path?: string | null; }): { manaRom: () => { path: string; rom: Uint8Array; } | null; refresh: () => void; } {
    const manaRom = () => findManaRom(where());
    const provider = new SomFileSystem(() => { const r = manaRom(); return r && r.rom; });
    context.subscriptions.push(
        provider,
        vscode.workspace.registerFileSystemProvider(SCHEME, provider, { isReadonly: true, isCaseSensitive: true }),
    );
    return { manaRom, refresh: () => provider.refresh() };
}

export { registerManaResources, SCHEME };
