// TODO port to TS (docs/todo/port-to-ts.md)

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
        const charId = EvsRom.entityCharacter(stype || 0);
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
      const charId = EvsRom.entityCharacter(stype || 0);
      return charId >= 0 ? ('Char #' + charId) : '$' + (stype || 0).toString(16).toUpperCase();
    }

