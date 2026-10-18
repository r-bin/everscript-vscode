
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

    const POOL_LARGE = { pointers: 0xec0000, data: 0xd90000, size: 16 };
    const POOL_SMALL = { pointers: 0xd80000, data: 0xd10000, size: 8 };

    function blockBytes(rom, index, pool) {
      const raw = readRom24(rom, snesToRom(pool.pointers + index * 3));
      const compressed = (raw >>> 23) & 1;
      const addr = ((raw & ~(1 << 23)) >>> 0) + pool.data;
      const sub = pool.size / 8;
      const length = (8 * 8 * sub * sub) / 2;
      const out = new Uint8Array(length);
      if (!compressed) {
        for (let i = 0; i < length; i++) out[i] = atRom(rom, addr + i);
        return out;
      }
      let src = addr;
      let dst = 0;
      for (let group = 0; group < length / 16; group++) {
        let bits = atRom(rom, src++);
        for (let bit = 0; bit < 8; bit++, bits >>= 1) {
          if (bits & 1) { dst += 2; continue; }
          out[dst++] = atRom(rom, src++);
          out[dst++] = atRom(rom, src++);
        }
      }
      return out;
    }

    function decodeSpriteBlock(rom, index, large) {
      const pool = large ? POOL_LARGE : POOL_SMALL;
      const d = blockBytes(rom, index, pool);
      const sub = pool.size / 8;
      const pixels = new Uint8Array(pool.size * pool.size);
      let n = 0;
      for (let l = 0; l < sub; l++) {
        for (let row = 0; row < 8; row++) {
          for (let j = 0; j < sub; j++) {
            const base = (j + 2 * l) * 32 + row * 2;
            for (let bit = 7; bit >= 0; bit--) {
              let p = 0;
              if (d[base + 0] & (1 << bit)) p |= 1;
              if (d[base + 1] & (1 << bit)) p |= 2;
              if (d[base + 16] & (1 << bit)) p |= 4;
              if (d[base + 17] & (1 << bit)) p |= 8;
              pixels[n++] = p;
            }
          }
        }
      }
      return { size: pool.size, pixels: pixels };
    }

    function readSpriteInfo(rom, address) {
      const count = atRom(rom, address);
      const dataOffset = atRom(rom, address + 1);
      const chunks = [];
      let cursor = address;
      for (let n = 0; n < count; n++) {
        const c = cursor + dataOffset;
        const flags = atRom(rom, c);
        chunks.push({
          flags: flags,
          x: (atRom(rom, c + 1) << 24) >> 24,
          y: (atRom(rom, c + 2) << 24) >> 24,
          block: atRom(rom, c + 3) | (atRom(rom, c + 4) << 8),
          large: (flags & 1) !== 0,
          flipX: (flags & 0x40) !== 0,
          flipY: (flags & 0x80) !== 0,
          priority: (flags & 0x30) >> 4,
          palette: (flags & 0x0e) >> 1,
        });
        cursor += 5;
      }
      return { address: address, chunks: chunks, size: dataOffset + count * 5 };
    }

    function composeSprite(rom, info) {
      let minX = 0, minY = 0, maxX = 1, maxY = 1;
      for (let i = 0; i < info.chunks.length; i++) {
        const c = info.chunks[i];
        const s = c.large ? 16 : 8;
        if (c.x < minX) minX = c.x;
        if (c.y < minY) minY = c.y;
        if (c.x + s > maxX) maxX = c.x + s;
        if (c.y + s > maxY) maxY = c.y + s;
      }
      const width = maxX - minX;
      const height = maxY - minY;
      const pixels = new Int16Array(width * height).fill(-1);
      // Each pixel's chunk palette bits (OAM palette = entity slot + these).
      const pals = new Uint8Array(width * height);
      for (let priority = 0; priority < 4; priority++) {
        for (let i = info.chunks.length - 1; i >= 0; i--) {
          const c = info.chunks[i];
          if (c.priority !== priority) continue;
          const b = decodeSpriteBlock(rom, c.block, c.large);
          for (let y = 0; y < b.size; y++) {
            for (let x = 0; x < b.size; x++) {
              const sx = c.flipX ? b.size - 1 - x : x;
              const sy = c.flipY ? b.size - 1 - y : y;
              const v = b.pixels[sy * b.size + sx];
              if (!v) continue;
              const px = c.x - minX + x;
              const py = c.y - minY + y;
              if (px < 0 || py < 0 || px >= width || py >= height) continue;
              pixels[py * width + px] = v;
              pals[py * width + px] = c.palette;
            }
          }
        }
      }
      return { width: width, height: height, pixels: pixels, pals: pals, originX: -minX, originY: -minY };
    }

    function paletteAt(rom, palAddr) {
      const addr = (palAddr && palAddr > 0) ? palAddr : 0xad0b;
      const base = snesToRom(0x900000 | addr);
      const out = [];
      for (let i = 0; i < 16; i++) {
        const off = base + i * 2;
        if (off + 2 <= rom.length) {
          const c = rom[off] | (rom[off + 1] << 8);
          out.push([
            (c & 31) * 8,
            ((c >> 5) & 31) * 8,
            ((c >> 10) & 31) * 8,
          ]);
        } else {
          out.push([0, 0, 0]);
        }
      }
      return out;
    }

    function characterPalette(rom, characterOrPal) {
      if (typeof characterOrPal === 'number' && characterOrPal > 256) {
        return paletteAt(rom, characterOrPal);
      }
      const CHARACTER_TABLE = 0x8eb678;
      const CHARACTER_STRIDE = 74;
      let addr = 0xad0b;
      try {
        const recOffset = snesToRom(CHARACTER_TABLE + (characterOrPal || 0) * CHARACTER_STRIDE + 0x09);
        if (recOffset >= 0 && recOffset + 2 <= rom.length) {
          addr = rom[recOffset] | (rom[recOffset + 1] << 8);
        }
      } catch (_) {}
      return paletteAt(rom, addr);
    }

    const spriteCache = new Map();

    // The 16 colours of OBJ palette pal (0..7) in the engine's CGRAM mirror.
    function liveObjPalette(cg, pal) {
      const out = [];
      const base = 256 + (pal & 7) * 32;
      for (let i = 0; i < 16; i++) {
        const c = cg[base + i * 2] | (cg[base + i * 2 + 1] << 8);
        out.push([(c & 31) * 8, ((c >> 5) & 31) * 8, ((c >> 10) & 31) * 8]);
      }
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
            const pal = livePals ? (livePals[comp.pals[i] ? 1 : 0]) : palette;
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
