// Ownership: how the emulator's ROM list describes a ROM the Evermore map editor built (a test ROM
// that boots into a custom room: *_emulator.sfc, or the intro hook pointing at the room). Handed to
// src/core/emulator/rom-history.js as its ROM describer through the game adapter (host.js).

import * as path from 'path';
import * as maps from '../maps';

function isCustomMapPath(target: unknown, hintPath?: string | null): boolean {
  const p = String(typeof target === 'string' ? target : (hintPath || '')).toLowerCase();
  const base = path.basename(p);
  return base.endsWith('_emulator.sfc') || base.endsWith('_emulator.smc') || base.includes('_emulator.');
}

function extractCustomMapName(target: unknown, hintPath?: string | null): string {
  const p = String(typeof target === 'string' ? target : (hintPath || ''));
  const base = path.basename(p);
  const m = base.match(/^(.+?)_emulator\.(sfc|smc)$/i);
  if (m) return m[1];
  return base.replace(/\.(sfc|smc)$/i, '');
}

/** Details for a custom-map test ROM, or null when `clean` is not one. sha1/crc32 are added by the caller. */
function describeCustomMapRom(clean: Uint8Array, target: unknown, hintPath?: string | null) {
    const customByPath = isCustomMapPath(target, hintPath);
    const introOffset = 0x12e0ca;
    const customByContent = clean.length >= 0x300000 && clean[introOffset] === 0x22 && clean[introOffset + 4] === 0x00 && clean[introOffset + 5] === 0x00;

    if (customByPath || customByContent) {
      const customName = extractCustomMapName(target, hintPath) || 'custom_map';
      const targetRoom = customByContent ? clean[introOffset + 3] : 0x15;
      let previewDataUri = '';
      let roomWidth = 16;
      let roomHeight = 14;
      try {
        const room = maps.decodeRoom(clean, targetRoom);
        if (room && room.header) {
          roomWidth = room.header.widthTiles;
          roomHeight = room.header.heightTiles;
          const composite = maps.renderRoomComposite(clean, room);
          if (composite) previewDataUri = maps.encodePngDataUri(composite);
        }
      } catch (_) {}

      return {
        known: false,
        isCustomMap: true,
        customName: customName,
        vfsUri: 'soe://maps/custom/' + encodeURIComponent(customName),
        targetRoom: targetRoom,
        roomWidth: roomWidth,
        roomHeight: roomHeight,
        previewDataUri: previewDataUri || '',
        region: 'MAP',
        regionName: 'Custom Map (' + customName + ')',
        icon: 'MAP',
        flag: 'MAP',
      };
    }

    return null;
}

export { describeCustomMapRom };
