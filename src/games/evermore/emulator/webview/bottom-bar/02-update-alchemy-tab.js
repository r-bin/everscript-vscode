// TODO port to TS (docs/todo/port-to-ts.md)

    // -- Update Alchemy & Projectiles Tab --
    function updateAlchemyTab(preState, rom) {
      if (!preState) return;
      const m = getModule();
      if (!m || !hasDebuggerApi(m)) return;

      let palcBuf = null;
      let aalcBuf = null;
      let projBuf = preState.projBuf;

      try {
        palcBuf = new Uint8Array(m.readMemoryRange(0x7E3564, 944).subarray(0, 944));
        aalcBuf = new Uint8Array(m.readMemoryRange(0x7E3364, 512).subarray(0, 512));
      } catch (_) {}

      let totalActive = 0;

      // 1. Projectile Alchemy (8 slots at $7E3564, 0x76 stride)
      const tbodyPalc = document.getElementById('alc-palc-tbody');
      let palcActive = 0;
      if (tbodyPalc && palcBuf) {
        tbodyPalc.innerHTML = '';
        for (let i = 0; i < 8; i++) {
          const slotAddr = 0x3564 + i * 0x76;
          const rel = i * 0x76;
          const active = (palcBuf[rel + 0x26] === 0);
          if (active) { palcActive++; totalActive++; }

          const spellType = palcBuf[rel + 0x12] | (palcBuf[rel + 0x13] << 8);
          const spellName = ALCHEMY_SPELL_MAP[spellType] || (spellType ? ('Formula $' + spellType.toString(16).toUpperCase()) : 'Empty');
          const power = palcBuf[rel + 0x2A] | (palcBuf[rel + 0x2B] << 8);
          const source = palcBuf[rel + 0x28] | (palcBuf[rel + 0x29] << 8);
          const target = palcBuf[rel + 0x2E] | (palcBuf[rel + 0x2F] << 8);

          const tr = document.createElement('tr');
          tr.className = 'menu-pick';
          // Icon
          const tdIcon = document.createElement('td');
          tdIcon.appendChild(createFormulaIconElement(spellName));
          tr.appendChild(tdIcon);
          // Slot
          const tdSlot = document.createElement('td');
          tdSlot.textContent = '#' + i + ' ($' + slotAddr.toString(16).toUpperCase() + ')';
          tr.appendChild(tdSlot);
          // Status
          const tdStatus = document.createElement('td');
          tdStatus.className = active ? 'slot-active' : 'slot-inactive';
          tdStatus.textContent = active ? 'ACTIVE' : 'inactive';
          tr.appendChild(tdStatus);
          // Spell
          const tdSpell = document.createElement('td');
          tdSpell.style.fontWeight = active ? 'bold' : 'normal';
          tdSpell.textContent = spellName + (spellType ? ' ($' + spellType.toString(16).toUpperCase() + ')' : '');
          tr.appendChild(tdSpell);
          // Power
          const tdPower = document.createElement('td');
          tdPower.textContent = active ? String(power) : '-';
          tr.appendChild(tdPower);
          // Source
          const tdSrc = document.createElement('td');
          tdSrc.textContent = (active && source) ? ('$' + source.toString(16).toUpperCase()) : '-';
          tr.appendChild(tdSrc);
          // Target
          const tdTgt = document.createElement('td');
          tdTgt.textContent = (active && target) ? ('$' + target.toString(16).toUpperCase()) : '-';
          tr.appendChild(tdTgt);

          tbodyPalc.appendChild(tr);
        }
      }
      const elPalcActive = document.getElementById('alc-palc-active-count');
      if (elPalcActive) elPalcActive.textContent = palcActive + ' active';

      // 2. Animation Alchemy (8 slots at $7E3364, 0x40 stride)
      const tbodyAalc = document.getElementById('alc-aalc-tbody');
      let aalcActive = 0;
      if (tbodyAalc && aalcBuf) {
        tbodyAalc.innerHTML = '';
        for (let i = 0; i < 8; i++) {
          const slotAddr = 0x3364 + i * 0x40;
          const rel = i * 0x40;
          const active = (aalcBuf[rel + 0x26] === 0);
          if (active) { aalcActive++; totalActive++; }

          const spellType = aalcBuf[rel + 0x12] | (aalcBuf[rel + 0x13] << 8);
          const spellName = ALCHEMY_SPELL_MAP[spellType] || (spellType ? ('Formula $' + spellType.toString(16).toUpperCase()) : 'Empty');
          const timer = aalcBuf[rel + 0x0E] | (aalcBuf[rel + 0x0F] << 8);
          const power = aalcBuf[rel + 0x2A] | (aalcBuf[rel + 0x2B] << 8);
          const source = aalcBuf[rel + 0x28] | (aalcBuf[rel + 0x29] << 8);

          const tr = document.createElement('tr');
          tr.className = 'menu-pick';
          const tdIcon = document.createElement('td');
          tdIcon.appendChild(createFormulaIconElement(spellName));
          tr.appendChild(tdIcon);
          const tdSlot = document.createElement('td');
          tdSlot.textContent = '#' + i + ' ($' + slotAddr.toString(16).toUpperCase() + ')';
          tr.appendChild(tdSlot);
          const tdStatus = document.createElement('td');
          tdStatus.className = active ? 'slot-active' : 'slot-inactive';
          tdStatus.textContent = active ? 'ACTIVE' : 'inactive';
          tr.appendChild(tdStatus);
          const tdSpell = document.createElement('td');
          tdSpell.style.fontWeight = active ? 'bold' : 'normal';
          tdSpell.textContent = spellName + (spellType ? ' ($' + spellType.toString(16).toUpperCase() + ')' : '');
          tr.appendChild(tdSpell);
          const tdTimer = document.createElement('td');
          tdTimer.textContent = active ? String(timer) : '-';
          tr.appendChild(tdTimer);
          const tdPower = document.createElement('td');
          tdPower.textContent = active ? String(power) : '-';
          tr.appendChild(tdPower);
          const tdSrc = document.createElement('td');
          tdSrc.textContent = (active && source) ? ('$' + source.toString(16).toUpperCase()) : '-';
          tr.appendChild(tdSrc);

          tbodyAalc.appendChild(tr);
        }
      }
      const elAalcActive = document.getElementById('alc-aalc-active-count');
      if (elAalcActive) elAalcActive.textContent = aalcActive + ' active';

      // 3. Projectiles (8 slots at $7E6387, 44-byte stride)
      const tbodyProj = document.getElementById('alc-proj-tbody');
      let projActive = 0;
      if (tbodyProj && projBuf) {
        tbodyProj.innerHTML = '';
        for (let i = 0; i < 8; i++) {
          const slotAddr = 0x6387 + i * 44;
          const rel = i * 44;
          const active = ((projBuf[rel + 0x10] | (projBuf[rel + 0x11] << 8)) !== 0);
          if (active) { projActive++; totalActive++; }

          const rawX = projBuf[rel + 0x14] | (projBuf[rel + 0x15] << 8);
          const posX = Math.floor((rawX >= 0x8000 ? rawX - 0x10000 : rawX) / 16);
          const rawY = projBuf[rel + 0x16] | (projBuf[rel + 0x17] << 8);
          const posY = Math.floor((rawY >= 0x8000 ? rawY - 0x10000 : rawY) / 16);
          const rawZ = projBuf[rel + 0x18] | (projBuf[rel + 0x19] << 8);
          const posZ = Math.floor((rawZ >= 0x8000 ? rawZ - 0x10000 : rawZ) / 16);

          const spriteBank = projBuf[rel + 0x08];
          const spriteAddr = projBuf[rel + 0x06] | (projBuf[rel + 0x07] << 8);
          const spritePtr = (spriteBank >= 0xC0 && spriteBank <= 0xDF && spriteAddr >= 3)
            ? ((spriteBank << 16) | spriteAddr)
            : 0;

          const slotOffset = projBuf[rel + 0x0C] & 0x0E;
          const palAddr = preState.palSlotBuf ? (preState.palSlotBuf[slotOffset] | (preState.palSlotBuf[slotOffset + 1] << 8)) : 0xAD0B;

          const lifetime = projBuf[rel + 0x1E] | (projBuf[rel + 0x1F] << 8);
          const power = projBuf[rel + 0x28] | (projBuf[rel + 0x29] << 8);
          const behaviour = projBuf[rel + 0x26] | (projBuf[rel + 0x27] << 8);

          const tr = document.createElement('tr');
          tr.className = 'menu-pick';
          const tdIcon = document.createElement('td');
          tdIcon.appendChild(renderProjectileIconCanvas(rom, spritePtr, palAddr));
          tr.appendChild(tdIcon);
          const tdSlot = document.createElement('td');
          tdSlot.textContent = '#' + i + ' ($' + slotAddr.toString(16).toUpperCase() + ')';
          tr.appendChild(tdSlot);
          const tdStatus = document.createElement('td');
          tdStatus.className = active ? 'slot-active' : 'slot-inactive';
          tdStatus.textContent = active ? 'ACTIVE' : 'inactive';
          tr.appendChild(tdStatus);
          const tdPos = document.createElement('td');
          tdPos.textContent = active ? (posX + ', ' + posY + (posZ ? ' (z:' + posZ + ')' : '')) : '-';
          tr.appendChild(tdPos);
          const tdLife = document.createElement('td');
          tdLife.textContent = active ? String(lifetime) : '-';
          tr.appendChild(tdLife);
          const tdPower = document.createElement('td');
          tdPower.textContent = active ? String(power) : '-';
          tr.appendChild(tdPower);
          const tdAction = document.createElement('td');
          tdAction.textContent = active ? ('Beh $' + behaviour.toString(16).toUpperCase() + ' (Ptr $' + spritePtr.toString(16).toUpperCase() + ')') : '-';
          tr.appendChild(tdAction);

          tbodyProj.appendChild(tr);
        }
      }
      const elProjActive = document.getElementById('alc-proj-active-count');
      if (elProjActive) elProjActive.textContent = projActive + ' active';

      const elTotal = document.getElementById('ss-alc-count');
      if (elTotal) elTotal.textContent = String(totalActive);
      if (typeof emuPanelRowsChanged === 'function') emuPanelRowsChanged('alchemy');
    }

    // -- Update Palettes Tab --
    function updatePalettesTab(preState, rom) {
      if (!rom) return;
      const m = getModule();

      // 1. Sprite Palettes
      const spriteGrid = document.getElementById('pal-sprite-grid');
      if (spriteGrid) {
        spriteGrid.innerHTML = '';
        const palSlotBuf = preState ? preState.palSlotBuf : (m ? m.readMemoryRange(0x7E1278, 16) : null);
        for (let i = 0; i < 8; i++) {
          let palAddr = palSlotBuf ? (palSlotBuf[i * 2] | (palSlotBuf[i * 2 + 1] << 8)) : 0;
          if (!palAddr) {
            if (i === 6) palAddr = 0xAD0B;
            else if (i === 7) palAddr = getDogPalette(preState ? preState.mapId : 0, 0);
            else palAddr = 0xAD0B;
          }
          const isStolen = (i === 2);
          const note = isStolen
            ? '(Stolen by Alchemy/Effects - The Glitch Slot)'
            : (i === 6 ? '(Boy - Home slot)' : (i === 7 ? '(Dog - Home slot)' : ''));
          const colors = paletteAt(rom, palAddr);

          const row = document.createElement('div');
          row.className = 'pal-row menu-pick' + (isStolen ? ' pal-stolen' : '');

          const titleEl = document.createElement('div');
          titleEl.className = 'pal-title';
          titleEl.innerHTML = '<span class="pal-name">Slot ' + i + ' ($90:' + palAddr.toString(16).toUpperCase() + ')</span> <span class="pal-note">' + note + '</span>';
          row.appendChild(titleEl);

          const strip = document.createElement('div');
          strip.className = 'pal-strip';
          for (let c = 0; c < 16; c++) {
            const col = colors[c] || [0, 0, 0];
            const hex = '#' + ((1 << 24) + (col[0] << 16) + (col[1] << 8) + col[2]).toString(16).slice(1);
            const box = document.createElement('div');
            box.className = 'pal-swatch';
            box.style.backgroundColor = hex;
            box.title = 'Color #' + c + ': ' + hex + ' (R:' + col[0] + ' G:' + col[1] + ' B:' + col[2] + ')';
            strip.appendChild(box);
          }
          row.appendChild(strip);
          spriteGrid.appendChild(row);
        }
      }

      // 2. Map Palettes
      const mapGrid = document.getElementById('pal-map-grid');
      if (mapGrid) {
        mapGrid.innerHTML = '';
        let mapPalBuf = null;
        if (m && hasDebuggerApi(m)) {
          try {
            mapPalBuf = new Uint8Array(m.readMemoryRange(0x7E61A7, 256).subarray(0, 256));
          } catch (_) {}
        }

        for (let p = 0; p < 8; p++) {
          const colors = [];
          let hasData = false;
          if (mapPalBuf) {
            for (let c = 0; c < 16; c++) {
              const off = p * 32 + c * 2;
              const w = mapPalBuf[off] | (mapPalBuf[off + 1] << 8);
              if (w > 0) hasData = true;
              colors.push([
                (w & 31) * 8,
                ((w >> 5) & 31) * 8,
                ((w >> 10) & 31) * 8,
              ]);
            }
          }
          if (!hasData) {
            // Default dark placeholders
            for (let c = 0; c < 16; c++) colors[c] = [c * 16, c * 16, c * 16];
          }

          const label = (p === 0) ? 'BG Pal 0 (HUD / Font)' : ('BG Pal ' + p + ' (Tile Family ' + (p - 1) + ')');
          const row = document.createElement('div');
          row.className = 'pal-row menu-pick';

          const titleEl = document.createElement('div');
          titleEl.className = 'pal-title';
          titleEl.innerHTML = '<span class="pal-name">' + label + '</span> <span class="pal-note">WRAM $7E' + (0x61A7 + p * 32).toString(16).toUpperCase() + '</span>';
          row.appendChild(titleEl);

          const strip = document.createElement('div');
          strip.className = 'pal-strip';
          for (let c = 0; c < 16; c++) {
            const col = colors[c];
            const hex = '#' + ((1 << 24) + (col[0] << 16) + (col[1] << 8) + col[2]).toString(16).slice(1);
            const box = document.createElement('div');
            box.className = 'pal-swatch';
            box.style.backgroundColor = hex;
            box.title = 'Color #' + c + ': ' + hex + ' (R:' + col[0] + ' G:' + col[1] + ' B:' + col[2] + ')';
            strip.appendChild(box);
          }
          row.appendChild(strip);
          mapGrid.appendChild(row);
        }
      }
      if (typeof emuPanelRowsChanged === 'function') emuPanelRowsChanged('palettes');
    }

    // -- Update Cheats Tab --
    function updateCheatsTab(m) {
      if (!m || !hasDebuggerApi(m)) return;
      try {
        const boyHp = m.readMemory(0x7E4EB3) | (m.readMemory(0x7E4EB4) << 8);
        const boyFlags = m.readMemory(0x7E4E99) | (m.readMemory(0x7E4E9A) << 8);
        const boyStat1 = m.readMemory(0x7E4ECF) | (m.readMemory(0x7E4ED0) << 8);

        const dogHp = m.readMemory(0x7E4F61) | (m.readMemory(0x7E4F62) << 8);
        const dogFlags = m.readMemory(0x7E4F47) | (m.readMemory(0x7E4F48) << 8);
        const dogStat1 = m.readMemory(0x7E4F7D) | (m.readMemory(0x7E4F7E) << 8);

        const elBHp = document.getElementById('mon-boy-hp');
        if (elBHp) elBHp.textContent = 'Boy HP: ' + boyHp;
        const elBFl = document.getElementById('mon-boy-flags');
        if (elBFl) elBFl.textContent = 'Boy Flags: $' + boyFlags.toString(16).toUpperCase();
        const elBSt = document.getElementById('mon-boy-status');
        if (elBSt) elBSt.textContent = 'Boy Status 1: $' + boyStat1.toString(16).toUpperCase();

        const elDHp = document.getElementById('mon-dog-hp');
        if (elDHp) elDHp.textContent = 'Dog HP: ' + dogHp;
        const elDFl = document.getElementById('mon-dog-flags');
        if (elDFl) elDFl.textContent = 'Dog Flags: $' + dogFlags.toString(16).toUpperCase();
        const elDSt = document.getElementById('mon-dog-status');
        if (elDSt) elDSt.textContent = 'Dog Status 1: $' + dogStat1.toString(16).toUpperCase();
      } catch (_) {}
    }

    function refreshActiveBottomTab() {
      const rom = loadedRomData
        ? ((loadedRomData.length % 1024 === 512) ? loadedRomData.subarray(512) : loadedRomData)
        : null;
      const m = getModule();

      // Every panel that can be seen (webview/emulator-panels.js), not only one.
      if (emuPanelVisible('entities')) updateEntitiesTab(lastSampledPreState, rom);
      if (emuPanelVisible('alchemy')) updateAlchemyTab(lastSampledPreState, rom);
      if (emuPanelVisible('palettes')) updatePalettesTab(lastSampledPreState, rom);
    }

  