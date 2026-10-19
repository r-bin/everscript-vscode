/**
 * core/emulator/emulator-log.ts
 *
 * Owns: the two output channels of the emulator panel (Everscript Build, Everscript Emulator), the
 * crash report written to the second, and the histories the status report (getStatus) hands out:
 * recent crashes (50), ROM launches (50) and formatted script trace entries (2000).
 */

import * as vscode from 'vscode';
import * as fs from 'fs';

/** A crash the page reports (panel-messages.ts): the error, where, the CPU and the script slots. */
interface CrashReport {
  message?: string; error?: string; type?: string; source?: string; line?: number; col?: number;
  frame?: number; mapId?: number; camX?: number; camY?: number; stack?: string;
  cpu?: { pc?: number; pb?: number; a?: number; x?: number; y?: number; sp?: number; db?: number; p?: number };
  scriptSlots?: { slot: number; state: string; loc?: number; entity?: number }[];
}
/** A crash as the histories keep it (soe://logs/crashes.json). */
interface CrashEntry {
  timestamp: string; error: string; type: string | null; source: string | null; rom: string;
  frame: number | null; mapId: number | null; camX: number | null; camY: number | null;
  cpu: CrashReport['cpu'] | null; stack: string | null; scriptSlots: NonNullable<CrashReport['scriptSlots']>;
}

let buildChannel: vscode.OutputChannel | null = null;     // output channel for build log
let emulatorChannel: vscode.OutputChannel | null = null;  // output channel for emulator runtime and crash log
const crashHistory: CrashEntry[] = [];  // recent crash reports (capped at 50)
const launchHistory: { timestamp?: string; name?: string; size?: number | null }[] = [];  // recent ROM launches (capped at 50)
const scriptTraceHistory: unknown[] = []; // recent formatted script trace entries (capped at 2000)

function describeFile(filePath: string): string {
  try {
    const st = fs.statSync(filePath);
    return `${filePath} (${st.size} bytes)`;
  } catch (_) {
    return `${filePath} (missing)`;
  }
}

/** The build channel the host already has (the Build and Run command's), shared. */
function setBuildChannel(channel: vscode.OutputChannel | null): void {
  buildChannel = channel;
}

function ensureBuildChannel(): vscode.OutputChannel {
  if (!buildChannel) buildChannel = vscode.window.createOutputChannel('Everscript Build');
  return buildChannel;
}

function ensureEmulatorChannel(): vscode.OutputChannel {
  if (!emulatorChannel) emulatorChannel = vscode.window.createOutputChannel('Everscript Emulator');
  return emulatorChannel;
}

function log(line: string, show?: boolean): void {
  const emuCh = ensureEmulatorChannel();
  const time = new Date().toLocaleTimeString();
  emuCh.appendLine(`[${time}] ${line}`);
  if (buildChannel && buildChannel !== emuCh) {
    buildChannel.appendLine('[Everscript] ' + line);
  }
  if (show) emuCh.show(true);
}

function logCrash(crash: CrashReport, romName?: string | null): void {
  const ch = ensureEmulatorChannel();
  const time = new Date().toISOString();
  const border = '================================================================================';
  ch.appendLine(border);
  ch.appendLine(`[EMULATOR CRASH REPORT] ${time}`);
  ch.appendLine(`Error: ${crash.message || crash.error || 'Unknown emulator error'}`);
  if (crash.type) ch.appendLine(`Type: ${crash.type}`);
  if (crash.source) ch.appendLine(`Source: ${crash.source}${crash.line ? ':' + crash.line : ''}${crash.col ? ':' + crash.col : ''}`);
  ch.appendLine(`ROM: ${romName || 'unknown'}${crash.frame !== undefined ? ` | Frame: ${crash.frame}` : ''}${crash.mapId !== undefined && crash.mapId >= 0 ? ` | Map ID: 0x${crash.mapId.toString(16).toUpperCase()} (${crash.mapId})` : ''}`);
  if (crash.camX !== undefined || crash.camY !== undefined) {
    ch.appendLine(`Camera: X=${crash.camX ?? 0}, Y=${crash.camY ?? 0}`);
  }

  if (crash.cpu) {
    const c = crash.cpu;
    const h = (v: number | undefined, len: number): string => (typeof v === 'number' ? (v >>> 0).toString(16).toUpperCase().padStart(len, '0') : '????');
    ch.appendLine('');
    ch.appendLine('SNES CPU State:');
    ch.appendLine(`  PC: $${h(c.pc, 6)} (PB: $${h(c.pb, 2)})   A: $${h(c.a, 4)}   X: $${h(c.x, 4)}   Y: $${h(c.y, 4)}`);
    ch.appendLine(`  SP: $${h(c.sp, 4)}   DB: $${h(c.db, 2)}   P: $${h(c.p, 2)}`);
  }

  if (crash.stack) {
    ch.appendLine('');
    ch.appendLine('Stack Trace:');
    ch.appendLine(crash.stack);
  }

  if (Array.isArray(crash.scriptSlots) && crash.scriptSlots.length > 0) {
    ch.appendLine('');
    ch.appendLine('Active Script Slots:');
    for (const slot of crash.scriptSlots) {
      const locHex = slot.loc !== undefined ? (slot.loc >>> 0).toString(16).toUpperCase().padStart(6, '0') : '000000';
      ch.appendLine(`  Slot ${slot.slot}: state=${slot.state} loc=$${locHex} entity=${slot.entity !== undefined ? slot.entity : '-'}`);
    }
  }

  ch.appendLine(border);
  ch.show(true);

  crashHistory.push({
    timestamp: time,
    error: crash.message || crash.error || 'Unknown emulator error',
    type: crash.type || null,
    source: crash.source ? `${crash.source}${crash.line ? ':' + crash.line : ''}${crash.col ? ':' + crash.col : ''}` : null,
    rom: romName || 'unknown',
    frame: crash.frame !== undefined ? crash.frame : null,
    mapId: crash.mapId !== undefined && crash.mapId >= 0 ? crash.mapId : null,
    camX: crash.camX ?? null,
    camY: crash.camY ?? null,
    cpu: crash.cpu ? {
      pc: crash.cpu.pc,
      pb: crash.cpu.pb,
      a: crash.cpu.a,
      x: crash.cpu.x,
      y: crash.cpu.y,
      sp: crash.cpu.sp,
      db: crash.cpu.db,
      p: crash.cpu.p,
    } : null,
    stack: crash.stack || null,
    scriptSlots: Array.isArray(crash.scriptSlots) ? crash.scriptSlots : [],
  });
  if (crashHistory.length > 50) crashHistory.shift();
}

export type { CrashReport, CrashEntry };
export { describeFile, setBuildChannel, ensureBuildChannel, ensureEmulatorChannel, log, logCrash, crashHistory, launchHistory, scriptTraceHistory };
