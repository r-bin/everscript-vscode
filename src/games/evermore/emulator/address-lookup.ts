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

import { getNpcScriptName, getGlobalScriptName, ABS_SCRIPTS, getMapName } from '../localizations';
import knownScriptsJson from './known-scripts.json';

type Rom = Uint8Array;
type Kind = 'empty' | 'global' | 'npc' | 'enter' | 'bTrigger' | 'stepOn';
/** What an address resolves to: a named script, or a trigger of a room. */
interface Resolved {
  addr: number; name: string; shortTag: string; kind: Kind;
  id?: number; room?: number; index?: number; scriptId?: number; coords?: string;
}
interface RoomTriggers { bTrigger: Resolved[]; stepOn: Resolved[]; enter: number | null }
/** The Rooms editor's draft: its triggers (x1/y1 are tiles, scriptId 0 = none). */
interface Draft { bTrigger?: { x1: number; y1: number; scriptId?: number }[]; stepOn?: { x1: number; y1: number; scriptId?: number }[] }
interface LookupItem { triggerKind?: string; triggerIndex?: number }
const KNOWN_SCRIPTS = knownScriptsJson as Record<string, { id: number; kind: 'global' | 'npc' }>;

const SCRIPTS_START_ADDR_US = 0x928000;
const ENTER_TABLE_OFFSET    = 0x1b;

function snesToRom(addr: number): number {
  return (addr & ~0xc00000) >>> 0;
}

function read16(rom: Rom | null, addr: number): number {
  const a = snesToRom(addr);
  if (!rom || a + 1 >= rom.length) return 0;
  return (rom[a] | (rom[a + 1] << 8)) >>> 0;
}

function read24(rom: Rom | null, addr: number): number {
  const a = snesToRom(addr);
  if (!rom || a + 2 >= rom.length) return 0;
  return (rom[a] | (rom[a + 1] << 8) | (rom[a + 2] << 16)) >>> 0;
}

function scriptValueToSnes(value: number, base = SCRIPTS_START_ADDR_US): number {
  return (base + (value & 0x007fff) + ((value & 0xff8000) << 1)) >>> 0;
}

class RomAddressLookup {
  rom: Rom | null;
  activeRoomId: number;
  lookupMap = new Map<number, Resolved>();
  roomTriggersMap = new Map<number, RoomTriggers>();
  mapscriptTableSnes = 0;

  constructor(rom: Rom | null | undefined, customDraft?: Draft | null, activeRoomId = 0x15) {
    this.rom = rom || null;
    this.activeRoomId = activeRoomId;

    this._initVanillaTable();
    if (customDraft) {
      this.registerCustomDraft(customDraft, activeRoomId);
    }
  }

