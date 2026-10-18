
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
        const namePtr = EvsRom.entityNamePointer(rom, stype);
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
          maxHp = EvsRom.entityRecordWord(rom, stype, EvsRom.RECORD_FIELDS.hp);
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
