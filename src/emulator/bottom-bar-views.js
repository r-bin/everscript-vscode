'use strict';

/**
 * emulator/bottom-bar-views.js
 *
 * Provides HTML, CSS, and client-side logic for the Emulator bottom bar pages:
 * 1. Entities & Enemies (Boy, Dog, Enemies, NPCs with sprite icons)
 * 2. Projectile Alchemy + Animation Alchemy + Projectiles (8 slots each with icons)
 * 3. Sprite Palettes + Map Palettes (16-color swatches with hex tooltips)
 * 4. Cheats (Atlas 999 glitch, Invincible flag, No Clip / Phasing flag)
 *
 * Invariant: Must remain strictly ASCII-only.
 */

function getBottomBarCss() {
  return `
    /* -- Bottom bar views styling -- */
    .ss-subbar {
      background: #141414;
      border-bottom: 1px solid #222;
      padding: 4px 8px;
      display: flex;
      gap: 6px;
      align-items: center;
      flex-shrink: 0;
      font-size: 10px;
    }
    .ss-search-input {
      background: #0e0e0e;
      border: 1px solid #333;
      color: #ddd;
      padding: 2px 6px;
      border-radius: 3px;
      font: inherit;
      font-size: 10px;
      width: 140px;
    }
    .ss-search-input:focus {
      outline: none;
      border-color: #007acc;
    }
    .ss-scroll-content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 4px 8px;
    }
    .ent-icon {
      width: 22px;
      height: 22px;
      border-radius: 2px;
      background: #181818;
      vertical-align: middle;
      image-rendering: pixelated;
      display: inline-block;
    }
    .proj-icon {
      width: 18px;
      height: 18px;
      border-radius: 2px;
      background: #181818;
      vertical-align: middle;
      image-rendering: pixelated;
      display: inline-block;
    }
    .alc-icon {
      width: 16px;
      height: 16px;
      vertical-align: middle;
      margin-right: 4px;
      image-rendering: pixelated;
      display: inline-block;
    }
    .badge-party {
      color: #4fc1ff;
      background: rgba(79, 193, 255, 0.12);
      padding: 1px 4px;
      border-radius: 2px;
      font-weight: bold;
    }
    .badge-enemy {
      color: #f48771;
      background: rgba(244, 135, 113, 0.12);
      padding: 1px 4px;
      border-radius: 2px;
    }
    .badge-npc {
      color: #7ad67a;
      background: rgba(122, 214, 122, 0.12);
      padding: 1px 4px;
      border-radius: 2px;
    }
    .flag-chip {
      font-size: 9px;
      padding: 1px 3px;
      border-radius: 2px;
      background: #242424;
      color: #aaa;
      margin-right: 2px;
      display: inline-block;
    }
    .flag-chip.inv   { background: #3d2a14; color: #f5a742; }
    .flag-chip.phase { background: #2a143d; color: #c586c0; }
    .flag-chip.inact { background: #331414; color: #f48771; }
    .slot-active     { color: #7ad67a; font-weight: bold; }
    .slot-inactive   { color: #555; }
    .alc-section {
      margin-bottom: 12px;
    }
    .alc-section-title {
      font-size: 11px;
      font-weight: bold;
      color: #4ec9b0;
      padding: 3px 6px;
      background: #161616;
      border-left: 3px solid #4ec9b0;
      margin-bottom: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .alc-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .alc-table th {
      text-align: left;
      padding: 2px 6px;
      color: #666;
      font-weight: normal;
      font-size: 10px;
      background: #111;
      border-bottom: 1px solid #222;
    }
    .alc-table td {
      padding: 2px 6px;
      color: #ccc;
      border-bottom: 1px solid #181818;
      font-size: 10px;
    }
    .alc-table tr:hover td {
      background: rgba(255, 255, 255, 0.03);
    }
    /* -- Palettes -- */
    .pal-section-title {
      font-size: 11px;
      font-weight: bold;
      color: #ce9178;
      padding: 3px 6px;
      background: #161616;
      border-left: 3px solid #ce9178;
      margin-bottom: 6px;
    }
    .pal-grid {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 12px;
    }
    .pal-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #111;
      padding: 3px 8px;
      border-radius: 3px;
      border: 1px solid #1f1f1f;
    }
    .pal-row.pal-stolen {
      border-color: #6a4010;
      background: #191208;
    }
    .pal-title {
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-size: 10px;
      width: 240px;
      flex-shrink: 0;
    }
    .pal-name {
      font-weight: bold;
      color: #ccc;
    }
    .pal-note {
      font-size: 9px;
      color: #888;
    }
    .pal-stolen .pal-note {
      color: #f5a742;
    }
    .pal-strip {
      display: flex;
      gap: 2px;
      flex-wrap: nowrap;
    }
    .pal-swatch {
      width: 14px;
      height: 14px;
      border: 1px solid rgba(0, 0, 0, 0.6);
      border-radius: 2px;
      cursor: pointer;
      transition: transform 0.1s;
    }
    .pal-swatch:hover {
      transform: scale(1.35);
      z-index: 2;
      border-color: #fff;
    }
    /* -- Cheats -- */
    .cheat-card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 8px;
      margin-bottom: 10px;
    }
    .cheat-card {
      background: #121212;
      border: 1px solid #242424;
      border-radius: 4px;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cheat-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .cheat-card-title {
      font-weight: bold;
      font-size: 11px;
      color: #eee;
    }
    .cheat-badge {
      font-size: 9px;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .cheat-badge.active {
      background: #1b4d1b;
      color: #85e085;
      border: 1px solid #2e7d32;
    }
    .cheat-badge.off {
      background: #1f1f1f;
      color: #777;
      border: 1px solid #333;
    }
    .cheat-desc {
      font-size: 10px;
      color: #888;
      line-height: 1.35;
    }
    .cheat-toggle-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #ccc;
      cursor: pointer;
      user-select: none;
    }
    .cheat-toggle-label input {
      cursor: pointer;
    }
    .party-monitor {
      background: #111;
      border: 1px solid #222;
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 10px;
      color: #aaa;
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }
  `;
}

