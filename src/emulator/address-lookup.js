'use strict';

/**
 * debugger/emulator/address-lookup.js
 *
 * Fast ROM address lookup table that resolves script addresses to human-readable
 * room triggers, enter scripts, and named global scripts:
 *   e.g. "0xBC8000 -> Room 0x15 Enter Script"
 *        "0x92A42F -> Room 0x15 B-trigger #0 (bare END)"
 *        "0x94E644 -> Room 0x34 B-trigger #0 (Gourd Prize)"
 *
 * Strictly ASCII-only.
 */

const path = require('path');
const fs   = require('fs');

const SCRIPTS_START_ADDR_US = 0x928000;
const ENTER_TABLE_OFFSET    = 0x1b;

function snesToRom(addr) {
  return (addr & ~0xc00000) >>> 0;
}

function read16(rom, addr) {
  const a = snesToRom(addr);
  if (!rom || a + 1 >= rom.length) return 0;
  return (rom[a] | (rom[a + 1] << 8)) >>> 0;
}

function read24(rom, addr) {
  const a = snesToRom(addr);
  if (!rom || a + 2 >= rom.length) return 0;
  return (rom[a] | (rom[a + 1] << 8) | (rom[a + 2] << 16)) >>> 0;
}

function scriptValueToSnes(value, base = SCRIPTS_START_ADDR_US) {
  return (base + (value & 0x007fff) + ((value & 0xff8000) << 1)) >>> 0;
}

class RomAddressLookup {
  constructor(rom, customDraft, activeRoomId = 0x15) {
    this.rom = rom || null;
    this.activeRoomId = activeRoomId;
    this.lookupMap = new Map();
    this.roomTriggersMap = new Map(); // roomId -> { bTrigger: [], stepOn: [], enter: null }
    this.namesData = null;

    this._loadNamesData();
    this._initVanillaTable();
    if (customDraft) {
      this.registerCustomDraft(customDraft, activeRoomId);
    }
  }

  _loadNamesData() {
    try {
      const namesPath = path.join(__dirname, '..', 'script', 'names.json');
      if (fs.existsSync(namesPath)) {
        this.namesData = JSON.parse(fs.readFileSync(namesPath, 'utf8'));
      }
    } catch (_) {
      this.namesData = null;
    }

    try {
      const knownPath = path.join(__dirname, 'known-scripts.json');
      if (fs.existsSync(knownPath)) {
        this.knownScripts = JSON.parse(fs.readFileSync(knownPath, 'utf8'));
      }
    } catch (_) {
      this.knownScripts = null;
    }
  }

  _initVanillaTable() {
    // 1. Bare empty trigger script (id 477)
    this.lookupMap.set(0x92A42F, {
      addr: 0x92A42F,
      name: 'Empty Trigger (bare END)',
      shortTag: 'empty',
      kind: 'empty',
    });

    // 2. Pre-indexed known global and NPC scripts (e.g. 0x92A050 -> global[0x36])
    if (this.knownScripts) {
      for (const [addrStr, entry] of Object.entries(this.knownScripts)) {
        const addr = parseInt(addrStr, 10);
        if (!isNaN(addr) && addr > 0 && !this.lookupMap.has(addr)) {
          const hexId = '0x' + entry.id.toString(16).toLowerCase();
          const shortTag = entry.kind === 'global' ? `global[${hexId}]` : `npc[${hexId}]`;
          let displayName = entry.name;
          if (entry.kind === 'global' && this.namesData && this.namesData.globalScripts) {
            const named = this.namesData.globalScripts[String(entry.id)];
            if (named) displayName = named;
          }
          this.lookupMap.set(addr, {
            addr,
            id: entry.id,
            name: displayName,
            shortTag,
            kind: entry.kind,
          });
        }
      }
    }

    // 3. Global / abs scripts from names.json
    if (this.namesData && this.namesData.absScripts) {
      for (const [addrStr, name] of Object.entries(this.namesData.absScripts)) {
        const addr = parseInt(addrStr, 10);
        if (!isNaN(addr) && addr > 0 && !this.lookupMap.has(addr)) {
          this.lookupMap.set(addr, {
            addr,
            name: `Global: ${name}`,
            shortTag: `global[0x${addr.toString(16)}]`,
            kind: 'global',
          });
        }
      }
    }

    if (!this.rom || this.rom.length < 0x300000) return;

    // 3. Vanilla Enter Scripts for all 127 rooms
    const mapscriptTableSnes = SCRIPTS_START_ADDR_US + read16(this.rom, SCRIPTS_START_ADDR_US);

    for (let r = 0; r < 127; r++) {
      const enterPtrAddr = SCRIPTS_START_ADDR_US + ENTER_TABLE_OFFSET + 5 * r;
      const packed = read24(this.rom, enterPtrAddr);
      if (packed > 0) {
        const snesAddr = scriptValueToSnes(packed);
        const mapName = (this.namesData && this.namesData.maps && this.namesData.maps[String(r)]) || '';
        const roomHex = '0x' + r.toString(16).toUpperCase().padStart(2, '0');
        if (!this.lookupMap.has(snesAddr)) {
          this.lookupMap.set(snesAddr, {
            addr: snesAddr,
            room: r,
            kind: 'enter',
            name: `Room ${roomHex} Enter Script${mapName ? ' (' + mapName + ')' : ''}`,
            shortTag: `${roomHex}.enter`,
          });
        }
      }
    }

    // Pre-calculate known trigger script IDs
    this.mapscriptTableSnes = mapscriptTableSnes;
  }

