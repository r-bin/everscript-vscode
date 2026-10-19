// TODO port to TS (docs/todo/port-to-ts.md)

    // The engine's INIDISP shadow (NMI copies it to $2100): bit 7 forced
    // blank, low nibble brightness. Room loads and fade_in()/fade_out() and
    // dying go through it.
    const INIDISP_SHADOW = 0x7E0106;
    // The engine's CGRAM mirror (512 bytes, DMA'd to CGRAM). The ring menu
    // halves every colour here rather than using colour math.
    const CGRAM_MIRROR = 0x7E6187;
    // Room header byte 8. Effect 2 ($D09BA7) scrolls BG1 on its own, and
    // $8FC7E8 then places plane-0 characters against BG1, not the camera.
    const ROOM_EFFECT = 0x7E241F;
    let lastCgramMirror = null;

    function bgr15(v) { return [v & 31, (v >> 5) & 31, (v >> 10) & 31]; }
    function median(a) {
      if (!a.length) return 1;
      a.sort((x, y) => x - y);
      return a[a.length >> 1];
    }

    // INIDISP brightness, 0..1 (0 in forced blank). It darkens everything the
    // PPU outputs, so it goes on every extended canvas.
    function screenBrightness(preState) {
      const ini = preState.iniDisp;
      return (ini & 0x80) ? 0 : (ini & 0x0F) / 15;
    }

    // How the BG colours are dimmed/greyed relative to the room's own: the
    // median ratio of the CGRAM mirror against the room palette (colours the
    // room defines only, so engine-loaded sub-palettes and a few cycling
    // colours do not count). Sprites need none of this: they are drawn from
    // the live mirror already.
    function paletteTint(preState, roomPalette) {
      let brightness = 1;
      let saturate = 1;
      const cg = preState.cgramBuf;
      if (cg && cg.length >= 256 && roomPalette && roomPalette.length >= 128) {
        const lum = [];
        const chroma = [];
        for (let c = 16; c < 128; c++) {
          if (!(c & 15)) continue; // colour 0 of a sub-palette is transparent
          const want = bgr15(roomPalette[c]);
          const wantSum = want[0] + want[1] + want[2];
          if (wantSum < 6) continue;
          const have = bgr15(cg[c * 2] | (cg[c * 2 + 1] << 8));
          const haveSum = have[0] + have[1] + have[2];
          const r = haveSum / wantSum;
          lum.push(r);
          const wantChroma = Math.max(want[0], want[1], want[2]) - Math.min(want[0], want[1], want[2]);
          if (wantChroma >= 4 && r > 0.05) {
            const haveChroma = Math.max(have[0], have[1], have[2]) - Math.min(have[0], have[1], have[2]);
            chroma.push(haveChroma / (wantChroma * r));
          }
        }
        // Too few comparable colours (a room with no palette yet): no claim.
        if (lum.length >= 8) {
          brightness = Math.min(1.5, median(lum));
          if (chroma.length >= 8) saturate = Math.min(1.5, median(chroma));
        }
      }
      return { brightness: brightness, saturate: saturate };
    }

    function tintFilter(brightness, saturate) {
      const b = Math.round(brightness * 100) / 100;
      const sat = Math.round(saturate * 100) / 100;
      return (b >= 0.99 && b <= 1.01 && sat >= 0.97 && sat <= 1.03) ? 'none' : 'brightness(' + b + ') saturate(' + sat + ')';
    }

    let lastBrightnessFilter = '';
    function applyScreenBrightness(brightness, canvases) {
      const f = tintFilter(brightness, 1);
      const filter = f === 'none' ? '' : f;
      if (filter === lastBrightnessFilter) return;
      lastBrightnessFilter = filter;
      for (let i = 0; i < canvases.length; i++) if (canvases[i]) canvases[i].style.filter = filter;
    }

    function applyCanvasLayersFilter(brightness, tint, mapCanvas, fgCanvas, entCanvas) {
      const b = (typeof brightness === 'number') ? brightness : 1;
      const t = tint || { brightness: 1, saturate: 1 };
      const mapF = tintFilter(b * t.brightness, t.saturate);
      const mapFilterStr = mapF === 'none' ? '' : mapF;
      const entF = tintFilter(b, 1);
      const entFilterStr = entF === 'none' ? '' : entF;

      if (mapCanvas && mapCanvas.style.filter !== mapFilterStr) mapCanvas.style.filter = mapFilterStr;
      if (fgCanvas && fgCanvas.style.filter !== mapFilterStr) fgCanvas.style.filter = mapFilterStr;
      if (entCanvas && entCanvas.style.filter !== entFilterStr) entCanvas.style.filter = entFilterStr;
    }

    // The engine's per-channel animation state: frame index at $7E4FE6 + ch,
    // countdown at $7E5018 + ch (found by watching WRAM; the holds match the
    // decoded delays). Stepping from it keeps the extension in phase with the
    // screen, and still where the engine has paused a channel.
    const ANIM_FRAME_INDEX_ADDR = 0x7E4FE6;
    const ANIM_MAX_CHANNELS     = 0x32;

    // A group's frames step through the lcm of its channels' frame counts, so
    // the step is the one whose position in every channel matches the engine.
    function animGroupStep(grp, idxBuf) {
      const chans = grp.channels;
      if (!idxBuf || !chans || !chans.length) return 0;
      const steps = grp.frames.length;
      for (let s = 0; s < steps; s++) {
        let ok = true;
        for (let i = 0; i < chans.length; i++) {
          if (s % (grp.chanLens[i] || 1) !== idxBuf[chans[i]]) { ok = false; break; }
        }
        if (ok) return s;
      }
      // Channels out of step with each other (or capped steps): follow the first.
      return idxBuf[chans[0]] % steps;
    }

    function renderExtendedMapAndOverlays(preState, canvas, extMapCanvas, extMapCtx, extEntCanvas, extEntCtx, extFgCanvas, extFgCtx, extOverCanvas, extOverCtx) {
      if (!preState || !loadedRomData) {
        if (extOverCtx && extOverCanvas) extOverCtx.clearRect(0, 0, extOverCanvas.width, extOverCanvas.height);
        if (extFgCtx && extFgCanvas) extFgCtx.clearRect(0, 0, extFgCanvas.width, extFgCanvas.height);
        if (extEntCtx && extEntCanvas) extEntCtx.clearRect(0, 0, extEntCanvas.width, extEntCanvas.height);
        if (extMapCtx && extMapCanvas) extMapCtx.clearRect(0, 0, extMapCanvas.width, extMapCanvas.height);
        return;
      }

      const camX = preState.camX;
      const camY = preState.camY;
      const mapId = preState.mapId;
      let trigOffX = preState.trigOffX;
      let trigOffY = preState.trigOffY;

      if (mapId < 0 || mapId > 0x90) {
        if (extOverCtx && extOverCanvas) extOverCtx.clearRect(0, 0, extOverCanvas.width, extOverCanvas.height);
        if (extFgCtx && extFgCanvas) extFgCtx.clearRect(0, 0, extFgCanvas.width, extFgCanvas.height);
        if (extEntCtx && extEntCanvas) extEntCtx.clearRect(0, 0, extEntCanvas.width, extEntCanvas.height);
        if (extMapCtx && extMapCanvas) extMapCtx.clearRect(0, 0, extMapCanvas.width, extMapCanvas.height);
        return;
      }

      if (mapId !== cachedMapId) {
        cachedMapId = mapId;
        cachedTriggers = parseRoomTriggers(loadedRomData, mapId);
        lastStepOnScriptId = 0xFFFF;
        lastStepOnIndex = -1;
        cachedObjects = roomObjectsCache.get(mapId) || null;
        cachedLootables = roomLootCache.get(mapId) || null;
        cachedAnimTiles = roomAnimTilesCache.get(mapId) || null;
        cachedCollisionImg = roomCollisionCache.get(mapId) || null;
        cachedOverlayImg = roomOverlayCache.get(mapId) || null;
        spriteCache.clear();
        cutGrassTileSet.clear();
        lastRequestedObjKey = '';
        lastRequestedGrassKey = '';
        roomParallax = false;
      }

      // Parallax: BG1 off the camera. A 16-bit wrap or a masked mode would
      // give a huge offset; that is not a room scrolling, so it is ignored.
      const bg1DX = (preState.bg1X ?? camX) - camX;
      const bg1DY = (preState.bg1Y ?? camY) - camY;
      if ((bg1DX || bg1DY) && Math.abs(bg1DX) < 0x1000 && Math.abs(bg1DY) < 0x1000) roomParallax = true;

      let objectStates = null;
      let objKey = '';
      if (preState.objStateBuf) {
        const mapObj = {};
        let anyObj = false;
        for (let o = 0; o < preState.objStateBuf.length; o++) {
          const val = preState.objStateBuf[o];
          if (val > 0) {
            mapObj[o] = val;
            anyObj = true;
          }
        }
        if (anyObj) {
          objectStates = mapObj;
          objKey = JSON.stringify(objectStates);
        }
      }

      if (preState.grassQueueBuf) {
        const gbuf = preState.grassQueueBuf;
        for (let s = 0; s < 24; s++) {
          const cur = gbuf[2 + s];
          if (cur > 0) {
            const tx = gbuf[0x62 + s * 2];
            const ty = gbuf[0x63 + s * 2];
            cutGrassTileSet.add(tx + ',' + ty);
          }
        }
      }
      const cutTiles = cutGrassTileSet.size > 0 ? Array.from(cutGrassTileSet) : null;
      const grassKey = cutTiles ? cutTiles.sort().join(';') : '';

      if (mapId !== lastRequestedMapId) {
        objectStates = null;
        objKey = '';
      }

      if (mapId !== lastRequestedMapId || objKey !== lastRequestedObjKey || grassKey !== lastRequestedGrassKey || roomParallax !== lastRequestedLayered) {
        lastRequestedMapId = mapId;
        lastRequestedObjKey = objKey;
        lastRequestedGrassKey = grassKey;
        lastRequestedLayered = roomParallax;
        if (vscodeApi) {
          vscodeApi.postMessage({
            command: 'requestRoomMap',
            mapId: mapId,
            objectStates: objectStates,
            cutGrassTiles: cutTiles,
            layered: roomParallax,
          });
        }
      }

      if (cachedTriggers && trigOffX === 0 && trigOffY === 0 && (cachedTriggers.offX || cachedTriggers.offY)) {
        trigOffX = cachedTriggers.offX;
        trigOffY = cachedTriggers.offY;
      }

      const wrapW = extMapCanvas ? extMapCanvas.width : (canvas.parentElement ? canvas.parentElement.clientWidth : 512);
      const wrapH = extMapCanvas ? extMapCanvas.height : (canvas.parentElement ? canvas.parentElement.clientHeight : 448);
      const emuW = parseFloat(canvas.style.width) || 512;
      const emuH = parseFloat(canvas.style.height) || 448;
      const emuX = parseFloat(canvas.style.left) || Math.round((wrapW - emuW) / 2);
      const emuY = parseFloat(canvas.style.top) || Math.round((wrapH - emuH) / 2);
      const scaleSnes = emuW / 256;

      const layout = {
        wrapW: wrapW,
        wrapH: wrapH,
        emuX: emuX,
        emuY: emuY,
        emuW: emuW,
        emuH: emuH,
        scaleSnes: scaleSnes,
        camX: camX,
        camY: camY,
        trigOffX: trigOffX,
        trigOffY: trigOffY,
      };
      lastLayout = layout;

      // Parallax rooms: each layer at its own scroll, under/over the sprites
      // in the PPU's order. Animated cells keep their first frame here (the
      // animation overlays are composites of both layers).
      const roomMap = (extendMapEnabled && activeRoomMap && activeRoomMap.mapId === mapId) ? activeRoomMap : null;
      const layered = roomParallax && roomMap && roomMap.layers ? roomMap.layers : null;
      // Main screen (TM): a title card or cutscene that turns BG1/BG2 or the
      // sprites off leaves only the backdrop there, so the extension shows
      // the same instead of the room.
      const tm = preState.mainScreen === undefined ? 0x17 : preState.mainScreen;
      const bgShown = (tm & 0x03) !== 0;
      const objShown = (tm & 0x10) !== 0;
      // Palette dimming (ring menu) and brightness fades are applied to the canvases
      // via applyCanvasLayersFilter (hardware accelerated CSS).
      const tint = paletteTint(preState, roomMap ? roomMap.bgPalette : null);
      const drawLayer = (lctx, img, scrollX, scrollY) => {
        if (!img || !img.complete || !img.naturalWidth) return;
        lctx.drawImage(img, emuX - scrollX * scaleSnes, emuY - (scrollY + 1) * scaleSnes,
          roomMap.width * scaleSnes, roomMap.height * scaleSnes);
      };

      // 1. Extended map background (Layer 0) - shifted 1 SNES pixel up to fix vertical seam
      if (extMapCtx && extMapCanvas) {
        extMapCtx.clearRect(0, 0, wrapW, wrapH);
        if (!bgShown) {
          if (roomMap) {
            extMapCtx.fillStyle = '#000';
            extMapCtx.fillRect(emuX - camX * scaleSnes, emuY - (camY + 1) * scaleSnes, roomMap.width * scaleSnes, roomMap.height * scaleSnes);
          }
        } else if (layered) {
          extMapCtx.imageSmoothingEnabled = false;
          extMapCtx.fillStyle = '#000';
          extMapCtx.fillRect(emuX - camX * scaleSnes, emuY - (camY + 1) * scaleSnes, roomMap.width * scaleSnes, roomMap.height * scaleSnes);
          drawLayer(extMapCtx, layered.bg2Low, camX, camY);
          drawLayer(extMapCtx, layered.bg1Low, preState.bg1X, preState.bg1Y);
        } else if (roomMap && roomMap.img) {
          const mapX = emuX - camX * scaleSnes;
          const mapY = emuY - (camY + 1) * scaleSnes;
          const mapW = activeRoomMap.width * scaleSnes;
          const mapH = activeRoomMap.height * scaleSnes;
          extMapCtx.imageSmoothingEnabled = false;
          extMapCtx.drawImage(activeRoomMap.img, mapX, mapY, mapW, mapH);

          if (activeRoomMap.animGroups && activeRoomMap.animGroups.length) {
            for (let g = 0; g < activeRoomMap.animGroups.length; g++) {
              const grp = activeRoomMap.animGroups[g];
              if (!grp.frames || grp.frames.length <= 1) continue;
              grp.frameIdx = animGroupStep(grp, preState.animIdxBuf);
              const curFrame = grp.frames[grp.frameIdx];
              if (curFrame && curFrame.complete && curFrame.naturalWidth > 0) {
                const gx = mapX + grp.x * scaleSnes;
                const gy = mapY + grp.y * scaleSnes;
                const gw = grp.w * scaleSnes;
                const gh = grp.h * scaleSnes;
                extMapCtx.drawImage(curFrame, gx, gy, gw, gh);
              }
            }
          }
        }
      }

      // 2. Extended entities (Layer 1); priority-3 ones come back for Layer 2
      let frontEntities = [];
      if (extEntCtx && extEntCanvas) {
        frontEntities = renderExtendedEntities(preState, layout, extEntCanvas, extEntCtx);
        if (!objShown || !extendMapEnabled) {
          extEntCtx.clearRect(0, 0, wrapW, wrapH);
          frontEntities = [];
        }
      }

      // 3. Extended foreground priority tiles (Layer 2)
      if (extFgCtx && extFgCanvas) {
        extFgCtx.clearRect(0, 0, wrapW, wrapH);
        if (!bgShown) {
          // nothing of the room in front of the sprites either
        } else if (layered) {
          extFgCtx.imageSmoothingEnabled = false;
          drawLayer(extFgCtx, layered.bg2High, camX, camY);
          drawLayer(extFgCtx, layered.bg1High, preState.bg1X, preState.bg1Y);
        } else if (roomMap) {
          const mapX = emuX - camX * scaleSnes;
          const mapY = emuY - (camY + 1) * scaleSnes;
          const mapW = activeRoomMap.width * scaleSnes;
          const mapH = activeRoomMap.height * scaleSnes;
          extFgCtx.imageSmoothingEnabled = false;
          if (activeRoomMap.foregroundImg && activeRoomMap.foregroundImg.complete && activeRoomMap.foregroundImg.naturalWidth > 0) {
            extFgCtx.drawImage(activeRoomMap.foregroundImg, mapX, mapY, mapW, mapH);
          }
          if (activeRoomMap.animGroups && activeRoomMap.animGroups.length) {
            for (let g = 0; g < activeRoomMap.animGroups.length; g++) {
              const grp = activeRoomMap.animGroups[g];
              // Priority half only; null when the group has none.
              const curFrame = grp.fgFrames ? grp.fgFrames[grp.frameIdx || 0] : null;
              if (curFrame && curFrame.complete && curFrame.naturalWidth > 0) {
                const gx = mapX + grp.x * scaleSnes;
                const gy = mapY + grp.y * scaleSnes;
                const gw = grp.w * scaleSnes;
                const gh = grp.h * scaleSnes;
                extFgCtx.drawImage(curFrame, gx, gy, gw, gh);
              }
            }
          }
        }
        drawEntityItems(extFgCtx, frontEntities);
      }

      // Follow the screen fades and ring menu palette tint via hardware-accelerated CSS filter
      applyCanvasLayersFilter(screenBrightness(preState), tint, extMapCanvas, extFgCanvas, extEntCanvas);

      // 4. Extended triggers overlay (Layer 4)
      if (extOverCtx && extOverCanvas) {
        renderTriggersOverlay(extOverCtx, layout, preState);
      }
    }
