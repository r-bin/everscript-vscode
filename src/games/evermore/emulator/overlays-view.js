'use strict';

/**
 * games/evermore/emulator/overlays-view.js
 *
 * Evermore's screen layer of the emulator page, handed in through host.js webview(): the extended map
 * and its overlays (triggers, objects, animated tiles, collision, fog, HP / stamina bars), sprite
 * decoding for entities outside the screen, the inspector, the per-frame sample of the game's RAM
 * (samplePreLoopState), the overlay toggles and their screen chips. panel-webview.js splices the two
 * scripts where they always ran (the order of the page's top-level code matters) and calls into them
 * only behind typeof guards (gameRomReset, gameOnRoomMap, renderExtendedMapAndOverlays, ...).
 *
 * Invariant: Must remain strictly ASCII-only.
 */

const { parseRoomTriggers, calculateTriggerBox, resolveScriptIdToSnes } = require('./room-triggers');

function getScreenChipsHtml() {
  return `<button id="screen-extend-toggle" class="screen-chip" data-needs="evermore" type="button" title="Toggle Extended Map">MAP EXT OFF</button>
        <button id="screen-trigger-toggle" class="screen-chip" data-needs="evermore" type="button" title="Toggle Trigger Overlay (B &amp; Step-on)">TRIGGERS OFF</button>
        <button id="screen-object-toggle" class="screen-chip" data-needs="evermore" type="button" title="Toggle Objects Overlay">OBJECTS OFF</button>
        <button id="screen-anim-toggle" class="screen-chip" data-needs="evermore" type="button" title="Toggle Animated Tiles Overlay">ANIM TILES OFF</button>
        <button id="screen-collision-toggle" class="screen-chip" data-needs="evermore" type="button" title="Toggle Collision Lines Overlay">COLLISION OFF</button>
        <button id="screen-fog-toggle" class="screen-chip" data-needs="evermore" type="button" title="Toggle Fog of War outside emulator">FOG OFF</button>`;
}

