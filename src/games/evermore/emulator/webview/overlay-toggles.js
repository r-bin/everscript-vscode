// TODO port to TS (docs/todo/port-to-ts.md)

    function redrawExtendedLayersNow() {
      if (!emuGameRom || typeof renderExtendedMapAndOverlays !== 'function') return;
      const sc = document.getElementById('screen');
      const extM = document.getElementById('extended-map');
      const extE = document.getElementById('extended-entities');
      const extF = document.getElementById('extended-foreground');
      const extO = document.getElementById('extended-overlay');
      if (!sc || !extM || !extE || !extF || !extO) return;
      const mCtx = extM.getContext('2d');
      const eCtx = extE.getContext('2d');
      const fCtx = extF.getContext('2d');
      const oCtx = extO.getContext('2d');
      if (!mCtx || !eCtx || !fCtx || !oCtx) return;
      const pre = (typeof lastSampledPreState !== 'undefined' && lastSampledPreState) ? lastSampledPreState : (typeof samplePreLoopState === 'function' ? samplePreLoopState() : null);
      if (pre) {
        renderExtendedMapAndOverlays(pre, sc, extM, mCtx, extE, eCtx, extF, fCtx, extO, oCtx);
      }
    }

    function setExtendMap(enabled) {
      extendMapEnabled = !!enabled;
      if (typeof emuSettingsChanged === 'function') emuSettingsChanged();
      const chip = document.getElementById('screen-extend-toggle');
      if (chip) {
        if (extendMapEnabled) {
          chip.classList.add('active');
          chip.textContent = 'MAP EXT ON';
        } else {
          chip.classList.remove('active');
          chip.textContent = 'MAP EXT OFF';
        }
      }
      const cb = document.getElementById('ss-extend-toggle');
      if (cb) cb.checked = extendMapEnabled;
      if (!extendMapEnabled) {
        const extMapCanvas = document.getElementById('extended-map');
        if (extMapCanvas) {
          const extCtx = extMapCanvas.getContext('2d');
          if (extCtx) extCtx.clearRect(0, 0, extMapCanvas.width, extMapCanvas.height);
        }
        const extEntCanvas = document.getElementById('extended-entities');
        if (extEntCanvas) {
          const entCtx = extEntCanvas.getContext('2d');
          if (entCtx) entCtx.clearRect(0, 0, extEntCanvas.width, extEntCanvas.height);
        }
        const extFgCanvas = document.getElementById('extended-foreground');
        if (extFgCanvas) {
          const fgCtx = extFgCanvas.getContext('2d');
          if (fgCtx) fgCtx.clearRect(0, 0, extFgCanvas.width, extFgCanvas.height);
        }
        const extOverCanvas = document.getElementById('extended-overlay');
        if (extOverCanvas) {
          const overCtx = extOverCanvas.getContext('2d');
          if (overCtx) overCtx.clearRect(0, 0, extOverCanvas.width, extOverCanvas.height);
        }
      }
      redrawExtendedLayersNow();
    }

    const extendChip = document.getElementById('screen-extend-toggle');
    if (extendChip) {
      extendChip.addEventListener('click', (e) => {
        e.stopPropagation();
        setExtendMap(!extendMapEnabled);
        const screenCanvas = document.getElementById('screen');
        if (screenCanvas) screenCanvas.focus();
      });
    }

    const extendCb = document.getElementById('ss-extend-toggle');
    if (extendCb) {
      extendCb.addEventListener('change', () => {
        setExtendMap(extendCb.checked);
      });
    }

    function hasAnyActiveOverlay() {
      return triggersOverlayEnabled || objectsOverlayEnabled || animTilesOverlayEnabled || collisionOverlayEnabled || fogOfWarEnabled || thinHpBarEnabled || thinStaminaBarEnabled || (inspectedTarget !== null);
    }

    function setThinHpBar(enabled) {
      thinHpBarEnabled = !!enabled;
      if (typeof emuSettingsChanged === 'function') emuSettingsChanged();
      checkClearOverlayCanvas();
      redrawExtendedLayersNow();
    }

    function setThinStaminaBar(enabled) {
      thinStaminaBarEnabled = !!enabled;
      if (typeof emuSettingsChanged === 'function') emuSettingsChanged();
      checkClearOverlayCanvas();
      redrawExtendedLayersNow();
    }

    function checkClearOverlayCanvas() {
      if (!hasAnyActiveOverlay()) {
        const extOverCanvas = document.getElementById('extended-overlay');
        if (extOverCanvas) {
          const extCtx = extOverCanvas.getContext('2d');
          if (extCtx) extCtx.clearRect(0, 0, extOverCanvas.width, extOverCanvas.height);
        }
      }
    }

    function setTriggersOverlay(enabled) {
      triggersOverlayEnabled = !!enabled;
      if (typeof emuSettingsChanged === 'function') emuSettingsChanged();
      const chip = document.getElementById('screen-trigger-toggle');
      if (chip) {
        if (triggersOverlayEnabled) {
          chip.classList.add('active');
          chip.textContent = 'TRIGGERS ON';
        } else {
          chip.classList.remove('active');
          chip.textContent = 'TRIGGERS OFF';
        }
      }
      const cb = document.getElementById('ss-overlay-toggle');
      if (cb) cb.checked = triggersOverlayEnabled;
      checkClearOverlayCanvas();
      redrawExtendedLayersNow();
    }

    const triggerChip = document.getElementById('screen-trigger-toggle');
    if (triggerChip) {
      triggerChip.addEventListener('click', (e) => {
        e.stopPropagation();
        setTriggersOverlay(!triggersOverlayEnabled);
        const screenCanvas = document.getElementById('screen');
        if (screenCanvas) screenCanvas.focus();
      });
    }

    const triggerCb = document.getElementById('ss-overlay-toggle');
    if (triggerCb) {
      triggerCb.addEventListener('change', () => {
        setTriggersOverlay(triggerCb.checked);
      });
    }

    function setObjectsOverlay(enabled) {
      objectsOverlayEnabled = !!enabled;
      if (typeof emuSettingsChanged === 'function') emuSettingsChanged();
      const chip = document.getElementById('screen-object-toggle');
      if (chip) {
        if (objectsOverlayEnabled) {
          chip.classList.add('active');
          chip.textContent = 'OBJECTS ON';
        } else {
          chip.classList.remove('active');
          chip.textContent = 'OBJECTS OFF';
        }
      }
      checkClearOverlayCanvas();
      redrawExtendedLayersNow();
    }

    const objectChip = document.getElementById('screen-object-toggle');
    if (objectChip) {
      objectChip.addEventListener('click', (e) => {
        e.stopPropagation();
        setObjectsOverlay(!objectsOverlayEnabled);
        const screenCanvas = document.getElementById('screen');
        if (screenCanvas) screenCanvas.focus();
      });
    }


    function setAnimTilesOverlay(enabled) {
      animTilesOverlayEnabled = !!enabled;
      if (typeof emuSettingsChanged === 'function') emuSettingsChanged();
      const chip = document.getElementById('screen-anim-toggle');
      if (chip) {
        if (animTilesOverlayEnabled) {
          chip.classList.add('active');
          chip.textContent = 'ANIM TILES ON';
        } else {
          chip.classList.remove('active');
          chip.textContent = 'ANIM TILES OFF';
        }
      }
      checkClearOverlayCanvas();
      redrawExtendedLayersNow();
    }

    const animChip = document.getElementById('screen-anim-toggle');
    if (animChip) {
      animChip.addEventListener('click', (e) => {
        e.stopPropagation();
        setAnimTilesOverlay(!animTilesOverlayEnabled);
        const screenCanvas = document.getElementById('screen');
        if (screenCanvas) screenCanvas.focus();
      });
    }


    function setCollisionOverlay(enabled) {
      collisionOverlayEnabled = !!enabled;
      if (typeof emuSettingsChanged === 'function') emuSettingsChanged();
      const chip = document.getElementById('screen-collision-toggle');
      if (chip) {
        if (collisionOverlayEnabled) {
          chip.classList.add('active');
          chip.textContent = 'COLLISION ON';
        } else {
          chip.classList.remove('active');
          chip.textContent = 'COLLISION OFF';
        }
      }
      checkClearOverlayCanvas();
      redrawExtendedLayersNow();
    }

    const collisionChip = document.getElementById('screen-collision-toggle');
    if (collisionChip) {
      collisionChip.addEventListener('click', (e) => {
        e.stopPropagation();
        setCollisionOverlay(!collisionOverlayEnabled);
        const screenCanvas = document.getElementById('screen');
        if (screenCanvas) screenCanvas.focus();
      });
    }


    function setFogOfWar(enabled) {
      fogOfWarEnabled = !!enabled;
      if (typeof emuSettingsChanged === 'function') emuSettingsChanged();
      const chip = document.getElementById('screen-fog-toggle');
      if (chip) {
        if (fogOfWarEnabled) {
          chip.classList.add('active');
          chip.textContent = 'FOG ON';
        } else {
          chip.classList.remove('active');
          chip.textContent = 'FOG OFF';
        }
      }
      checkClearOverlayCanvas();
      redrawExtendedLayersNow();
    }

    const fogChip = document.getElementById('screen-fog-toggle');
    if (fogChip) {
      fogChip.addEventListener('click', (e) => {
        e.stopPropagation();
        setFogOfWar(!fogOfWarEnabled);
        const screenCanvas = document.getElementById('screen');
        if (screenCanvas) screenCanvas.focus();
      });
    }

  