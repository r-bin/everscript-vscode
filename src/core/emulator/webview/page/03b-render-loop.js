// TODO port to TS (docs/todo/port-to-ts.md)

    // -- Render loop -----------------------------------------------------------
    function startRenderLoop() {
      const canvas        = document.getElementById('screen');
      const extMapCanvas  = document.getElementById('extended-map');
      const extEntCanvas  = document.getElementById('extended-entities');
      const extFgCanvas   = document.getElementById('extended-foreground');
      const extOverCanvas = document.getElementById('extended-overlay');
      const wrap          = document.getElementById('screen-wrap');
      const ctx           = canvas.getContext('2d');
      const extMapCtx     = extMapCanvas ? extMapCanvas.getContext('2d') : null;
      const extEntCtx     = extEntCanvas ? extEntCanvas.getContext('2d') : null;
      const extFgCtx      = extFgCanvas ? extFgCanvas.getContext('2d') : null;
      const extOverCtx    = extOverCanvas ? extOverCanvas.getContext('2d') : null;
      const imageData     = ctx.createImageData(512, 448);
      canvas.setAttribute('tabindex', '0');
      // A click on the focused screen presses B; the click that focuses it only focuses.
      let canvasHadFocus = false;
      canvas.addEventListener('mousedown', () => { canvasHadFocus = document.hasFocus() && document.activeElement === canvas; });
      canvas.addEventListener('click', () => {
        canvas.focus();
        if (!canvasHadFocus) return;
        keyInput |= (1 << 15);
        setTimeout(() => {
          keyInput &= ~(1 << 15);
        }, 120);
      });
      let lastWrapWidth = -1;
      let lastWrapHeight = -1;

      // Zoom & Pan state
      zoomLevel = 1.0;
      panX = 0;
      panY = 0;

      updateScreenLayout = function() {
        const W = wrap.clientWidth, H = wrap.clientHeight;
        if (!W || !H) return;
        const fitScale = Math.max(Math.min(W / 512, H / 448), 0.01);
        const scale = fitScale * zoomLevel;
        canvas.style.width = (512 * scale) + 'px';
        canvas.style.height = (448 * scale) + 'px';
        const emuW = 512 * scale;
        const emuH = 448 * scale;
        const emuX = Math.round((W - emuW) / 2 + panX);
        const emuY = Math.round((H - emuH) / 2 + panY);
        canvas.style.position = 'absolute';
        canvas.style.left = emuX + 'px';
        canvas.style.top = emuY + 'px';
        const zLvlEl = document.getElementById('screen-zlevel');
        if (zLvlEl) zLvlEl.textContent = Math.round(zoomLevel * 100) + '%';
        if (romLoaded && lastSampledPreState) {
          if (typeof renderExtendedMapAndOverlays === 'function') renderExtendedMapAndOverlays(lastSampledPreState, canvas, extMapCanvas, extMapCtx, extEntCanvas, extEntCtx, extFgCanvas, extFgCtx, extOverCanvas, extOverCtx);
        }
      };

      zoomAt = function(nextZoom, cx, cy) {
        const W = wrap.clientWidth, H = wrap.clientHeight;
        if (!W || !H) return;
        nextZoom = Math.max(0.25, Math.min(nextZoom, 10.0));
        if (Math.abs(nextZoom - zoomLevel) < 0.0001) return;
        const fitScale = Math.max(Math.min(W / 512, H / 448), 0.01);
        const oldScale = fitScale * zoomLevel;
        const newScale = fitScale * nextZoom;
        const oldEmuW = 512 * oldScale;
        const newEmuW = 512 * newScale;
        const oldEmuH = 448 * oldScale;
        const newEmuH = 448 * newScale;
        const oldEmuX = (W - oldEmuW) / 2 + panX;
        const oldEmuY = (H - oldEmuH) / 2 + panY;
        const newEmuX = cx - (cx - oldEmuX) * (newScale / oldScale);
        const newEmuY = cy - (cy - oldEmuY) * (newScale / oldScale);
        panX = newEmuX - (W - newEmuW) / 2;
        panY = newEmuY - (H - newEmuH) / 2;
        zoomLevel = nextZoom;
        updateScreenLayout();
      };

      resetZoom = function() {
        zoomLevel = 1.0;
        panX = 0;
        panY = 0;
        updateScreenLayout();
      };

      // Trackpad pinch-to-zoom (wheel with ctrlKey/metaKey) and two-finger pan (wheel)
      wrap.addEventListener('wheel', (e) => {
        const isLens = (typeof isMenuOpen !== 'undefined' && isMenuOpen && typeof menuActiveTab !== 'undefined' && menuActiveTab === 0);
        if (typeof isMenuOpen !== 'undefined' && isMenuOpen && !isLens) {
          const menuCard = document.getElementById('menu-card');
          if (menuCard && menuCard.contains(e.target)) {
            // Inside menu card: allow natural scroll of menu list, do NOT zoom/pan map!
            return;
          }
        }
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const r = wrap.getBoundingClientRect();
          const cx = e.clientX - r.left;
          const cy = e.clientY - r.top;
          const factor = Math.exp(-e.deltaY * 0.01);
          zoomAt(zoomLevel * factor, cx, cy);
        } else {
          e.preventDefault();
          const k = e.deltaMode === 1 ? 16 : 1;
          panX -= e.deltaX * k;
          panY -= e.deltaY * k;
          updateScreenLayout();
        }
      }, { passive: false });

      // Mouse drag-to-pan (middle click, alt+click, or dragging outside screen canvas)
      let isPanning = false;
      let panStartX = 0;
      let panStartY = 0;
      let panBaseX = 0;
      let panBaseY = 0;
      let dragDist = 0;
      wrap.addEventListener('mousedown', (e) => {
        dragDist = 0;
        if (e.button === 2) return; // Right-click handled by contextmenu
        const isLens = (typeof isMenuOpen !== 'undefined' && isMenuOpen && typeof menuActiveTab !== 'undefined' && menuActiveTab === 0);
        if (typeof isMenuOpen !== 'undefined' && isMenuOpen && !isLens) {
          const menuCard = document.getElementById('menu-card');
          if (menuCard && menuCard.contains(e.target)) return;
        }
        if (isLens) {
          const menuHeader = document.getElementById('menu-header');
          if (menuHeader && menuHeader.contains(e.target)) return;
        }
        if (isLens || e.button === 1 || e.altKey || (e.target !== canvas && !e.target.closest('.screen-chip'))) {
          isPanning = true;
          panStartX = e.clientX;
          panStartY = e.clientY;
          panBaseX = panX;
          panBaseY = panY;
          e.preventDefault();
        }
      });
      wrap.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!romLoaded || !lastLayout || typeof injectEverscript !== 'function') return;
        const rect = wrap.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const targetX = Math.max(0, Math.round(lastLayout.camX + (mouseX - lastLayout.emuX) / lastLayout.scaleSnes));
        const targetY = Math.max(0, Math.round(lastLayout.camY + (mouseY - lastLayout.emuY) / lastLayout.scaleSnes));
        activeTargetPings.push({ x: targetX, y: targetY, birth: performance.now(), duration: 1200 });
        // wait_for ACTIVE, unlock ACTIVE: the player gets control back on arrival
        const scriptStr = 'walk(ACTIVE, COORDINATE_ABSOLUTE, ' + targetX + ', ' + targetY + ', ACTIVE, ACTIVE)';
        injectEverscript(scriptStr);
      });
      window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        dragDist += Math.abs(dx) + Math.abs(dy);
        panX = panBaseX + dx;
        panY = panBaseY + dy;
        updateScreenLayout();
      });
      window.addEventListener('mouseup', () => {
        isPanning = false;
      });

      wrap.addEventListener('click', (e) => {
        if (dragDist > 6) return;
        const inspectCard = document.getElementById('menu-inspect-card');
        if (inspectCard && inspectCard.contains(e.target)) return;
        const menuCard = document.getElementById('menu-card');
        if (menuCard && menuCard.contains(e.target)) return;
        if (e.target.closest && (e.target.closest('.screen-chip') || e.target.closest('.screen-btn'))) return;

        // If paused, inspector click allows selecting character, trigger, or object
        if (emuGameRom && typeof isEmulatorPaused === 'function' && isEmulatorPaused() && romLoaded && lastLayout) {
          const rect = wrap.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          const worldX = Math.round(lastLayout.camX + (mouseX - lastLayout.emuX) / lastLayout.scaleSnes);
          const worldY = Math.round(lastLayout.camY + (mouseY - lastLayout.emuY) / lastLayout.scaleSnes);
          if (typeof handleMapInspectClick === 'function') {
            handleMapInspectClick(worldX, worldY, mouseX, mouseY);
          }
        }
      });

      const inspectCloseBtn = document.getElementById('inspect-close-btn');
      if (inspectCloseBtn) {
        inspectCloseBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof closeInspector === 'function') closeInspector();
        });
      }

      // Zoom buttons
      const zinBtn = document.getElementById('screen-zin');
      const zoutBtn = document.getElementById('screen-zout');
      const zfitBtn = document.getElementById('screen-zfit');
      if (zinBtn) zinBtn.addEventListener('click', () => {
        zoomAt(zoomLevel * 1.25, wrap.clientWidth / 2, wrap.clientHeight / 2);
      });
      if (zoutBtn) zoutBtn.addEventListener('click', () => {
        zoomAt(zoomLevel / 1.25, wrap.clientWidth / 2, wrap.clientHeight / 2);
      });
      if (zfitBtn) zfitBtn.addEventListener('click', () => {
        resetZoom();
      });

      // Scale the canvases to fit the panel and sync dimensions
      function resizeCanvas(force) {
        const W = wrap.clientWidth, H = wrap.clientHeight;
        if (!force && W === lastWrapWidth && H === lastWrapHeight) return;
        lastWrapWidth = W;
        lastWrapHeight = H;
        if (!W || !H) return;
        updateScreenLayout();
        if (extMapCanvas && (extMapCanvas.width !== W || extMapCanvas.height !== H)) {
          extMapCanvas.width = W;
          extMapCanvas.height = H;
        }
        if (extEntCanvas && (extEntCanvas.width !== W || extEntCanvas.height !== H)) {
          extEntCanvas.width = W;
          extEntCanvas.height = H;
        }
        if (extFgCanvas && (extFgCanvas.width !== W || extFgCanvas.height !== H)) {
          extFgCanvas.width = W;
          extFgCanvas.height = H;
        }
        if (extOverCanvas && (extOverCanvas.width !== W || extOverCanvas.height !== H)) {
          extOverCanvas.width = W;
          extOverCanvas.height = H;
        }
      }
      if (window.ResizeObserver) new ResizeObserver(() => resizeCanvas(true)).observe(wrap);
      window.addEventListener('resize', () => resizeCanvas(true));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') resizeCanvas(true);
      });
      resizeCanvas(true);

      let lastFrameTimestamp = performance.now();
      const FRAME_INTERVAL_MS = 1000 / 60; // 16.666 ms
      // Paused (Esc, pause button, breakpoint): the core is frozen, so only the
      // extension layers are redrawn - a few times a second, for pan / zoom.
      const PAUSED_FRAME_MS = 250;
      let lastPausedFrame = 0;

      function frame(timestamp) {
        requestAnimationFrame(frame);
        if (!timestamp) timestamp = performance.now();
        const elapsed = timestamp - lastFrameTimestamp;
        if (elapsed < FRAME_INTERVAL_MS - 2.0) return;
        lastFrameTimestamp = timestamp - (elapsed % FRAME_INTERVAL_MS);
        if (typeof pollGamepadMenu === 'function') pollGamepadMenu();
        if (typeof pollGamepadOverlay === 'function') pollGamepadOverlay();

        try {
          const paused = isEmulatorPaused();
          if (paused !== emulatorPausedState) {
            emulatorPausedState = paused;
            cdlOnPauseChanged(paused);
            tasOnPauseChanged(paused);
            if (typeof sdbgOnPauseChanged === 'function') sdbgOnPauseChanged(paused);
            apuPauseChanged(paused);
          }
          fpsTick(timestamp, romLoaded && !paused);
          if (paused) {
            if (timestamp - lastPausedFrame < PAUSED_FRAME_MS) return;
            lastPausedFrame = timestamp;
          }

          resizeCanvas(false);
          if (romLoaded && paused) {
            if (typeof renderExtendedMapAndOverlays === 'function') renderExtendedMapAndOverlays(lastSampledPreState, canvas, extMapCanvas, extMapCtx, extEntCanvas, extEntCtx, extFgCanvas, extFgCtx, extOverCanvas, extOverCtx);
            apuStreamTick(Module, true);
          } else if (romLoaded) {
            romFrameCount++;
            // Sample camera and entity state BEFORE _mainLoop() to match rendered frame
            const preState = emuGameRom && typeof samplePreLoopState === 'function' ? samplePreLoopState() : null;
            lastSampledPreState = preState;
            const m = getModule();
            // A replay must see exactly the recorded memory: no cheat writes.
            if (m && emuGameRom && !tasReplaying() && typeof maintainCheats === 'function') maintainCheats(m);
            if (speedMultiplier < 1.0) {
              speedAccumulator += speedMultiplier;
              if (speedAccumulator < 1.0) {
                const fbPtr = Module._getScreenBuffer();
                if (fbPtr) {
                  imageData.data.set(new Uint8ClampedArray(HEAPU8.buffer, fbPtr, 512 * 448 * 4));
                  ctx.putImageData(imageData, 0, 0);
                }
                if (typeof renderExtendedMapAndOverlays === 'function') renderExtendedMapAndOverlays(preState, canvas, extMapCanvas, extMapCtx, extEntCanvas, extEntCtx, extFgCanvas, extFgCtx, extOverCanvas, extOverCtx);
                return;
              }
              speedAccumulator -= 1.0;
            }
            for (let extra = (speedMultiplier > 1.0 ? Math.floor(speedMultiplier) - 1 : 0); extra > 0 && !isEmulatorPaused(); extra--) {
              tasApplyInput(Module, keyInput);
              Module._mainLoop();
              fpsCountFrame(Module);
              romFrameCount++;
              apuStreamTick(Module, false);
            }
            tasApplyInput(Module, keyInput);
            Module._mainLoop();
            fpsCountFrame(Module);
            const fbPtr = Module._getScreenBuffer();
            if (fbPtr) {
              imageData.data.set(new Uint8ClampedArray(HEAPU8.buffer, fbPtr, 512 * 448 * 4));
              ctx.putImageData(imageData, 0, 0);
            }
            if (typeof renderExtendedMapAndOverlays === 'function') renderExtendedMapAndOverlays(preState, canvas, extMapCanvas, extMapCtx, extEntCanvas, extEntCtx, extFgCanvas, extFgCtx, extOverCanvas, extOverCtx);
            tasDrawOverlay();
            if (emuScriptHook && typeof checkScriptExecutionTrace === 'function') checkScriptExecutionTrace();
            apuStreamTick(Module, false);
          }
        } catch (frameErr) {
          reportEmulatorCrash('frame_loop_error', frameErr && frameErr.message ? frameErr.message : String(frameErr), {
            stack: frameErr && frameErr.stack ? frameErr.stack : null
          });
        }
      }
      requestAnimationFrame(frame);
    }
