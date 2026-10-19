// TODO port to TS (docs/todo/port-to-ts.md)

    // ---- Evermore's pause-menu tabs 1-4 (OVERLAYS, OBJECTS, LOOT, CHEATS): the hooks the emulator's
    // menu calls behind typeof guards (src/core/emulator/menu/menu-view.ts), and what they need.
    const menuLocalObjStates = new Map();

    // Controllable Player Gate:
    // Only intercepts Start when player is in gameplay (not on opening screen, cinema, or entering name)
    function gameStartAllowed(m) {
      if (!emuGameRom) return false;
      try {
        if (typeof m.readMemory !== 'function') return false;
        // 1. Current map: 0x00 is title, Carlton cinema, intro, and name entry
        const curMap = m.readMemory(0x7E0ADB);
        if (curMap === 0x00 || curMap === 0xFF) return false;

        // 2. Stats initialized check: Boy Max HP at $7E0A35 is 0 before name entry completes
        const boyMaxHp = m.readMemory(0x7E0A35) | (m.readMemory(0x7E0A36) << 8);
        if (boyMaxHp === 0) return false;

        return true;
      } catch (err) {
        return false;
      }
    }

    function getCurrentMapId() {
      let currentMap = (typeof cachedMapId === 'number' && cachedMapId >= 0) ? cachedMapId : -1;
      if (currentMap < 0 && typeof lastSampledPreState !== 'undefined' && lastSampledPreState && typeof lastSampledPreState.mapId === 'number') {
        currentMap = lastSampledPreState.mapId;
      }
      if (currentMap < 0) {
        const m = getModule();
        if (m && typeof m.readMemory === 'function') {
          currentMap = m.readMemory(0x7E0B3C) | (m.readMemory(0x7E0B3D) << 8);
        }
      }
      return currentMap;
    }

    function getEffectiveObjState(objIndex) {
      if (menuLocalObjStates.has(objIndex)) {
        return menuLocalObjStates.get(objIndex);
      }
      const m = getModule();
      if (m && typeof m.readMemory === 'function') {
        return m.readMemory(0x7E10CE + objIndex) || 0;
      }
      if (typeof lastSampledPreState !== 'undefined' && lastSampledPreState && lastSampledPreState.objStateBuf) {
        return lastSampledPreState.objStateBuf[objIndex] || 0;
      }
      return 0;
    }

    // VIEW's line: the room (number and name) and the Boy's position (menu-view.ts updateLensTabInfo).
    function gameLensInfo() {
      const mapName = (typeof activeRoomMap !== 'undefined' && activeRoomMap && activeRoomMap.name) ? activeRoomMap.name : '';
      const hex = (typeof cachedMapId === 'number' && cachedMapId >= 0) ? ('0x' + cachedMapId.toString(16).toUpperCase().padStart(2, '0')) : '0x00';
      let playerX = 0, playerY = 0;
      const m = getModule();
      if (m && typeof m.readMemory === 'function') {
        playerX = m.readMemory(0x7E4E89 + 0x1A) | (m.readMemory(0x7E4E89 + 0x1B) << 8);
        playerY = m.readMemory(0x7E4E89 + 0x1C) | (m.readMemory(0x7E4E89 + 0x1D) << 8);
      }
      return { room: 'Room ' + hex + (mapName ? ' (' + mapName + ')' : ' Exploration Lens'), playerX, playerY };
    }

    function gameMenuOpened() { menuLocalObjStates.clear(); }
    function gameMenuClosed() { menuLocalObjStates.clear(); }
    function gameMenuMapChanged() { menuLocalObjStates.clear(); }

    // The room's objects and pickups for OBJECTS and LOOT, asked for when the menu opens.
    function gameMenuLoad() {
      const curMap = getCurrentMapId();
      if (emuGameRom && curMap >= 0 && (!cachedObjects || !cachedLootables)) {
        if (typeof roomObjectsCache !== 'undefined' && roomObjectsCache.has(curMap)) {
          cachedObjects = roomObjectsCache.get(curMap);
        }
        if (typeof roomLootCache !== 'undefined' && roomLootCache.has(curMap)) {
          cachedLootables = roomLootCache.get(curMap);
        }
        if ((!cachedObjects || !cachedLootables) && typeof vscodeApi !== 'undefined' && vscodeApi) {
          vscodeApi.postMessage({
            command: 'requestRoomMap',
            mapId: curMap,
            objectStates: null,
            cutGrassTiles: null,
            layered: false,
          });
        }
      }
    }

    function gameMenuRender(tab) {
      if (tab === 2) renderObjectRows();
      else if (tab === 3) renderLootRows();
      else if (tab === 4) syncMenuValuesFromRuntime();
    }

    // The pills of OVERLAYS and CHEATS (menu-view.ts syncMenuValuesFromRuntime).
    function gameMenuSync() {
      setPillState('menu-val-extend', extendMapEnabled);
      setPillState('menu-val-triggers', triggersOverlayEnabled);
      setPillState('menu-val-objects', objectsOverlayEnabled);
      setPillState('menu-val-anim', animTilesOverlayEnabled);
      setPillState('menu-val-collision', collisionOverlayEnabled);
      setPillState('menu-val-fog', fogOfWarEnabled);
      setPillState('menu-val-sound-vis', sndShow);
      setPillState('menu-val-hp-bar', !!thinHpBarEnabled);
      setPillState('menu-val-stamina-bar', !!thinStaminaBarEnabled);
      if (typeof tasOverlayIsOn === 'function') setPillState('menu-val-inputs', tasOverlayIsOn());
      setPillState('menu-val-cheat-noclip', typeof cheatNoclipEnabled !== 'undefined' && !!cheatNoclipEnabled);
      setPillState('menu-val-cheat-invincible', typeof cheatInvincibleEnabled !== 'undefined' && !!cheatInvincibleEnabled);
      setPillState('menu-val-cheat-atlas', typeof cheatAtlasEnabled !== 'undefined' && !!cheatAtlasEnabled);
    }

    // Left / right on a row of tabs 1-4 (menu-view.ts changeMenuValue).
    function gameMenuStep(tab, row, delta) {
      if (tab === 1) {
        // Tab 1: OVERLAYS
        switch (row) {
          case 0:
            setExtendMap(delta > 0);
            setPillState('menu-val-extend', extendMapEnabled);
            playMenuSound('click_toggle');
            break;
          case 1:
            setTriggersOverlay(delta > 0);
            setPillState('menu-val-triggers', triggersOverlayEnabled);
            playMenuSound('click_toggle');
            break;
          case 2:
            setObjectsOverlay(delta > 0);
            setPillState('menu-val-objects', objectsOverlayEnabled);
            playMenuSound('click_toggle');
            break;
          case 3:
            setAnimTilesOverlay(delta > 0);
            setPillState('menu-val-anim', animTilesOverlayEnabled);
            playMenuSound('click_toggle');
            break;
          case 4:
            setCollisionOverlay(delta > 0);
            setPillState('menu-val-collision', collisionOverlayEnabled);
            playMenuSound('click_toggle');
            break;
          case 5:
            setFogOfWar(delta > 0);
            setPillState('menu-val-fog', fogOfWarEnabled);
            playMenuSound('click_toggle');
            break;
          case 6:
            if (typeof sndSetShow === 'function') {
              sndSetShow(delta > 0);
              setPillState('menu-val-sound-vis', sndShow);
              playMenuSound('click_toggle');
            }
            break;
          case 7:
            menuZoomIndex = Math.max(0, Math.min(menuZoomIndex + delta, MENU_ZOOM_LABELS.length - 1));
            applyMenuZoom(menuZoomIndex);
            playMenuSound('click_toggle');
            break;
          case 8:
            if (typeof setThinHpBar === 'function') {
              setThinHpBar(delta > 0);
              setPillState('menu-val-hp-bar', thinHpBarEnabled);
              playMenuSound('click_toggle');
            }
            break;
          case 9:
            if (typeof setThinStaminaBar === 'function') {
              setThinStaminaBar(delta > 0);
              setPillState('menu-val-stamina-bar', thinStaminaBarEnabled);
              playMenuSound('click_toggle');
            }
            break;
          case 10:
            if (typeof tasSetOverlay === 'function') {
              tasSetOverlay(delta > 0, true);
              playMenuSound('click_toggle');
            }
            break;
        }
      } else if (tab === 2) {
        // Tab 2: OBJECTS
        if (cachedObjects && cachedObjects[row]) {
          stepObjectState(cachedObjects[row].index, delta);
        }
      } else if (tab === 3) {
        // Tab 3: LOOT
        if (cachedLootables && cachedLootables[row]) {
          toggleLootState(row);
        }
      } else if (tab === 4) {
        // Tab 4: CHEATS
        const m = getModule();
        switch (row) {
          case 0:
            cheatNoclipEnabled = (delta > 0);
            if (!cheatNoclipEnabled && m) disableNoclipCheat(m);
            else if (cheatNoclipEnabled && m) maintainCheats(m);
            setPillState('menu-val-cheat-noclip', cheatNoclipEnabled);
            playMenuSound('click_toggle');
            break;
          case 1:
            cheatInvincibleEnabled = (delta > 0);
            if (!cheatInvincibleEnabled && m) disableInvincibleCheat(m);
            else if (cheatInvincibleEnabled && m) maintainCheats(m);
            setPillState('menu-val-cheat-invincible', cheatInvincibleEnabled);
            playMenuSound('click_toggle');
            break;
          case 2:
            cheatAtlasEnabled = (delta > 0);
            if (!cheatAtlasEnabled && m) disableAtlasCheat(m);
            else if (cheatAtlasEnabled && m) maintainCheats(m);
            setPillState('menu-val-cheat-atlas', cheatAtlasEnabled);
            playMenuSound('click_toggle');
            break;
          case 3:
            if (m) healParty(m);
            playMenuSound('click_confirm');
            break;
          case 4:
            cheatNoclipEnabled = false;
            cheatInvincibleEnabled = false;
            cheatAtlasEnabled = false;
            if (m) {
              disableNoclipCheat(m);
              disableInvincibleCheat(m);
              disableAtlasCheat(m);
            }
            syncMenuValuesFromRuntime();
            playMenuSound('click_toggle');
            break;
        }
      }
    }

    // B on a row of tabs 1-4 (menu-view.ts activateMenuRow).
    function gameMenuActivate(tab, row) {
      if (tab === 1) {
        switch (row) {
          case 0:
            setExtendMap(!extendMapEnabled);
            setPillState('menu-val-extend', extendMapEnabled);
            playMenuSound('click_toggle');
            break;
          case 1:
            setTriggersOverlay(!triggersOverlayEnabled);
            setPillState('menu-val-triggers', triggersOverlayEnabled);
            playMenuSound('click_toggle');
            break;
          case 2:
            setObjectsOverlay(!objectsOverlayEnabled);
            setPillState('menu-val-objects', objectsOverlayEnabled);
            playMenuSound('click_toggle');
            break;
          case 3:
            setAnimTilesOverlay(!animTilesOverlayEnabled);
            setPillState('menu-val-anim', animTilesOverlayEnabled);
            playMenuSound('click_toggle');
            break;
          case 4:
            setCollisionOverlay(!collisionOverlayEnabled);
            setPillState('menu-val-collision', collisionOverlayEnabled);
            playMenuSound('click_toggle');
            break;
          case 5:
            setFogOfWar(!fogOfWarEnabled);
            setPillState('menu-val-fog', fogOfWarEnabled);
            playMenuSound('click_toggle');
            break;
          case 6:
            if (typeof sndSetShow === 'function') {
              sndSetShow(!sndShow);
              setPillState('menu-val-sound-vis', sndShow);
              playMenuSound('click_toggle');
            }
            break;
          case 7:
            changeMenuValue(1);
            break;
          case 8:
            if (typeof setThinHpBar === 'function') {
              setThinHpBar(!thinHpBarEnabled);
              setPillState('menu-val-hp-bar', thinHpBarEnabled);
              playMenuSound('click_toggle');
            }
            break;
          case 9:
            if (typeof setThinStaminaBar === 'function') {
              setThinStaminaBar(!thinStaminaBarEnabled);
              setPillState('menu-val-stamina-bar', thinStaminaBarEnabled);
              playMenuSound('click_toggle');
            }
            break;
          case 10:
            if (typeof tasSetOverlay === 'function') {
              tasSetOverlay(!tasOverlayIsOn(), true);
              playMenuSound('click_toggle');
            }
            break;
        }
      } else if (tab === 2) {
        changeMenuValue(1);
      } else if (tab === 3) {
        toggleLootState(row);
      } else if (tab === 4) {
        // Tab 4: CHEATS
        const m = getModule();
        switch (row) {
          case 0:
            cheatNoclipEnabled = !cheatNoclipEnabled;
            if (!cheatNoclipEnabled && m) disableNoclipCheat(m);
            else if (cheatNoclipEnabled && m) maintainCheats(m);
            setPillState('menu-val-cheat-noclip', cheatNoclipEnabled);
            playMenuSound('click_toggle');
            break;
          case 1:
            cheatInvincibleEnabled = !cheatInvincibleEnabled;
            if (!cheatInvincibleEnabled && m) disableInvincibleCheat(m);
            else if (cheatInvincibleEnabled && m) maintainCheats(m);
            setPillState('menu-val-cheat-invincible', cheatInvincibleEnabled);
            playMenuSound('click_toggle');
            break;
          case 2:
            cheatAtlasEnabled = !cheatAtlasEnabled;
            if (!cheatAtlasEnabled && m) disableAtlasCheat(m);
            else if (cheatAtlasEnabled && m) maintainCheats(m);
            setPillState('menu-val-cheat-atlas', cheatAtlasEnabled);
            playMenuSound('click_toggle');
            break;
          case 3:
            if (m) healParty(m);
            playMenuSound('click_confirm');
            break;
          case 4:
            cheatNoclipEnabled = false;
            cheatInvincibleEnabled = false;
            cheatAtlasEnabled = false;
            if (m) {
              disableNoclipCheat(m);
              disableInvincibleCheat(m);
              disableAtlasCheat(m);
            }
            syncMenuValuesFromRuntime();
            playMenuSound('click_toggle');
            break;
        }
      }
    }