  _initVanillaTable(): void {
    // 1. Bare empty trigger script (id 477)
    this.lookupMap.set(0x92A42F, {
      addr: 0x92A42F,
      name: 'Empty Trigger (bare END)',
      shortTag: 'empty',
      kind: 'empty',
    });

    // 2. Pre-indexed known global and NPC scripts (e.g. 0x92A050 -> global[0x36])
    for (const [addrStr, entry] of Object.entries(KNOWN_SCRIPTS)) {
      const addr = parseInt(addrStr, 10);
      if (!isNaN(addr) && addr > 0 && !this.lookupMap.has(addr)) {
        const hexId = '0x' + entry.id.toString(16).toLowerCase();
        const shortTag = entry.kind === 'global' ? `global[${hexId}]` : `npc[${hexId}]`;
        const displayName = entry.kind === 'global'
          ? getGlobalScriptName(entry.id)
          : getNpcScriptName(entry.id);
        this.lookupMap.set(addr, {
          addr,
          id: entry.id,
          name: displayName,
          shortTag,
          kind: entry.kind,
        });
      }
    }

    // 3. Global / abs scripts from localizations
    if (ABS_SCRIPTS) {
      for (const [addr, entry] of ABS_SCRIPTS.entries()) {
        if (typeof addr !== 'number') continue;
        if (addr > 0 && !this.lookupMap.has(addr)) {
          this.lookupMap.set(addr, {
            addr,
            name: `Global: ${entry.name}`,
            shortTag: `global[0x${addr.toString(16)}]`,
            kind: 'global',
          });
        }
      }
    }

    if (!this.rom || this.rom.length < 0x300000) return;

    // 4. Vanilla Enter Scripts for all 127 rooms
    const mapscriptTableSnes = SCRIPTS_START_ADDR_US + read16(this.rom, SCRIPTS_START_ADDR_US);

    for (let r = 0; r < 127; r++) {
      const enterPtrAddr = SCRIPTS_START_ADDR_US + ENTER_TABLE_OFFSET + 5 * r;
      const packed = read24(this.rom, enterPtrAddr);
      if (packed > 0) {
        const snesAddr = scriptValueToSnes(packed);
        const mapName = getMapName(r, { full: true, fallback: '' });
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

  resolveScriptIdToSnes(scriptId: number): number {
    if (!this.rom || typeof scriptId !== 'number') return 0;
    const mapscriptTableSnes = this.mapscriptTableSnes || (SCRIPTS_START_ADDR_US + read16(this.rom, SCRIPTS_START_ADDR_US));
    const packed = read24(this.rom, mapscriptTableSnes + scriptId);
    return packed > 0 ? scriptValueToSnes(packed) : 0;
  }

  registerCustomDraft(draft: Draft | null | undefined, roomId = 0x15): void {
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

    const roomTrigs: RoomTriggers = { bTrigger: [], stepOn: [], enter: enterAddr };

    // Register B-triggers
    if (Array.isArray(draft.bTrigger)) {
      draft.bTrigger.forEach((t, i) => {
        const sId = typeof t.scriptId === 'number' && t.scriptId !== 0 ? t.scriptId : 477;
        const addr = this.resolveScriptIdToSnes(sId) || (sId === 477 ? 0x92A42F : 0);
        const coords = `(${t.x1},${t.y1})`;
        const trigInfo: Resolved = {
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
        if (addr && addr !== 0x92A42F && !this.lookupMap.has(addr)) {
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
        const trigInfo: Resolved = {
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
        if (addr && addr !== 0x92A42F && !this.lookupMap.has(addr)) {
          this.lookupMap.set(addr, trigInfo);
        }
      });
    }

    this.roomTriggersMap.set(roomId, roomTrigs);
  }

  _getRoomTriggers(roomId: number): RoomTriggers | null {
    if (this.roomTriggersMap.has(roomId)) {
      return this.roomTriggersMap.get(roomId)!;
    }
    if (!this.rom || typeof roomId !== 'number' || roomId < 0 || roomId > 0x90) return null;
    const headerOffset = (this.rom.length % 1024 === 512) ? 512 : 0;
    const mapTableRom = headerOffset + 0x1ffde7;
    const ptrAddr = mapTableRom + roomId * 4;
    if (ptrAddr + 3 >= this.rom.length) return null;
    const dataSnes = this.rom[ptrAddr] | (this.rom[ptrAddr + 1] << 8) | (this.rom[ptrAddr + 2] << 16);
    if (dataSnes === 0 || dataSnes === 0xFFFFFF) return null;
    const dataRom = headerOffset + (((dataSnes >> 16) & 0x3f) * 0x10000 + (dataSnes & 0xffff));
    if (dataRom + 20 >= this.rom.length) return null;

    const stepLen = this.rom[dataRom + 0x0d] | (this.rom[dataRom + 0x0e] << 8);
    const stepTableRom = dataRom + 0x0f;
    const bLenRom = stepTableRom + stepLen;
    if (bLenRom + 2 >= this.rom.length) return null;
    const bLen = this.rom[bLenRom] | (this.rom[bLenRom + 1] << 8);
    const bTableRom = bLenRom + 2;

    const roomHex = '0x' + roomId.toString(16).toUpperCase().padStart(2, '0');
    const roomTrigs: RoomTriggers = { bTrigger: [], stepOn: [], enter: null };

    if (stepLen >= 6 && stepLen % 6 === 0 && stepLen <= 600) {
      let idx = 0;
      for (let p = 0; p < stepLen; p += 6) {
        const at = stepTableRom + p;
        if (at + 5 >= this.rom.length) break;
        const sId = this.rom[at + 4] | (this.rom[at + 5] << 8);
        const addr = this.resolveScriptIdToSnes(sId) || (sId === 477 ? 0x92A42F : 0);
        const coords = `(${this.rom[at + 1]},${this.rom[at + 0]})`;
        roomTrigs.stepOn.push({
          addr,
          room: roomId,
          kind: 'stepOn',
          index: idx,
          scriptId: sId,
          coords,
          name: `Room ${roomHex} Step-on #${idx} at ${coords}`,
          shortTag: `${roomHex}.step[${idx}]`,
        });
        idx++;
      }
    }

    if (bLen >= 6 && bLen % 6 === 0 && bLen <= 600) {
      let idx = 0;
      for (let p = 0; p < bLen; p += 6) {
        const at = bTableRom + p;
        if (at + 5 >= this.rom.length) break;
        const sId = this.rom[at + 4] | (this.rom[at + 5] << 8);
        const addr = this.resolveScriptIdToSnes(sId) || (sId === 477 ? 0x92A42F : 0);
        const coords = `(${this.rom[at + 1]},${this.rom[at + 0]})`;
        roomTrigs.bTrigger.push({
          addr,
          room: roomId,
          kind: 'bTrigger',
          index: idx,
          scriptId: sId,
          coords,
          name: `Room ${roomHex} B-trigger #${idx} at ${coords}`,
          shortTag: `${roomHex}.b[${idx}]`,
        });
        idx++;
      }
    }

    this.roomTriggersMap.set(roomId, roomTrigs);
    return roomTrigs;
  }

  lookup(addr: number, currentRoomId?: number, item?: LookupItem): Resolved | null {
    if (typeof addr !== 'number' || addr <= 0) return null;

    // Check custom room or room-specific triggers first if room matches
    const roomId = currentRoomId !== undefined ? currentRoomId : this.activeRoomId;
    const roomTrigs = this.roomTriggersMap.has(roomId)
      ? this.roomTriggersMap.get(roomId) ?? null
      : this._getRoomTriggers(roomId);

    if (roomTrigs) {
      if (addr === roomTrigs.enter) {
        return this.lookupMap.get(addr) || null;
      }
      // Prioritize triggerKind and triggerIndex if provided in item
      if (item && item.triggerKind) {
        const isStep = item.triggerKind === 'stepOn';
        const list = isStep ? roomTrigs.stepOn : roomTrigs.bTrigger;
        const idx = typeof item.triggerIndex === 'number' ? item.triggerIndex : 0;
        if (list && list[idx]) {
          const t = list[idx];
          if (t.scriptId === 477 || addr === 0x92A42F) {
            const hex = '0x' + roomId.toString(16).toUpperCase().padStart(2, '0');
            const kindLabel = isStep ? 'Step-on' : 'B-trigger';
            const kindTag = isStep ? 'step' : 'b';
            return {
              ...t,
              name: `Room ${hex} ${kindLabel} #${idx} (bare END)`,
              shortTag: `${hex}.${kindTag}[${idx}]`,
            };
          }
          return t;
        }
      }
      // Check if address matches any specific non-empty trigger in this room
      for (const trig of roomTrigs.bTrigger) {
        if (trig.addr === addr && trig.scriptId !== 477) return trig;
      }
      for (const trig of roomTrigs.stepOn) {
        if (trig.addr === addr && trig.scriptId !== 477) return trig;
      }
      // If address is bare empty return (0x92A42F)
      if (addr === 0x92A42F) {
        const hex = '0x' + roomId.toString(16).toUpperCase().padStart(2, '0');
        if (item && item.triggerKind === 'stepOn' && roomTrigs.stepOn.length > 0) {
          const idx = typeof item.triggerIndex === 'number' ? item.triggerIndex : 0;
          const t = roomTrigs.stepOn[idx] || roomTrigs.stepOn[0];
          return {
            ...t,
            name: `Room ${hex} Step-on #${idx} (bare END)`,
            shortTag: `${hex}.step[${idx}]`,
          };
        }
        if (item && item.triggerKind === 'bTrigger' && roomTrigs.bTrigger.length > 0) {
          const idx = typeof item.triggerIndex === 'number' ? item.triggerIndex : 0;
          const t = roomTrigs.bTrigger[idx] || roomTrigs.bTrigger[0];
          return {
            ...t,
            name: `Room ${hex} B-trigger #${idx} (bare END)`,
            shortTag: `${hex}.b[${idx}]`,
          };
        }
        if (roomTrigs.bTrigger.length > 0) {
          const t0 = roomTrigs.bTrigger[0];
          return {
            ...t0,
            name: `Room ${hex} B-trigger (bare END)`,
            shortTag: `${hex}.b[0]`,
          };
        }
        if (roomTrigs.stepOn.length > 0) {
          const s0 = roomTrigs.stepOn[0];
          return {
            ...s0,
            name: `Room ${hex} Step-on #0 (bare END)`,
            shortTag: `${hex}.step[0]`,
          };
        }
        return this.lookupMap.get(addr) || {
          addr: 0x92A42F,
          room: roomId,
          name: `Room ${hex} Trigger (bare END)`,
          shortTag: `${hex}.end`,
          kind: 'empty',
        };
      }
    }

    // Direct lookup in global map
    return this.lookupMap.get(addr) || null;
  }
}

let _activeLookup: RomAddressLookup | null = null;

function getActiveAddressLookup(rom?: Rom | null, customDraft?: Draft | null, activeRoomId = 0x15): RomAddressLookup {
  if (!_activeLookup || (rom && _activeLookup.rom !== rom) || customDraft) {
    _activeLookup = new RomAddressLookup(rom, customDraft, activeRoomId);
  }
  return _activeLookup;
}

export { RomAddressLookup, getActiveAddressLookup, scriptValueToSnes };
