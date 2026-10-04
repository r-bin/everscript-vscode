'use strict';

/**
 * debugger/emulator/script-trace.js
 *
 * Real-time Everscript bytecode execution logging and disassembly.
 * Decodes bytecode to human-readable form (matching map editor trigger snippets)
 * and logs to the "Everscript Script Trace" output channel and webview UI.
 *
 * All string output in this file is strictly ASCII-only.
 */

let vscode = null;
try {
  vscode = require('vscode');
} catch (_) {
  // Headless test environment
}

const path   = require('path');
const fs     = require('fs');
const { decodeInstruction, OperandStack } = require('../script');

const ROM_NAMES = [
  'Secret of Evermore (U) [!].smc',
  'Secret of Evermore.smc',
  path.join('script_parser', 'dependencies', 'Secret of Evermore (U) [!].smc'),
];

let _scriptTraceChannel = null;

function ensureScriptTraceChannel() {
  if (!_scriptTraceChannel && vscode && vscode.window && typeof vscode.window.createOutputChannel === 'function') {
    _scriptTraceChannel = vscode.window.createOutputChannel('Everscript Script Trace', 'everscript-trace');
    _scriptTraceChannel.appendLine('[Everscript Script Trace] Initialized. Monitoring script slots at $7E28FC...');
  }
  return _scriptTraceChannel;
}

function loadFallbackRom(wsRoot) {
  if (!wsRoot) return null;
  for (const name of ROM_NAMES) {
    const candidate = path.isAbsolute(name) ? name : path.join(wsRoot, name);
    if (fs.existsSync(candidate)) {
      try {
        return new Uint8Array(fs.readFileSync(candidate));
      } catch (_) {
        // Continue searching
      }
    }
  }
  return null;
}

function fmtHex(val, width) {
  return (val >>> 0).toString(16).toUpperCase().padStart(width, '0');
}

/**
 * Validates whether an address represents a plausible SoE ROM script address.
 * Rejects cold-RAM fill pattern (0x555555), 0, and non-ROM addresses.
 */
function isValidScriptAddr(loc) {
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
function decodeScriptSnippet(rom, snesAddr, maxLines = 2) {
  if (!rom || !snesAddr || snesAddr <= 0) return null;
  const stack = new OperandStack();
  const lines = [];
  let cur = snesAddr >>> 0;

  for (let i = 0; i < maxLines; i++) {
    let ins = null;
    try {
      ins = decodeInstruction(rom, cur, stack);
    } catch (_) {
      ins = null;
    }
    if (!ins || ins.size <= 0) break;

    const romOffset = (cur & ~0xc00000) >>> 0;
    let bytesHex = '';
    if (romOffset + ins.size <= rom.length) {
      bytesHex = Array.from(rom.slice(romOffset, romOffset + ins.size))
        .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
        .join(' ');
    }

    lines.push({
      addr: cur,
      addrHex: '0x' + fmtHex(cur, 6),
      bytesHex,
      summary: ins.summary || ('op 0x' + fmtHex(ins.opcode, 2)),
      terminal: !!ins.terminal,
      opcode: ins.opcode,
      size: ins.size,
    });

    cur += ins.size;
    if (ins.terminal) break;
  }

  return lines.length ? lines : null;
}

/**
 * Processes a batch of execution trace events reported by the webview.
 * @param {Array} items Array of { slot, entity, event, loc, bytes, state, timer, timestamp, timeStr, frame }
 * @param {Uint8Array|null} currentRom Active ROM buffer or null
 * @param {string|null} wsRoot Workspace root folder path
 * @returns {Array} Formatted trace entries for the webview UI
 */
function processScriptTraceBatch(items, currentRom, wsRoot) {
  if (!Array.isArray(items) || !items.length) return [];
  const ch = ensureScriptTraceChannel();

  let rom = currentRom;
  if (!rom && wsRoot) {
    rom = loadFallbackRom(wsRoot);
  }

  const formatted = [];

  for (const item of items) {
    let loc = (item.loc || 0) >>> 0;
    if (!isValidScriptAddr(loc)) continue;

    // Detect if this is room 0x15's enter script start which completed within frame 1:
    // If reported address is 0xBC8000..0xBC8008, normalize to entry point 0xBC8000
    if (item.event === 'start' && loc >= 0xBC8000 && loc <= 0xBC8008) {
      loc = 0xBC8000;
    }

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

    const snippet = decodeScriptSnippet(romBuf, loc, item.event === 'start' ? 3 : 1);
    const first = snippet && snippet[0];

    const locHex = '0x' + fmtHex(loc, 6);
    const entityHex = fmtHex(item.entity || 0, 4);
    const eventName = String(item.event || 'exec');

    let bytesHex = first && first.bytesHex ? first.bytesHex : '';
    if (!bytesHex && item.bytes && item.bytes.length) {
      bytesHex = item.bytes.slice(0, 4)
        .map(b => (b & 0xFF).toString(16).toUpperCase().padStart(2, '0'))
        .join(' ');
    }
    if (!bytesHex) bytesHex = '??';

    let summary = first ? first.summary : '';
    if (!summary) {
      summary = item.event === 'end' ? 'END of script' : 'UNKNOWN INSTR';
    }

    const timePrefix = item.timeStr ? `[${item.timeStr}] ` : '';
    const tag = `${timePrefix}[Slot ${item.slot} | Ent ${entityHex} | ${eventName}]`;
    const line = `${tag} ${locHex}: ${bytesHex}  ${summary}`;
    if (ch) ch.appendLine(line);

    const subLines = [];
    if (snippet && snippet.length > 1) {
      for (let s = 1; s < snippet.length; s++) {
        const sub = snippet[s];
        const subLine = `   -> ${sub.addrHex}: ${sub.bytesHex}  ${sub.summary}`;
        if (ch) ch.appendLine(subLine);
        subLines.push(subLine);
      }
    }

    formatted.push({
      slot: item.slot,
      entity: entityHex,
      event: eventName,
      locHex,
      bytesHex,
      summary,
      subLines,
      line,
      timeStr: item.timeStr || '',
      frame: typeof item.frame === 'number' ? item.frame : null,
    });
  }

  return formatted;
}

module.exports = {
  ensureScriptTraceChannel,
  loadFallbackRom,
  decodeScriptSnippet,
  processScriptTraceBatch,
  isValidScriptAddr,
};