function getOverlaysScript() {
  return `
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
      const walkMatch = str.match(/^walk\\s*\\(\\s*(\\w+)\\s*,\\s*(\\w+)\\s*,\\s*(-?\\d+)\\s*,\\s*(-?\\d+)\\s*(?:,\\s*(\\w+)\\s*)?(?:,\\s*(\\w+)\\s*)?\\)/i);
      const destroyMatch = str.match(/^destroy\\s*\\(\\s*([^)]+)\\s*\\)/i);
      const callMatch = str.match(/^(?:call_id|call|trigger)\\s*\\(\\s*([^)]+)\\s*\\)/i);
      const objMatch = str.match(/^(?:set_object_state|set_obj_state|set_state)\\s*\\(\\s*([^,]+)\\s*,\\s*([^)]+)\\s*\\)/i);

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
        const hexMatch = str.match(/^(?:0x)?([0-9a-fA-F\\s,]+)$/);
        if (hexMatch) {
          const parts = str.split(/[\\s,]+/).filter(Boolean);
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

    ${parseRoomTriggers.toString()}

    ${calculateTriggerBox.toString()}
    ${resolveScriptIdToSnes.toString()}

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

    // -- Sprite decoding & caching ---------------------------------------------
    function snesToRom(snes) { return snes & 0x3fffff; }
    function atRom(rom, snes) { return rom[snesToRom(snes)]; }
    function readRom24(rom, off) { return rom[off] | (rom[off + 1] << 8) | (rom[off + 2] << 16); }

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
            const recOffset = snesToRom(0x8E0000 | (stype + 0x0F));
            if (recOffset >= 0 && recOffset + 2 <= rom.length) {
              maxHp = rom[recOffset] | (rom[recOffset + 1] << 8);
            }
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
              const charId = Math.floor(((0x8E0000 | stype) - 0x8EB678) / 74);
              if (charId >= 0 && charId < 142) {
                const snes = 0x8EB678 + charId * 74;
                for (const off of [0x38, 0x3A, 0x3C, 0x3E]) {
                  const o = snesToRom(snes + off);
                  if (o + 1 < rom.length && (rom[o] | (rom[o + 1] << 8))) attackAnimsCount++;
                }
              }
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

    function renderInspectSelection(overlayCtx, layout, preState) {
      if (!overlayCtx || !inspectedTarget || !layout) return;
      if (inspectedTarget.type === 'char') {
        const refX = layout.camX;
        const refY = layout.camY;
        const sx = layout.emuX + (inspectedTarget.posX - refX) * layout.scaleSnes;
        const sy = layout.emuY + (inspectedTarget.posY - refY) * layout.scaleSnes;
        overlayCtx.save();
        overlayCtx.strokeStyle = '#4ec9b0';
        overlayCtx.lineWidth = Math.max(1.5, Math.round(2 * layout.scaleSnes));
        overlayCtx.beginPath();
        overlayCtx.arc(sx, sy - 14 * layout.scaleSnes, 18 * layout.scaleSnes, 0, Math.PI * 2);
        overlayCtx.stroke();
        overlayCtx.restore();
      } else if (inspectedTarget.type === 'trigger') {
        const tOffX = layout.trigOffX || 0;
        const tOffY = layout.trigOffY || 0;
        const box = calculateTriggerBox(inspectedTarget.trigger, tOffX, tOffY, layout.camX, layout.camY);
        const tx = layout.emuX + (box.posX - layout.camX) * layout.scaleSnes;
        const ty = layout.emuY + (box.posY - layout.camY) * layout.scaleSnes;
        const tw = box.boxW * layout.scaleSnes;
        const th = box.boxH * layout.scaleSnes;
        overlayCtx.save();
        overlayCtx.strokeStyle = '#ffffff';
        overlayCtx.lineWidth = Math.max(2, Math.round(2.5 * layout.scaleSnes));
        overlayCtx.strokeRect(tx - 0.5, ty - 0.5, tw + 1, th + 1);
        overlayCtx.restore();
      } else if (inspectedTarget.type === 'obj') {
        const obj = inspectedTarget.obj;
        const tx = layout.emuX + (obj.x - layout.camX) * layout.scaleSnes;
        const ty = layout.emuY + (obj.y - layout.camY) * layout.scaleSnes;
        const tw = obj.w * layout.scaleSnes;
        const th = obj.h * layout.scaleSnes;
        overlayCtx.save();
        overlayCtx.strokeStyle = '#4ec9b0';
        overlayCtx.lineWidth = Math.max(2, Math.round(2.5 * layout.scaleSnes));
        overlayCtx.strokeRect(tx - 0.5, ty - 0.5, tw + 1, th + 1);
        overlayCtx.restore();
      }
    }

    function decodeTriggerScriptPreview(rom, scriptId) {
      if (!rom || typeof scriptId !== 'number') return ['(ROM not loaded)'];
      const headerOffset = (rom.length % 1024 === 512) ? 512 : 0;
      const scriptsStartRom = headerOffset + 0x128000;
      if (scriptsStartRom + 2 >= rom.length) return ['(Invalid script table)'];
      const tableOffset = rom[scriptsStartRom] | (rom[scriptsStartRom + 1] << 8);
      const tableRom = scriptsStartRom + tableOffset;
      if (tableRom + scriptId + 2 >= rom.length) return ['(Script ID out of range)'];
      const rawPtr = rom[tableRom + scriptId] | (rom[tableRom + scriptId + 1] << 8) | (rom[tableRom + scriptId + 2] << 16);
      if (rawPtr === 0 || rawPtr === 0xFFFFFF) return ['(Empty script pointer)'];
      const scriptSnes = (0x928000 + (rawPtr & 0x7FFF) + ((rawPtr & 0xFF8000) << 1)) >>> 0;
      const scriptRom = headerOffset + (((scriptSnes >> 16) & 0x3F) * 0x10000 + (scriptSnes & 0xFFFF));
      if (scriptRom >= rom.length) return ['(Script address out of range)'];

      const lines = [];
      let ptr = scriptRom;
      let snesPtr = scriptSnes;
      let count = 0;
      while (ptr < rom.length && count < 8) {
        const op = rom[ptr++];
        const addrHex = '$' + snesPtr.toString(16).toUpperCase();
        snesPtr++;
        count++;
        if (op === 0x00) {
          lines.push(addrHex + ': end() [00]');
          break;
        } else if (op === 0xA3) {
          const id = rom[ptr++];
          snesPtr++;
          lines.push(addrHex + ': call_global(0x' + id.toString(16).toUpperCase() + ') [A3]');
        } else if (op === 0xA4) {
          const id = rom[ptr] | (rom[ptr + 1] << 8);
          ptr += 2; snesPtr += 2;
          lines.push(addrHex + ': call_id(0x' + id.toString(16).toUpperCase() + ') [A4]');
        } else if (op === 0x22) {
          const x = (rom[ptr++] << 3);
          const y = (rom[ptr++] << 3);
          const mapId = (rom[ptr] | (rom[ptr + 1] << 8)) & 0xFF;
          ptr += 2; snesPtr += 4;
          lines.push(addrHex + ': load_map(0x' + mapId.toString(16).toUpperCase() + ', ' + x + ', ' + y + ') [22]');
        } else if (op === 0x36) {
          lines.push(addrHex + ': fade_in() [36]');
        } else if (op === 0x37) {
          lines.push(addrHex + ': fade_out() [37]');
        } else if (op === 0x2A) {
          ptr++; snesPtr++;
          lines.push(addrHex + ': control(NONE) [2A]');
        } else if (op === 0x2B) {
          ptr++; snesPtr++;
          lines.push(addrHex + ': control(ACTIVE) [2B]');
        } else if (op === 0x5C) {
          ptr += 4; snesPtr += 4;
          lines.push(addrHex + ': set_object_state(...) [5C]');
        } else {
          lines.push(addrHex + ': opcode 0x' + op.toString(16).toUpperCase());
          break;
        }
      }
      if (!lines.length) lines.push('(No instructions found)');
      return lines;
    }

    function closeInspector() {
      inspectedTarget = null;
      const card = document.getElementById('menu-inspect-card');
      if (card) card.classList.add('hidden');
      checkClearOverlayCanvas();
      redrawExtendedLayersNow();
    }

    function openCharacterInspector(addr) {
      if (!lastSampledPreState || !lastSampledPreState.entBuf) return;
      const buf = lastSampledPreState.entBuf;
      const rel = addr - 0x3DDF;
      if (rel < 0 || rel + 0x70 > buf.length) return;

      const rom = (loadedRomData && loadedRomData.length % 1024 === 512) ? loadedRomData.subarray(512) : loadedRomData;
      const isBoy = (addr === 0x4E89);
      const isDog = (addr === 0x4F37);

      const stype = buf[rel + 0x60] | (buf[rel + 0x61] << 8);
      let name = isBoy ? 'Boy' : isDog ? 'Dog' : '';
      if (!name && stype >= 0x8000 && rom) {
        const namePtr = readRom24(rom, snesToRom(0x8E0000 | stype));
        if (typeof decodeEntityName === 'function') name = decodeEntityName(rom, namePtr, stype);
      }
      if (!name) name = isBoy ? 'Boy' : isDog ? 'Dog' : ('Entity $' + addr.toString(16).toUpperCase());

      const hp = buf[rel + 0x2A] | (buf[rel + 0x2B] << 8);
      const rawX = buf[rel + 0x1A] | (buf[rel + 0x1B] << 8);
      const posX = rawX >= 0x8000 ? rawX - 0x10000 : rawX;
      const rawY = buf[rel + 0x1C] | (buf[rel + 0x1D] << 8);
      const posY = rawY >= 0x8000 ? rawY - 0x10000 : rawY;
      const rawZ = buf[rel + 0x1E] | (buf[rel + 0x1F] << 8);
      const posZ = rawZ >= 0x8000 ? rawZ - 0x10000 : rawZ;

      let maxHp = 0;
      const mInst = (typeof getModule === 'function') ? getModule() : null;
      if (isBoy) {
        if (mInst && typeof mInst.readMemory === 'function') {
          maxHp = (mInst.readMemory(0x7E0A35) || 0) | ((mInst.readMemory(0x7E0A36) || 0) << 8);
        } else if (lastSampledPreState.wram && lastSampledPreState.wram.length > 0x0A36) {
          maxHp = lastSampledPreState.wram[0x0A35] | (lastSampledPreState.wram[0x0A36] << 8);
        }
        if (!maxHp) maxHp = Math.max(hp, 1);
      } else if (isDog) {
        if (mInst && typeof mInst.readMemory === 'function') {
          maxHp = (mInst.readMemory(0x7E0A7F) || 0) | ((mInst.readMemory(0x7E0A80) || 0) << 8);
        } else if (lastSampledPreState.wram && lastSampledPreState.wram.length > 0x0A80) {
          maxHp = lastSampledPreState.wram[0x0A7F] | (lastSampledPreState.wram[0x0A80] << 8);
        }
        if (!maxHp) maxHp = Math.max(hp, 1);
      } else {
        if (stype >= 0x8000 && rom) {
          const recOffset = snesToRom(0x8E0000 | (stype + 0x0F));
          if (recOffset >= 0 && recOffset + 2 <= rom.length) {
            maxHp = rom[recOffset] | (rom[recOffset + 1] << 8);
          }
        }
        if (!maxHp || maxHp < hp) maxHp = Math.max(hp, 1);
      }

      const stamina = buf[rel + 0x2E] | (buf[rel + 0x2F] << 8);
      const maxStamina = Math.max(0x400, stamina);
      const flags = buf[rel + 0x10] | (buf[rel + 0x11] << 8);
      const isNpc = !isBoy && !isDog && ((flags & 0x0002) !== 0);
      const category = isBoy ? 'Party (Boy)' : isDog ? 'Party (Dog)' : isNpc ? 'NPC' : 'Enemy';

      inspectedTarget = { type: 'char', addr: addr, posX: posX, posY: posY };

      const card = document.getElementById('menu-inspect-card');
      const titleEl = document.getElementById('inspect-title');
      const bodyEl = document.getElementById('inspect-body');
      const footerEl = document.getElementById('inspect-footer');
      if (!card || !titleEl || !bodyEl || !footerEl) return;

      titleEl.textContent = 'CHARACTER: ' + name + ' ($7E' + fmtHex(addr, 4) + ')';
      const hpPct = Math.round(Math.min(100, (hp / maxHp) * 100));
      const stamPct = Math.round(Math.min(100, (stamina / maxStamina) * 100));
      const stamTier = stamina >= 0xC00 ? 'Lvl 3 (>=300%, power x4)' :
                       stamina >= 0x800 ? 'Lvl 2 (200%, power x2)' :
                       stamina >= 0x400 ? 'Lvl 1 (100%, power x1)' :
                       stamina >= 0x200 ? 'Lvl 0 (50-99%, power x1/2)' : 'Lvl 0 (<50%, power x1/4)';

      bodyEl.innerHTML =
        '<div class="inspect-row"><span class="inspect-label">Category:</span><span class="inspect-val">' + category + '</span></div>' +
        '<div class="inspect-row"><span class="inspect-label">Address:</span><span class="inspect-val">$7E' + fmtHex(addr, 4) + '</span></div>' +
        '<div class="inspect-row"><span class="inspect-label">Position:</span><span class="inspect-val">X: ' + posX + ', Y: ' + posY + ', Z: ' + posZ + '</span></div>' +
        '<div class="inspect-row"><span class="inspect-label">HP:</span><span class="inspect-val">' + hp + ' / ' + maxHp + ' (' + hpPct + '%)</span></div>' +
        '<div class="inspect-row"><span class="inspect-label">Stamina:</span><span class="inspect-val">' + stamina + ' / ' + maxStamina + ' (' + stamPct + '%) [' + stamTier + ']</span></div>' +
        '<div class="inspect-row"><span class="inspect-label">Flags:</span><span class="inspect-val">0x' + fmtHex(flags, 4) + '</span></div>' +
        '<div class="inspect-row"><span class="inspect-label">Type ID:</span><span class="inspect-val">0x' + fmtHex(stype, 4) + '</span></div>';

      const delBtn = document.createElement('button');
      delBtn.className = 'menu-action-pill inspect-danger-btn';
      delBtn.type = 'button';
      delBtn.textContent = '[Delete Character (Everscript)]';
      delBtn.addEventListener('click', function() {
        const targetStr = isBoy ? 'BOY' : isDog ? 'DOG' : ('0x' + addr.toString(16));
        const ok = injectEverscript('destroy(' + targetStr + ')');
        const m = getModule();
        if (m && hasDebuggerApi(m)) {
          m.writeMemory(addr + 0x2A, 0);
          m.writeMemory(addr + 0x2B, 0);
          const hi = m.readMemory(addr + 0x13);
          m.writeMemory(addr + 0x13, hi | 0x80);
        }
        if (lastSampledPreState && lastSampledPreState.entBuf) {
          lastSampledPreState.entBuf[rel + 0x2A] = 0;
          lastSampledPreState.entBuf[rel + 0x2B] = 0;
          lastSampledPreState.entBuf[rel + 0x13] |= 0x80;
        }
        delBtn.disabled = true;
        delBtn.textContent = '[Deleted]';
        delBtn.style.opacity = '0.5';
        if (typeof playMenuSound === 'function') playMenuSound('click_confirm');
        setText('ss-last-hit', 'deleted character ' + name + ' ($7E' + fmtHex(addr, 4) + ') via destroy()', 'ss-ok');
        redrawExtendedLayersNow();
      });

      footerEl.innerHTML = '';
      footerEl.appendChild(delBtn);

      card.classList.remove('hidden');
      if (typeof playMenuSound === 'function') playMenuSound('click_nav');
      redrawExtendedLayersNow();
    }

    function openTriggerInspector(typeStr, trigger, triggerIndex) {
      if (!trigger) return;
      if (typeof triggerIndex === 'number') trigger.index = triggerIndex;
      inspectedTarget = { type: 'trigger', trigger: trigger };

      const card = document.getElementById('menu-inspect-card');
      const titleEl = document.getElementById('inspect-title');
      const bodyEl = document.getElementById('inspect-body');
      const footerEl = document.getElementById('inspect-footer');
      if (!card || !titleEl || !bodyEl || !footerEl) return;

      const scriptIdHex = '$' + fmtHex(trigger.scriptId, 4);
      titleEl.textContent = typeStr.toUpperCase() + ' (Script ' + scriptIdHex + ')';

      const box = calculateTriggerBox(trigger, trigOffX, trigOffY, (lastLayout ? lastLayout.camX : 0), (lastLayout ? lastLayout.camY : 0));
      const previewLines = decodeTriggerScriptPreview(loadedRomData, trigger.scriptId);

      let scriptBoxHtml = '<div class="inspect-script-box">';
      for (let i = 0; i < previewLines.length; i++) {
        scriptBoxHtml += '<div>' + previewLines[i] + '</div>';
      }
      scriptBoxHtml += '</div>';

      bodyEl.innerHTML =
        '<div class="inspect-row"><span class="inspect-label">Type:</span><span class="inspect-val">' + typeStr + '</span></div>' +
        '<div class="inspect-row"><span class="inspect-label">Script ID:</span><span class="inspect-val">' + scriptIdHex + ' (' + trigger.scriptId + ')</span></div>' +
        '<div class="inspect-row"><span class="inspect-label">Tile Bounds:</span><span class="inspect-val">(' + trigger.x1 + ', ' + trigger.y1 + ') to (' + trigger.x2 + ', ' + trigger.y2 + ')</span></div>' +
        '<div class="inspect-row"><span class="inspect-label">World Rect:</span><span class="inspect-val">' + box.posX + ', ' + box.posY + ' (' + box.boxW + 'x' + box.boxH + ' px)</span></div>' +
        '<div style="margin-top:4px;"><span class="inspect-label">Script Content:</span></div>' +
        scriptBoxHtml;

      const trigBtn = document.createElement('button');
      trigBtn.className = 'menu-action-pill';
      trigBtn.type = 'button';
      trigBtn.textContent = '[Trigger Script (Everscript call_id)]';
      trigBtn.addEventListener('click', function() {
        lastInjectedTrigger = {
          kind: (trigger && trigger.kind) || (typeStr === 'B-Trigger' ? 'bTrigger' : 'stepOn'),
          index: (trigger && typeof trigger.index === 'number') ? trigger.index : (typeof triggerIndex === 'number' ? triggerIndex : 0),
          scriptId: trigger.scriptId,
          expiryFrame: romFrameCount + 40,
        };
        const ok = injectEverscript('call_id(0x' + trigger.scriptId.toString(16) + ')');
        if (typeof playMenuSound === 'function') playMenuSound('click_confirm');
        setText('ss-last-hit', 'triggered ' + typeStr + ' script ' + scriptIdHex + ' via call_id()', 'ss-ok');
      });

      footerEl.innerHTML = '';
      footerEl.appendChild(trigBtn);

      card.classList.remove('hidden');
      if (typeof playMenuSound === 'function') playMenuSound('click_nav');
      redrawExtendedLayersNow();
    }

    function openObjectInspector(obj) {
      if (!obj) return;
      inspectedTarget = { type: 'obj', obj: obj };

      const card = document.getElementById('menu-inspect-card');
      const titleEl = document.getElementById('inspect-title');
      const bodyEl = document.getElementById('inspect-body');
      const footerEl = document.getElementById('inspect-footer');
      if (!card || !titleEl || !bodyEl || !footerEl) return;

      const curState = (typeof getEffectiveObjState === 'function') ? getEffectiveObjState(obj.index) : (((lastSampledPreState && lastSampledPreState.objStateBuf && lastSampledPreState.objStateBuf[obj.index]) || 0));
      const maxState = (obj.states && obj.states.length) ? Math.max(1, obj.states.length - 1) : 1;

      titleEl.textContent = 'MAP OBJECT #' + obj.index + ' (State ' + curState + ' / ' + maxState + ')';

      let stateBtnsHtml = '<div class="inspect-states-row">';
      for (let s = 0; s <= maxState; s++) {
        const isActive = (s === curState);
        stateBtnsHtml += '<button type="button" class="inspect-state-btn' + (isActive ? ' active' : '') + '" data-obj="' + obj.index + '" data-state="' + s + '">State ' + s + '</button>';
      }
      stateBtnsHtml += '</div>';

      bodyEl.innerHTML =
        '<div class="inspect-row"><span class="inspect-label">Object Index:</span><span class="inspect-val">#' + obj.index + '</span></div>' +
        '<div class="inspect-row"><span class="inspect-label">Coordinates:</span><span class="inspect-val">(' + obj.x + ', ' + obj.y + ') ' + obj.w + 'x' + obj.h + ' px</span></div>' +
        '<div class="inspect-row"><span class="inspect-label">Current State:</span><span id="inspect-obj-curstate" class="inspect-val">State ' + curState + ' of ' + maxState + '</span></div>' +
        '<div style="margin-top:4px;"><span class="inspect-label">Available States (click to set):</span></div>' +
        stateBtnsHtml;

      const sBtns = bodyEl.querySelectorAll('.inspect-state-btn');
      sBtns.forEach(function(b) {
        b.addEventListener('click', function() {
          const targetState = parseInt(b.getAttribute('data-state'), 10);
          if (typeof stepObjectState === 'function') {
            stepObjectState(obj.index, targetState - curState);
          } else {
            const hexObj = obj.index.toString(16).padStart(2, '0');
            const hexVal = targetState.toString(16).padStart(2, '0');
            injectEverscript('5c 82 ' + hexObj + ' 82 ' + hexVal);
          }
          openObjectInspector(obj);
        });
      });

      footerEl.innerHTML = '<span style="color:#778899;font-size:10px;">Click any state above to alter WRAM &amp; engine.</span>';

      card.classList.remove('hidden');
      if (typeof playMenuSound === 'function') playMenuSound('click_nav');
      redrawExtendedLayersNow();
    }

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

    // Standing sprites for entities that have not been activated yet, from
    // the host (resolveCharacterSprite). undefined = not asked yet, null = none.
    const idleSprites = new Map();
    let idleSpritesWanted = new Set();
    function idleSpriteFor(type, facing) {
      const key = type + ':' + ((facing || 8) & 0x0e);
      if (idleSprites.has(key)) return idleSprites.get(key);
      if (!idleSpritesWanted.has(key)) {
        idleSpritesWanted.add(key);
        if (vscodeApi) vscodeApi.postMessage({ command: 'requestIdleSprites', keys: [key] });
      }
      return null;
    }

    // Every live entity, from a read of WRAM starting at $7E3DDF. The engine
    // keeps two lists, both linked through +0x5E: $3DDF holds the active
    // entities (near the screen, run and drawn every frame) and $3DE1 the
    // inactive ones, which it moves an entity to as it leaves the screen and
    // back as it returns ($CFB254). Walking $3DDF alone made enemies blink in
    // and out of the extension and the Entities tab at that boundary. ($3DE3
    // is the free list.) The Boy and Dog are always added.
    function entityAddresses(buf) {
      const out = [];
      const visited = new Set();
      for (const head of [0, 2]) {
        let cur = buf[head] | (buf[head + 1] << 8);
        let safety = 0;
        while (cur >= 0x3DE5 && cur < 0x4FE5 && !visited.has(cur) && safety++ < 40) {
          visited.add(cur);
          out.push(cur);
          const rel = cur - 0x3DDF;
          if (rel < 0 || rel + 0x60 > buf.length) break;
          cur = buf[rel + 0x5E] | (buf[rel + 0x5F] << 8);
          if (!cur) break;
        }
      }
      if (!visited.has(0x4E89)) out.push(0x4E89);
      if (!visited.has(0x4F37)) out.push(0x4F37);
      return out;
    }

    // Draws the priority-2 entities on Layer 1 and returns the priority-3 ones,
    // which the caller draws over the foreground (Layer 2).
    function renderExtendedEntities(preState, layout, extEntCanvas, extEntCtx) {
      if (!extEntCtx || !extEntCanvas) return [];
      extEntCtx.clearRect(0, 0, layout.wrapW, layout.wrapH);
      if (!extendMapEnabled || !preState || !loadedRomData) return [];

      const rom = (loadedRomData.length % 1024 === 512) ? loadedRomData.subarray(512) : loadedRomData;
      const drawList = [];

      // 1. Entities from WRAM entBuf (0x7E3DDF)
      if (preState.entBuf) {
        const buf = preState.entBuf;
        const entities = entityAddresses(buf);

        for (let i = 0; i < entities.length; i++) {
          const addr = entities[i];
          const rel = addr - 0x3DDF;
          if (rel < 0 || rel + 0x8E > buf.length) continue;

          // Draw mode 0 ($8FC6C5) draws a main sprite (+0x06, bank +0x08)
          // unless +0x12 bit 15 hides it, and a secondary one (+0x09, bank
          // +0x0B: the shadow) unless bit 14 does. Nothing else hides a listed
          // entity: +0x10 bit 5 is "scripted" (control(NONE), walk(), every
          // cutscene actor), not "invisible" - skipping it lost the intro's cast.
          const hideFlags = buf[rel + 0x12] | (buf[rel + 0x13] << 8);
          const spriteBank = buf[rel + 0x08];
          const spriteAddr = buf[rel + 0x06] | (buf[rel + 0x07] << 8);
          const mainOk = !(hideFlags & 0x8000) && spriteBank >= 0xC0 && spriteBank <= 0xDF && spriteAddr >= 3;
          const secBank = buf[rel + 0x0B];
          const secAddr = buf[rel + 0x09] | (buf[rel + 0x0A] << 8);
          const secOk = !(hideFlags & 0x4000) && secBank >= 0xC0 && secBank <= 0xDF && secAddr >= 3;
          // Spawned but never activated (waiting in $3DE1 until the camera
          // comes near): no sprite yet, so stand it in its record's standing
          // frame rather than let it pop in at the screen edge.
          let idle = null;
          if (!mainOk && !secOk && !(hideFlags & 0x8000)) {
            const type = buf[rel + 0x60] | (buf[rel + 0x61] << 8);
            if (type >= 0x8000) idle = idleSpriteFor(type, buf[rel + 0x22]);
          }
          if (!mainOk && !secOk && !idle) continue;

          const isBoy = (addr === 0x4E89);
          const isDog = (addr === 0x4F37);
          const depth = entityDepth(buf, rel);
          if (depth === 'hidden') continue;

          const rawX = buf[rel + 0x1A] | (buf[rel + 0x1B] << 8);
          const posX = rawX >= 0x8000 ? rawX - 0x10000 : rawX;
          const rawY = buf[rel + 0x1C] | (buf[rel + 0x1D] << 8);
          const posY = rawY >= 0x8000 ? rawY - 0x10000 : rawY;
          const rawZ = buf[rel + 0x1E] | (buf[rel + 0x1F] << 8);
          const posZ = rawZ >= 0x8000 ? rawZ - 0x10000 : rawZ;

          // +0x0C is the entity's palette slot; $7E1278 holds the ROM address
          // of the palette loaded in each slot. That is the engine's own answer
          // for the Boy and Dog too (the Dog's changes per act and per floor).
          const slotOffset = buf[rel + 0x0C] & 0x0E;
          let palAddr = preState.palSlotBuf ? (preState.palSlotBuf[slotOffset] | (preState.palSlotBuf[slotOffset + 1] << 8)) : 0;
          if (!palAddr) {
            if (isBoy) {
              palAddr = 0xAD0B;
            } else if (isDog) {
              palAddr = getDogPalette(preState.mapId, spriteBank);
            } else {
              const stype = buf[rel + 0x60] | (buf[rel + 0x61] << 8);
              if (stype >= 0x8000) {
                const recOffset = snesToRom(0x8E0000 | (stype + 0x09));
                if (recOffset >= 0 && recOffset + 2 <= rom.length) {
                  palAddr = rom[recOffset] | (rom[recOffset + 1] << 8);
                }
              }
            }
          }
          if (!palAddr) palAddr = 0xAD0B;

          // $8FC7E8: in a room with effect 2 a plane-0 character is placed
          // against BG1's scroll (it belongs to the parallax layer), and two
          // lines lower than the camera formula gives.
          const onBg1 = preState.roomEffect === 2 && (buf[rel + 0x18] & 0x30) === 0;
          const refX = onBg1 ? preState.bg1X : layout.camX;
          const refY = onBg1 ? preState.bg1Y - 2 : layout.camY;
          const live = { cg: preState.cgramBuf, slot: slotOffset };
          // The secondary sprite sits on the ground (no height) and sorts
          // just behind the main one, as the engine queues it.
          const parts = [];
          if (secOk) parts.push({ ptr: (secBank << 16) | secAddr, lift: 0, sort: posY - 0.5 });
          if (mainOk) parts.push({ ptr: (spriteBank << 16) | spriteAddr, lift: Math.floor(posZ / 16), sort: posY });
          if (idle) parts.push({ ptr: idle.sprite, lift: 0, sort: posY, pal: idle.palette });
          for (let k = 0; k < parts.length; k++) {
            // An idle stand-in has no palette slot yet: its record's colours.
            const sprite = parts[k].pal
              ? getDecodedSprite(rom, parts[k].ptr, parts[k].pal & 0xFFFF, null)
              : getDecodedSprite(rom, parts[k].ptr, palAddr, live);
            if (!sprite) continue;
            const screenX = layout.emuX + (posX - sprite.originX - refX) * layout.scaleSnes;
            const screenY = layout.emuY + (posY - sprite.originY - parts[k].lift - refY) * layout.scaleSnes;
            const screenW = sprite.width * layout.scaleSnes;
            const screenH = sprite.height * layout.scaleSnes;
            if (screenX + screenW <= 0 || screenX >= layout.wrapW || screenY + screenH <= 0 || screenY >= layout.wrapH) continue;
            drawList.push({
              canvas: sprite.canvas,
              x: screenX,
              y: screenY,
              w: screenW,
              h: screenH,
              sortY: parts[k].sort,
              // Never activated means +0x3C (the tile under it) was never
              // filled; most tiles put a character in front.
              front: parts[k].pal ? true : depth === 'front',
            });
          }
        }
      }

      // 2. Projectiles from WRAM projBuf (0x7E6387, 8 slots * 44 bytes)
      if (preState.projBuf) {
        const pbuf = preState.projBuf;
        for (let p = 0; p < 8; p++) {
          const rel = p * 44;
          const active = pbuf[rel + 0x10] | (pbuf[rel + 0x11] << 8);
          if (!active) continue;

          // Coordinates are 1/16 subpixels in WRAM ($90DE88 shifts right 4 bits)
          const rawX = pbuf[rel + 0x14] | (pbuf[rel + 0x15] << 8);
          const posX = Math.floor((rawX >= 0x8000 ? rawX - 0x10000 : rawX) / 16);
          const rawY = pbuf[rel + 0x16] | (pbuf[rel + 0x17] << 8);
          const posY = Math.floor((rawY >= 0x8000 ? rawY - 0x10000 : rawY) / 16);
          const rawZ = pbuf[rel + 0x18] | (pbuf[rel + 0x19] << 8);
          const posZ = Math.floor((rawZ >= 0x8000 ? rawZ - 0x10000 : rawZ) / 16);

          const spriteBank = pbuf[rel + 0x08];
          const spriteAddr = pbuf[rel + 0x06] | (pbuf[rel + 0x07] << 8);
          const slotOffset = pbuf[rel + 0x0C] & 0x0E;
          const palAddr = preState.palSlotBuf ? (preState.palSlotBuf[slotOffset] | (preState.palSlotBuf[slotOffset + 1] << 8)) : 0;

          let sprite = null;
          if (spriteBank >= 0xC0 && spriteBank <= 0xDF && spriteAddr >= 3) {
            const spritePtr = (spriteBank << 16) | spriteAddr;
            sprite = getDecodedSprite(rom, spritePtr, palAddr || 0xad0b, { cg: preState.cgramBuf, slot: slotOffset });
          }

          if (sprite) {
            const roomSpriteX = posX - sprite.originX;
            const roomSpriteY = posY - sprite.originY - posZ;
            const screenX = layout.emuX + (roomSpriteX - layout.camX) * layout.scaleSnes;
            const screenY = layout.emuY + (roomSpriteY - layout.camY) * layout.scaleSnes;
            const screenW = sprite.width * layout.scaleSnes;
            const screenH = sprite.height * layout.scaleSnes;

            if (screenX + screenW > 0 && screenX < layout.wrapW && screenY + screenH > 0 && screenY < layout.wrapH) {
              drawList.push({
                canvas: sprite.canvas,
                x: screenX,
                y: screenY,
                w: screenW,
                h: screenH,
                sortY: posY,
                front: true,
              });
            }
          } else {
            const screenX = layout.emuX + (posX - layout.camX) * layout.scaleSnes;
            const screenY = layout.emuY + (posY - posZ - layout.camY) * layout.scaleSnes;
            const rad = Math.max(3, Math.round(5 * layout.scaleSnes));
            if (screenX + rad > 0 && screenX - rad < layout.wrapW && screenY + rad > 0 && screenY - rad < layout.wrapH) {
              drawList.push({
                isOrb: true,
                x: screenX,
                y: screenY,
                rad: rad,
                sortY: posY,
                front: true,
              });
            }
          }
        }
      }

      drawList.sort((a, b) => a.sortY - b.sortY);
      drawEntityItems(extEntCtx, drawList.filter(item => !item.front));
      return drawList.filter(item => item.front);
    }

    // readMemoryRange caps a call at 4096 bytes (the core's static buffer) and
    // returns a short array past that, which silently cut the Boy ($4E89) and
    // Dog ($4F37) off the end of the entity table.
    function readMemoryChunked(m, addr, size) {
      const out = new Uint8Array(size);
      for (let off = 0; off < size; off += 4096) {
        const n = Math.min(4096, size - off);
        out.set(m.readMemoryRange(addr + off, n).subarray(0, n), off);
      }
      return out;
    }

    function samplePreLoopState() {
      const m = getModule();
      if (!m || !hasDebuggerApi(m) || !loadedRomData) return null;
      let camX = 0, camY = 0, mapId = -1, trigOffX = 0, trigOffY = 0, bg1X = 0, bg1Y = 0;
      let iniDisp = 0x0F, cgramBuf = null, mainScreen = 0x17, roomEffect = 0;
      let entBuf = null, palSlotBuf = null, projBuf = null, objStateBuf = null, grassQueueBuf = null, animIdxBuf = null;

      try {
        const camBuf = m.readMemoryRange(0x7E0112, 4);
        if (!camBuf || camBuf.length < 4) return null;
        const rawX = camBuf[0] | (camBuf[1] << 8);
        camX = rawX >= 0x8000 ? rawX - 0x10000 : rawX;
        const rawY = camBuf[2] | (camBuf[3] << 8);
        camY = rawY >= 0x8000 ? rawY - 0x10000 : rawY;
        bg1X = camX;
        bg1Y = camY;

        // BG1 (the canopy layer) scrolls from its own shadow. Most rooms copy
        // the camera into it; a parallax room feeds it from elsewhere
        // ($D09B7A: BG1 from $12/$14, BG2 from the camera $59/$5B).
        const bg1Buf = m.readMemoryRange(0x7E010E, 4);
        if (bg1Buf && bg1Buf.length >= 4) {
          const b1x = bg1Buf[0] | (bg1Buf[1] << 8);
          const b1y = bg1Buf[2] | (bg1Buf[3] << 8);
          bg1X = b1x >= 0x8000 ? b1x - 0x10000 : b1x;
          bg1Y = b1y >= 0x8000 ? b1y - 0x10000 : b1y;
        }

        const mapBuf = m.readMemoryRange(0x7E0ADB, 1);
        if (mapBuf && mapBuf.length >= 1) mapId = mapBuf[0];

        const offBuf = m.readMemoryRange(0x7E0F86, 4);
        if (offBuf && offBuf.length >= 4) {
          const rawOX = offBuf[0] | (offBuf[1] << 8);
          trigOffX = rawOX >= 0x8000 ? rawOX - 0x10000 : rawOX;
          const rawOY = offBuf[2] | (offBuf[3] << 8);
          trigOffY = rawOY >= 0x8000 ? rawOY - 0x10000 : rawOY;
        }

        // The PPU itself when the core exposes it: read before mainLoop() it is
        // exactly what this frame renders with. The game's own shadows run
        // ahead of the picture (the CGRAM mirror by a frame or more, through
        // the upload queue), which showed as the ring menu and death fades
        // landing early on the extended layers.
        const ppu = typeof m._getPpuView === 'function' ? m._getPpuView() : 0;
        if (ppu && typeof HEAPU8 !== 'undefined') {
          cgramBuf = HEAPU8.slice(ppu, ppu + 512);
          iniDisp = HEAPU8[ppu + 512];
          mainScreen = HEAPU8[ppu + 513];
        } else {
          const iniBuf = m.readMemoryRange(INIDISP_SHADOW, 1);
          if (iniBuf && iniBuf.length >= 1) iniDisp = iniBuf[0];
          // One frame behind the mirror is when it reaches CGRAM.
          cgramBuf = lastCgramMirror;
          lastCgramMirror = m.readMemoryRange(CGRAM_MIRROR, 512);
        }
        const effBuf = m.readMemoryRange(ROOM_EFFECT, 1);
        if (effBuf && effBuf.length >= 1) roomEffect = effBuf[0];

        entBuf = readMemoryChunked(m, 0x7E3DDF, 0x1220);
        palSlotBuf = m.readMemoryRange(0x7E1278, 16);
        projBuf = m.readMemoryRange(0x7E6387, 352);
        objStateBuf = m.readMemoryRange(0x7E10CE, 160);
        grassQueueBuf = m.readMemoryRange(0x7E0FD0, 148);
        animIdxBuf = m.readMemoryRange(ANIM_FRAME_INDEX_ADDR, ANIM_MAX_CHANNELS);
      } catch (_) {
        return null;
      }

      return {
        camX: camX,
        camY: camY,
        bg1X: bg1X,
        bg1Y: bg1Y,
        iniDisp: iniDisp,
        cgramBuf: cgramBuf,
        mainScreen: mainScreen,
        roomEffect: roomEffect,
        mapId: mapId,
        trigOffX: trigOffX,
        trigOffY: trigOffY,
        entBuf: entBuf,
        palSlotBuf: palSlotBuf,
        projBuf: projBuf,
        objStateBuf: objStateBuf,
        grassQueueBuf: grassQueueBuf,
        animIdxBuf: animIdxBuf,
      };
    }

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

    // Just above the entity the camera follows ($7E:0F42 points into the entity records sampled at
    // $7E:3DDF): x, and y minus the elevation; for the CDL float (cdl-float.js). Null when unknown.
    function gameCameraWorld(m, ps) {
      if (!ps.entBuf) return null;
      const ptr = m.readMemory(0x7E0F42) | (m.readMemory(0x7E0F43) << 8);
      const rel = ptr - 0x3DDF;
      if (rel < 0 || rel + 0x20 > ps.entBuf.length) return null;
      const b = ps.entBuf;
      const sx = v => (v >= 0x8000 ? v - 0x10000 : v);
      const x = sx(b[rel + 0x1A] | (b[rel + 0x1B] << 8));
      const y = sx(b[rel + 0x1C] | (b[rel + 0x1D] << 8)) - sx(b[rel + 0x1E] | (b[rel + 0x1F] << 8));
      return { x, y: y - 40 };
    }

    // A (re)started ROM: forget the room and the sprites of the last one (panel-webview.js bootRom).
    function gameRomReset() {
      idleSprites.clear();
      idleSpritesWanted = new Set();
      cachedMapId = -1;
      cachedTriggers = null;
      cachedObjects = null;
      cachedLootables = null;
      cachedAnimTiles = null;
      roomObjectsCache.clear();
      roomLootCache.clear();
      roomAnimTilesCache.clear();
      lastRequestedMapId = -1;
      activeRoomMap = null;
      spriteCache.clear();
    }

    // Room pictures and data from the host (host.js roomMap), for the overlays, OBJECTS and LOOT.
    function gameOnRoomMap(data) {
        if (Array.isArray(data.objects)) {
          roomObjectsCache.set(data.mapId, data.objects);
          if (data.mapId === cachedMapId) cachedObjects = data.objects;
        }
        if (Array.isArray(data.lootables)) {
          roomLootCache.set(data.mapId, data.lootables);
          if (data.mapId === cachedMapId) cachedLootables = data.lootables;
        }
        if (data.itemIcons) {
          cachedItemIcons = Object.assign(cachedItemIcons || {}, data.itemIcons);
        }
        if (typeof refreshMenuDataIfOpen === 'function') refreshMenuDataIfOpen();
        if (Array.isArray(data.animTiles)) {
          roomAnimTilesCache.set(data.mapId, data.animTiles);
          if (data.mapId === cachedMapId) cachedAnimTiles = data.animTiles;
        }
        let collImg = null;
        if (data.collisionUri) {
          collImg = new Image();
          collImg.src = data.collisionUri;
          roomCollisionCache.set(data.mapId, collImg);
          if (data.mapId === cachedMapId) cachedCollisionImg = collImg;
        }
        let overImg = null;
        if (data.overlayUri) {
          overImg = new Image();
          overImg.src = data.overlayUri;
          roomOverlayCache.set(data.mapId, overImg);
          if (data.mapId === cachedMapId) cachedOverlayImg = overImg;
        }
        if (data.imageUri) {
          const mapId = data.mapId;
          const img = new Image();
          let fgImg = null;
          if (data.foregroundUri) {
            fgImg = new Image();
            fgImg.src = data.foregroundUri;
          }
          const loadedGroups = [];
          if (Array.isArray(data.animGroups)) {
            for (let i = 0; i < data.animGroups.length; i++) {
              const g = data.animGroups[i];
              const toImg = fUri => {
                const fImg = new Image();
                fImg.src = fUri;
                return fImg;
              };
              const frameImgs = (g.frames || []).map(toImg);
              const fgFrameImgs = Array.isArray(g.fgFrames) ? g.fgFrames.map(toImg) : null;
              loadedGroups.push({
                x: g.x,
                y: g.y,
                w: g.w,
                h: g.h,
                channels: Array.isArray(g.channels) ? g.channels : [],
                chanLens: Array.isArray(g.chanLens) ? g.chanLens : [],
                frames: frameImgs,
                fgFrames: fgFrameImgs,
                frameIdx: 0,
              });
            }
          }
          let layerImgs = null;
          if (data.layers) {
            layerImgs = {};
            for (const k of ['bg1Low', 'bg1High', 'bg2Low', 'bg2High']) {
              const uri = data.layers[k];
              if (!uri) continue;
              layerImgs[k] = new Image();
              layerImgs[k].src = uri;
            }
          }
          let imgLoaded = false;
          let fgLoaded = !data.foregroundUri;
          function tryActivate() {
            if (!imgLoaded || !fgLoaded) return;
            activeRoomMap = {
              mapId: mapId,
              img: img,
              foregroundImg: fgImg,
              collisionImg: collImg,
              overlayImg: overImg,
              layers: layerImgs,
              bgPalette: Array.isArray(data.bgPalette) ? data.bgPalette : null,
              animGroups: loadedGroups,
              width: data.width,
              height: data.height,
              offX: data.offX,
              offY: data.offY,
              objects: data.objects || null,
              animTiles: data.animTiles || null,
            };
            redrawExtendedLayersNow();
          }
          img.onload = function() {
            imgLoaded = true;
            tryActivate();
          };
          if (fgImg) {
            fgImg.onload = function() {
              fgLoaded = true;
              tryActivate();
            };
            fgImg.onerror = function() {
              fgLoaded = true;
              tryActivate();
            };
          }
          img.src = data.imageUri;
        }
    }
  `;
}

function getOverlayTogglesScript() {
  return `
    function redrawExtendedLayersNow() {
      if (!emuEvermore || typeof renderExtendedMapAndOverlays !== 'function') return;
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

  `;
}

module.exports = { getScreenChipsHtml, getOverlaysScript, getOverlayTogglesScript };
