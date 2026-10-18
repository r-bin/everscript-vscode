
    // ---- Evermore's pause-menu tabs 1-4 (OVERLAYS, OBJECTS, LOOT, CHEATS): the hooks the emulator's
    // menu calls behind typeof guards (src/core/emulator/menu/menu-view.js), and what they need.
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

    // VIEW's line: the room (number and name) and the Boy's position (menu-view.js updateLensTabInfo).
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

    // The pills of OVERLAYS and CHEATS (menu-view.js syncMenuValuesFromRuntime).
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

    // Left / right on a row of tabs 1-4 (menu-view.js changeMenuValue).
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

    // B on a row of tabs 1-4 (menu-view.js activateMenuRow).
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

    // -- Section 3 Map Objects Dynamic View -------------------------------------
    function updateObjectRowDisplay(objIndex, newState, maxState) {
      const pill = document.getElementById('menu-val-obj-' + objIndex);
      if (pill) {
        pill.textContent = 'State ' + newState + ' / ' + maxState;
      }
      if (cachedObjects) {
        const obj = cachedObjects.find(function(o) { return o.index === objIndex; });
        if (obj) {
          const stateObj = (obj.states && obj.states[newState]) ? obj.states[newState] : null;
          const previewSrc = (stateObj && stateObj.preview) ? stateObj.preview : (obj.preview || null);
          const row = pill ? pill.closest('.menu-row') : null;
          if (row) {
            const previewBox = row.querySelector('.menu-preview-box');
            if (previewBox) {
              if (previewSrc) {
                previewBox.innerHTML = '<img class="menu-preview-img" src="' + previewSrc + '" alt="OBJ #' + obj.index + '">';
              } else {
                previewBox.innerHTML = '<span class="menu-preview-empty">OBJ</span>';
              }
            }
            const sBtns = row.querySelectorAll('.menu-state-pill');
            sBtns.forEach(function(sb) {
              const sVal = parseInt(sb.getAttribute('data-state'), 10);
              sb.classList.toggle('active', sVal === newState);
            });
          }
        }
      }
    }

    function renderObjectRows() {
      const container = document.getElementById('menu-objects-list');
      if (!container) return;
      const menuBody = document.getElementById('menu-body');
      const prevScroll = (menuBody && menuBody.scrollTop > 0) ? menuBody.scrollTop : (tabScrollTops[2] || 0);
      container.innerHTML = '';
      if (!cachedObjects) {
        const curMap = getCurrentMapId();
        if (curMap >= 0 && typeof roomObjectsCache !== 'undefined' && roomObjectsCache.has(curMap)) {
          cachedObjects = roomObjectsCache.get(curMap);
        }
      }
      if (!cachedObjects) {
        const curMap = getCurrentMapId();
        if (curMap >= 0 && typeof vscodeApi !== 'undefined' && vscodeApi) {
          vscodeApi.postMessage({
            command: 'requestRoomMap',
            mapId: curMap,
            objectStates: null,
            cutGrassTiles: null,
            layered: false,
          });
        }
        container.innerHTML = '<div class="menu-empty-hint">Loading Section 3 map objects...</div>';
        return;
      }
      if (!cachedObjects.length) {
        container.innerHTML = '<div class="menu-empty-hint">No Section 3 map objects found in this room.</div>';
        return;
      }
      for (let i = 0; i < cachedObjects.length; i++) {
        const obj = cachedObjects[i];
        const maxState = (obj.states && obj.states.length) ? Math.max(1, obj.states.length - 1) : 1;
        const curState = getEffectiveObjState(obj.index);

        const stateObj = (obj.states && obj.states[curState]) ? obj.states[curState] : null;
        const previewSrc = (stateObj && stateObj.preview) ? stateObj.preview : (obj.preview || null);
        let previewHtml = '<div class="menu-preview-box">';
        if (previewSrc) {
          previewHtml += '<img class="menu-preview-img" src="' + previewSrc + '" alt="OBJ #' + obj.index + '">';
        } else {
          previewHtml += '<span class="menu-preview-empty">OBJ</span>';
        }
        previewHtml += '</div>';

        let statesPillsHtml = '<div class="menu-obj-states-pills" style="display:inline-flex;gap:3px;margin:0 6px;align-items:center;">';
        for (let s = 0; s <= maxState; s++) {
          const isActive = (s === curState);
          statesPillsHtml += '<button type="button" class="menu-pill menu-state-pill' + (isActive ? ' active' : '') + '" data-obj="' + obj.index + '" data-state="' + s + '" title="Set State ' + s + '">' + s + '</button>';
        }
        statesPillsHtml += '</div>';

        const row = document.createElement('div');
        row.className = 'menu-row' + (i === menuSelectedRow ? ' selected' : '');
        row.setAttribute('data-row', String(i));
        row.setAttribute('data-action', 'stepper-obj-state');

        row.innerHTML =
          '<div class="menu-row-label">' +
            '<span class="menu-row-cursor">&gt;</span> ' +
            previewHtml +
            '<span class="menu-obj-badge">OBJ #' + obj.index + '</span> ' +
            '<span class="menu-obj-coords">(' + obj.x + ',' + obj.y + ' ' + obj.w + 'x' + obj.h + ')</span>' +
            statesPillsHtml +
          '</div>' +
          '<div class="menu-row-value">' +
            '<button class="menu-stepper-btn" data-step="-1" type="button">&lt;</button>' +
            '<span id="menu-val-obj-' + obj.index + '" class="menu-pill active">State ' + curState + ' / ' + maxState + '</span>' +
            '<button class="menu-stepper-btn" data-step="1" type="button">&gt;</button>' +
          '</div>';

        const sBtns = row.querySelectorAll('.menu-state-pill');
        sBtns.forEach(function(sb) {
          sb.addEventListener('click', function(e) {
            e.stopPropagation();
            menuSelectedRow = i;
            tabSelectedRows[menuActiveTab] = i;
            updateMenuRowSelection();
            const targetState = parseInt(sb.getAttribute('data-state'), 10);
            stepObjectState(obj.index, targetState - curState);
          });
        });

        const btnLeft = row.querySelector('[data-step="-1"]');
        const btnRight = row.querySelector('[data-step="1"]');
        if (btnLeft) {
          btnLeft.addEventListener('click', function(e) {
            e.stopPropagation();
            menuSelectedRow = i;
            tabSelectedRows[menuActiveTab] = i;
            updateMenuRowSelection();
            stepObjectState(obj.index, -1);
          });
        }
        if (btnRight) {
          btnRight.addEventListener('click', function(e) {
            e.stopPropagation();
            menuSelectedRow = i;
            tabSelectedRows[menuActiveTab] = i;
            updateMenuRowSelection();
            stepObjectState(obj.index, 1);
          });
        }
        row.addEventListener('click', function() {
          menuSelectedRow = i;
          tabSelectedRows[menuActiveTab] = i;
          updateMenuRowSelection();
          stepObjectState(obj.index, 1);
        });

        container.appendChild(row);
      }
      if (menuBody) {
        menuBody.scrollTop = prevScroll;
      }
      updateMenuRowSelection(false);
    }

    function stepObjectState(objIndex, delta) {
      if (!cachedObjects) return;
      const obj = cachedObjects.find(function(o) { return o.index === objIndex; });
      if (!obj) return;
      const maxState = (obj.states && obj.states.length) ? Math.max(1, obj.states.length - 1) : 1;
      const curState = getEffectiveObjState(objIndex);
      const newState = Math.max(0, Math.min(curState + delta, maxState));
      if (newState === curState) return;

      // 1. Update state caches immediately
      menuLocalObjStates.set(objIndex, newState);
      if (typeof lastSampledPreState !== 'undefined' && lastSampledPreState && lastSampledPreState.objStateBuf) {
        lastSampledPreState.objStateBuf[objIndex] = newState;
      }

      // 2. Safe opcode 0x5C injection: 5C takes two expressions (0x82 = unsigned const byte)
      let injected = false;
      try {
        const hexObj = objIndex.toString(16).padStart(2, '0');
        const hexVal = newState.toString(16).padStart(2, '0');
        injected = injectEverscript('5c 82 ' + hexObj + ' 82 ' + hexVal);
      } catch (_) {}

      // 3. Update UI in-place (preserves scroll position and active DOM)
      playMenuSound('click_nav');
      updateObjectRowDisplay(objIndex, newState, maxState);

      // 5. Request room map refresh to draw new object tiles immediately
      if (vscodeApi && typeof cachedMapId === 'number') {
        const objStateMap = {};
        const m = getModule();
        if (m && typeof m.readMemory === 'function') {
          for (let o = 0; o < 160; o++) {
            const val = (o === objIndex) ? newState : (m.readMemory(0x7E10CE + o) || 0);
            if (val > 0) objStateMap[o] = val;
          }
        } else {
          objStateMap[objIndex] = newState;
        }
        vscodeApi.postMessage({
          command: 'requestRoomMap',
          mapId: cachedMapId,
          objectStates: objStateMap,
          cutGrassTiles: null,
          layered: false,
        });
      }
    }

    // -- Lootables Dynamic View ------------------------------------------------
    function renderLootRows() {
      const container = document.getElementById('menu-loot-list');
      if (!container) return;
      const menuBody = document.getElementById('menu-body');
      const prevScroll = (menuBody && menuBody.scrollTop > 0) ? menuBody.scrollTop : (tabScrollTops[3] || 0);
      container.innerHTML = '';
      if (!cachedLootables) {
        const curMap = getCurrentMapId();
        if (curMap >= 0 && typeof roomLootCache !== 'undefined' && roomLootCache.has(curMap)) {
          cachedLootables = roomLootCache.get(curMap);
        }
      }
      if (!cachedLootables) {
        const curMap = getCurrentMapId();
        if (curMap >= 0 && typeof vscodeApi !== 'undefined' && vscodeApi) {
          vscodeApi.postMessage({
            command: 'requestRoomMap',
            mapId: curMap,
            objectStates: null,
            cutGrassTiles: null,
            layered: false,
          });
        }
        container.innerHTML = '<div class="menu-empty-hint">Loading lootables...</div>';
        return;
      }
      if (!cachedLootables.length) {
        container.innerHTML = '<div class="menu-empty-hint">No lootable gourds, chests or sniff spots found in this room.</div>';
        return;
      }
      const m = getModule();
      for (let i = 0; i < cachedLootables.length; i++) {
        const loot = cachedLootables[i];
        let isLooted = false;
        if (m && typeof m.readMemory === 'function') {
          if (loot.checkFlag) {
            const b = m.readMemory(0x7E0000 + loot.checkFlag.addr);
            isLooted = (b & (1 << loot.checkFlag.bit)) !== 0;
          } else if (loot.setFlag) {
            const b = m.readMemory(0x7E0000 + loot.setFlag.addr);
            isLooted = (b & (1 << loot.setFlag.bit)) !== 0;
          }
        }
        if (loot.objectId !== null && loot.objectId !== undefined) {
          const ost = getEffectiveObjState(loot.objectId);
          if (ost > 0) isLooted = true;
        }

        const previewSrc = loot.preview || (cachedItemIcons && cachedItemIcons[loot.itemName]) || null;
        let previewHtml = '<div class="menu-preview-box">';
        if (previewSrc) {
          previewHtml += '<img class="menu-preview-img" src="' + previewSrc + '" alt="' + loot.itemName + '">';
        } else {
          previewHtml += '<span class="menu-preview-empty">' + (loot.kind === 'sniff' ? 'SNIFF' : 'LOOT') + '</span>';
        }
        previewHtml += '</div>';

        const row = document.createElement('div');
        row.className = 'menu-row' + (i === menuSelectedRow ? ' selected' : '');
        row.setAttribute('data-row', String(i));
        row.setAttribute('data-action', 'toggle-loot');

        row.innerHTML =
          '<div class="menu-row-label">' +
            '<span class="menu-row-cursor">&gt;</span> ' +
            previewHtml +
            '<span class="menu-loot-name">' + loot.itemName + (loot.amount > 1 ? ' x' + loot.amount : '') + '</span> ' +
            '<span class="menu-loot-meta">(' + (loot.kind === 'sniff' ? 'Sniff' : (loot.objectId !== null ? 'OBJ #' + loot.objectId : 'Chest')) + ' @ ' + loot.x + ',' + loot.y + ')</span>' +
          '</div>' +
          '<div class="menu-row-value menu-loot-actions">' +
            '<button class="menu-loot-toggle-btn ' + (isLooted ? 'looted' : 'unlooted') + '" type="button">' +
              (isLooted ? 'LOOTED' : 'UNLOOTED') +
            '</button>' +
            '<button class="menu-loot-run-btn" type="button" title="Run loot script in emulator">[Run]</button>' +
          '</div>';

        const toggleBtn = row.querySelector('.menu-loot-toggle-btn');
        if (toggleBtn) {
          toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            menuSelectedRow = i;
            tabSelectedRows[menuActiveTab] = i;
            updateMenuRowSelection();
            toggleLootState(i);
          });
        }
        const runBtn = row.querySelector('.menu-loot-run-btn');
        if (runBtn) {
          runBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            menuSelectedRow = i;
            tabSelectedRows[menuActiveTab] = i;
            updateMenuRowSelection();
            runLootScript(i);
          });
        }
        row.addEventListener('click', function() {
          menuSelectedRow = i;
          tabSelectedRows[menuActiveTab] = i;
          updateMenuRowSelection();
          toggleLootState(i);
        });

        container.appendChild(row);
      }
      if (menuBody) {
        menuBody.scrollTop = prevScroll;
      }
      updateMenuRowSelection(false);
    }

    function toggleLootState(lootIdx) {
      if (!cachedLootables || !cachedLootables[lootIdx]) return;
      const loot = cachedLootables[lootIdx];
      const m = getModule();
      if (!m || typeof m.readMemory !== 'function') return;

      let isLooted = false;
      const flag = loot.setFlag || loot.checkFlag;
      if (flag) {
        const b = m.readMemory(0x7E0000 + flag.addr);
        isLooted = (b & (1 << flag.bit)) !== 0;
      }
      if (loot.objectId !== null && loot.objectId !== undefined) {
        const ost = getEffectiveObjState(loot.objectId);
        if (ost > 0) isLooted = true;
      }

      const targetLooted = !isLooted;
      if (flag) {
        const oldB = m.readMemory(0x7E0000 + flag.addr);
        const newB = targetLooted ? (oldB | (1 << flag.bit)) : (oldB & ~(1 << flag.bit));
        m.writeMemory(0x7E0000 + flag.addr, newB);
      }
      if (loot.objectId !== null && loot.objectId !== undefined) {
        const newObjState = targetLooted ? 1 : 0;
        menuLocalObjStates.set(loot.objectId, newObjState);
        if (typeof lastSampledPreState !== 'undefined' && lastSampledPreState && lastSampledPreState.objStateBuf) {
          lastSampledPreState.objStateBuf[loot.objectId] = newObjState;
        }
        let injected = false;
        try {
          injected = injectEverscript('5c 82 ' + loot.objectId.toString(16).padStart(2, '0') + ' 82 ' + (targetLooted ? '01' : '00'));
        } catch (_) {}
      }

      if (targetLooted) {
        playMenuSound('click_confirm');
      } else {
        playMenuSound('click_toggle');
      }

      renderLootRows();

      if (vscodeApi && typeof cachedMapId === 'number' && loot.objectId !== null) {
        const objStateMap = {};
        objStateMap[loot.objectId] = targetLooted ? 1 : 0;
        vscodeApi.postMessage({
          command: 'requestRoomMap',
          mapId: cachedMapId,
          objectStates: objStateMap,
          cutGrassTiles: null,
          layered: false,
        });
      }
    }

    function runLootScript(lootIdx) {
      if (!cachedLootables || !cachedLootables[lootIdx]) return;
      const loot = cachedLootables[lootIdx];
      const m = getModule();
      if (!m || typeof m.readMemory !== 'function') return;

      // Crash prevention: check free script slot count
      let freeSlot = -1;
      for (let s = 0; s < 20; s++) {
        if ((m.readMemory(0x7E28FC + s * 0x4F + 3) | (m.readMemory(0x7E28FC + s * 0x4F + 4) << 8)) === 0) {
          freeSlot = s;
          break;
        }
      }
      const runIdx = m.readMemory(0x7E0086) | (m.readMemory(0x7E0087) << 8);
      if (freeSlot < 0 || runIdx >= 40) {
        console.warn('Cannot run loot script: all 20 script slots occupied (prevented game crash)');
        playMenuSound('wheel_close');
        return;
      }

      if (loot.scriptAddressSnes) {
        const snes = loot.scriptAddressSnes;
        const b0 = snes & 0xFF, b1 = (snes >> 8) & 0xFF, b2 = (snes >> 16) & 0xFF;
        const hex = '29 ' + b0.toString(16).padStart(2, '0') + ' ' + b1.toString(16).padStart(2, '0') + ' ' + b2.toString(16).padStart(2, '0');
        injectEverscript(hex);
        playMenuSound('click_confirm');
        closeEmulatorMenu();
      }
    }

  