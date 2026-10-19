// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Ownership: the map editor's draft messages that build a ROM — the draft handed over as JSON, its
// collision, Export ROM and Play ROM. editor-host.js dispatches; `ctx` is described there.

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const os = require('os');
const romReaders = require('../../../../dist/games/evermore/rom-readers');
const { buildDraftCollision, buildExportRom } = require('./index');
const { missingRomText } = require('../../../../dist/platform/roms/library');

const ROM_HANDLERS = {
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
};

module.exports = { ROM_HANDLERS };
