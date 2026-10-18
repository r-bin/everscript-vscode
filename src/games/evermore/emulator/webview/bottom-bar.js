
    // -- Bottom bar client-side logic ------------------------------------------

    const ALCHEMY_SPELL_MAP = {
      0x8c86: 'Fireball',
      0x8756: 'Flash',
      0x926c: 'Hard Ball',
      0x8110: 'Flare',
      0x86f0: 'Acid Rain',
      0x8b2a: 'Atlas',
      0x944c: 'Barrier',
      0x95fa: 'Call Up',
      0x8f20: 'Corrosion',
      0x8a9c: 'Crush',
      0x85da: 'Cure',
      0x872a: 'Defend',
      0x9362: 'Double Drain',
      0x8984: 'Drain',
      0x9610: 'Energize',
      0x8e22: 'Escape',
      0x9002: 'Explosion',
      0x8f8e: 'Fire Power',
      0x962a: 'Force Field',
      0x886c: 'Heal',
      0x8e36: 'Lance',
      0x896e: 'Levitate',
      0x91cc: 'Lightning Storm',
      0x8ff4: 'Miracle Cure',
      0x8bb8: 'Nitro',
      0x8c08: 'One Up',
      0x8cfc: 'Reflect',
      0x8a1a: 'Regrowth',
      0x88f2: 'Revealer',
      0x8d5c: 'Slow Burn',
      0x88aa: 'Speed',
      0x90d2: 'Sting',
      0x8dca: 'Stop',
      0x87d6: 'Super Ball',
      0x959e: 'Super Heal'
    };

    let loadedAlchemyIcons = {};

    /** The page's game-data hook: what host.js romData() built from the ROM (the ALCHEMY icons). */
    function gameRomData(data, redraw) {
      loadedAlchemyIcons = data.alchemyIcons || {};
      if (redraw && emuPanelVisible('alchemy')) updateAlchemyTab(lastSampledPreState, bottomBarRom());
    }

    // Cheats state
    let cheatAtlasEnabled = false;
    let cheatInvincibleEnabled = false;
    let cheatNoclipEnabled = false;

    // What ENTITIES / ALCHEMY / PALETTES list: chosen in their pause-menu tab ("Show" row,
    // webview/emulator-panels.js emuPanelMenuValue), the same wherever the panel is shown.
    const PANEL_FILTERS = {
      entities: [['all', 'All'], ['party', 'Party'], ['enemies', 'Enemies'], ['npcs', 'NPCs']],
      alchemy: [['all', 'All'], ['palc', 'Projectile alchemy'], ['aalc', 'Animation alchemy'], ['proj', 'Projectiles']],
      palettes: [['all', 'All'], ['sprites', 'Sprite palettes'], ['maps', 'Map palettes']],
    };
    const panelFilter = { entities: 'all', alchemy: 'all', palettes: 'all' };
    const entityCounts = { all: 0, party: 0, enemies: 0, npcs: 0 };

    function panelFilterLabel(name) {
      const list = PANEL_FILTERS[name];
      if (!list) return '';
      const hit = list.find(f => f[0] === panelFilter[name]) || list[0];
      return hit[1] + (name === 'entities' ? ' (' + entityCounts[hit[0]] + ')' : '');
    }

    // Steps the filter (clamped, no wrap-around); true when it changed.
    function panelFilterStep(name, delta) {
      const list = PANEL_FILTERS[name];
      if (!list) return false;
      const i = list.findIndex(f => f[0] === panelFilter[name]);
      const next = Math.max(0, Math.min(list.length - 1, i + delta));
      if (next === i) return false;
      panelFilter[name] = list[next][0];
      applyPanelFilter(name);
      return true;
    }

    function applyPanelFilter(name) {
      const f = panelFilter[name];
      const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
      if (name === 'alchemy') {
        for (const k of ['palc', 'aalc', 'proj']) show('alc-sec-' + k, f === 'all' || f === k);
      } else if (name === 'palettes') {
        for (const k of ['sprites', 'maps']) show('pal-sec-' + k, f === 'all' || f === k);
      } else if (name === 'entities') {
        updateEntitiesTab(lastSampledPreState, bottomBarRom());
      }
    }

    function bottomBarRom() {
      return loadedRomData ? ((loadedRomData.length % 1024 === 512) ? loadedRomData.subarray(512) : loadedRomData) : null;
    }

    function renderEntityIconCanvas(rom, spritePtr, palAddr) {
      const c = document.createElement('canvas');
      c.width = 22;
      c.height = 22;
      c.className = 'ent-icon';
      const ctx = c.getContext('2d');
      if (!rom || !spritePtr) {
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, 22, 22);
        return c;
      }
      const sprite = getDecodedSprite(rom, spritePtr, palAddr);
      if (!sprite || !sprite.width || !sprite.height) {
        ctx.fillStyle = '#242424';
        ctx.fillRect(0, 0, 22, 22);
        ctx.fillStyle = '#666';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 11, 11);
        return c;
      }
      const maxD = Math.max(sprite.width, sprite.height);
      const scale = Math.min(20 / maxD, 1);
      const dw = Math.round(sprite.width * scale);
      const dh = Math.round(sprite.height * scale);
      const dx = Math.round((22 - dw) / 2);
      const dy = Math.round((22 - dh) / 2);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite.canvas, 0, 0, sprite.width, sprite.height, dx, dy, dw, dh);
      return c;
    }

    function renderProjectileIconCanvas(rom, spritePtr, palAddr) {
      const c = document.createElement('canvas');
      c.width = 18;
      c.height = 18;
      c.className = 'proj-icon';
      const ctx = c.getContext('2d');
      if (spritePtr && rom) {
        const sprite = getDecodedSprite(rom, spritePtr, palAddr);
        if (sprite && sprite.width && sprite.height) {
          const maxD = Math.max(sprite.width, sprite.height);
          const scale = Math.min(16 / maxD, 1);
          const dw = Math.round(sprite.width * scale);
          const dh = Math.round(sprite.height * scale);
          const dx = Math.round((18 - dw) / 2);
          const dy = Math.round((18 - dh) / 2);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(sprite.canvas, 0, 0, sprite.width, sprite.height, dx, dy, dw, dh);
          return c;
        }
      }
      ctx.fillStyle = '#282828';
      ctx.beginPath();
      ctx.arc(9, 9, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff6644';
      ctx.beginPath();
      ctx.arc(9, 9, 3, 0, Math.PI * 2);
      ctx.fill();
      return c;
    }

    function createFormulaIconElement(spellName) {
      if (spellName && loadedAlchemyIcons && loadedAlchemyIcons[spellName]) {
        const img = document.createElement('img');
        img.src = loadedAlchemyIcons[spellName];
        img.className = 'alc-icon';
        img.alt = spellName;
        return img;
      }
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      c.className = 'alc-icon';
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#1e2d3d';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#4ec9b0';
      ctx.beginPath();
      ctx.arc(8, 8, 4, 0, Math.PI * 2);
      ctx.fill();
      return c;
    }

    function decodeEntityName(rom, namePtr, stype) {
      if (namePtr === 0x7E2210) return 'Boy';
      if (namePtr === 0x7E2234) return 'Dog';
      if (!rom || !namePtr) {
        const charId = Math.floor(((0x8E0000 | (stype || 0)) - 0x8EB678) / 74);
        return charId >= 0 ? ('Char #' + charId) : '$' + (stype || 0).toString(16).toUpperCase();
      }
      const o = snesToRom(namePtr);
      if (o >= 0 && o < rom.length) {
        let name = '';
        for (let i = 0; i < 24 && o + i < rom.length; i++) {
          const b = rom[o + i];
          if (!b || b === 0xFF || b < 32 || b > 126) break;
          name += String.fromCharCode(b);
        }
        if (name.trim()) return name.trim();
      }
      const charId = Math.floor(((0x8E0000 | (stype || 0)) - 0x8EB678) / 74);
      return charId >= 0 ? ('Char #' + charId) : '$' + (stype || 0).toString(16).toUpperCase();
    }

    function maintainCheats(m) {
      if (!m || !hasDebuggerApi(m) || !romLoaded) return;
      try {
        if (cheatAtlasEnabled) {
          // Boy status slot 1 ($7E4ECF): id=0x0000, timer=0x7FFF, param=0x01E0 (+480 attack)
          m.writeMemory(0x7E4ECF, 0x00);
          m.writeMemory(0x7E4ED0, 0x00);
          m.writeMemory(0x7E4ED1, 0xFF);
          m.writeMemory(0x7E4ED2, 0x7F);
          m.writeMemory(0x7E4ED3, 0xE0);
          m.writeMemory(0x7E4ED4, 0x01);
          // Dog status slot 1 ($7E4F7D)
          m.writeMemory(0x7E4F7D, 0x00);
          m.writeMemory(0x7E4F7E, 0x00);
          m.writeMemory(0x7E4F7F, 0xFF);
          m.writeMemory(0x7E4F80, 0x7F);
          m.writeMemory(0x7E4F81, 0xE0);
          m.writeMemory(0x7E4F82, 0x01);
        }
        if (cheatInvincibleEnabled) {
          const bLow = m.readMemory(0x7E4E99);
          if ((bLow & 0x02) === 0) m.writeMemory(0x7E4E99, bLow | 0x02);
          const dLow = m.readMemory(0x7E4F47);
          if ((dLow & 0x02) === 0) m.writeMemory(0x7E4F47, dLow | 0x02);
        }
        if (cheatNoclipEnabled) {
          const bHi = m.readMemory(0x7E4E9A);
          if ((bHi & 0x04) === 0) m.writeMemory(0x7E4E9A, bHi | 0x04);
          const dHi = m.readMemory(0x7E4F48);
          if ((dHi & 0x04) === 0) m.writeMemory(0x7E4F48, dHi | 0x04);
        }
      } catch (_) {}
    }

    function disableAtlasCheat(m) {
      if (!m || !hasDebuggerApi(m)) return;
      m.writeMemory(0x7E4ECF, 0xFF);
      m.writeMemory(0x7E4ED0, 0xFF);
      m.writeMemory(0x7E4F7D, 0xFF);
      m.writeMemory(0x7E4F7E, 0xFF);
    }

    function disableInvincibleCheat(m) {
      if (!m || !hasDebuggerApi(m)) return;
      const bLow = m.readMemory(0x7E4E99);
      m.writeMemory(0x7E4E99, bLow & ~0x02);
      const dLow = m.readMemory(0x7E4F47);
      m.writeMemory(0x7E4F47, dLow & ~0x02);
    }

    function disableNoclipCheat(m) {
      if (!m || !hasDebuggerApi(m)) return;
      const bHi = m.readMemory(0x7E4E9A);
      m.writeMemory(0x7E4E9A, bHi & ~0x04);
      const dHi = m.readMemory(0x7E4F48);
      m.writeMemory(0x7E4F48, dHi & ~0x04);
    }

    function healParty(m) {
      if (!m || !hasDebuggerApi(m)) return;
      // Boy HP $7E4EB3 = 999 (0x03E7)
      m.writeMemory(0x7E4EB3, 0xE7);
      m.writeMemory(0x7E4EB4, 0x03);
      // Dog HP $7E4F61 = 999 (0x03E7)
      m.writeMemory(0x7E4F61, 0xE7);
      m.writeMemory(0x7E4F62, 0x03);
      updateCheatsTab(m);
    }

    // -- Update Entities Tab --
    function updateEntitiesTab(preState, rom) {
      if (!preState || !preState.entBuf || !rom) return;
      const buf = preState.entBuf;
      const tbody = document.getElementById('ent-tbody');
      if (!tbody) return;

      const entities = entityAddresses(buf); // panel-webview.js: active + inactive lists

      let partyCount = 0;
      let enemyCount = 0;
      let npcCount = 0;

      const entList = [];
      for (let i = 0; i < entities.length; i++) {
        const addr = entities[i];
        const rel = addr - 0x3DDF;
        if (rel < 0 || rel + 0x70 > buf.length) continue;

        const isBoy = (addr === 0x4E89);
        const isDog = (addr === 0x4F37);
        const flags = buf[rel + 0x10] | (buf[rel + 0x11] << 8);
        const isNpc = !isBoy && !isDog && ((flags & 0x0002) !== 0);
        const isEnemy = !isBoy && !isDog && ((flags & 0x0002) === 0);

        if (isBoy || isDog) partyCount++;
        else if (isNpc) npcCount++;
        else enemyCount++;

        const stype = buf[rel + 0x60] | (buf[rel + 0x61] << 8);
        let name = isBoy ? 'Boy' : isDog ? 'Dog' : '';
        if (!name && stype >= 0x8000) {
          const namePtr = readRom24(rom, snesToRom(0x8E0000 | stype));
          name = decodeEntityName(rom, namePtr, stype);
        }
        if (!name) name = isBoy ? 'Boy' : isDog ? 'Dog' : ('Entity $' + addr.toString(16).toUpperCase());

        const hp = buf[rel + 0x2A] | (buf[rel + 0x2B] << 8);
        const rawX = buf[rel + 0x1A] | (buf[rel + 0x1B] << 8);
        const posX = rawX >= 0x8000 ? rawX - 0x10000 : rawX;
        const rawY = buf[rel + 0x1C] | (buf[rel + 0x1D] << 8);
        const posY = rawY >= 0x8000 ? rawY - 0x10000 : rawY;
        const rawZ = buf[rel + 0x1E] | (buf[rel + 0x1F] << 8);
        const posZ = rawZ >= 0x8000 ? rawZ - 0x10000 : rawZ;

        const spriteBank = buf[rel + 0x08];
        const spriteAddr = buf[rel + 0x06] | (buf[rel + 0x07] << 8);
        const spritePtr = (spriteBank >= 0xC0 && spriteBank <= 0xDF && spriteAddr >= 3)
          ? ((spriteBank << 16) | spriteAddr)
          : 0;

        const slotOffset = buf[rel + 0x0C] & 0x0E;
        let palAddr = preState.palSlotBuf ? (preState.palSlotBuf[slotOffset] | (preState.palSlotBuf[slotOffset + 1] << 8)) : 0;
        if (!palAddr) {
          if (isBoy) palAddr = 0xAD0B;
          else if (isDog) palAddr = getDogPalette(preState.mapId, spriteBank);
          else palAddr = 0xAD0B;
        }

        const cat = isBoy ? 'Boy' : isDog ? 'Dog' : isNpc ? 'NPC' : 'Enemy';
        entList.push({
          addr: addr,
          name: name,
          category: cat,
          hp: hp,
          x: posX,
          y: posY,
          z: posZ,
          flags: flags,
          palSlot: buf[rel + 0x0C] & 0x0F,
          palAddr: palAddr,
          spritePtr: spritePtr,
        });
      }

      // Update counters
      const elCount = document.getElementById('ss-ent-count');
      if (elCount) elCount.textContent = String(entList.length);
      entityCounts.all = entList.length;
      entityCounts.party = partyCount;
      entityCounts.enemies = enemyCount;
      entityCounts.npcs = npcCount;
      if (typeof emuSyncPlaceRow === 'function') emuSyncPlaceRow('entities');

      // Filter and render
      tbody.innerHTML = '';
      const cat = panelFilter.entities;
      for (let i = 0; i < entList.length; i++) {
        const ent = entList[i];
        if (cat === 'party' && ent.category !== 'Boy' && ent.category !== 'Dog') continue;
        if (cat === 'enemies' && ent.category !== 'Enemy') continue;
        if (cat === 'npcs' && ent.category !== 'NPC') continue;

        const ping = () => activeTargetPings.push({ x: ent.x, y: ent.y, birth: performance.now(), duration: 2500 });
        const tr = document.createElement('tr');
        // A pause-menu row: Up / Down select it, B pings the character (emulator-panels.js).
        tr.className = 'menu-pick ent-row';
        tr.onMenuAction = ping;

        // Icon
        const tdIcon = document.createElement('td');
        tdIcon.appendChild(renderEntityIconCanvas(rom, ent.spritePtr, ent.palAddr));
        tr.appendChild(tdIcon);

        // Address
        const tdAddr = document.createElement('td');
        tdAddr.style.color = '#4ec9b0';
        tdAddr.textContent = '$' + ent.addr.toString(16).toUpperCase();
        tr.appendChild(tdAddr);

        // Name
        const tdName = document.createElement('td');
        tdName.style.fontWeight = 'bold';
        tdName.textContent = ent.name;
        tr.appendChild(tdName);

        // Category
        const tdCat = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = (ent.category === 'Boy' || ent.category === 'Dog')
          ? 'badge-party'
          : (ent.category === 'NPC' ? 'badge-npc' : 'badge-enemy');
        badge.textContent = ent.category;
        tdCat.appendChild(badge);
        tr.appendChild(tdCat);

        // HP
        const tdHp = document.createElement('td');
        tdHp.textContent = String(ent.hp);
        tr.appendChild(tdHp);

        // Position
        const tdPos = document.createElement('td');
        tdPos.textContent = ent.x + ', ' + ent.y + (ent.z ? ' (z:' + ent.z + ')' : '');
        tr.appendChild(tdPos);

        // Flags
        const tdFlags = document.createElement('td');
        if (ent.flags & 0x0002) {
          const f = document.createElement('span'); f.className = 'flag-chip inv'; f.textContent = 'INV'; tdFlags.appendChild(f);
        }
        if (ent.flags & 0x0400) {
          const f = document.createElement('span'); f.className = 'flag-chip phase'; f.textContent = 'PHASE'; tdFlags.appendChild(f);
        }
        if (ent.flags & 0x0020) {
          const f = document.createElement('span'); f.className = 'flag-chip inact'; f.textContent = 'INACT'; tdFlags.appendChild(f);
        }
        if (!tdFlags.children.length) {
          tdFlags.textContent = '$' + ent.flags.toString(16).toUpperCase();
        }
        tr.appendChild(tdFlags);

        // Palette
        const tdPal = document.createElement('td');
        tdPal.textContent = 'Pal ' + ent.palSlot + ' ($' + ent.palAddr.toString(16).toUpperCase() + ')';
        tr.appendChild(tdPal);

        // Ping button
        const tdPing = document.createElement('td');
        const btnPing = document.createElement('button');
        btnPing.className = 'ss-btn';
        btnPing.textContent = 'ping';
        btnPing.addEventListener('click', ping);
        tdPing.appendChild(btnPing);
        tr.appendChild(tdPing);

        tbody.appendChild(tr);
      }
      if (typeof emuPanelRowsChanged === 'function') emuPanelRowsChanged('entities');
    }

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

  