'use strict';
// Ownership: Everscript: Export Room Maps as PNG — every decoded room (or one) written as PNG files,
// the in-editor equivalent of a batch render. `getExtConfig` is injected by extension.js.

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const romReaders = require('../rom-readers');
const { missingRomText } = require('../../../../dist/platform/roms/library');

/**
 * Export decoded room maps as PNG files.
 *
 * The in-repo equivalent of `tools/render_map.py --all-rooms -o out/maps`,
 * so the PNGs are reachable without leaving VS Code or setting up Python.
 */
async function exportRoomMaps(getExtConfig) {
    const maps = require('../../../../dist/games/evermore/maps');
    const cfg  = getExtConfig();
    const ws   = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    const rom  = romReaders.loadRomBuffer(ws, '');
    if (!rom) {
        vscode.window.showErrorMessage('Everscript: ' + missingRomText('evermore'));
        return;
    }

    const scopePick = await vscode.window.showQuickPick(
        [
            { label: 'This room only', detail: 'Pick a single room id', all: false },
            { label: 'All rooms', detail: 'Export every vanilla room (0x00–0x7E)', all: true },
        ],
        { placeHolder: 'Export room maps as PNG' },
    );
    if (!scopePick) return;

    const layerPick = await vscode.window.showQuickPick(
        ['composite', 'layer2', 'layer1'],
        { placeHolder: 'Which layer? (composite = as the SNES displays it)' },
    );
    if (!layerPick) return;

    let roomIds = [];
    if (scopePick.all) {
        roomIds = Array.from({ length: maps.MAX_ROOMS }, (_, i) => i);
    } else {
        const raw = await vscode.window.showInputBox({
            prompt: 'Room id (hex, e.g. 0x38)',
            value: '0x38',
            validateInput: (v) => {
                const n = parseInt(String(v).replace(/^0x/i, ''), 16);
                return Number.isInteger(n) && n >= 0 && n <= 0x7e ? null : 'Expected a hex room id in 0x00–0x7E';
            },
        });
        if (!raw) return;
        roomIds = [parseInt(String(raw).replace(/^0x/i, ''), 16)];
    }

    const target = await vscode.window.showOpenDialog({
        canSelectFolders: true, canSelectFiles: false, canSelectMany: false,
        openLabel: 'Export here',
        defaultUri: ws ? vscode.Uri.file(path.join(ws, 'out')) : undefined,
    });
    if (!target || !target.length) return;
    const outDir = target[0].fsPath;

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Exporting room maps', cancellable: true },
        async (progress, token) => {
            let written = 0;
            const failures = [];
            for (let i = 0; i < roomIds.length; i++) {
                if (token.isCancellationRequested) break;
                const id = roomIds[i];
                progress.report({
                    message: `0x${id.toString(16).padStart(2, '0')} (${i + 1}/${roomIds.length})`,
                    increment: 100 / roomIds.length,
                });
                try {
                    const room  = maps.decodeRoom(rom, id);
                    const image = layerPick === 'composite'
                        ? maps.renderRoomComposite(rom, room)
                        : maps.renderVramLayer(rom, room, layerPick === 'layer1' ? room.layer1VramWords : room.layer2VramWords);
                    const file = path.join(outDir, `room_0x${id.toString(16).padStart(2, '0')}_${layerPick}.png`);
                    fs.writeFileSync(file, maps.encodePng(image));
                    written += 1;
                } catch (err) {
                    failures.push(`0x${id.toString(16)}: ${err && err.message || err}`);
                }
                // Yield so the progress notification can paint.
                await new Promise((r) => setImmediate(r));
            }

            if (failures.length) {
                console.warn('[Everscript] Map export failures:\n  ' + failures.join('\n  '));
                vscode.window.showWarningMessage(
                    `Exported ${written} map(s); ${failures.length} failed (first: ${failures[0]}).`);
            } else {
                vscode.window.showInformationMessage(`Exported ${written} map(s) to ${outDir}`);
            }
        },
    );
}

module.exports = { exportRoomMaps };
