
    // -- Extended map and overlays --------------------------------------------
    let extendMapEnabled = false;
    let triggersOverlayEnabled = false;
    let objectsOverlayEnabled = false;
    let animTilesOverlayEnabled = false;
    let collisionOverlayEnabled = false;
    let fogOfWarEnabled = false;
    let thinHpBarEnabled = false;
    let thinStaminaBarEnabled = false;
    let inspectedTarget = null;
    let lastInjectedTrigger = null;
    let cachedMapId = -1;
    let cachedTriggers = null;
    let cachedObjects = null;
    let cachedLootables = null;
    let cachedItemIcons = {};
    let cachedAnimTiles = null;
    let cachedCollisionImg = null;
    let cachedOverlayImg = null;
    const roomObjectsCache = new Map();
    const roomLootCache = new Map();
    const roomAnimTilesCache = new Map();
    const roomCollisionCache = new Map();
    const roomOverlayCache = new Map();
    let lastRequestedMapId = -1;
    let lastRequestedObjKey = '';
    let lastRequestedGrassKey = '';
    let lastRequestedLayered = false;
    // Sticky per room: once BG1 has scrolled apart from the camera, the room
    // is drawn from its separate layers (the composite is right only at one scroll).
    let roomParallax = false;
    let cutGrassTileSet = new Set();
    let activeRoomMap = null;
    let activeTargetPings = [];

    function getDogPalette(mapId, spriteBank) {
      if (spriteBank === 0xD2) return 0xAE6B; // Act 4 Toaster
      if (mapId >= 69) return 0xAE6B; // Act 4 Omnitopia
      if (mapId >= 49) return 0xAE4B; // Act 3 Gothica (Poodle)
      if (mapId >= 27) return 0xAE2B; // Act 2 Antiqua (Greyhound)
      if (mapId === 0) return 0xB54B;  // Act 0 Podunk
      return 0xAE0B; // Act 1 Prehistoria (Wolf)
    }

    function injectEverscript(codeString) {
      const m = getModule();
      if (!m || !hasDebuggerApi(m)) {
        console.warn('Cannot inject everscript: emulator debugger API not available');
        return false;
      }
      const str = String(codeString || '').trim();
      if (!str) return false;

      let bytecode = null;
      const walkMatch = str.match(/^walk\s*\(\s*(\w+)\s*,\s*(\w+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*(?:,\s*(\w+)\s*)?(?:,\s*(\w+)\s*)?\)/i);
      const destroyMatch = str.match(/^destroy\s*\(\s*([^)]+)\s*\)/i);
      const callMatch = str.match(/^(?:call_id|call|trigger)\s*\(\s*([^)]+)\s*\)/i);
      const objMatch = str.match(/^(?:set_object_state|set_obj_state|set_state)\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/i);

      if (walkMatch) {
        const charName = walkMatch[1].toUpperCase();
        const typeName = walkMatch[2].toUpperCase();
        const targetX = parseInt(walkMatch[3], 10);
        const targetY = parseInt(walkMatch[4], 10);

        let opcode = 0x9D; // COORDINATE_ABSOLUTE
        if (typeName.includes('DIRECT')) opcode = 0x73; // COORDINATE_ABSOLUTE_DIRECT
        else if (typeName.includes('TILE')) opcode = 0x6E;

        // entity tokens: BOY 0x50, DOG 0x51, ACTIVE 0x52, INACTIVE 0x53 (| 0x80)
        const token = name => ({ BOY: 0xD0, DOG: 0xD1, ACTIVE: 0xD2, INACTIVE: 0xD3 })[(name || '').toUpperCase()];
        const charToken = token(charName) || 0xD2;

        bytecode = [
          opcode,
          charToken,
          0x84, targetX & 0xFF, (targetX >> 8) & 0xFF,
          0x84, targetY & 0xFF, (targetY >> 8) & 0xFF,
        ];
        // walk(..., wait_for, unlock) as the compiler emits it: (2e) wait until
        // the character arrives, (2b) make it player/AI controlled again.
        const waitFor = token(walkMatch[5]);
        const unlock = token(walkMatch[6]);
        if (waitFor) {
          bytecode.push(0x2E, waitFor);
          if (unlock) bytecode.push(0x2B, unlock);
        }
        bytecode.push(0x00); // END
      } else if (destroyMatch) {
        const targetRaw = destroyMatch[1].trim().toUpperCase();
        let targetToken = null;
        if (targetRaw === 'BOY') targetToken = [0xD0];
        else if (targetRaw === 'DOG') targetToken = [0xD1];
        else if (targetRaw === 'ACTIVE') targetToken = [0xD2];
        else if (targetRaw === 'INACTIVE') targetToken = [0xD3];
        else {
          const cleanAddr = targetRaw.replace(/[<>]/g, '');
          const addrVal = cleanAddr.startsWith('0X') ? parseInt(cleanAddr, 16) : parseInt(cleanAddr, 10);
          if (!isNaN(addrVal)) {
            targetToken = [0x84, addrVal & 0xFF, (addrVal >> 8) & 0xFF];
          }
        }
        if (targetToken) {
          bytecode = [0x9B, ...targetToken, 0x00];
        }
      } else if (callMatch) {
        const idRaw = callMatch[1].trim();
        const idVal = idRaw.toLowerCase().startsWith('0x') ? parseInt(idRaw, 16) : parseInt(idRaw, 10);
        if (!isNaN(idVal)) {
          bytecode = [0xA4, idVal & 0xFF, (idVal >> 8) & 0xFF, 0x00];
        }
      } else if (objMatch) {
        const objVal = parseInt(objMatch[1].trim(), 10);
        const stateVal = parseInt(objMatch[2].trim(), 10);
        if (!isNaN(objVal) && !isNaN(stateVal)) {
          bytecode = [0x5C, 0x82, objVal & 0xFF, 0x82, stateVal & 0xFF, 0x00];
        }
      } else {
        const hexMatch = str.match(/^(?:0x)?([0-9a-fA-F\s,]+)$/);
        if (hexMatch) {
          const parts = str.split(/[\s,]+/).filter(Boolean);
          bytecode = parts.map(p => parseInt(p, 16) & 0xFF);
          if (bytecode.length && bytecode[bytecode.length - 1] !== 0x00) bytecode.push(0x00);
        }
      }

      if (!bytecode || !bytecode.length) {
        console.warn('Unknown or unparseable everscript:', str);
        return false;
      }

      // Start the script the way the engine does (JSL $8CCE5C -> $8CCF18):
      //  * $8CCF18 takes the first slot in $7E28FC with state 0, stores the
      //    24-bit code pointer at +0, state 2 at +3, clears +5/+9/+B/+D and
      //    the argument block;
      //  * the caller then appends the slot to the run list at $7E2F28,
      //    indexed by $86, zero-terminated. $8CCFFD runs only what is on that
      //    list, so a slot that is merely marked live never executes.
      // Bytecode is fetched with LDA [$82] (a long pointer), so it can live in
      // WRAM: $7FFF00 is never written during play (headless survey), and a
      // walk without a wait runs to its END within the frame anyway.
      // A walk that waits keeps running across frames, so each injection gets
      // its own 0x40-byte buffer: a new right-click must not overwrite the
      // bytecode of a walk that is still waiting.
      let CODE_ADDR = 0x7FFF00;
      if (bytecode.length <= 0x40) {
        const buffer = injectEverscript.nextBuffer || 0;
        CODE_ADDR = 0x7FFF00 + buffer * 0x40;
        injectEverscript.nextBuffer = (buffer + 1) % 4;
      }
      if (bytecode.length > 0x100) {
        console.warn('Injected everscript too long:', bytecode.length);
        return false;
      }
      for (let i = 0; i < bytecode.length; i++) m.writeMemory(CODE_ADDR + i, bytecode[i]);

      const writeWord = (addr, v) => {
        m.writeMemory(addr, v & 0xFF);
        m.writeMemory(addr + 1, (v >> 8) & 0xFF);
      };
      const readWord = (addr) => m.readMemory(addr) | (m.readMemory(addr + 1) << 8);

      let targetSlot = -1;
      for (let s = 0; s < SLOT_COUNT; s++) {
        if (readWord(SCRIPT_STACK_BUS_ADDR + s * SLOT_SIZE + 0x03) === 0) { targetSlot = s; break; }
      }
      const RUN_LIST = 0x7E2F28;
      const RUN_INDEX = 0x7E0086;
      const runIdx = readWord(RUN_INDEX);
      if (targetSlot < 0 || runIdx >= SLOT_COUNT * 2) {
        console.warn('Cannot inject everscript: no free script slot');
        setText('ss-last-hit', 'inject failed: no free script slot', 'ss-warn');
        return false;
      }

      const targetBus = SCRIPT_STACK_BUS_ADDR + targetSlot * SLOT_SIZE;
      for (let i = 0; i < SLOT_SIZE; i++) m.writeMemory(targetBus + i, 0);
      m.writeMemory(targetBus + 0x00, CODE_ADDR & 0xFF);
      m.writeMemory(targetBus + 0x01, (CODE_ADDR >> 8) & 0xFF);
      m.writeMemory(targetBus + 0x02, (CODE_ADDR >> 16) & 0xFF);
      writeWord(targetBus + 0x03, 0x0002);
      // +0x0D (owner) stays 0: an owner would need its +0x3E refcount bumped.

      writeWord(RUN_LIST + runIdx, targetBus & 0xFFFF);
      writeWord(RUN_LIST + runIdx + 2, 0);
      writeWord(RUN_INDEX, runIdx + 2);

      console.log('Injected everscript:', str, 'into slot', targetSlot, 'addr', fmtHex(CODE_ADDR, 6));
      setText('ss-last-hit', 'injected: ' + str + ' -> slot ' + targetSlot, 'ss-ok');
      return true;
    }

    //@@parseRoomTriggers

    //@@calculateTriggerBox
    //@@resolveScriptIdToSnes

    function renderTriggersOverlay(overlayCtx, layout, preState) {
      if (!overlayCtx) return;
      if (!layout) {
        const wrap = document.getElementById('screen-wrap');
        const canvas = document.getElementById('screen');
        const wrapW = wrap ? wrap.clientWidth : 512;
        const wrapH = wrap ? wrap.clientHeight : 448;
        const emuW = canvas ? (parseFloat(canvas.style.width) || 512) : 512;
        const emuH = canvas ? (parseFloat(canvas.style.height) || 448) : 448;
        layout = {
          wrapW: wrapW,
          wrapH: wrapH,
          emuX: (wrapW - emuW) / 2,
          emuY: (wrapH - emuH) / 2,
          emuW: emuW,
          emuH: emuH,
          scaleSnes: emuW / 256,
          camX: 0,
          camY: 0,
          trigOffX: 0,
          trigOffY: 0,
        };
      }
      overlayCtx.clearRect(0, 0, layout.wrapW, layout.wrapH);

      if (fogOfWarEnabled && extendMapEnabled) {
        overlayCtx.save();
        overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        overlayCtx.beginPath();
        overlayCtx.rect(0, 0, layout.wrapW, layout.wrapH);
        overlayCtx.rect(layout.emuX, layout.emuY, layout.emuW, layout.emuH);
        overlayCtx.fill('evenodd');
        overlayCtx.restore();
      }

      if (activeTargetPings.length) {
        const now = performance.now();
        activeTargetPings = activeTargetPings.filter(p => (now - p.birth) < p.duration);
        for (let i = 0; i < activeTargetPings.length; i++) {
          const p = activeTargetPings[i];
          const progress = (now - p.birth) / p.duration;
          const px = layout.emuX + (p.x - layout.camX) * layout.scaleSnes;
          const py = layout.emuY + (p.y - layout.camY) * layout.scaleSnes;
          const radius = (6 + progress * 24) * layout.scaleSnes;
          const alpha = 1.0 - progress;

          overlayCtx.save();
          overlayCtx.strokeStyle = 'rgba(0, 230, 255, ' + alpha.toFixed(2) + ')';
          overlayCtx.lineWidth = Math.max(1, Math.round(2 * layout.scaleSnes));
          overlayCtx.beginPath();
          overlayCtx.arc(px, py, radius, 0, Math.PI * 2);
          overlayCtx.stroke();

          const cs = 4 * layout.scaleSnes;
          overlayCtx.beginPath();
          overlayCtx.moveTo(px - cs, py); overlayCtx.lineTo(px + cs, py);
          overlayCtx.moveTo(px, py - cs); overlayCtx.lineTo(px, py + cs);
          overlayCtx.stroke();
          overlayCtx.restore();
        }
      }
      sndDraw(overlayCtx, layout, preState);

      overlayCtx.save();

      if (!extendMapEnabled) {
        overlayCtx.beginPath();
        overlayCtx.rect(layout.emuX, layout.emuY, layout.emuW, layout.emuH);
        overlayCtx.clip();
      }

      // Collision: contours and wall tint (the line version)
      if (collisionOverlayEnabled) {
        renderCollisionOverlay(overlayCtx, layout, preState, activeRoomMap, cachedCollisionImg, cachedMapId);
      }

      // Step-on triggers: Pink (#ff69b4, rgba(255, 100, 180, 0.22))
      if (triggersOverlayEnabled && cachedTriggers) {
          const stepOn = cachedTriggers.stepOn || [];
          const bTrigger = cachedTriggers.bTrigger || [];
          overlayCtx.lineWidth = 1;
          for (let i = 0; i < stepOn.length; i++) {
            const box = calculateTriggerBox(stepOn[i], layout.trigOffX, layout.trigOffY, layout.camX, layout.camY);
            const tx = layout.emuX + (box.posX - layout.camX) * layout.scaleSnes;
            const ty = layout.emuY + (box.posY - layout.camY) * layout.scaleSnes;
            const tw = box.boxW * layout.scaleSnes;
            const th = box.boxH * layout.scaleSnes;

            if (tx + tw <= 0 || tx >= layout.wrapW || ty + th <= 0 || ty >= layout.wrapH) continue;

            overlayCtx.fillStyle = 'rgba(255, 100, 180, 0.22)';
            overlayCtx.fillRect(tx, ty, tw, th);
            overlayCtx.strokeStyle = '#ff69b4';
            overlayCtx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, th - 1);

            const label = (stepOn[i].scriptId >>> 0).toString(16).toUpperCase();
            overlayCtx.font = '10px monospace';
            const textW = overlayCtx.measureText(label).width;
            const labelX = tx + 2;
            const labelY = ty + 10;
            overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            overlayCtx.fillRect(labelX - 1, labelY - 9, textW + 2, 11);
            overlayCtx.fillStyle = '#ff69b4';
            overlayCtx.fillText(label, labelX, labelY);
          }

          // B-triggers: Yellow (#ffcc00, rgba(255, 210, 0, 0.22))
          for (let i = 0; i < bTrigger.length; i++) {
            const box = calculateTriggerBox(bTrigger[i], layout.trigOffX, layout.trigOffY, layout.camX, layout.camY);
            const tx = layout.emuX + (box.posX - layout.camX) * layout.scaleSnes;
            const ty = layout.emuY + (box.posY - layout.camY) * layout.scaleSnes;
            const tw = box.boxW * layout.scaleSnes;
            const th = box.boxH * layout.scaleSnes;

            if (tx + tw <= 0 || tx >= layout.wrapW || ty + th <= 0 || ty >= layout.wrapH) continue;

            overlayCtx.fillStyle = 'rgba(255, 210, 0, 0.22)';
            overlayCtx.fillRect(tx, ty, tw, th);
            overlayCtx.strokeStyle = '#ffcc00';
            overlayCtx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, th - 1);

            const label = (bTrigger[i].scriptId >>> 0).toString(16).toUpperCase();
            overlayCtx.font = '10px monospace';
            const textW = overlayCtx.measureText(label).width;
            const labelX = tx + 2;
            const labelY = ty + 10;
            overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            overlayCtx.fillRect(labelX - 1, labelY - 9, textW + 2, 11);
            overlayCtx.fillStyle = '#ffcc00';
            overlayCtx.fillText(label, labelX, labelY);
          }
        }

        // Objects: Section 3 map objects (sky blue)
        if (objectsOverlayEnabled && cachedObjects && cachedObjects.length) {
          renderObjectsOverlay(overlayCtx, layout, cachedObjects, (preState && preState.objStateBuf) || null);
        }

        // Animated tiles: Section 2 animated tiles (purple)
        if (animTilesOverlayEnabled && cachedAnimTiles && cachedAnimTiles.length) {
          renderAnimTilesOverlay(overlayCtx, layout, cachedAnimTiles);
        }

        // Thin HP and Stamina bars
        renderHpAndStaminaBarsOverlay(overlayCtx, layout, preState);

        // Active inspection highlight
        renderInspectSelection(overlayCtx, layout, preState);

      overlayCtx.restore();
    }
