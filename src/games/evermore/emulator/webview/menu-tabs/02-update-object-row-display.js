
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
