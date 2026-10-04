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
const { getActiveAddressLookup } = require('./address-lookup');
const { ScriptTraceFormatter } = require('./trace-formatter');

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

    let callKind = null;
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
      summary: ins.summary || ('op 0x' + fmtHex(ins.opcode, 2)),
      terminal: !!ins.terminal,
      opcode: ins.opcode,
      callKind,
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
 * @param {object|null} [customDraft] Custom draft containing triggers for active room
 * @param {object} [options] Formatter options, e.g. { hideInactive: boolean, show8BitCalls: boolean }
 * @returns {Array} Formatted trace entries for the webview UI
 */
function processScriptTraceBatch(items, currentRom, wsRoot, customDraft = null, options = {}) {
  if (!Array.isArray(items) || !items.length) return [];
  const ch = ensureScriptTraceChannel();

  let rom = currentRom;
  if (!rom && wsRoot) {
    rom = loadFallbackRom(wsRoot);
  }

  const formatter = new ScriptTraceFormatter(options);
  const lookupTable = getActiveAddressLookup(rom, customDraft);
  const formatted = [];

  for (const item of items) {
    let loc = (item.loc || 0) >>> 0;
    if (!isValidScriptAddr(loc)) continue;

    // Detect if this is room 0x15's enter script start which completed within frame 1:
    // If reported address is 0xBC8000..0xBC8008, normalize to entry point 0xBC8000
    if (item.event === 'start' && loc >= 0xBC8000 && loc <= 0xBC8008) {
      loc = 0xBC8000;
    }

    // Resolve human-readable ROM address information
    const lookup = lookupTable ? lookupTable.lookup(loc) : null;

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
    const subItems = [];
    const subLines = [];

    if (eventName === 'end') {
      summary = 'END of script';
      bytesHex = '';
    } else {
      const snippet = decodeScriptSnippet(romBuf, loc, item.event === 'start' ? 3 : 1);
      const first = snippet && snippet[0];

      bytesHex = first && first.bytesHex ? first.bytesHex : '';
      if (!bytesHex && item.bytes && item.bytes.length) {
        bytesHex = item.bytes.slice(0, 4)
          .map(b => (b & 0xFF).toString(16).toUpperCase().padStart(2, '0'))
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
    const isInactive = formatter.isInactiveStatus(eventName);

    if (ch && (!options.hideInactive || !isInactive)) {
      ch.appendLine(line);
    }

    if (subItems.length > 0) {
      for (const sub of subItems) {
        const subText = formatter.formatSubText(sub, itemData);
        if (ch && (!options.hideInactive || !isInactive)) {
          ch.appendLine(subText);
        }
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

module.exports = {
  ensureScriptTraceChannel,
  loadFallbackRom,
  decodeScriptSnippet,
  processScriptTraceBatch,
  isValidScriptAddr,
  ScriptTraceFormatter,
  getActiveAddressLookup,
};