  resolveScriptIdToSnes(scriptId) {
    if (!this.rom || typeof scriptId !== 'number') return 0;
    const mapscriptTableSnes = this.mapscriptTableSnes || (SCRIPTS_START_ADDR_US + read16(this.rom, SCRIPTS_START_ADDR_US));
    const packed = read24(this.rom, mapscriptTableSnes + scriptId);
    return packed > 0 ? scriptValueToSnes(packed) : 0;
  }

  registerCustomDraft(draft, roomId = 0x15) {
    if (!draft) return;
    const roomHex = '0x' + roomId.toString(16).toUpperCase().padStart(2, '0');

    // Custom enter script is always written to 0xBC8000
    const enterAddr = 0xBC8000;
    this.lookupMap.set(enterAddr, {
      addr: enterAddr,
      room: roomId,
      kind: 'enter',
      name: `Room ${roomHex} Enter Script (Laser Lance + Fade)`,
      shortTag: `${roomHex}.enter`,
    });

    const roomTrigs = { bTrigger: [], stepOn: [], enter: enterAddr };

    // Register B-triggers
    if (Array.isArray(draft.bTrigger)) {
      draft.bTrigger.forEach((t, i) => {
        const sId = typeof t.scriptId === 'number' && t.scriptId !== 0 ? t.scriptId : 477;
        const addr = this.resolveScriptIdToSnes(sId) || (sId === 477 ? 0x92A42F : 0);
        const coords = `(${t.x1},${t.y1})`;
        const trigInfo = {
          addr,
          room: roomId,
          kind: 'bTrigger',
          index: i,
          scriptId: sId,
          coords,
          name: `Room ${roomHex} B-trigger #${i} at ${coords}`,
          shortTag: `${roomHex}.b[${i}]`,
        };
        roomTrigs.bTrigger.push(trigInfo);
        if (addr && (!this.lookupMap.has(addr) || addr === 0x92A42F)) {
          // If address is shared (e.g. 0x92A42F), save reference to active room trigger
          this.lookupMap.set(addr, trigInfo);
        }
      });
    }

    // Register step-on triggers
    if (Array.isArray(draft.stepOn)) {
      draft.stepOn.forEach((t, i) => {
        const sId = typeof t.scriptId === 'number' && t.scriptId !== 0 ? t.scriptId : 477;
        const addr = this.resolveScriptIdToSnes(sId) || (sId === 477 ? 0x92A42F : 0);
        const coords = `(${t.x1},${t.y1})`;
        const trigInfo = {
          addr,
          room: roomId,
          kind: 'stepOn',
          index: i,
          scriptId: sId,
          coords,
          name: `Room ${roomHex} Step-on #${i} at ${coords}`,
          shortTag: `${roomHex}.step[${i}]`,
        };
        roomTrigs.stepOn.push(trigInfo);
        if (addr && (!this.lookupMap.has(addr) || addr === 0x92A42F)) {
          this.lookupMap.set(addr, trigInfo);
        }
      });
    }

    this.roomTriggersMap.set(roomId, roomTrigs);
  }

  lookup(addr, currentRoomId) {
    if (typeof addr !== 'number' || addr <= 0) return null;

    // Check custom room 0x15 specific triggers first if room matches
    const roomId = currentRoomId !== undefined ? currentRoomId : this.activeRoomId;
    const roomTrigs = this.roomTriggersMap.get(roomId);
    if (roomTrigs) {
      if (addr === roomTrigs.enter) {
        return this.lookupMap.get(addr) || null;
      }
      // Check if address matches any specific non-empty trigger in this room
      for (const trig of roomTrigs.bTrigger) {
        if (trig.addr === addr && trig.scriptId !== 477) return trig;
      }
      for (const trig of roomTrigs.stepOn) {
        if (trig.addr === addr && trig.scriptId !== 477) return trig;
      }
      // If address is bare empty return (0x92A42F) and room has B-triggers, attribute to room B-trigger
      if (addr === 0x92A42F && roomTrigs.bTrigger.length > 0) {
        const t0 = roomTrigs.bTrigger[0];
        const hex = '0x' + roomId.toString(16).toUpperCase().padStart(2, '0');
        return {
          ...t0,
          name: `Room ${hex} B-trigger (bare END)`,
          shortTag: `${hex}.b[0]`,
        };
      }
    }

    // Direct lookup in global map
    return this.lookupMap.get(addr) || null;
  }
}

let _activeLookup = null;

function getActiveAddressLookup(rom, customDraft, activeRoomId = 0x15) {
  if (!_activeLookup || (rom && _activeLookup.rom !== rom) || customDraft) {
    _activeLookup = new RomAddressLookup(rom, customDraft, activeRoomId);
  }
  return _activeLookup;
}

module.exports = {
  RomAddressLookup,
  getActiveAddressLookup,
  scriptValueToSnes,
};