function getBottomBarTabButtonsHtml() {
  return `
        <button id="ss-tab-entities" class="ss-tab" type="button">ENTITIES (<span id="ss-ent-count">0</span>)</button>
        <button id="ss-tab-alchemy" class="ss-tab" type="button">ALCHEMY &amp; PROJECTILES (<span id="ss-alc-count">0</span>)</button>
        <button id="ss-tab-palettes" class="ss-tab" type="button">PALETTES</button>
        <button id="ss-tab-cheats" class="ss-tab" type="button">CHEATS</button>
  `;
}

function getBottomBarViewsHtml() {
  return `
    <!-- Tab: Entities / Enemies (Boy, Dog, Enemies, NPCs) -->
    <div id="ss-view-entities" class="ss-tab-view">
      <div class="ss-subbar">
        <button id="ent-filter-all" class="ss-btn active" type="button">All (<span id="ent-count-all">0</span>)</button>
        <button id="ent-filter-party" class="ss-btn" type="button">Party (<span id="ent-count-party">0</span>)</button>
        <button id="ent-filter-enemies" class="ss-btn" type="button">Enemies (<span id="ent-count-enemies">0</span>)</button>
        <button id="ent-filter-npcs" class="ss-btn" type="button">NPCs (<span id="ent-count-npcs">0</span>)</button>
        <input type="text" id="ent-search" class="ss-search-input" placeholder="Filter entities..." />
        <span style="flex:1"></span>
        <label title="Keep entity list updating during play"><input type="checkbox" id="ent-auto-refresh" checked /> live</label>
      </div>
      <div class="ss-scroll-content">
        <table id="ent-table" class="alc-table">
          <thead>
            <tr>
              <th style="width:30px">Icon</th>
              <th style="width:60px">Address</th>
              <th>Name</th>
              <th style="width:70px">Category</th>
              <th style="width:50px">HP</th>
              <th style="width:110px">Position (X,Y,Z)</th>
              <th>Flags</th>
              <th style="width:65px">Palette</th>
              <th style="width:45px">Ping</th>
            </tr>
          </thead>
          <tbody id="ent-tbody"></tbody>
        </table>
      </div>
    </div>

    <!-- Tab: Projectile Alchemy + Animation Alchemy + Projectiles -->
    <div id="ss-view-alchemy" class="ss-tab-view">
      <div class="ss-subbar">
        <button id="alc-filter-all" class="ss-btn active" type="button">All (24)</button>
        <button id="alc-filter-palc" class="ss-btn" type="button">Projectile Alchemy (8)</button>
        <button id="alc-filter-aalc" class="ss-btn" type="button">Animation Alchemy (8)</button>
        <button id="alc-filter-proj" class="ss-btn" type="button">Projectiles (8)</button>
        <span style="flex:1"></span>
        <span id="alc-status-summary" style="color:#777">8 slots per pool</span>
      </div>
      <div class="ss-scroll-content">
        <!-- 1. Projectile Alchemy (8 slots at $7E3564, 0x76 stride) -->
        <div id="alc-sec-palc" class="alc-section">
          <div class="alc-section-title">
            <span>PROJECTILE ALCHEMY (8 slots &middot; WRAM $7E3564 &middot; stride 0x76)</span>
            <span id="alc-palc-active-count" style="font-size:10px;font-weight:normal;color:#aaa">0 active</span>
          </div>
          <table class="alc-table">
            <thead>
              <tr>
                <th style="width:26px">Icon</th>
                <th style="width:55px">Slot</th>
                <th style="width:65px">Status</th>
                <th>Spell Formula</th>
                <th style="width:60px">Power</th>
                <th style="width:60px">Source</th>
                <th>Targets</th>
              </tr>
            </thead>
            <tbody id="alc-palc-tbody"></tbody>
          </table>
        </div>

        <!-- 2. Animation Alchemy (8 slots at $7E3364, 0x40 stride) -->
        <div id="alc-sec-aalc" class="alc-section">
          <div class="alc-section-title">
            <span>ANIMATION ALCHEMY (8 slots &middot; WRAM $7E3364 &middot; stride 0x40)</span>
            <span id="alc-aalc-active-count" style="font-size:10px;font-weight:normal;color:#aaa">0 active</span>
          </div>
          <table class="alc-table">
            <thead>
              <tr>
                <th style="width:26px">Icon</th>
                <th style="width:55px">Slot</th>
                <th style="width:65px">Status</th>
                <th>Spell Formula</th>
                <th style="width:60px">Timer</th>
                <th style="width:60px">Power</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody id="alc-aalc-tbody"></tbody>
          </table>
        </div>

        <!-- 3. Projectiles (8 slots at $7E6387, 44-byte stride) -->
        <div id="alc-sec-proj" class="alc-section">
          <div class="alc-section-title">
            <span>PROJECTILES (8 slots &middot; WRAM $7E6387 &middot; stride 44 bytes)</span>
            <span id="alc-proj-active-count" style="font-size:10px;font-weight:normal;color:#aaa">0 active</span>
          </div>
          <table class="alc-table">
            <thead>
              <tr>
                <th style="width:26px">Icon</th>
                <th style="width:55px">Slot</th>
                <th style="width:65px">Status</th>
                <th style="width:110px">Position (X,Y,Z)</th>
                <th style="width:60px">Lifetime</th>
                <th style="width:60px">Power</th>
                <th>Sprite / Action</th>
              </tr>
            </thead>
            <tbody id="alc-proj-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab: Sprite Palettes + Map Palettes -->
    <div id="ss-view-palettes" class="ss-tab-view">
      <div class="ss-subbar">
        <button id="pal-tab-all" class="ss-btn active" type="button">All Palettes</button>
        <button id="pal-tab-sprites" class="ss-btn" type="button">Sprite Palettes (8)</button>
        <button id="pal-tab-maps" class="ss-btn" type="button">Map Palettes (8)</button>
        <span style="flex:1"></span>
        <span style="color:#777">Hover swatches for hex code</span>
      </div>
      <div class="ss-scroll-content">
        <!-- Sprite Palettes -->
        <div id="pal-sec-sprites">
          <div class="pal-section-title">SPRITE PALETTES (8 slots &middot; WRAM $7E1278 &middot; CGRAM 128..255)</div>
          <div id="pal-sprite-grid" class="pal-grid"></div>
        </div>
        <!-- Map Palettes -->
        <div id="pal-sec-maps">
          <div class="pal-section-title">MAP PALETTES (8 sub-palettes &middot; WRAM $7E61A7 &middot; CGRAM 0..127)</div>
          <div id="pal-map-grid" class="pal-grid"></div>
        </div>
      </div>
    </div>

    <!-- Tab: Cheats -->
    <div id="ss-view-cheats" class="ss-tab-view">
      <div class="ss-subbar">
        <button id="btn-cheats-all" class="ss-btn" type="button">Enable All</button>
        <button id="btn-cheats-none" class="ss-btn" type="button">Disable All</button>
        <button id="btn-cheat-heal" class="ss-btn" type="button">Heal Party (999 HP)</button>
        <span style="flex:1"></span>
        <span id="cheat-global-status" style="color:#7ad67a">Ready</span>
      </div>
      <div class="ss-scroll-content">
        <div class="cheat-card-grid">
          <!-- Cheat 1: Atlas Glitch -->
          <div class="cheat-card">
            <div class="cheat-card-header">
              <label class="cheat-toggle-label">
                <input type="checkbox" id="cheat-toggle-atlas" />
                <span class="cheat-card-title">Atlas 999 Glitch</span>
              </label>
              <span id="cheat-atlas-badge" class="cheat-badge off">OFF</span>
            </div>
            <div class="cheat-desc">
              Applies the Atlas buff (+480 attack boost, infinite timer) into player status slots ($7E4ECF for Boy, $7E4F7D for Dog). Below 100% weapon charge, stamina math underflows to 65,535 and caps at 999 damage per strike.
            </div>
          </div>

          <!-- Cheat 2: Invincible Flag -->
          <div class="cheat-card">
            <div class="cheat-card-header">
              <label class="cheat-toggle-label">
                <input type="checkbox" id="cheat-toggle-invincible" />
                <span class="cheat-card-title">Invincible Flag (0x0002)</span>
              </label>
              <span id="cheat-invincible-badge" class="cheat-badge off">OFF</span>
            </div>
            <div class="cheat-desc">
              Sets bit 0x0002 (FLAG_INVINCIBLE) in player entity flags (+0x10) for Boy ($7E4E99) and Dog ($7E4F47). The game engine treats the party as invulnerable NPCs during hit detection, completely ignoring hostile strikes.
            </div>
          </div>

          <!-- Cheat 3: No Clip Flag -->
          <div class="cheat-card">
            <div class="cheat-card-header">
              <label class="cheat-toggle-label">
                <input type="checkbox" id="cheat-toggle-noclip" />
                <span class="cheat-card-title">No Clip / Phasing (0x0400)</span>
              </label>
              <span id="cheat-noclip-badge" class="cheat-badge off">OFF</span>
            </div>
            <div class="cheat-desc">
              Sets bit 0x0400 (PHASING) in player entity flags (+0x10) for Boy ($7E4E9A) and Dog ($7E4F48). Allows walking freely through solid walls, boundaries, obstacles, and elevation barriers like phasing mosquitoes.
            </div>
          </div>
        </div>

        <!-- Live Party Monitor -->
        <div class="party-monitor">
          <span style="font-weight:bold;color:#eee">Party Monitor:</span>
          <span id="mon-boy-hp">Boy HP: --</span>
          <span id="mon-boy-flags">Boy Flags: ----</span>
          <span id="mon-boy-status">Boy Status 1: ----</span>
          <span style="color:#444">|</span>
          <span id="mon-dog-hp">Dog HP: --</span>
          <span id="mon-dog-flags">Dog Flags: ----</span>
          <span id="mon-dog-status">Dog Status 1: ----</span>
        </div>
      </div>
    </div>
  `;
}

