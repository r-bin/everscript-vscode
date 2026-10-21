// Ownership: entry point of games/terra/resources: registers the read-only `terra://` file system.
// Which ROM file is injected by extension.ts (the ROM library), so this domain reads no config itself.

import * as vscode from 'vscode';
import { RomFileSystem } from '../../../core/resources/rom-file-system';
import { missingRomText } from '../../../platform/roms/library';
import { resolveTerra } from './files';
import { readTerraRom } from './rom-source';

const SCHEME = 'terra';

export function registerTerraResources(context: vscode.ExtensionContext, where: () => { path?: string | null }): { refresh: () => void } {
    const provider = new RomFileSystem({
        scheme: SCHEME, getRom: () => readTerraRom(where().path), resolve: resolveTerra, missing: missingRomText('terra'),
    });
    context.subscriptions.push(provider, vscode.workspace.registerFileSystemProvider(SCHEME, provider, { isReadonly: true, isCaseSensitive: true }));
    return { refresh: () => provider.refresh() };
}

