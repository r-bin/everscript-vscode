// TODO port to TS (docs/todo/port-to-ts.md)

    const SCRIPT_TOKEN = /("[^"]*")|(\([^()]*\))|(\$[0-9a-fA-F]+|0x[0-9a-fA-F]+|\b0d\d+\b|\b\d+\b)|(^[A-Z][A-Z_?]+(?: [A-Z][A-Z_?]+)?\b|\b_[a-z_]+(?=\())/g;

    function scriptHighlight(text) {
      let out = '';
      let last = 0;
      let m;
      const src = String(text || '');
      const re = new RegExp(SCRIPT_TOKEN.source, 'g');
      while ((m = re.exec(src))) {
        out += escH(src.slice(last, m.index));
        if (m[2]) {
          const aside = !src.slice(m.index + m[0].length).trim();
          const inner = '(' + scriptHighlight(m[2].slice(1, -1)) + ')';
          out += aside ? '<span class="sx-aside">' + inner + '</span>' : inner;
        } else {
          out += '<span class="' + (m[1] ? 'sx-str' : m[3] ? 'sx-num' : 'sx-kw') + '">' + escH(m[0]) + '</span>';
        }
        last = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++;
      }
      return out + escH(src.slice(last));
    }

    const scriptSlotTrackers = Array.from({ length: SLOT_COUNT }, () => ({
      loc: 0,
      state: 0,
      timer1: 0,
      entity: 0,
      triggerKind: null,
      triggerIndex: null,
      initialized: false,
    }));

    let lastStepOnScriptId = 0xFFFF;
    let lastStepOnIndex = -1;
    // A (re)started ROM (panel-webview.js bootRom).
    function gameTraceReset() {
      lastStepOnScriptId = 0xFFFF;
      lastStepOnIndex = -1;
    }

    let totalTraceCount = 0;

    function isValidScriptAddr(loc) {
      if (typeof loc !== 'number' || isNaN(loc)) return false;
      const raw = loc >>> 0;
      if (raw === 0 || raw === 0x555555 || raw === 0xFFFFFF) return false;
      const bank = (raw >>> 16) & 0xFF;
      const addr = raw & 0xFFFF;
      if (bank < 0x80 || addr < 0x8000) return false;
      return true;
    }

    function checkScriptExecutionTrace() {
      const m = getModule();
      if (!m || !hasDebuggerApi(m)) return;
      const region = m.readMemoryRange(SCRIPT_STACK_BUS_ADDR, SCRIPT_REGION_SIZE);
      if (!region || region.length < SCRIPT_REGION_SIZE) return;

      const batch = [];

      for (let s = 0; s < SLOT_COUNT; s++) {
        const base = s * SLOT_SIZE;
        const loc = readU24(region, base + 0x00);
        const state = readU16(region, base + 0x03);
        const timer1 = readU16(region, base + 0x05);
        const entity = readU16(region, base + 0x0D);
        const tracker = scriptSlotTrackers[s];

        if (!tracker.initialized) {
          tracker.loc = loc;
          tracker.state = state;
          tracker.timer1 = timer1;
          tracker.entity = entity;
          tracker.initialized = true;
          continue;
        }

        let event = null;
        let targetLoc = 0;

        // Condition 1: New script started
        if ((tracker.state === 0 || tracker.loc === 0) && (state !== 0 && loc !== 0)) {
          event = 'start';
          targetLoc = loc;
          if (typeof lastInjectedTrigger !== 'undefined' && lastInjectedTrigger && romFrameCount <= lastInjectedTrigger.expiryFrame) {
            tracker.triggerKind = lastInjectedTrigger.kind;
            tracker.triggerIndex = lastInjectedTrigger.index;
            lastInjectedTrigger = null;
          }
        }
        // Condition 2: Slot was waiting (state 4) and resumed to executing (state 2)
        else if (tracker.state === 4 && state === 2) {
          event = 'resume';
          targetLoc = loc;
        }
        // Condition 3: Slot was waiting, still waiting, but loc advanced (ran & slept within this frame)
        else if (tracker.state === 4 && state === 4 && loc !== tracker.loc && tracker.loc !== 0) {
          event = 'resume';
          targetLoc = tracker.loc;
        }
        // Condition 4: Slot executing and stepped loc
        else if (tracker.state === 2 && state === 2 && loc !== tracker.loc && loc !== 0) {
          event = 'step';
          targetLoc = loc;
        }
        // Condition 5: Slot ended
        else if (tracker.state !== 0 && state === 0 && tracker.loc !== 0) {
          event = 'end';
          targetLoc = tracker.loc;
        }

        // Filter cold-RAM garbage or uninitialized addresses
        if (event && !isValidScriptAddr(targetLoc)) {
          event = null;
        }

        // Room 0x15 enter script executes in frame 1 and reaches 0xBC8006 before frame poll.
        // Catch when slot 0 starts and points to 0xBC8000..0xBC8008, resetting targetLoc to 0xBC8000
        if (s === 0 && event === 'start' && targetLoc >= 0xBC8000 && targetLoc <= 0xBC8008) {
          targetLoc = 0xBC8000;
        }

        if (event && targetLoc > 0) {
          let rawBytes = [];
          try {
            const buf = m.readMemoryRange(targetLoc, 32);
            if (buf && buf.length) rawBytes = Array.from(buf);
          } catch (_) {}
          const elapsedSec = romLaunchTimestamp > 0 ? ((performance.now() - romLaunchTimestamp) / 1000) : 0;
          const timeStr = '+' + elapsedSec.toFixed(2) + 's, f' + romFrameCount;
          const entry = {
            slot: s,
            entity,
            event,
            loc: targetLoc,
            nextLoc: loc,
            state,
            timer1,
            bytes: rawBytes,
            timeStr,
            frame: romFrameCount,
          };
          if (tracker.triggerKind) {
            entry.triggerKind = tracker.triggerKind;
            entry.triggerIndex = tracker.triggerIndex;
            if (event === 'end') {
              tracker.triggerKind = null;
              tracker.triggerIndex = null;
            }
          }
          batch.push(entry);
        }

        tracker.loc = loc;
        tracker.state = state;
        tracker.timer1 = timer1;
        tracker.entity = entity;
      }

      // Step-on trigger execution detection via $7E2429
      try {
        const curStepOnScriptId = (m.readMemory(0x7E2429) | (m.readMemory(0x7E242A) << 8)) >>> 0;
        if (curStepOnScriptId !== 0xFFFF && curStepOnScriptId !== 0x5555) {
          let activeStepIndex = -1;
          if (typeof cachedTriggers !== 'undefined' && cachedTriggers && Array.isArray(cachedTriggers.stepOn) && cachedTriggers.stepOn.length > 0) {
            const rawBoyX = m.readMemory(0x7E4EA3) | (m.readMemory(0x7E4EA4) << 8);
            const rawBoyY = m.readMemory(0x7E4EA5) | (m.readMemory(0x7E4EA6) << 8);
            const rawOX = m.readMemory(0x7E0F86) | (m.readMemory(0x7E0F87) << 8);
            const rawOY = m.readMemory(0x7E0F88) | (m.readMemory(0x7E0F89) << 8);
            const playerTileX = ((rawBoyX >> 4) + rawOX) & 0xFFFF;
            const playerTileY = ((rawBoyY >> 4) + rawOY) & 0xFFFF;
            const sList = cachedTriggers.stepOn;

            // Replicate SNES $8FACB1 step-on search:
            // Condition: playerTileY >= t.y1 && playerTileY < t.y2 && playerTileX >= t.x1 && playerTileX < t.x2
            for (let i = 0; i < sList.length; i++) {
              const t = sList[i];
              if (playerTileY >= t.y1 && playerTileY < t.y2 &&
                  playerTileX >= t.x1 && playerTileX < t.x2) {
                activeStepIndex = i;
                break;
              }
            }
            if (activeStepIndex === -1) {
              for (let i = 0; i < sList.length; i++) {
                if (sList[i].scriptId === curStepOnScriptId) {
                  activeStepIndex = i;
                  break;
                }
              }
            }
          }
          if (activeStepIndex === -1) activeStepIndex = 0;

          const slotStartItem = batch.find(item => item.event === 'start' && item.slot === 0);
          if (slotStartItem) {
            slotStartItem.triggerKind = 'stepOn';
            slotStartItem.triggerIndex = activeStepIndex;
            if (scriptSlotTrackers[0]) {
              scriptSlotTrackers[0].triggerKind = 'stepOn';
              scriptSlotTrackers[0].triggerIndex = activeStepIndex;
            }
          } else {
            if (scriptSlotTrackers[0] && scriptSlotTrackers[0].state !== 0 && !scriptSlotTrackers[0].triggerKind) {
              scriptSlotTrackers[0].triggerKind = 'stepOn';
              scriptSlotTrackers[0].triggerIndex = activeStepIndex;
            }
            const isNewActivation = (lastStepOnScriptId === 0xFFFF) || (activeStepIndex !== lastStepOnIndex && lastStepOnIndex !== -1);
            if (isNewActivation) {
              const targetLoc = resolveScriptIdToSnes(loadedRomData, curStepOnScriptId);
              if (isValidScriptAddr(targetLoc)) {
                let rawBytes = [];
                try {
                  const buf = m.readMemoryRange(targetLoc, 32);
                  if (buf && buf.length) rawBytes = Array.from(buf);
                } catch (_) {}
                const elapsedSec = romLaunchTimestamp > 0 ? ((performance.now() - romLaunchTimestamp) / 1000) : 0;
                const timeStr = '+' + elapsedSec.toFixed(2) + 's, f' + romFrameCount;
                // Emit paired start and end for 0-frame executions so lifecycle is consistently logged
                batch.push({
                  slot: 0,
                  entity: 0x4E89,
                  event: 'start',
                  loc: targetLoc,
                  nextLoc: targetLoc,
                  state: 0,
                  timer1: 0,
                  bytes: rawBytes,
                  timeStr,
                  frame: romFrameCount,
                  triggerKind: 'stepOn',
                  triggerIndex: activeStepIndex,
                });
                batch.push({
                  slot: 0,
                  entity: 0x4E89,
                  event: 'end',
                  loc: targetLoc,
                  nextLoc: targetLoc,
                  state: 0,
                  timer1: 0,
                  bytes: [],
                  timeStr,
                  frame: romFrameCount,
                  triggerKind: 'stepOn',
                  triggerIndex: activeStepIndex,
                });
              }
            }
          }
          lastStepOnScriptId = curStepOnScriptId;
          lastStepOnIndex = activeStepIndex;
        } else {
          lastStepOnScriptId = 0xFFFF;
          lastStepOnIndex = -1;

          // B-trigger execution detection for slot 0
          const slotStartItem = batch.find(item => item.event === 'start' && item.slot === 0);
          if (slotStartItem && !slotStartItem.triggerKind && typeof cachedTriggers !== 'undefined' && cachedTriggers && Array.isArray(cachedTriggers.bTrigger) && cachedTriggers.bTrigger.length > 0) {
            const rawBoyX = m.readMemory(0x7E4EA3) | (m.readMemory(0x7E4EA4) << 8);
            const rawBoyY = m.readMemory(0x7E4EA5) | (m.readMemory(0x7E4EA6) << 8);
            const rawOX = m.readMemory(0x7E0F86) | (m.readMemory(0x7E0F87) << 8);
            const rawOY = m.readMemory(0x7E0F88) | (m.readMemory(0x7E0F89) << 8);
            const playerTileX = ((rawBoyX >> 4) + rawOX) & 0xFFFF;
            const playerTileY = ((rawBoyY >> 4) + rawOY) & 0xFFFF;
            const rawFacing = m.readMemory(0x7E4EAB);
            const FACING_DELTAS = {
              0:  [ 0, -1], // N
              2:  [ 1, -1], // NE
              4:  [ 1,  0], // E
              6:  [ 1,  1], // SE
              8:  [ 0,  1], // S
              10: [-1,  1], // SW
              12: [-1,  0], // W
              14: [-1, -1], // NW
            };
            const delta = FACING_DELTAS[rawFacing & 0x0E] || [0, 1];
            const targetTileX = (playerTileX + delta[0]) & 0xFFFF;
            const targetTileY = (playerTileY + delta[1]) & 0xFFFF;
            const bList = cachedTriggers.bTrigger;
            let activeBIndex = -1;

            // 1. Check facing tile first (normal B-press target)
            for (let i = 0; i < bList.length; i++) {
              const t = bList[i];
              if (targetTileY >= t.y1 && targetTileY < t.y2 &&
                  targetTileX >= t.x1 && targetTileX < t.x2) {
                activeBIndex = i;
                break;
              }
            }
            // 2. Check player standing tile as fallback
            if (activeBIndex === -1) {
              for (let i = 0; i < bList.length; i++) {
                const t = bList[i];
                if (playerTileY >= t.y1 && playerTileY < t.y2 &&
                    playerTileX >= t.x1 && playerTileX < t.x2) {
                  activeBIndex = i;
                  break;
                }
              }
            }
            // 3. Check matching script address in B-triggers
            if (activeBIndex === -1 && slotStartItem.loc) {
              for (let i = 0; i < bList.length; i++) {
                const tLoc = resolveScriptIdToSnes(loadedRomData, bList[i].scriptId);
                if (tLoc === slotStartItem.loc && tLoc !== 0x92A42F) {
                  activeBIndex = i;
                  break;
                }
              }
            }

            if (activeBIndex !== -1) {
              slotStartItem.triggerKind = 'bTrigger';
              slotStartItem.triggerIndex = activeBIndex;
              if (scriptSlotTrackers[0]) {
                scriptSlotTrackers[0].triggerKind = 'bTrigger';
                scriptSlotTrackers[0].triggerIndex = activeBIndex;
              }
            }
          }
        }
      } catch (_) {}

      if (batch.length > 0 && vscodeApi) {
        vscodeApi.postMessage({ command: 'scriptTraceBatch', items: batch });
      }
    }

    function appendTraceEntries(entries) {
      const container = document.getElementById('ss-trace-log');
      if (!container || !entries || !entries.length) return;
      const frag = document.createDocumentFragment();
      for (const entry of entries) {
        const wrapper = document.createElement('div');
        wrapper.className = 'ss-trace-entry ' + (entry.event || '');
        if (entry.html) {
          wrapper.innerHTML = entry.html;
        } else {
          wrapper.textContent = entry.line || '';
        }
        frag.appendChild(wrapper);
      }
      container.appendChild(frag);
      while (container.childNodes.length > 250) {
        container.removeChild(container.firstChild);
      }
      totalTraceCount += entries.length;
      const tabCountEl = document.getElementById('ss-tab-trace-count');
      if (tabCountEl) {
        tabCountEl.textContent = totalTraceCount;
      }
      // Always follow the newest line: nothing arrives while paused, so pausing keeps the view.
      container.scrollTop = container.scrollHeight;
    }

    // The TRACE menu tab's "Clear" row (emulator-panels.js emuPanelMenuAction).
    function traceClear() {
      const log = document.getElementById('ss-trace-log');
      if (log) log.innerHTML = '';
      totalTraceCount = 0;
      const tabCount = document.getElementById('ss-tab-trace-count');
      if (tabCount) tabCount.textContent = '0';
    }

  