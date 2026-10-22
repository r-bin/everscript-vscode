// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: client-side interaction, animation playback loop, canvas drawing, stat cards, and chunk inspector for the Sprites tab.
  // Reuse the vscode API instance already acquired by shared.js (acquireVsCodeApi can only be called once)
  var vsApi = (typeof vs !== 'undefined' && vs) ? vs : (typeof acquireVsCodeApi === 'function' ? (function() { try { return acquireVsCodeApi(); } catch(e) { return null; } })() : null);

  // State variables
  var currentMode = 'chars'; // 'chars', 'anims' or 'raw'
  var pinnedRecord = null;   // Animations mode: the catalogue entry being played
  var requestedRecord = 0;   // the record behind the last animation request
  var charFilter = 'all';
  var selectedCharId = 0;
  var selectedAnimKey = 'w_atk0';
  var selectedFacing = 8; // South: the direction tables move facing 8 down the screen
  var animScale = 3;
  var selectedWeaponId = 0;
  var weaponGroup = document.getElementById('sp-weapon-group');
  var weaponSel = document.getElementById('sp-weapon-sel');
  var weaponLabel = document.querySelector('label[for="sp-weapon-sel"]');

  var currentAnimData = null;
  var currentFrameIdx = 0;
  var tickCounter = 0;
  var isPlaying = true;
  var isLooping = true;
  var playbackSpeed = 1;
  var lastRafTime = 0;
  var loadedImages = {}; // cache of Image objects for PNGs

  var selectedRawAddr = 0xca0003;
  var rawBg = 'dark';
  var rawPalette = 0x90b00b;

  // DOM Elements
  var btnChars = document.getElementById('sp-btn-mode-chars');
  var btnRaw = document.getElementById('sp-btn-mode-raw');
  var btnAnims = document.getElementById('sp-btn-mode-anims');
  var script = (typeof window !== 'undefined' && window.SpritesScript) || null;
  var charView = document.getElementById('sp-char-view');
  var rawView = document.getElementById('sp-raw-view');
  var charFilters = document.getElementById('sp-char-filters');
  var searchInput = document.getElementById('sp-search');
  var listEl = document.getElementById('sp-list');

  var canvas = document.getElementById('sp-canvas');
  var ctx = (canvas && typeof canvas.getContext === 'function') ? canvas.getContext('2d') : null;
  var rawCanvas = document.getElementById('sp-raw-canvas');
  var rawCtx = (rawCanvas && typeof rawCanvas.getContext === 'function') ? rawCanvas.getContext('2d') : null;

  var animSel = document.getElementById('sp-anim-sel');
  var scrubber = document.getElementById('sp-scrubber');
  var frameInfo = document.getElementById('sp-frame-info');
  var btnPlay = document.getElementById('sp-btn-play');
  var btnPrev = document.getElementById('sp-btn-step-prev');
  var btnNext = document.getElementById('sp-btn-step-next');
  var btnLoop = document.getElementById('sp-btn-loop');
  var speedSel = document.getElementById('sp-speed-sel');
  var spriteAddrLink = document.getElementById('sp-cur-sprite-addr');

  var chkBody = document.getElementById('sp-chk-body');
  var chkHurt = document.getElementById('sp-chk-hurt');
  var chkStrike = document.getElementById('sp-chk-strike');
  var chkOrigin = document.getElementById('sp-chk-origin');
  var chkProj = document.getElementById('sp-chk-proj');
  var chkWalk = document.getElementById('sp-chk-walk');
  var chkTarget = document.getElementById('sp-chk-target');
  var chkAggro = document.getElementById('sp-chk-aggro');
  var targetDist = document.getElementById('sp-target-dist');
  var trailInput = document.getElementById('sp-trail');
  function trailTicks() {
    var n = trailInput ? parseInt(trailInput.value, 10) : 0;
    return isFinite(n) && n > 0 ? Math.min(n, 120) : 0;
  }
  var frameStartTicks = [];  // playback tick each frame starts on, for projectile flight
  var flightTail = 0;        // ticks of projectile flight left when the cycle ends

  var statsGrid = document.getElementById('sp-stats-grid');
  var chunksBody = document.getElementById('sp-chunks-body');
  var chunksCount = document.getElementById('sp-chunks-count');

  var rawPaletteSel = document.getElementById('sp-raw-palette-sel');
  var rawBgSel = document.getElementById('sp-raw-bg-sel');
  var rawChunksBody = document.getElementById('sp-raw-chunks-body');
  var rawName = document.getElementById('sp-raw-name');
  var rawBadge = document.getElementById('sp-raw-badge');

  /** Names like "<Boy Name>" must not be parsed as tags. */
  function escHtml(v) {
    return String(v).replace(/[&<>"]/g, function(ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; });
  }

  function getCharacters() {
    return (typeof SPRITES_CHARACTERS_DATA !== 'undefined' ? SPRITES_CHARACTERS_DATA : (typeof window !== 'undefined' ? window.SPRITES_CHARACTERS_DATA : [])) || [];
  }

  function getRawIndex() {
    return (typeof SPRITES_RAW_INDEX !== 'undefined' ? SPRITES_RAW_INDEX : (typeof window !== 'undefined' ? window.SPRITES_RAW_INDEX : [])) || [];
  }

  // ── Mode Switching ──────────────────────────────────────────────────────────
  function setMode(mode) {
    currentMode = mode;
    if (btnChars) btnChars.classList.toggle('sp-active', mode === 'chars');
    if (btnRaw) btnRaw.classList.toggle('sp-active', mode === 'raw');
    if (btnAnims) btnAnims.classList.toggle('sp-active', mode === 'anims');
    if (charView) charView.style.display = mode === 'chars' || mode === 'anims' ? 'flex' : 'none';
    if (rawView) rawView.style.display = mode === 'raw' ? 'flex' : 'none';
    if (charFilters) charFilters.style.display = mode === 'chars' ? 'flex' : 'none';
    if (animSel) animSel.disabled = mode === 'anims';
    // A catalogue record has no character to list animations or stats for.
    document.querySelectorAll('.sp-side-tab[data-side="anims"], .sp-side-tab[data-side="stats"]').forEach(function(b) {
      b.style.display = mode === 'anims' ? 'none' : '';
    });
    if (mode === 'anims' && (sideTab === 'anims' || sideTab === 'stats')) setSideTab('script');
    renderList();
    if (mode === 'raw') loadRawSprite(selectedRawAddr);
    if (mode === 'chars' && pinnedRecord) { pinnedRecord = null; selectCharacter(selectedCharId); }
    if (mode === 'chars') { var mc = getCharacters().find(function(x) { return x.id === selectedCharId; }); if (mc) renderAnimGrid(mc); }
    if (mode === 'anims' && !pinnedRecord && script && script.count()) {
      selectAnimationRecord(script.findRecord(getAnimationsFirst()));
    }
  }

  function getAnimationsFirst() {
    var all = (typeof SPRITES_ANIMATIONS !== 'undefined' ? SPRITES_ANIMATIONS : []) || [];
    return all.length ? all[0].record : null;
  }

  /** Animations mode: play one catalogue record, drawn in its owner's palette. */
  function selectAnimationRecord(entry) {
    if (!entry) return;
    pinnedRecord = entry;
    selectCharacter(entry.paletteCharacter);
    var nameEl = document.getElementById('sp-char-name');
    if (nameEl) nameEl.textContent = entry.label + ' (' + entry.recHex + ')';
    if (weaponGroup) weaponGroup.style.display = 'none';
    if (listEl) {
      listEl.querySelectorAll('.sp-list-item').forEach(function(el) {
        el.classList.toggle('sp-selected', parseInt(el.dataset.record) === entry.record);
      });
    }
  }

  if (btnChars) btnChars.addEventListener('click', function() { setMode('chars'); });
  if (btnRaw) btnRaw.addEventListener('click', function() { setMode('raw'); });
  if (btnAnims) btnAnims.addEventListener('click', function() { setMode('anims'); });

  // ── Search & Filters ────────────────────────────────────────────────────────
  if (searchInput) {
    searchInput.addEventListener('input', function() { renderList(); });
  }

  if (charFilters) {
    charFilters.querySelectorAll('.sp-filter-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        charFilters.querySelectorAll('.sp-filter-chip').forEach(function(c) { c.classList.remove('sp-active'); });
        chip.classList.add('sp-active');
        charFilter = chip.dataset.filter || 'all';
        renderList();
      });
    });
  }

  // ── Render List ─────────────────────────────────────────────────────────────
  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = '';
    var q = (searchInput && searchInput.value ? searchInput.value.toLowerCase().trim() : '');

    var chipAll = document.querySelector('.sp-filter-chip[data-filter="all"]');
    var chars = getCharacters();
    if (chipAll && chars && chars.length) {
      chipAll.textContent = 'All (' + chars.length + ')';
    }

    if (currentMode === 'anims') {
      if (script) script.renderCatalogList(listEl, q, pinnedRecord ? pinnedRecord.record : null, selectAnimationRecord);
      return;
    }

    if (currentMode === 'chars') {
      if (!chars || chars.length === 0) {
        var emptyEl = document.createElement('div');
        emptyEl.className = 'sp-empty-notice';
        emptyEl.innerHTML = '<strong>No characters loaded.</strong><br><span style="opacity:0.75">No Secret of Evermore ROM in the ROM library. Add your own with Everscript: Switch ROM.</span>';
        listEl.appendChild(emptyEl);
        return;
      }

      chars.forEach(function(c) {
        if (!c) return;
        var disp = c.disposition || {};
        if (charFilter === 'enemies' && !disp.hostile) return;
        if (charFilter === 'npcs' && disp.hostile) return;
        if (charFilter === 'heroes' && c.id !== 0 && c.id !== 1) return;

        var nameStr = (c.name || '').toLowerCase();
        var idStr = String(c.id);
        var snesStr = (c.snesHex || '').toLowerCase();

        if (q && !nameStr.includes(q) && !idStr.includes(q) && !snesStr.includes(q)) return;

        var li = document.createElement('li');
        li.className = 'sp-list-item' + (c.id === selectedCharId ? ' sp-selected' : '') + (c.noVisuals ? ' sp-li-novis' : '');
        li.dataset.id = String(c.id);
        li.title = c.noVisuals ? 'No visuals: none of its own animations shows a sprite (death is the shared dust puff)' : '';
        // Two square boxes per row, filled or empty, so every name starts at the same x.
        var box = function(src, title) { return '<span class="sp-li-thumb" title="' + title + '">' + (src ? '<img src="' + src + '" alt="">' : '') + '</span>'; };
        var thumbs = '<span class="sp-li-thumbs">' + box(c.thumbs && c.thumbs.s, 'south') + box(c.thumbs && c.thumbs.e, 'east') + '</span>';
        li.innerHTML = thumbs + '<span class="sp-li-name">' + escHtml(c.name || '#' + c.id) + (c.noVisuals ? '<span class="sp-li-tag">no visuals</span>' : '') + '</span>' +
          '<span class="sp-li-addr">' + (c.snesHex || '') + '</span>';

        li.addEventListener('click', function() { selectCharacter(c.id); });
        listEl.appendChild(li);
      });
    } else {
      var rawList = getRawIndex();
      if (!rawList || rawList.length === 0) {
        var emptyRawEl = document.createElement('div');
        emptyRawEl.className = 'sp-empty-notice';
        emptyRawEl.innerHTML = '<strong>No raw sprites loaded.</strong><br><span style="opacity:0.75">No Secret of Evermore ROM in the ROM library. Add your own with Everscript: Switch ROM.</span>';
        listEl.appendChild(emptyRawEl);
        return;
      }

      rawList.forEach(function(s) {
        if (!s) return;
        var addrStr = (s.addrHex || '').toLowerCase();
        var idxStr = String(s.index);
        if (q && !addrStr.includes(q) && !idxStr.includes(q)) return;

        var li = document.createElement('li');
        li.className = 'sp-list-item' + (s.address === selectedRawAddr ? ' sp-selected' : '');
        li.dataset.addr = String(s.address);
        li.innerHTML = '<span class="sp-li-name">' + s.addrHex + '</span>' +
          '<span class="sp-li-addr">' + s.width + '×' + s.height + ' (' + s.chunkCount + ')</span>';
        if (window.SpritesThumbs) {
          var tw = document.createElement('span');
          tw.className = 'sp-li-thumbs';
          tw.appendChild(window.SpritesThumbs.box({ key: 'spr:' + s.address + ':' + rawPalette, sprite: s.address, paletteAddr: rawPalette }));
          li.insertBefore(tw, li.firstChild);
        }

        li.addEventListener('click', function() { selectRawSprite(s.address); });
        listEl.appendChild(li);
      });
    }
  }

  // ── Character Selection ─────────────────────────────────────────────────────
  function selectCharacter(id) {
    selectedCharId = id;
    var chars = getCharacters();
    if (!chars || !chars.length) return;
    var c = chars.find(function(x) { return x.id === id; });
    if (!c) c = chars[0];
    if (!c) return;
    selectedCharId = c.id;

    // Update list selection highlight
    if (listEl && currentMode === 'chars') {
      listEl.querySelectorAll('.sp-list-item').forEach(function(el) {
        el.classList.toggle('sp-selected', parseInt(el.dataset.id) === selectedCharId);
      });
    }

    // Header info
    var idEl = document.getElementById('sp-char-id');
    var nameEl = document.getElementById('sp-char-name');
    var badgeEl = document.getElementById('sp-char-badge');
    var palHex = document.getElementById('sp-palette-hex');
    var swatch = document.getElementById('sp-palette-swatch');

    if (idEl) idEl.textContent = '#' + c.id;
    if (nameEl) nameEl.textContent = (c.name || '#' + c.id) + ' (' + (c.snesHex || '') + ')';
    paletteOverride = 0;
    paletteOverrideChar = c.id;
    if (paletteGrid) paletteGrid.querySelectorAll('.sp-pal-tile').forEach(function(t) { t.classList.remove('sp-active'); });
    if (badgeEl) {
      var disp = c.disposition || {};
      badgeEl.textContent = c.id === 0 || c.id === 1 ? 'Hero' : (disp.label || '');
      badgeEl.className = 'sp-badge ' + (c.id === 0 || c.id === 1 ? 'sp-badge-hero' : disp.hostile ? 'sp-badge-enemy' : 'sp-badge-npc');
    }
    if (palHex) {
      var pIdx = c.paletteIndex != null && c.paletteIndex >= 0 ? '#' + c.paletteIndex : '';
      var pHex = c.paletteAddrHex ? '$' + parseInt(c.paletteAddrHex.replace(/^0x/, ''), 16).toString(16).padStart(4, '0') : '';
      palHex.textContent = pIdx ? pIdx + (pHex ? ' (' + pHex + ')' : '') : pHex;
    }
    if (swatch && c.paletteColors) {
      swatch.innerHTML = c.paletteColors.map(function(hex) {
        return '<span style="background-color:' + hex + '" title="' + hex + '"></span>';
      }).join('');
    }

    // Weapon selection for the Boy, form selection for the Dog
    if (weaponGroup && weaponSel) {
      if (hasVariants(c)) {
        if (selectedWeaponId >= c.weapons.length) selectedWeaponId = 0;
        if (weaponLabel) weaponLabel.textContent = c.id === 1 ? 'Form:' : 'Weapon:';
        weaponGroup.style.display = '';
        weaponSel.innerHTML = '';
        c.weapons.forEach(function(w) {
          var opt = document.createElement('option');
          opt.value = String(w.id);
          opt.textContent = w.name;
          weaponSel.appendChild(opt);
        });
        weaponSel.value = String(selectedWeaponId);
      } else {
        weaponGroup.style.display = 'none';
      }
    }

    // Populate Animations dropdown
    populateAnimationDropdown(c);

    // Render Stats Cards with meanings
    renderStats(c);

    // Request animation data from backend
    loadCurrentAnimation();
    if (typeof sideTab !== 'undefined' && sideTab === 'palettes' && typeof requestPaletteGrid === 'function') requestPaletteGrid();
  }
