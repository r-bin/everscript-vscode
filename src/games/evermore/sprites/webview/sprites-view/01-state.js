// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: client-side interaction, animation playback loop, canvas drawing, stat cards, and chunk inspector for the Characters tab.
  // Reuse the vscode API instance already acquired by shared.js (acquireVsCodeApi can only be called once)
  var vsApi = (typeof vs !== 'undefined' && vs) ? vs : (typeof acquireVsCodeApi === 'function' ? (function() { try { return acquireVsCodeApi(); } catch(e) { return null; } })() : null);

  // State variables
  var pickedRecord = null;   // All filter: the catalogue entry played on the selected character
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

  // DOM Elements
  var script = (typeof window !== 'undefined' && window.SpritesScript) || null;
  var charFilters = document.getElementById('sp-char-filters');
  var searchInput = document.getElementById('sp-search');
  var listEl = document.getElementById('sp-list');

  var canvas = document.getElementById('sp-canvas');
  var ctx = (canvas && typeof canvas.getContext === 'function') ? canvas.getContext('2d') : null;

  var animSel = document.getElementById('sp-anim-sel');
  var scrubber = document.getElementById('sp-scrubber');
  var scrubTicks = document.getElementById('sp-scrub-ticks');
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

  /** Names like "<Boy Name>" must not be parsed as tags. */
  function escHtml(v) {
    return String(v).replace(/[&<>"]/g, function(ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; });
  }

  function getCharacters() {
    return (typeof SPRITES_CHARACTERS_DATA !== 'undefined' ? SPRITES_CHARACTERS_DATA : (typeof window !== 'undefined' ? window.SPRITES_CHARACTERS_DATA : [])) || [];
  }

  /** Every animation record, in record order: its position is the animation's index (#n). */
  function getAnimations() {
    return (typeof SPRITES_ANIMATIONS !== 'undefined' ? SPRITES_ANIMATIONS : (typeof window !== 'undefined' ? window.SPRITES_ANIMATIONS : [])) || [];
  }
  var animIndexByRecord = null;
  function animIndexOf(record) {
    if (!animIndexByRecord) {
      animIndexByRecord = {};
      getAnimations().forEach(function(a, i) { animIndexByRecord[a.record] = i; });
    }
    return record in animIndexByRecord ? animIndexByRecord[record] : -1;
  }

  /** A list row's text: the name, and its index on a second line. */
  function twoLineHtml(name, index, tag) {
    return '<span class="sp-li-text"><span class="sp-li-name">' + escHtml(name) + (tag || '') + '</span>' +
      '<span class="sp-li-idx">' + escHtml(index) + '</span></span>';
  }

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

      if (q && !nameStr.includes(q) && idStr !== q.replace(/^#/, '') && !snesStr.includes(q)) return;

      var li = document.createElement('li');
      li.className = 'sp-list-item' + (c.id === selectedCharId ? ' sp-selected' : '') + (c.noVisuals ? ' sp-li-novis' : '');
      li.dataset.id = String(c.id);
      li.title = (c.snesHex ? 'Record ' + c.snesHex : '') + (c.noVisuals ? '\nNo visuals: none of its own animations shows a sprite (death is the shared dust puff)' : '');
      // Two square boxes per row, filled or empty, so every name starts at the same x.
      var box = function(src, title) { return '<span class="sp-li-thumb" title="' + title + '">' + (src ? '<img src="' + src + '" alt="">' : '') + '</span>'; };
      var thumbs = '<span class="sp-li-thumbs">' + box(c.thumbs && c.thumbs.s, 'south') + box(c.thumbs && c.thumbs.e, 'east') + '</span>';
      li.innerHTML = thumbs + twoLineHtml(c.name || '#' + c.id, '#' + c.id, c.noVisuals ? '<span class="sp-li-tag">no visuals</span>' : '');

      li.addEventListener('click', function() { selectCharacter(c.id); });
      listEl.appendChild(li);
    });
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
    // A record picked under All stays on stage for the next character; a Default pick does not.
    if (animFilter !== 'all') pickedRecord = null;

    // Update list selection highlight
    if (listEl) {
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
    if (nameEl) { nameEl.textContent = c.name || '#' + c.id; nameEl.title = c.snesHex ? 'Record ' + c.snesHex : ''; }
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
