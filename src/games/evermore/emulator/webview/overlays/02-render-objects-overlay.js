// TODO port to TS (docs/todo/port-to-ts.md)

    function renderObjectsOverlay(overlayCtx, layout, objects, objStateBuf) {
      if (!overlayCtx || !objects || !objects.length) return;

      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        const tx = layout.emuX + (obj.x - layout.camX) * layout.scaleSnes;
        const ty = layout.emuY + (obj.y - layout.camY) * layout.scaleSnes;
        const tw = obj.w * layout.scaleSnes;
        const th = obj.h * layout.scaleSnes;

        if (tx + tw <= 0 || tx >= layout.wrapW || ty + th <= 0 || ty >= layout.wrapH) continue;

        const liveState = (objStateBuf && objStateBuf[obj.index]) || 0;

        // 1. Cluster area: soft blue tint and dashed blue border
        overlayCtx.fillStyle = 'rgba(41, 182, 246, 0.12)';
        overlayCtx.fillRect(tx, ty, tw, th);

        overlayCtx.strokeStyle = '#29b6f6';
        overlayCtx.lineWidth = 1;
        overlayCtx.setLineDash([Math.round(4 * layout.scaleSnes), Math.round(3 * layout.scaleSnes)]);
        overlayCtx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, th - 1);
        overlayCtx.setLineDash([]);

        // 2. Sub-frames / states
        if (obj.states && obj.states.length) {
          for (let s = 0; s < obj.states.length; s++) {
            const st = obj.states[s];
            const sx = layout.emuX + (st.x - layout.camX) * layout.scaleSnes;
            const sy = layout.emuY + (st.y - layout.camY) * layout.scaleSnes;
            const sw = st.w * layout.scaleSnes;
            const sh = st.h * layout.scaleSnes;

            if (sx + sw <= 0 || sx >= layout.wrapW || sy + sh <= 0 || sy >= layout.wrapH) continue;

            const isActive = (st.state === liveState && liveState > 0);
            if (isActive) {
              overlayCtx.fillStyle = 'rgba(41, 182, 246, 0.2)';
              overlayCtx.fillRect(sx, sy, sw, sh);
              overlayCtx.strokeStyle = '#29b6f6';
              overlayCtx.lineWidth = 1.5;
              overlayCtx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
            } else {
              overlayCtx.strokeStyle = 'rgba(41, 182, 246, 0.4)';
              overlayCtx.lineWidth = 1;
              overlayCtx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
            }
          }
        }

        // 3. Object ID label in top-right corner
        const label = liveState > 0 ? ('OBJ ' + obj.index + ':' + liveState) : ('OBJ ' + obj.index);
        overlayCtx.font = '10px monospace';
        const textW = overlayCtx.measureText(label).width;
        let labelX = tx + tw - textW - 4;
        if (labelX < tx + 2) labelX = tx + 2;
        const labelY = ty + 10;

        overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        overlayCtx.fillRect(labelX - 1, labelY - 9, textW + 2, 11);
        overlayCtx.fillStyle = '#29b6f6';
        overlayCtx.fillText(label, labelX, labelY);
      }
    }

    function renderAnimTilesOverlay(overlayCtx, layout, animTiles) {
      if (!overlayCtx || !animTiles || !animTiles.length) return;

      const u = 16 * layout.scaleSnes;

      for (let i = 0; i < animTiles.length; i++) {
        const cluster = animTiles[i];
        if (!cluster.cells || !cluster.cells.length) continue;

        const bx = layout.emuX + (cluster.bbox.x - layout.camX) * layout.scaleSnes;
        const by = layout.emuY + (cluster.bbox.y - layout.camY) * layout.scaleSnes;
        const bw = cluster.bbox.w * layout.scaleSnes;
        const bh = cluster.bbox.h * layout.scaleSnes;
        if (bx + bw <= 0 || bx >= layout.wrapW || by + bh <= 0 || by >= layout.wrapH) continue;

        // 1. Soft purple fill on each cell
        overlayCtx.fillStyle = 'rgba(191, 85, 236, 0.15)';
        for (let j = 0; j < cluster.cells.length; j++) {
          const c = cluster.cells[j];
          const cx = layout.emuX + (c.x - layout.camX) * layout.scaleSnes;
          const cy = layout.emuY + (c.y - layout.camY) * layout.scaleSnes;
          overlayCtx.fillRect(cx, cy, u, u);
        }

        // 2. Contour outline edges
        const coordSet = new Set();
        for (let j = 0; j < cluster.cellCoords.length; j++) {
          coordSet.add(cluster.cellCoords[j].x + ',' + cluster.cellCoords[j].y);
        }

        overlayCtx.strokeStyle = '#bf55ec';
        overlayCtx.lineWidth = Math.max(1, Math.round(1.5 * layout.scaleSnes));
        overlayCtx.beginPath();
        for (let j = 0; j < cluster.cellCoords.length; j++) {
          const cc = cluster.cellCoords[j];
          const cx = layout.emuX + (cc.x * 16 - layout.camX) * layout.scaleSnes;
          const cy = layout.emuY + (cc.y * 16 - layout.camY) * layout.scaleSnes;

          if (!coordSet.has(cc.x + ',' + (cc.y - 1))) {
            overlayCtx.moveTo(cx, cy);
            overlayCtx.lineTo(cx + u, cy);
          }
          if (!coordSet.has(cc.x + ',' + (cc.y + 1))) {
            overlayCtx.moveTo(cx, cy + u);
            overlayCtx.lineTo(cx + u, cy + u);
          }
          if (!coordSet.has((cc.x - 1) + ',' + cc.y)) {
            overlayCtx.moveTo(cx, cy);
            overlayCtx.lineTo(cx, cy + u);
          }
          if (!coordSet.has((cc.x + 1) + ',' + cc.y)) {
            overlayCtx.moveTo(cx + u, cy);
            overlayCtx.lineTo(cx + u, cy + u);
          }
        }
        overlayCtx.stroke();

        // 3. Non-rectangular dotted bounding box
        if (!cluster.isRect) {
          overlayCtx.save();
          overlayCtx.strokeStyle = 'rgba(191, 85, 236, 0.5)';
          overlayCtx.lineWidth = 1;
          overlayCtx.setLineDash([Math.round(3 * layout.scaleSnes), Math.round(2 * layout.scaleSnes)]);
          overlayCtx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
          overlayCtx.restore();
        }

        // 4. Pattern letter badge in top-left cell of the cluster
        if (cluster.letter && cluster.first) {
          const fx = layout.emuX + (cluster.first.x - layout.camX) * layout.scaleSnes;
          const fy = layout.emuY + (cluster.first.y - layout.camY) * layout.scaleSnes;

          overlayCtx.font = 'bold 10px monospace';
          const textW = overlayCtx.measureText(cluster.letter).width;
          const labelX = fx + 2;
          const labelY = fy + 10;

          overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
          overlayCtx.fillRect(labelX - 1, labelY - 9, textW + 2, 11);
          overlayCtx.fillStyle = '#bf55ec';
          overlayCtx.fillText(cluster.letter, labelX, labelY);
        }
      }
    }

    function renderCollisionOverlay(overlayCtx, layout, preState, roomMap, cachedImg, cachedId) {
      if (!overlayCtx || !preState) return;
      const cImg = (roomMap && roomMap.mapId === preState.mapId && roomMap.collisionImg)
        || (cachedImg && cachedId === preState.mapId ? cachedImg : null);
      if (!cImg || !cImg.complete || !cImg.naturalWidth) return;
      const mapWidth = (roomMap && roomMap.width) || (cImg.naturalWidth / 2);
      const mapHeight = (roomMap && roomMap.height) || (cImg.naturalHeight / 2);
      const mapX = layout.emuX - layout.camX * layout.scaleSnes;
      const mapY = layout.emuY - (layout.camY + 1) * layout.scaleSnes;
      const mapW = mapWidth * layout.scaleSnes;
      const mapH = mapHeight * layout.scaleSnes;
      overlayCtx.imageSmoothingEnabled = false;
      overlayCtx.drawImage(cImg, mapX, mapY, mapW, mapH);
    }

    // -- ROM bus address -> file offset (the name text) --------------------------
    function snesToRom(snes) { return snes & 0x3fffff; }

    function renderHpAndStaminaBarsOverlay(overlayCtx, layout, preState) {
      if (!overlayCtx || (!thinHpBarEnabled && !thinStaminaBarEnabled)) return;
      if (!preState || !preState.entBuf) return;
      const buf = preState.entBuf;
      const entities = entityAddresses(buf);
      const rom = (loadedRomData && loadedRomData.length % 1024 === 512) ? loadedRomData.subarray(512) : loadedRomData;

      for (let i = 0; i < entities.length; i++) {
        const addr = entities[i];
        const rel = addr - 0x3DDF;
        if (rel < 0 || rel + 0x70 > buf.length) continue;

        const isBoy = (addr === 0x4E89);
        const isDog = (addr === 0x4F37);

        const hideFlags = buf[rel + 0x12] | (buf[rel + 0x13] << 8);
        if (hideFlags & 0x8000) continue;

        const hp = buf[rel + 0x2A] | (buf[rel + 0x2B] << 8);
        if (hp <= 0 && !isBoy && !isDog) continue;

        const rawX = buf[rel + 0x1A] | (buf[rel + 0x1B] << 8);
        const posX = rawX >= 0x8000 ? rawX - 0x10000 : rawX;
        const rawY = buf[rel + 0x1C] | (buf[rel + 0x1D] << 8);
        const posY = rawY >= 0x8000 ? rawY - 0x10000 : rawY;
        const rawZ = buf[rel + 0x1E] | (buf[rel + 0x1F] << 8);
        const posZ = rawZ >= 0x8000 ? rawZ - 0x10000 : rawZ;

        const onBg1 = preState.roomEffect === 2 && (buf[rel + 0x18] & 0x30) === 0;
        const refX = onBg1 ? preState.bg1X : layout.camX;
        const refY = onBg1 ? preState.bg1Y - 2 : layout.camY;

        const screenX = layout.emuX + (posX - refX) * layout.scaleSnes;
        const screenY = layout.emuY + (posY - Math.floor(posZ / 16) - refY) * layout.scaleSnes;

        let maxHp = 0;
        const m = (typeof getModule === 'function') ? getModule() : null;
        if (isBoy) {
          if (m && typeof m.readMemory === 'function') {
            maxHp = (m.readMemory(0x7E0A35) || 0) | ((m.readMemory(0x7E0A36) || 0) << 8);
          } else if (preState.wram && preState.wram.length > 0x0A36) {
            maxHp = preState.wram[0x0A35] | (preState.wram[0x0A36] << 8);
          }
          if (!maxHp) maxHp = Math.max(hp, 1);
        } else if (isDog) {
          if (m && typeof m.readMemory === 'function') {
            maxHp = (m.readMemory(0x7E0A7F) || 0) | ((m.readMemory(0x7E0A80) || 0) << 8);
          } else if (preState.wram && preState.wram.length > 0x0A80) {
            maxHp = preState.wram[0x0A7F] | (preState.wram[0x0A80] << 8);
          }
          if (!maxHp) maxHp = Math.max(hp, 1);
        } else {
          const stype = buf[rel + 0x60] | (buf[rel + 0x61] << 8);
          if (stype >= 0x8000 && rom) {
            maxHp = EvsRom.entityRecordWord(rom, stype, EvsRom.RECORD_FIELDS.hp);
          }
          if (!maxHp || maxHp < hp) maxHp = Math.max(hp, 1);
        }

        const stamina = buf[rel + 0x2E] | (buf[rel + 0x2F] << 8);
        const maxStamina = Math.max(0x400, stamina);

        const headOffset = (isDog ? 28 : 42) * layout.scaleSnes;
        const barW = Math.max(18, Math.round(24 * layout.scaleSnes));
        const barH = Math.max(2, Math.round(2.5 * layout.scaleSnes));
        const barX = Math.round(screenX - barW / 2);
        let barY = Math.round(screenY - headOffset);

        if (barX + barW < 0 || barX > layout.wrapW || barY + 10 < 0 || barY > layout.wrapH) continue;

        if (thinHpBarEnabled && maxHp > 0) {
          overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          overlayCtx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
          const ratio = Math.max(0, Math.min(1, hp / maxHp));
          const fillW = Math.round(barW * ratio);
          const color = ratio > 0.5 ? '#4caf50' : (ratio > 0.2 ? '#ff9800' : '#f44336');
          overlayCtx.fillStyle = color;
          overlayCtx.fillRect(barX, barY, fillW, barH);
          barY += barH + 2;
        }

        if (thinStaminaBarEnabled && (isBoy || isDog || stamina > 0)) {
          // Check if character has multi-tier attacks (>1 attack animations)
          let attackAnimsCount = (isBoy || isDog) ? 4 : 0;
          if (!attackAnimsCount && rom) {
            const stype = buf[rel + 0x60] | (buf[rel + 0x61] << 8);
            if (stype >= 0x8000) {
              for (const field of EvsRom.ATTACK_FIELDS) if (EvsRom.entityRecordWord(rom, stype, field)) attackAnimsCount++;
            }
          }

          const isMultiAttack = (attackAnimsCount > 1) || (maxStamina > 0x400);
          const sH = Math.max(1.5, Math.round(2 * layout.scaleSnes));
          overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          overlayCtx.fillRect(barX - 1, barY - 1, barW + 2, sH + 2);

          if (isMultiAttack) {
            // Complex colored stamina bar:
            // Tiers: Tier 0 (< 100% / $400), Tier 1 (100%..199% / $400..$7FF), Tier 2 (200%..299% / $800..$BFF), Tier 3 (>= 300% / $C00)
            // Color palettes with distinct charging vs charged tints:
            // Tier 0: < $200 (0..49%): soft cyan (#00b0ff), $200..$3FF (50..99%): vibrant cyan (#00e5ff)
            // Tier 1: $400 (charged 100%): bright lime (#aeea00), $401..$7FF (charging Lvl 2): lime green (#76ff03)
            // Tier 2: $800 (charged 200%): golden yellow (#ffd600), $801..$BFF (charging Lvl 3): bright amber (#ffab00)
            // Tier 3: >= $C00 (charged 300% max): blazing radiant orange-red (#ff3d00)
            let sColor = '#00b0ff';
            if (stamina >= 0xC00) {
              sColor = '#ff3d00'; // Blazing red-orange
            } else if (stamina >= 0x800) {
              sColor = (stamina === 0x800) ? '#ffd600' : '#ffab00'; // Gold tier
            } else if (stamina >= 0x400) {
              sColor = (stamina === 0x400) ? '#aeea00' : '#76ff03'; // Lime tier
            } else if (stamina >= 0x200) {
              sColor = '#00e5ff'; // Vibrant cyan (50-99%)
            } else {
              sColor = '#00b0ff'; // Sky blue (0-49%)
            }

            const sRatio = Math.max(0, Math.min(1, stamina / maxStamina));
            const sFillW = Math.round(barW * sRatio);
            overlayCtx.fillStyle = sColor;
            overlayCtx.fillRect(barX, barY, sFillW, sH);

            // Subtle tier tick dividers at 100% ($400) and 200% ($800) if bar is wide enough
            if (maxStamina > 0x400 && barW >= 20) {
              overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
              const tick1 = Math.round(barW * (0x400 / maxStamina));
              if (tick1 > 2 && tick1 < barW - 2) overlayCtx.fillRect(barX + tick1, barY, 1, sH);
              if (maxStamina >= 0xC00) {
                const tick2 = Math.round(barW * (0x800 / maxStamina));
                if (tick2 > 2 && tick2 < barW - 2) overlayCtx.fillRect(barX + tick2, barY, 1, sH);
              }
            }
          } else {
            const sRatio = Math.max(0, Math.min(1, stamina / maxStamina));
            const sFillW = Math.round(barW * sRatio);
            const sColor = sRatio >= 1.0 ? '#ffeb3b' : '#00e5ff';
            overlayCtx.fillStyle = sColor;
            overlayCtx.fillRect(barX, barY, sFillW, sH);
          }
        }
      }
    }
