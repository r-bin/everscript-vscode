/**
 * debugger/emulator/script-trace.js
 *
 * Real-time Everscript bytecode execution logging and disassembly.
 * Decodes bytecode to human-readable form (matching map editor trigger snippets)
 * and logs to the "Everscript Script Trace" output channel and webview UI.
 *
 * All string output in this file is strictly ASCII-only.
 */

import type * as VsCode from 'vscode';

// vscode is absent in the headless tests.
let vscode: typeof VsCode | null = null;
try {
  vscode = require('vscode');
} catch (_) {
  // Headless test environment
}

import * as vm from '../script-vm';
import { printNames } from '../script-model';
import { getActiveAddressLookup } from './address-lookup';
import { ScriptTraceFormatter } from './trace-formatter';
import { hex as fmtHex, hiromFileOffset } from '../../../platform';

let _scriptTraceChannel: VsCode.OutputChannel | null = null;

function ensureScriptTraceChannel() {
  if (!_scriptTraceChannel && vscode && vscode.window && typeof vscode.window.createOutputChannel === 'function') {
    _scriptTraceChannel = vscode.window.createOutputChannel('Everscript Script Trace', 'everscript-trace');
    _scriptTraceChannel.appendLine('[Everscript Script Trace] Initialized. Monitoring script slots at $7E28FC...');
  }
  return _scriptTraceChannel;
}

/** The Evermore ROM of the ROM library (docs/architecture/multi-game.md, section 5), when the emulator has none. */
function loadFallbackRom(_wsRoot: string | null): Uint8Array | null {
  const rom = require('../rom-readers').loadRomBuffer(null);
  return rom ? new Uint8Array(rom) : null;
}

/** One decoded instruction of a snippet. */
interface SnippetLine { addr: number; addrHex: string; bytesHex: string; summary: string; terminal: boolean; opcode: number; callKind?: string; size: number }
/** One execution event the page reports. */
interface TraceItem { slot?: number; entity?: number; event?: string; loc?: number; bytes?: number[]; state?: number; timer?: number; timestamp?: number; timeStr?: string; frame?: number; triggerKind?: string; triggerIndex?: number }

const NAMES = printNames(hiromFileOffset);
const _scriptRoms = new WeakMap();
/** script-vm's view of `rom`, or null for a ROM it does not know (non-US layouts). */
function scriptRom(rom: Uint8Array) {
  if (!_scriptRoms.has(rom)) {
    let sr: vm.ScriptRom | null = null;
    try { sr = new vm.ScriptRom(rom); } catch (_) { sr = null; }
    _scriptRoms.set(rom, sr);
  }
  return _scriptRoms.get(rom);
}

/**
 * Validates whether an address represents a plausible SoE ROM script address.
 * Rejects cold-RAM fill pattern (0x555555), 0, and non-ROM addresses.
 */
function isValidScriptAddr(loc: unknown): boolean {
  if (typeof loc !== 'number' || isNaN(loc)) return false;
  const raw = loc >>> 0;
  if (raw === 0 || raw === 0x555555 || raw === 0xFFFFFF) return false;
  const bank = (raw >>> 16) & 0xFF;
  const addr = raw & 0xFFFF;
  if (bank < 0x80 || addr < 0x8000) return false;
  return true;
}

/**
 * Disassembles up to maxLines instructions starting from snesAddr.
 * Returns an array of instruction descriptor objects.
 */
function decodeScriptSnippet(rom: Uint8Array | null, snesAddr: number, maxLines = 2) {
  if (!rom || !snesAddr || snesAddr <= 0) return null;
  const sr = scriptRom(rom);
  const lines: SnippetLine[] = [];
  let cur = snesAddr >>> 0;

  for (let i = 0; i < maxLines; i++) {
    let ins: vm.Instruction | null = null;
    try {
      ins = sr && sr.contains(cur) ? vm.decodeAt(sr, cur) : null;
    } catch (_) {
      ins = null;
    }
    if (!ins || ins.size <= 0) break;
    const terminal = ins.flow === 'end' || ins.flow === 'reset';

    const romOffset = (cur & ~0xc00000) >>> 0;
    let bytesHex = '';
    if (romOffset + ins.size <= rom.length) {
      bytesHex = Array.from(rom.slice(romOffset, romOffset + ins.size))
        .map((b: number) => b.toString(16).toUpperCase().padStart(2, '0'))
        .join(' ');
    }

    let callKind: string | undefined;
    if (ins.opcode === 0xa3) {
      callKind = '8bit';
    } else if (ins.opcode === 0xa4) {
      callKind = '16bit';
    } else if (ins.opcode === 0x29) {
      callKind = '24bit';
    }

    lines.push({
      addr: cur,
      addrHex: '0x' + fmtHex(cur, 6),
      bytesHex,
      summary: vm.text(ins, NAMES),
      terminal,
      opcode: ins.opcode,
      callKind,
      size: ins.size,
    });

    cur = ins.next;
    if (terminal) break;
  }

  return lines.length ? lines : null;
}

