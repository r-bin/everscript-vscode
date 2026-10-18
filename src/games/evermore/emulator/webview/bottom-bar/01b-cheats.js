
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
          const namePtr = EvsRom.entityNamePointer(rom, stype);
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
