
    // Standing sprites for entities that have not been activated yet, from
    // the host (resolveCharacterSprite). undefined = not asked yet, null = none.
    const idleSprites = new Map();
    let idleSpritesWanted = new Set();
    function idleSpriteFor(type, facing) {
      const key = type + ':' + ((facing || 8) & 0x0e);
      if (idleSprites.has(key)) return idleSprites.get(key);
      if (!idleSpritesWanted.has(key)) {
        idleSpritesWanted.add(key);
        if (vscodeApi) vscodeApi.postMessage({ command: 'requestIdleSprites', keys: [key] });
      }
      return null;
    }

    // Every live entity, from a read of WRAM starting at $7E3DDF. The engine
    // keeps two lists, both linked through +0x5E: $3DDF holds the active
    // entities (near the screen, run and drawn every frame) and $3DE1 the
    // inactive ones, which it moves an entity to as it leaves the screen and
    // back as it returns ($CFB254). Walking $3DDF alone made enemies blink in
    // and out of the extension and the Entities tab at that boundary. ($3DE3
    // is the free list.) The Boy and Dog are always added.
    function entityAddresses(buf) {
      const out = [];
      const visited = new Set();
      for (const head of [0, 2]) {
        let cur = buf[head] | (buf[head + 1] << 8);
        let safety = 0;
        while (cur >= 0x3DE5 && cur < 0x4FE5 && !visited.has(cur) && safety++ < 40) {
          visited.add(cur);
          out.push(cur);
          const rel = cur - 0x3DDF;
          if (rel < 0 || rel + 0x60 > buf.length) break;
          cur = buf[rel + 0x5E] | (buf[rel + 0x5F] << 8);
          if (!cur) break;
        }
      }
      if (!visited.has(0x4E89)) out.push(0x4E89);
      if (!visited.has(0x4F37)) out.push(0x4F37);
      return out;
    }

    // Draws the priority-2 entities on Layer 1 and returns the priority-3 ones,
    // which the caller draws over the foreground (Layer 2).
    function renderExtendedEntities(preState, layout, extEntCanvas, extEntCtx) {
      if (!extEntCtx || !extEntCanvas) return [];
      extEntCtx.clearRect(0, 0, layout.wrapW, layout.wrapH);
      if (!extendMapEnabled || !preState || !loadedRomData) return [];

      const rom = (loadedRomData.length % 1024 === 512) ? loadedRomData.subarray(512) : loadedRomData;
      const drawList = [];

      // 1. Entities from WRAM entBuf (0x7E3DDF)
      if (preState.entBuf) {
        const buf = preState.entBuf;
        const entities = entityAddresses(buf);

        for (let i = 0; i < entities.length; i++) {
          const addr = entities[i];
          const rel = addr - 0x3DDF;
          if (rel < 0 || rel + 0x8E > buf.length) continue;

          // Draw mode 0 ($8FC6C5) draws a main sprite (+0x06, bank +0x08)
          // unless +0x12 bit 15 hides it, and a secondary one (+0x09, bank
          // +0x0B: the shadow) unless bit 14 does. Nothing else hides a listed
          // entity: +0x10 bit 5 is "scripted" (control(NONE), walk(), every
          // cutscene actor), not "invisible" - skipping it lost the intro's cast.
          const hideFlags = buf[rel + 0x12] | (buf[rel + 0x13] << 8);
          const spriteBank = buf[rel + 0x08];
          const spriteAddr = buf[rel + 0x06] | (buf[rel + 0x07] << 8);
          const mainOk = !(hideFlags & 0x8000) && spriteBank >= 0xC0 && spriteBank <= 0xDF && spriteAddr >= 3;
          const secBank = buf[rel + 0x0B];
          const secAddr = buf[rel + 0x09] | (buf[rel + 0x0A] << 8);
          const secOk = !(hideFlags & 0x4000) && secBank >= 0xC0 && secBank <= 0xDF && secAddr >= 3;
          // Spawned but never activated (waiting in $3DE1 until the camera
          // comes near): no sprite yet, so stand it in its record's standing
          // frame rather than let it pop in at the screen edge.
          let idle = null;
          if (!mainOk && !secOk && !(hideFlags & 0x8000)) {
            const type = buf[rel + 0x60] | (buf[rel + 0x61] << 8);
            if (type >= 0x8000) idle = idleSpriteFor(type, buf[rel + 0x22]);
          }
          if (!mainOk && !secOk && !idle) continue;

          const isBoy = (addr === 0x4E89);
          const isDog = (addr === 0x4F37);
          const depth = entityDepth(buf, rel);
          if (depth === 'hidden') continue;

          const rawX = buf[rel + 0x1A] | (buf[rel + 0x1B] << 8);
          const posX = rawX >= 0x8000 ? rawX - 0x10000 : rawX;
          const rawY = buf[rel + 0x1C] | (buf[rel + 0x1D] << 8);
          const posY = rawY >= 0x8000 ? rawY - 0x10000 : rawY;
          const rawZ = buf[rel + 0x1E] | (buf[rel + 0x1F] << 8);
          const posZ = rawZ >= 0x8000 ? rawZ - 0x10000 : rawZ;

          // +0x0C is the entity's palette slot; $7E1278 holds the ROM address
          // of the palette loaded in each slot. That is the engine's own answer
          // for the Boy and Dog too (the Dog's changes per act and per floor).
          const slotOffset = buf[rel + 0x0C] & 0x0E;
          let palAddr = preState.palSlotBuf ? (preState.palSlotBuf[slotOffset] | (preState.palSlotBuf[slotOffset + 1] << 8)) : 0;
          if (!palAddr) {
            if (isBoy) {
              palAddr = 0xAD0B;
            } else if (isDog) {
              palAddr = getDogPalette(preState.mapId, spriteBank);
            } else {
              const stype = buf[rel + 0x60] | (buf[rel + 0x61] << 8);
              if (stype >= 0x8000) {
                palAddr = EvsRom.entityRecordWord(rom, stype, EvsRom.RECORD_FIELDS.palette);
              }
            }
          }
          if (!palAddr) palAddr = 0xAD0B;

          // $8FC7E8: in a room with effect 2 a plane-0 character is placed
          // against BG1's scroll (it belongs to the parallax layer), and two
          // lines lower than the camera formula gives.
          const onBg1 = preState.roomEffect === 2 && (buf[rel + 0x18] & 0x30) === 0;
          const refX = onBg1 ? preState.bg1X : layout.camX;
          const refY = onBg1 ? preState.bg1Y - 2 : layout.camY;
          const live = { cg: preState.cgramBuf, slot: slotOffset };
          // The secondary sprite sits on the ground (no height) and sorts
          // just behind the main one, as the engine queues it.
          const parts = [];
          if (secOk) parts.push({ ptr: (secBank << 16) | secAddr, lift: 0, sort: posY - 0.5 });
          if (mainOk) parts.push({ ptr: (spriteBank << 16) | spriteAddr, lift: Math.floor(posZ / 16), sort: posY });
          if (idle) parts.push({ ptr: idle.sprite, lift: 0, sort: posY, pal: idle.palette });
          for (let k = 0; k < parts.length; k++) {
            // An idle stand-in has no palette slot yet: its record's colours.
            const sprite = parts[k].pal
              ? getDecodedSprite(rom, parts[k].ptr, parts[k].pal & 0xFFFF, null)
              : getDecodedSprite(rom, parts[k].ptr, palAddr, live);
            if (!sprite) continue;
            const screenX = layout.emuX + (posX - sprite.originX - refX) * layout.scaleSnes;
            const screenY = layout.emuY + (posY - sprite.originY - parts[k].lift - refY) * layout.scaleSnes;
            const screenW = sprite.width * layout.scaleSnes;
            const screenH = sprite.height * layout.scaleSnes;
            if (screenX + screenW <= 0 || screenX >= layout.wrapW || screenY + screenH <= 0 || screenY >= layout.wrapH) continue;
            drawList.push({
              canvas: sprite.canvas,
              x: screenX,
              y: screenY,
              w: screenW,
              h: screenH,
              sortY: parts[k].sort,
              // Never activated means +0x3C (the tile under it) was never
              // filled; most tiles put a character in front.
              front: parts[k].pal ? true : depth === 'front',
            });
          }
        }
      }

      // 2. Projectiles from WRAM projBuf (0x7E6387, 8 slots * 44 bytes)
      if (preState.projBuf) {
        const pbuf = preState.projBuf;
        for (let p = 0; p < 8; p++) {
          const rel = p * 44;
          const active = pbuf[rel + 0x10] | (pbuf[rel + 0x11] << 8);
          if (!active) continue;

          // Coordinates are 1/16 subpixels in WRAM ($90DE88 shifts right 4 bits)
          const rawX = pbuf[rel + 0x14] | (pbuf[rel + 0x15] << 8);
          const posX = Math.floor((rawX >= 0x8000 ? rawX - 0x10000 : rawX) / 16);
          const rawY = pbuf[rel + 0x16] | (pbuf[rel + 0x17] << 8);
          const posY = Math.floor((rawY >= 0x8000 ? rawY - 0x10000 : rawY) / 16);
          const rawZ = pbuf[rel + 0x18] | (pbuf[rel + 0x19] << 8);
          const posZ = Math.floor((rawZ >= 0x8000 ? rawZ - 0x10000 : rawZ) / 16);

          const spriteBank = pbuf[rel + 0x08];
          const spriteAddr = pbuf[rel + 0x06] | (pbuf[rel + 0x07] << 8);
          const slotOffset = pbuf[rel + 0x0C] & 0x0E;
          const palAddr = preState.palSlotBuf ? (preState.palSlotBuf[slotOffset] | (preState.palSlotBuf[slotOffset + 1] << 8)) : 0;

          let sprite = null;
          if (spriteBank >= 0xC0 && spriteBank <= 0xDF && spriteAddr >= 3) {
            const spritePtr = (spriteBank << 16) | spriteAddr;
            sprite = getDecodedSprite(rom, spritePtr, palAddr || 0xad0b, { cg: preState.cgramBuf, slot: slotOffset });
          }

          if (sprite) {
            const roomSpriteX = posX - sprite.originX;
            const roomSpriteY = posY - sprite.originY - posZ;
            const screenX = layout.emuX + (roomSpriteX - layout.camX) * layout.scaleSnes;
            const screenY = layout.emuY + (roomSpriteY - layout.camY) * layout.scaleSnes;
            const screenW = sprite.width * layout.scaleSnes;
            const screenH = sprite.height * layout.scaleSnes;

            if (screenX + screenW > 0 && screenX < layout.wrapW && screenY + screenH > 0 && screenY < layout.wrapH) {
              drawList.push({
                canvas: sprite.canvas,
                x: screenX,
                y: screenY,
                w: screenW,
                h: screenH,
                sortY: posY,
                front: true,
              });
            }
          } else {
            const screenX = layout.emuX + (posX - layout.camX) * layout.scaleSnes;
            const screenY = layout.emuY + (posY - posZ - layout.camY) * layout.scaleSnes;
            const rad = Math.max(3, Math.round(5 * layout.scaleSnes));
            if (screenX + rad > 0 && screenX - rad < layout.wrapW && screenY + rad > 0 && screenY - rad < layout.wrapH) {
              drawList.push({
                isOrb: true,
                x: screenX,
                y: screenY,
                rad: rad,
                sortY: posY,
                front: true,
              });
            }
          }
        }
      }

      drawList.sort((a, b) => a.sortY - b.sortY);
      drawEntityItems(extEntCtx, drawList.filter(item => !item.front));
      return drawList.filter(item => item.front);
    }

    // readMemoryRange caps a call at 4096 bytes (the core's static buffer) and
    // returns a short array past that, which silently cut the Boy ($4E89) and
    // Dog ($4F37) off the end of the entity table.
    function readMemoryChunked(m, addr, size) {
      const out = new Uint8Array(size);
      for (let off = 0; off < size; off += 4096) {
        const n = Math.min(4096, size - off);
        out.set(m.readMemoryRange(addr + off, n).subarray(0, n), off);
      }
      return out;
    }

    function samplePreLoopState() {
      const m = getModule();
      if (!m || !hasDebuggerApi(m) || !loadedRomData) return null;
      let camX = 0, camY = 0, mapId = -1, trigOffX = 0, trigOffY = 0, bg1X = 0, bg1Y = 0;
      let iniDisp = 0x0F, cgramBuf = null, mainScreen = 0x17, roomEffect = 0;
      let entBuf = null, palSlotBuf = null, projBuf = null, objStateBuf = null, grassQueueBuf = null, animIdxBuf = null;

      try {
        const camBuf = m.readMemoryRange(0x7E0112, 4);
        if (!camBuf || camBuf.length < 4) return null;
        const rawX = camBuf[0] | (camBuf[1] << 8);
        camX = rawX >= 0x8000 ? rawX - 0x10000 : rawX;
        const rawY = camBuf[2] | (camBuf[3] << 8);
        camY = rawY >= 0x8000 ? rawY - 0x10000 : rawY;
        bg1X = camX;
        bg1Y = camY;

        // BG1 (the canopy layer) scrolls from its own shadow. Most rooms copy
        // the camera into it; a parallax room feeds it from elsewhere
        // ($D09B7A: BG1 from $12/$14, BG2 from the camera $59/$5B).
        const bg1Buf = m.readMemoryRange(0x7E010E, 4);
        if (bg1Buf && bg1Buf.length >= 4) {
          const b1x = bg1Buf[0] | (bg1Buf[1] << 8);
          const b1y = bg1Buf[2] | (bg1Buf[3] << 8);
          bg1X = b1x >= 0x8000 ? b1x - 0x10000 : b1x;
          bg1Y = b1y >= 0x8000 ? b1y - 0x10000 : b1y;
        }

        const mapBuf = m.readMemoryRange(0x7E0ADB, 1);
        if (mapBuf && mapBuf.length >= 1) mapId = mapBuf[0];

        const offBuf = m.readMemoryRange(0x7E0F86, 4);
        if (offBuf && offBuf.length >= 4) {
          const rawOX = offBuf[0] | (offBuf[1] << 8);
          trigOffX = rawOX >= 0x8000 ? rawOX - 0x10000 : rawOX;
          const rawOY = offBuf[2] | (offBuf[3] << 8);
          trigOffY = rawOY >= 0x8000 ? rawOY - 0x10000 : rawOY;
        }

        // The PPU itself when the core exposes it: read before mainLoop() it is
        // exactly what this frame renders with. The game's own shadows run
        // ahead of the picture (the CGRAM mirror by a frame or more, through
        // the upload queue), which showed as the ring menu and death fades
        // landing early on the extended layers.
        const ppu = typeof m._getPpuView === 'function' ? m._getPpuView() : 0;
        if (ppu && typeof HEAPU8 !== 'undefined') {
          cgramBuf = HEAPU8.slice(ppu, ppu + 512);
          iniDisp = HEAPU8[ppu + 512];
          mainScreen = HEAPU8[ppu + 513];
        } else {
          const iniBuf = m.readMemoryRange(INIDISP_SHADOW, 1);
          if (iniBuf && iniBuf.length >= 1) iniDisp = iniBuf[0];
          // One frame behind the mirror is when it reaches CGRAM.
          cgramBuf = lastCgramMirror;
          lastCgramMirror = m.readMemoryRange(CGRAM_MIRROR, 512);
        }
        const effBuf = m.readMemoryRange(ROOM_EFFECT, 1);
        if (effBuf && effBuf.length >= 1) roomEffect = effBuf[0];

        entBuf = readMemoryChunked(m, 0x7E3DDF, 0x1220);
        palSlotBuf = m.readMemoryRange(0x7E1278, 16);
        projBuf = m.readMemoryRange(0x7E6387, 352);
        objStateBuf = m.readMemoryRange(0x7E10CE, 160);
        grassQueueBuf = m.readMemoryRange(0x7E0FD0, 148);
        animIdxBuf = m.readMemoryRange(ANIM_FRAME_INDEX_ADDR, ANIM_MAX_CHANNELS);
      } catch (_) {
        return null;
      }

      return {
        camX: camX,
        camY: camY,
        bg1X: bg1X,
        bg1Y: bg1Y,
        iniDisp: iniDisp,
        cgramBuf: cgramBuf,
        mainScreen: mainScreen,
        roomEffect: roomEffect,
        mapId: mapId,
        trigOffX: trigOffX,
        trigOffY: trigOffY,
        entBuf: entBuf,
        palSlotBuf: palSlotBuf,
        projBuf: projBuf,
        objStateBuf: objStateBuf,
        grassQueueBuf: grassQueueBuf,
        animIdxBuf: animIdxBuf,
      };
    }