/**
 * Processes a batch of execution trace events reported by the webview.
 * @param {Array} items Array of { slot, entity, event, loc, bytes, state, timer, timestamp, timeStr, frame }
 * @param {Uint8Array|null} currentRom Active ROM buffer or null
 * @param {string|null} wsRoot Workspace root folder path
 * @param {object|null} [customDraft] Custom draft containing triggers for active room
 * @returns {Array} Formatted trace entries for the webview UI
 */
function processScriptTraceBatch(items: TraceItem[], currentRom: Uint8Array | null, wsRoot: string | null, customDraft: Parameters<typeof getActiveAddressLookup>[1] = null) {
  if (!Array.isArray(items) || !items.length) return [];
  const ch = ensureScriptTraceChannel();

  let rom = currentRom;
  if (!rom && wsRoot) {
    rom = loadFallbackRom(wsRoot);
  }

  const formatter = new ScriptTraceFormatter();
  const lookupTable = getActiveAddressLookup(rom, customDraft);
  const formatted: object[] = [];

  for (const item of items) {
    let loc = (item.loc || 0) >>> 0;
    if (!isValidScriptAddr(loc)) continue;

    // Detect if this is room 0x15's enter script start which completed within frame 1:
    // If reported address is 0xBC8000..0xBC8008, normalize to entry point 0xBC8000
    if (item.event === 'start' && loc >= 0xBC8000 && loc <= 0xBC8008) {
      loc = 0xBC8000;
    }

    // Resolve human-readable ROM address information
    const lookup = lookupTable ? lookupTable.lookup(loc, undefined, item) : null;

    // Use current ROM or synthesize buffer from bytes sent from emulator bus
    let romBuf = rom;
    const romOffset = (loc & ~0xc00000) >>> 0;
    if (!romBuf || romOffset >= romBuf.length) {
      const byteLen = (item.bytes && item.bytes.length) ? item.bytes.length : 32;
      romBuf = new Uint8Array(romOffset + byteLen + 32);
      if (item.bytes && item.bytes.length) {
        romBuf.set(item.bytes, romOffset);
      }
    }

    const locHex = '0x' + fmtHex(loc, 6);
    const entityHex = fmtHex(item.entity || 0, 4);
    const eventName = String(item.event || 'exec');

    let bytesHex = '';
    let summary = '';
    const subItems: SnippetLine[] = [];
    const subLines: string[] = [];

    if (eventName === 'end') {
      summary = 'END of script';
      bytesHex = '';
    } else {
      const snippet = decodeScriptSnippet(romBuf, loc, item.event === 'start' ? 3 : 1);
      const first = snippet && snippet[0];

      bytesHex = first && first.bytesHex ? first.bytesHex : '';
      if (!bytesHex && item.bytes && item.bytes.length) {
        bytesHex = item.bytes.slice(0, 4)
          .map((b: number) => (b & 0xFF).toString(16).toUpperCase().padStart(2, '0'))
          .join(' ');
      }
      if (!bytesHex) bytesHex = '??';

      summary = first ? first.summary : 'UNKNOWN INSTR';

      if (snippet && snippet.length > 1) {
        for (let s = 1; s < snippet.length; s++) {
          subItems.push(snippet[s]);
        }
      }
    }

    const itemData = {
      slot: item.slot,
      entity: item.entity || 0,
      event: eventName,
      locHex,
      loc,
      bytesHex,
      summary,
      timeStr: item.timeStr || '',
    };

    const line = formatter.formatText(itemData, lookup);
    if (ch) ch.appendLine(line);

    if (subItems.length > 0) {
      for (const sub of subItems) {
        const subText = formatter.formatSubText(sub, itemData);
        if (ch) ch.appendLine(subText);
        subLines.push(subText);
      }
    }

    const html = formatter.formatHtml(itemData, lookup, subItems);

    formatted.push({
      slot: item.slot,
      entity: entityHex,
      event: eventName,
      locHex,
      bytesHex,
      summary,
      subLines,
      subItems,
      line,
      html,
      timeStr: item.timeStr || '',
      frame: typeof item.frame === 'number' ? item.frame : null,
      lookup: lookup ? {
        addr: lookup.addr,
        name: lookup.name,
        shortTag: lookup.shortTag,
        kind: lookup.kind,
        room: lookup.room,
        index: lookup.index,
      } : null,
    });
  }

  return formatted;
}

export { ensureScriptTraceChannel, loadFallbackRom, decodeScriptSnippet, processScriptTraceBatch, isValidScriptAddr, ScriptTraceFormatter, getActiveAddressLookup };
