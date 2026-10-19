// TODO port to TS (docs/todo/port-to-ts.md)

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

  