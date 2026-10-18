
    function handleMapInspectClick(worldX, worldY, mouseX, mouseY) {
      if (lastSampledPreState && lastSampledPreState.entBuf) {
        const buf = lastSampledPreState.entBuf;
        const entities = entityAddresses(buf);
        for (let i = 0; i < entities.length; i++) {
          const addr = entities[i];
          const rel = addr - 0x3DDF;
          if (rel < 0 || rel + 0x70 > buf.length) continue;
          const hideFlags = buf[rel + 0x12] | (buf[rel + 0x13] << 8);
          if (hideFlags & 0x8000) continue;
          const rawX = buf[rel + 0x1A] | (buf[rel + 0x1B] << 8);
          const posX = rawX >= 0x8000 ? rawX - 0x10000 : rawX;
          const rawY = buf[rel + 0x1C] | (buf[rel + 0x1D] << 8);
          const posY = rawY >= 0x8000 ? rawY - 0x10000 : rawY;
          if (Math.abs(worldX - posX) <= 18 && worldY >= posY - 36 && worldY <= posY + 8) {
            openCharacterInspector(addr);
            return true;
          }
        }
      }

      if (cachedTriggers) {
        const tOffX = (lastLayout && lastLayout.trigOffX) || 0;
        const tOffY = (lastLayout && lastLayout.trigOffY) || 0;
        const bList = cachedTriggers.bTrigger || [];
        for (let i = 0; i < bList.length; i++) {
          const box = calculateTriggerBox(bList[i], tOffX, tOffY, (lastLayout ? lastLayout.camX : 0), (lastLayout ? lastLayout.camY : 0));
          if (worldX >= box.posX && worldX <= box.posX + box.boxW && worldY >= box.posY && worldY <= box.posY + box.boxH) {
            openTriggerInspector('B-Trigger', bList[i], i);
            return true;
          }
        }
        const sList = cachedTriggers.stepOn || [];
        for (let i = 0; i < sList.length; i++) {
          const box = calculateTriggerBox(sList[i], tOffX, tOffY, (lastLayout ? lastLayout.camX : 0), (lastLayout ? lastLayout.camY : 0));
          if (worldX >= box.posX && worldX <= box.posX + box.boxW && worldY >= box.posY && worldY <= box.posY + box.boxH) {
            openTriggerInspector('Step-on', sList[i], i);
            return true;
          }
        }
      }

      if (cachedObjects && cachedObjects.length) {
        for (let i = 0; i < cachedObjects.length; i++) {
          const obj = cachedObjects[i];
          if (worldX >= obj.x && worldX <= obj.x + obj.w && worldY >= obj.y && worldY <= obj.y + obj.h) {
            openObjectInspector(obj);
            return true;
          }
        }
      }

      closeInspector();
      return false;
    }

    // The sprite and record readers are the host's (maps/sprites.ts, maps/character-record.ts), bundled for the page
    // as EvsRom (dist/webview/evermore-rom.js, a page file from host.js webviewFiles()).
    const { readSpriteInfo, composeSprite } = typeof EvsRom !== 'undefined' ? EvsRom : {};

    function paletteAt(rom, palAddr) {
      return EvsRom.paletteAt(rom, (palAddr && palAddr > 0) ? palAddr : 0xad0b);
    }

    const spriteCache = new Map();

    // The 16 colours of OBJ palette pal (0..7) in the engine's CGRAM mirror.
    function liveObjPalette(cg, pal) {
      const out = [];
      const base = 256 + (pal & 7) * 32;
      for (let i = 0; i < 16; i++) out.push(EvsRom.bgr555(cg[base + i * 2] | (cg[base + i * 2 + 1] << 8)));
      return out;
    }

    // live: { cg, slot } - draw from the colours the engine has actually
    // loaded in the entity's OBJ slot (and slot + a chunk's palette bits).
    // That is right for palettes an animation script loads (placeholder
    // effects), the ring menu's greyed enemies, flashes; the ROM address in
    // $7E1278 is only the fallback.
    function getDecodedSprite(rom, spritePtr, palAddr, live) {
      let key = spritePtr + '_' + (palAddr || 0xad0b);
      let livePals = null;
      if (live && live.cg && live.cg.length >= 512) {
        const first = (live.slot >> 1) & 7;
        livePals = [];
        let sig = '';
        for (let k = 0; k < 2; k++) {
          const pal = (first + k) & 7;
          livePals.push(liveObjPalette(live.cg, pal));
          const base = 256 + pal * 32;
          for (let i = 2; i < 32; i++) sig += live.cg[base + i].toString(16);
        }
        key = spritePtr + '_L' + first + '_' + sig;
      }
      if (spriteCache.has(key)) return spriteCache.get(key);

      try {
        const info = readSpriteInfo(rom, spritePtr);
        if (!info || !info.chunks || info.chunks.length === 0) {
          spriteCache.set(key, null);
          return null;
        }
        const comp = composeSprite(rom, info);
        if (!comp || comp.width <= 0 || comp.height <= 0) {
          spriteCache.set(key, null);
          return null;
        }
        const palette = paletteAt(rom, palAddr);
        const offCanvas = document.createElement('canvas');
        offCanvas.width = comp.width;
        offCanvas.height = comp.height;
        const offCtx = offCanvas.getContext('2d');
        const imgData = offCtx.createImageData(comp.width, comp.height);
        const data = imgData.data;
        const total = comp.width * comp.height;
        for (let i = 0; i < total; i++) {
          const v = comp.pixels[i];
          if (v > 0) {
            const pal = livePals ? (livePals[comp.palettes[i] ? 1 : 0]) : palette;
            const col = pal[v] || [255, 255, 255];
            const dst = i * 4;
            data[dst] = col[0];
            data[dst + 1] = col[1];
            data[dst + 2] = col[2];
            data[dst + 3] = 255;
          }
        }
        offCtx.putImageData(imgData, 0, 0);
        const res = {
          canvas: offCanvas,
          originX: comp.originX,
          originY: comp.originY,
          width: comp.width,
          height: comp.height,
        };
        if (spriteCache.size > 256) spriteCache.clear();
        spriteCache.set(key, res);
        return res;
      } catch (_) {
        spriteCache.set(key, null);
        return null;
      }
    }

    // Port of $8FC773 (src/games/evermore/maps/collision.ts spriteDepth): an entity's OAM
    // priority comes from the collision word of the tile under its feet, which
    // $8FAFE5 caches at +0x3C, against its own plane at +0x18. Priority 3
    // draws over the canopy, priority 2 under it, gate nibble 8 not at all.
    function entityDepth(buf, rel) {
      const cw = buf[rel + 0x3C] | (buf[rel + 0x3D] << 8);
      if (((cw ^ 0x0800) & 0x0F00) === 0) return 'hidden';
      const tilePlane = cw & 0x30;
      const ownPlane = buf[rel + 0x18] & 0x30;
      if (ownPlane !== tilePlane) return ownPlane < tilePlane ? 'front' : 'behind';
      return (cw & 0x1000) ? 'front' : 'behind';
    }

    function drawEntityItems(ctx, items) {
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.isOrb) {
          ctx.save();
          const grad = ctx.createRadialGradient(item.x, item.y, 1, item.x, item.y, item.rad);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.4, '#ffea75');
          grad.addColorStop(1, 'rgba(255, 120, 0, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.drawImage(item.canvas, item.x, item.y, item.w, item.h);
        }
      }
    }