function getBottomBarClientScript() {
  return `
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
    let currentBottomTab = 'trace';
    let lastSampledPreState = null;

    // Cheats state
    let cheatAtlasEnabled = false;
    let cheatInvincibleEnabled = false;
    let cheatNoclipEnabled = false;

    // Entity filter state
    let entityFilterCategory = 'all';
    let entityFilterSearch = '';

    // Alchemy filter state
    let alchemyFilterCategory = 'all';

    // Palettes filter state
    let palettesFilterCategory = 'all';

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
      const elAll = document.getElementById('ent-count-all');
      if (elAll) elAll.textContent = String(entList.length);
      const elParty = document.getElementById('ent-count-party');
      if (elParty) elParty.textContent = String(partyCount);
      const elEnemies = document.getElementById('ent-count-enemies');
      if (elEnemies) elEnemies.textContent = String(enemyCount);
      const elNpcs = document.getElementById('ent-count-npcs');
      if (elNpcs) elNpcs.textContent = String(npcCount);

      // Filter and render
      tbody.innerHTML = '';
      const filterText = (entityFilterSearch || '').toLowerCase();
      for (let i = 0; i < entList.length; i++) {
        const ent = entList[i];
        if (entityFilterCategory === 'party' && ent.category !== 'Boy' && ent.category !== 'Dog') continue;
        if (entityFilterCategory === 'enemies' && ent.category !== 'Enemy') continue;
        if (entityFilterCategory === 'npcs' && ent.category !== 'NPC') continue;
        if (filterText) {
          const match = ent.name.toLowerCase().includes(filterText) ||
                        ('$' + ent.addr.toString(16)).toLowerCase().includes(filterText) ||
                        ent.category.toLowerCase().includes(filterText);
          if (!match) continue;
        }

        const tr = document.createElement('tr');

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
        btnPing.addEventListener('click', () => {
          activeTargetPings.push({
            x: ent.x,
            y: ent.y,
            birth: performance.now(),
            duration: 2500,
          });
        });
        tdPing.appendChild(btnPing);
        tr.appendChild(tdPing);

        tbody.appendChild(tr);
      }
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
          row.className = 'pal-row' + (isStolen ? ' pal-stolen' : '');

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
          row.className = 'pal-row';

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

      if (currentBottomTab === 'entities') {
        const chk = document.getElementById('ent-auto-refresh');
        if (!chk || chk.checked) {
          updateEntitiesTab(lastSampledPreState, rom);
        }
      } else if (currentBottomTab === 'alchemy') {
        updateAlchemyTab(lastSampledPreState, rom);
      } else if (currentBottomTab === 'palettes') {
        updatePalettesTab(lastSampledPreState, rom);
      } else if (currentBottomTab === 'cheats') {
        updateCheatsTab(m);
      }
    }

    let bottomBarListenersBound = false;
    // Called on every boot (ROM load, replay start): bind once.
    function initBottomBarEventListeners() {
      if (bottomBarListenersBound) return;
      bottomBarListenersBound = true;
      // Entities filter buttons
      const btnAll = document.getElementById('ent-filter-all');
      const btnParty = document.getElementById('ent-filter-party');
      const btnEnemies = document.getElementById('ent-filter-enemies');
      const btnNpcs = document.getElementById('ent-filter-npcs');
      const searchInput = document.getElementById('ent-search');

      function setEntCategory(cat) {
        entityFilterCategory = cat;
        [btnAll, btnParty, btnEnemies, btnNpcs].forEach(b => {
          if (b) b.classList.toggle('active', b.id === 'ent-filter-' + cat);
        });
        const rom = loadedRomData ? ((loadedRomData.length % 1024 === 512) ? loadedRomData.subarray(512) : loadedRomData) : null;
        updateEntitiesTab(lastSampledPreState, rom);
      }

      if (btnAll) btnAll.addEventListener('click', () => setEntCategory('all'));
      if (btnParty) btnParty.addEventListener('click', () => setEntCategory('party'));
      if (btnEnemies) btnEnemies.addEventListener('click', () => setEntCategory('enemies'));
      if (btnNpcs) btnNpcs.addEventListener('click', () => setEntCategory('npcs'));

      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          entityFilterSearch = e.target.value;
          const rom = loadedRomData ? ((loadedRomData.length % 1024 === 512) ? loadedRomData.subarray(512) : loadedRomData) : null;
          updateEntitiesTab(lastSampledPreState, rom);
        });
      }

      // Alchemy section filter buttons
      const alcBtnAll = document.getElementById('alc-filter-all');
      const alcBtnPalc = document.getElementById('alc-filter-palc');
      const alcBtnAalc = document.getElementById('alc-filter-aalc');
      const alcBtnProj = document.getElementById('alc-filter-proj');
      const secPalc = document.getElementById('alc-sec-palc');
      const secAalc = document.getElementById('alc-sec-aalc');
      const secProj = document.getElementById('alc-sec-proj');

      function setAlcFilter(filter) {
        [alcBtnAll, alcBtnPalc, alcBtnAalc, alcBtnProj].forEach(b => {
          if (b) b.classList.toggle('active', b.id === 'alc-filter-' + filter);
        });
        if (secPalc) secPalc.style.display = (filter === 'all' || filter === 'palc') ? '' : 'none';
        if (secAalc) secAalc.style.display = (filter === 'all' || filter === 'aalc') ? '' : 'none';
        if (secProj) secProj.style.display = (filter === 'all' || filter === 'proj') ? '' : 'none';
      }

      if (alcBtnAll) alcBtnAll.addEventListener('click', () => setAlcFilter('all'));
      if (alcBtnPalc) alcBtnPalc.addEventListener('click', () => setAlcFilter('palc'));
      if (alcBtnAalc) alcBtnAalc.addEventListener('click', () => setAlcFilter('aalc'));
      if (alcBtnProj) alcBtnProj.addEventListener('click', () => setAlcFilter('proj'));

      // Palettes filter buttons
      const palBtnAll = document.getElementById('pal-tab-all');
      const palBtnSprites = document.getElementById('pal-tab-sprites');
      const palBtnMaps = document.getElementById('pal-tab-maps');
      const palSecSprites = document.getElementById('pal-sec-sprites');
      const palSecMaps = document.getElementById('pal-sec-maps');

      function setPalFilter(filter) {
        [palBtnAll, palBtnSprites, palBtnMaps].forEach(b => {
          if (b) b.classList.toggle('active', b.id === 'pal-tab-' + filter);
        });
        if (palSecSprites) palSecSprites.style.display = (filter === 'all' || filter === 'sprites') ? '' : 'none';
        if (palSecMaps) palSecMaps.style.display = (filter === 'all' || filter === 'maps') ? '' : 'none';
      }

      if (palBtnAll) palBtnAll.addEventListener('click', () => setPalFilter('all'));
      if (palBtnSprites) palBtnSprites.addEventListener('click', () => setPalFilter('sprites'));
      if (palBtnMaps) palBtnMaps.addEventListener('click', () => setPalFilter('maps'));

      // Cheats event listeners
      const tAtlas = document.getElementById('cheat-toggle-atlas');
      const tInvincible = document.getElementById('cheat-toggle-invincible');
      const tNoclip = document.getElementById('cheat-toggle-noclip');
      const bAtlas = document.getElementById('cheat-atlas-badge');
      const bInvincible = document.getElementById('cheat-invincible-badge');
      const bNoclip = document.getElementById('cheat-noclip-badge');

      function updateCheatUi() {
        if (tAtlas) tAtlas.checked = cheatAtlasEnabled;
        if (tInvincible) tInvincible.checked = cheatInvincibleEnabled;
        if (tNoclip) tNoclip.checked = cheatNoclipEnabled;

        if (bAtlas) {
          bAtlas.textContent = cheatAtlasEnabled ? 'ACTIVE' : 'OFF';
          bAtlas.className = 'cheat-badge ' + (cheatAtlasEnabled ? 'active' : 'off');
        }
        if (bInvincible) {
          bInvincible.textContent = cheatInvincibleEnabled ? 'ACTIVE' : 'OFF';
          bInvincible.className = 'cheat-badge ' + (cheatInvincibleEnabled ? 'active' : 'off');
        }
        if (bNoclip) {
          bNoclip.textContent = cheatNoclipEnabled ? 'ACTIVE' : 'OFF';
          bNoclip.className = 'cheat-badge ' + (cheatNoclipEnabled ? 'active' : 'off');
        }
        const m = getModule();
        if (m) maintainCheats(m);
        updateCheatsTab(m);
      }

      if (tAtlas) {
        tAtlas.addEventListener('change', (e) => {
          cheatAtlasEnabled = e.target.checked;
          if (!cheatAtlasEnabled) disableAtlasCheat(getModule());
          updateCheatUi();
        });
      }
      if (tInvincible) {
        tInvincible.addEventListener('change', (e) => {
          cheatInvincibleEnabled = e.target.checked;
          if (!cheatInvincibleEnabled) disableInvincibleCheat(getModule());
          updateCheatUi();
        });
      }
      if (tNoclip) {
        tNoclip.addEventListener('change', (e) => {
          cheatNoclipEnabled = e.target.checked;
          if (!cheatNoclipEnabled) disableNoclipCheat(getModule());
          updateCheatUi();
        });
      }

      const btnAllCheats = document.getElementById('btn-cheats-all');
      if (btnAllCheats) {
        btnAllCheats.addEventListener('click', () => {
          cheatAtlasEnabled = true;
          cheatInvincibleEnabled = true;
          cheatNoclipEnabled = true;
          updateCheatUi();
        });
      }

      const btnNoCheats = document.getElementById('btn-cheats-none');
      if (btnNoCheats) {
        btnNoCheats.addEventListener('click', () => {
          const m = getModule();
          cheatAtlasEnabled = false;
          cheatInvincibleEnabled = false;
          cheatNoclipEnabled = false;
          disableAtlasCheat(m);
          disableInvincibleCheat(m);
          disableNoclipCheat(m);
          updateCheatUi();
        });
      }

      const btnHeal = document.getElementById('btn-cheat-heal');
      if (btnHeal) {
        btnHeal.addEventListener('click', () => {
          healParty(getModule());
        });
      }
    }
  `;
}

module.exports = {
  getBottomBarCss,
  getBottomBarTabButtonsHtml,
  getBottomBarViewsHtml,
  getBottomBarClientScript,
};
