
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
