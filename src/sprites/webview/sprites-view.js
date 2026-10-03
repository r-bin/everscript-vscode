// Ownership: client-side interaction, animation playback loop, canvas drawing, stat cards, and chunk inspector for the Sprites tab.
(function() {
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
        emptyEl.innerHTML = '<strong>No characters loaded.</strong><br><span style="opacity:0.75">Ensure a Secret of Evermore ROM is present or configured in Settings (<code>everscript.romPath</code>).</span>';
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
        emptyRawEl.innerHTML = '<strong>No raw sprites loaded.</strong><br><span style="opacity:0.75">Ensure a Secret of Evermore ROM is present or configured in Settings (<code>everscript.romPath</code>).</span>';
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
    if (c.id !== paletteOverrideChar) { paletteOverride = 0; paletteOverrideChar = c.id; }
    if (badgeEl) {
      var disp = c.disposition || {};
      badgeEl.textContent = c.id === 0 || c.id === 1 ? 'Hero' : (disp.label || '');
      badgeEl.className = 'sp-badge ' + (c.id === 0 || c.id === 1 ? 'sp-badge-hero' : disp.hostile ? 'sp-badge-enemy' : 'sp-badge-npc');
    }
    if (palHex) palHex.textContent = c.paletteAddrHex || '$0000';
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
  }

  /**
   * The second character, when the Target box is on: enemies are shown against the Boy
   * (in his first weapon's palette), the Boy, the Dog and NPCs against a Wimpy Flower.
   */
  function targetRequest(c) {
    if (!chkTarget || !chkTarget.checked) return null;
    var chars = getCharacters();
    var hostile = c.id > 1 && c.disposition && c.disposition.hostile;
    var t = hostile ? chars[0] : chars.find(function(x) { return x.name === 'Wimpy Flower'; }) || chars[0];
    var paletteAddr = t.id === 0 && t.weapons && t.weapons[0] ? t.weapons[0].paletteAddr : 0;
    var d = targetDist ? parseInt(targetDist.value, 10) : 40;
    return { on: true, character: t.id, name: t.name, paletteAddr: paletteAddr, distance: isFinite(d) ? d : 40 };
  }

  /** The Boy has weapons and the Dog has forms: each an animation set with its own palette. */
  var DOG = 1;
  function hasVariants(c) {
    return (c.id === 0 || c.id === 1) && c.weapons && c.weapons.length > 0;
  }

  function populateAnimationDropdown(c) {
    if (!animSel) return;
    animSel.innerHTML = '';
    // An animation that reuses an earlier one's record says which: "Walk (→ Idle)".
    var firstByRecord = {};
    var labelFor = function(a) {
      var base = a.label + (a.valueHex ? ' (' + a.valueHex + ')' : '');
      if (!a.animRec) return base;
      if (firstByRecord[a.animRec]) return a.label + ' (→ ' + firstByRecord[a.animRec] + ')';
      firstByRecord[a.animRec] = a.label;
      return base;
    };

    var defaultKey = 'stand';

    // The Boy's weapon or the Dog's form:
    if (hasVariants(c) && c.weapons[selectedWeaponId]) {
      var w = c.weapons[selectedWeaponId];
      var wGroup = document.createElement('optgroup');
      wGroup.label = (c.id === 1 ? 'Form: ' : 'Weapon: ') + w.name;
      (w.anims || []).forEach(function(a) {
        var opt = document.createElement('option');
        opt.value = a.key;
        opt.textContent = labelFor(a);
        opt.dataset.category = 'weapon';
        wGroup.appendChild(opt);
      });
      if (wGroup.children.length) animSel.appendChild(wGroup);
      defaultKey = c.id === 1 ? 'd_slot0' : 'w_atk0';
    }

    var stdGroup = document.createElement('optgroup');
    stdGroup.label = c.id === 0 ? 'General Actions' : 'Standard Animations';
    var extGroup = document.createElement('optgroup');
    extGroup.label = 'Special / Opcode Triggers';

    (c.anims || []).forEach(function(a) {
      if (a.category === 'weapon') return;
      var opt = document.createElement('option');
      opt.value = a.key;
      opt.textContent = labelFor(a);
      opt.dataset.category = a.category;
      if (a.category === 'external') extGroup.appendChild(opt);
      else stdGroup.appendChild(opt);
    });

    if (stdGroup.children.length) animSel.appendChild(stdGroup);
    if (extGroup.children.length) animSel.appendChild(extGroup);

    var hasCur = false;
    for (var i = 0; i < animSel.options.length; i++) {
      if (animSel.options[i].value === selectedAnimKey) { hasCur = true; break; }
    }
    if (!hasCur) selectedAnimKey = defaultKey;
    animSel.value = selectedAnimKey;
    renderAnimGrid(c);
  }

  /**
   * The Animations tab: the dropdown's entries as tiles, grouped the same way, each with a
   * lazily rendered preview of its resting pose at the current facing and palette.
   */
  var animGrid = document.getElementById('sp-anim-grid');
  function renderAnimGrid(c) {
    if (!animGrid || !animSel) return;
    animGrid.innerHTML = '';
    if (currentMode === 'anims') {
      animGrid.innerHTML = '<div class="sp-anim-group">The list on the left picks the animation in this mode.</div>';
      return;
    }
    var byKey = {};
    (c.anims || []).forEach(function(a) { byKey[a.key] = a; });
    if (hasVariants(c) && c.weapons[selectedWeaponId]) (c.weapons[selectedWeaponId].anims || []).forEach(function(a) { byKey[a.key] = a; });
    var variantPal = hasVariants(c) && c.weapons[selectedWeaponId] ? c.weapons[selectedWeaponId].paletteAddr : 0;
    Array.prototype.forEach.call(animSel.children, function(group, gi) {
      var isVariant = gi === 0 && variantPal !== undefined && hasVariants(c) && /^(Weapon|Form): /.test(group.label || '');
      if (!isVariant) {
        var head = document.createElement('div');
        head.className = 'sp-anim-group';
        head.textContent = group.label || '';
        animGrid.appendChild(head);
      }
      Array.prototype.forEach.call(group.children, function(opt) {
        var a = byKey[opt.value] || {};
        var pal = paletteOverride || a.paletteAddr || (c.id === DOG ? 0 : variantPal) || 0;
        var tile = document.createElement('div');
        tile.className = 'sp-anim-tile' + (opt.value === selectedAnimKey ? ' sp-active' : '');
        tile.dataset.key = opt.value;
        tile.title = opt.textContent + (a.animRec ? ' — record $' + a.animRec.toString(16) : '');
        if (a.animRec && window.SpritesThumbs) {
          tile.appendChild(window.SpritesThumbs.box({
            key: 'anim:' + c.id + ':' + a.animRec + ':' + selectedFacing + ':' + pal,
            record: a.animRec, facing: selectedFacing, character: c.id, paletteAddr: pal,
          }));
        } else {
          var empty = document.createElement('span'); empty.className = 'sp-li-thumb'; tile.appendChild(empty);
        }
        var m = /^(.*?)(\s\(→ .*\))$/.exec(opt.textContent);
        var label = document.createElement('span'); label.className = 'sp-anim-label'; label.textContent = m ? m[1] : opt.textContent;
        tile.appendChild(label);
        if (m) { var sub = document.createElement('span'); sub.className = 'sp-anim-sub'; sub.textContent = m[2].trim(); tile.appendChild(sub); }
        tile.addEventListener('click', function() {
          animSel.value = opt.value;
          selectedAnimKey = opt.value;
          animGrid.querySelectorAll('.sp-anim-tile').forEach(function(t) { t.classList.toggle('sp-active', t === tile); });
          loadCurrentAnimation();
        });
        animGrid.appendChild(tile);
      });
    });
  }

  // ── Stats Cards ─────────────────────────────────────────────────────────────
  function renderStats(c) {
    if (!statsGrid) return;
    statsGrid.innerHTML = '';
    var s = c.stats || {};
    var m = c.statMeanings || {};

    var fields = [
      { key: 'hp', label: 'HP', val: s.hp, hex: '$' + s.hp.toString(16), desc: m.hp },
      { key: 'attack', label: 'Attack', val: s.attack, hex: '$' + s.attack.toString(16), desc: m.attack },
      { key: 'defense', label: 'Defense', val: s.defense, hex: '$' + s.defense.toString(16), desc: m.defense },
      { key: 'magic_defense', label: 'M. Defense', val: s.magic_defense, hex: '$' + s.magic_defense.toString(16), desc: m.magic_defense },
      { key: 'evade', label: 'Evade', val: s.evade, hex: '$' + s.evade.toString(16), desc: m.evade },
      { key: 'hit_rate', label: 'Hit Rate', val: s.hit_rate, hex: '$' + s.hit_rate.toString(16), desc: m.hit_rate },
      { key: 'aggro_range', label: 'Aggro Range', val: s.aggro_range + ' px', hex: '$' + s.aggro_range.toString(16), desc: m.aggro_range },
      { key: 'aggro_chance', label: 'Aggro Chance', val: Math.round(s.aggro_chance / 256 * 100) + '%', hex: '$' + s.aggro_chance.toString(16), desc: m.aggro_chance },
      { key: 'exp', label: 'EXP', val: s.exp, hex: '$' + s.exp.toString(16), desc: m.exp },
      { key: 'money', label: 'Money (Talons)', val: s.money, hex: '$' + s.money.toString(16), desc: m.money },
      { key: 'prize_chance', label: 'Prize Chance', val: Math.round(s.prize_chance / 128 * 100) + '%', hex: '$' + s.prize_chance.toString(16), desc: m.prize_chance },
      { key: 'radius', label: 'Collision Radius', val: s.radius + ' px (' + (s.radius*2) + '×' + s.radius + ')', hex: '$' + s.radius.toString(16), desc: m.radius },
      { key: 'flags', label: 'Spawn Flags', val: spawnFlagsText(s.flags), hex: '$' + s.flags.toString(16), desc: m.flags },
      { key: 'palette', label: 'Palette', val: '$' + s.palette.toString(16), hex: '$' + s.palette.toString(16), desc: m.palette },
      { key: 'charge_limit', label: 'Charge Limit', val: s.charge_limit, hex: '$' + s.charge_limit.toString(16), desc: m.charge_limit },
      { key: 'charge_speed', label: 'Charge Speed', val: s.charge_speed, hex: '$' + s.charge_speed.toString(16), desc: m.charge_speed },
      { key: 'attack_proc', label: 'Attack Proc', val: '$' + s.attack_proc.toString(16), hex: '$' + s.attack_proc.toString(16), desc: m.attack_proc },
      { key: 'ai_script', label: 'Behaviour', val: '$' + s.ai_script.toString(16), hex: '$' + s.ai_script.toString(16), desc: m.ai_script },
      { key: 'flags2', label: 'Flags (+0x07)', val: flags2Text(s.unknown07), hex: '$' + s.unknown07.toString(16), desc: m.flags2 },
      { key: 'palette2', label: 'Palette 2', val: s.unknown0b ? '$' + s.unknown0b.toString(16) : '—', hex: '$' + s.unknown0b.toString(16), desc: m.palette2 },
      { key: 'unknown11', label: '+0x11', val: s.unknown11, hex: '$' + s.unknown11.toString(16), desc: m.unknown11 },
      { key: 'unknown17', label: '+0x17', val: s.unknown17, hex: '$' + s.unknown17.toString(16), desc: m.unknown17 },
      { key: 'unknown2a', label: 'Level (+0x2A)', val: s.unknown2a, hex: '$' + s.unknown2a.toString(16), desc: m.unknown2a },
    ];

    fields.forEach(function(f) {
      var card = document.createElement('div');
      card.className = 'sp-stat-card';
      card.innerHTML = 
        '<div class="sp-stat-header"><span>' + f.label + '</span><span>' + f.hex + '</span></div>' +
        '<div class="sp-stat-val">' + f.val + '</div>' +
        '<div class="sp-stat-tooltip"><strong>' + f.label + ':</strong> ' + f.desc + '</div>';
      statsGrid.appendChild(card);
    });
  }

  /** Flags +0x07, as the code tests them. */
  function flags2Text(v) {
    var bits = [];
    if (v & 0x01) bits.push('listed');
    if (v & 0x02) bits.push('−30 hit');
    if (v & 0x0c) bits.push('script ' + ((v >> 2) & 3));
    if (v & 0x10) bits.push('projectile-proof');
    return bits.length ? bits.join(', ') : 'none';
  }

  // ── Load Animation Data ─────────────────────────────────────────────────────
  function loadCurrentAnimation() {
    var chars = getCharacters();
    var c = chars.find(function(x) { return x.id === selectedCharId; });
    if (!c) return;

    var animOpt = null;
    if (currentMode === 'anims' && pinnedRecord) {
      animOpt = { key: 'record', category: 'external', animRec: pinnedRecord.record, paletteAddr: pinnedRecord.paletteAddr || 0 };
    }
    if (!animOpt && hasVariants(c) && c.weapons[selectedWeaponId]) {
      animOpt = (c.weapons[selectedWeaponId].anims || []).find(function(a) { return a.key === selectedAnimKey; });
    }
    if (!animOpt) {
      animOpt = (c.anims || []).find(function(a) { return a.key === selectedAnimKey; });
    }
    if (!animOpt) animOpt = { key: 'stand', offset: 0x32 };
    // The Boy is drawn in the equipped weapon's palette (weapon +0x04), whatever he is doing.
    // The Dog's own fields are its Act 1 wolf, so only its form animations take the form's.
    if (currentMode === 'chars' && hasVariants(c) && c.id !== DOG && c.weapons[selectedWeaponId] && !animOpt.paletteAddr) {
      animOpt = Object.assign({}, animOpt, { paletteAddr: c.weapons[selectedWeaponId].paletteAddr });
    }
    if (paletteOverride) animOpt = Object.assign({}, animOpt, { paletteAddr: paletteOverride, paletteForced: true });
    requestedRecord = animOpt.animRec || 0;
    var target = targetRequest(c);
    if (target) animOpt = Object.assign({}, animOpt, { target: target });

    if (vsApi) {
      vsApi.postMessage({
        command: 'getSpriteAnimation',
        characterId: selectedCharId,
        animKey: selectedAnimKey,
        animOpt: animOpt,
        facing: selectedFacing,
      });
    }
  }

  // ── Animation Playback Controls ─────────────────────────────────────────────
  if (weaponSel) {
    weaponSel.addEventListener('change', function() {
      selectedWeaponId = parseInt(weaponSel.value) || 0;
      var chars = getCharacters();
      var c = chars.find(function(x) { return x.id === selectedCharId; });
      if (c) populateAnimationDropdown(c);
      loadCurrentAnimation();
    });
  }

  if (animSel) {
    animSel.addEventListener('change', function() {
      selectedAnimKey = animSel.value;
      loadCurrentAnimation();
    });
  }

  document.querySelectorAll('.sp-facing-btn').forEach(function(b) {
    b.addEventListener('click', function() {
      document.querySelectorAll('.sp-facing-btn').forEach(function(x) { x.classList.remove('sp-active'); });
      b.classList.add('sp-active');
      selectedFacing = parseInt(b.dataset.facing);
      var fc = getCharacters().find(function(x) { return x.id === selectedCharId; });
      if (fc) renderAnimGrid(fc);
      loadCurrentAnimation();
    });
  });

  document.querySelectorAll('.sp-scale-btn').forEach(function(b) {
    b.addEventListener('click', function() {
      document.querySelectorAll('.sp-scale-btn').forEach(function(x) { x.classList.remove('sp-active'); });
      b.classList.add('sp-active');
      animScale = parseInt(b.dataset.scale);
      drawFrame();
    });
  });

  if (trailInput) trailInput.addEventListener('change', drawFrame);
  [chkTarget, targetDist].forEach(function(el) {
    if (el) el.addEventListener('change', loadCurrentAnimation);
  });
  if (chkWalk) chkWalk.addEventListener('change', updateFrameUI);
  [chkBody, chkHurt, chkStrike, chkOrigin, chkProj, chkWalk, chkAggro].forEach(function(chk) {
    if (chk) chk.addEventListener('change', drawFrame);
  });

  if (btnPlay) {
    btnPlay.addEventListener('click', function() {
      isPlaying = !isPlaying;
      btnPlay.textContent = isPlaying ? '⏸' : '▶';
    });
  }

  if (btnLoop) {
    btnLoop.addEventListener('click', function() {
      isLooping = !isLooping;
      btnLoop.classList.toggle('sp-active', isLooping);
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', function() {
      if (!currentAnimData || !currentAnimData.frames.length) return;
      currentFrameIdx = (currentFrameIdx - 1 + currentAnimData.frames.length) % currentAnimData.frames.length;
      tickCounter = 0;
      updateFrameUI();
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', function() {
      if (!currentAnimData || !currentAnimData.frames.length) return;
      currentFrameIdx = (currentFrameIdx + 1) % currentAnimData.frames.length;
      tickCounter = 0;
      updateFrameUI();
    });
  }

  if (scrubber) {
    scrubber.addEventListener('input', function() {
      currentFrameIdx = parseInt(scrubber.value);
      tickCounter = 0;
      updateFrameUI();
    });
  }

  if (speedSel) {
    speedSel.addEventListener('change', function() {
      playbackSpeed = parseFloat(speedSel.value) || 1;
    });
  }

  if (spriteAddrLink) {
    spriteAddrLink.addEventListener('click', function() {
      if (!currentAnimData || !currentAnimData.frames[currentFrameIdx]) return;
      var f = currentAnimData.frames[currentFrameIdx];
      setMode('raw');
      selectRawSprite(f.spriteAddr);
    });
  }

  // ── Animation Loop ──────────────────────────────────────────────────────────
  var raf = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : function(cb) { return setTimeout(cb, 16); });

  function animationLoop(timestamp) {
    raf(animationLoop);
    if (!lastRafTime) lastRafTime = timestamp;
    var delta = timestamp - lastRafTime;
    lastRafTime = timestamp;

    if (!isPlaying || !currentAnimData || !currentAnimData.frames.length) return;

    var snesTickMs = (1000 / 60) / playbackSpeed;
    tickCounter += delta / snesTickMs;

    var curFrame = currentAnimData.frames[currentFrameIdx];
    var holdTicks = curFrame && curFrame.ticks > 0 ? curFrame.ticks : 1;
    // Projectiles that outlive the cycle (a boomerang's lap) finish before it loops:
    // the last frame holds while they fly.
    if (currentFrameIdx === currentAnimData.frames.length - 1) holdTicks += flightTail;

    if (tickCounter >= holdTicks) {
      tickCounter -= holdTicks;
      if (currentFrameIdx + 1 < currentAnimData.frames.length) {
        currentFrameIdx++;
        updateFrameUI();
        return;
      } else if (isLooping) {
        // A flier still in the air loops back to where its motion started repeating.
        var from = currentAnimData.loopFrom || 0;
        currentFrameIdx = 0;
        for (var i = 0; i < frameStartTicks.length; i++) if (frameStartTicks[i] <= from) currentFrameIdx = i;
        tickCounter = from - (frameStartTicks[currentFrameIdx] || 0);
        updateFrameUI();
        return;
      }
    }
    // Walking, jumping and projectiles change between frame changes: redraw every tick.
    if (animatesBetweenFrames()) drawFrame();
  }
  raf(animationLoop);

  // ── Update Frame & Canvas Drawing ───────────────────────────────────────────
  function updateFrameUI() {
    if (!currentAnimData || !currentAnimData.frames.length) {
      // No script, or a script that draws nothing: clear what the last one left.
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (frameInfo) frameInfo.textContent = currentAnimData ? 'Draws nothing' : 'No animation';
      if (spriteAddrLink) spriteAddrLink.textContent = '—';
      renderChunks([]);
      if (script) script.highlight(null);
      return;
    }
    var cur = currentAnimData.frames[currentFrameIdx];
    if (!cur) return;

    if (scrubber) {
      scrubber.max = currentAnimData.frames.length - 1;
      scrubber.value = currentFrameIdx;
    }

    if (frameInfo) {
      var isLast = currentFrameIdx === currentAnimData.frames.length - 1;
      frameInfo.textContent = 'Frame ' + (currentFrameIdx + 1) + '/' + currentAnimData.frames.length + ' (' + cur.ticks + ' ticks' +
        (isLast && flightTail > 0 ? ', then ' + flightTail + ' of flight' : '') +
        (cur.random ? ', random ' + cur.random[0] + '–' + cur.random[1] : '') + ')' +
        (cur.spawns && cur.spawns.length ? ' · throws ' + cur.spawns.map(function(sp) { return '$' + sp.id.toString(16); }).join(', ') : '') +
        motionText(cur) + targetText(cur) + modeText(cur.mode);
    }

    if (spriteAddrLink) {
      spriteAddrLink.textContent = cur.spriteHex;
    }

    // Update Chunks table and the script lines behind this frame
    renderChunks(cur.chunks || []);
    if (script) script.highlight(cur);

    // Draw canvas
    drawFrame();
  }

  /**
   * Mode (+0x16) bits by everscript's ATTRIBUTE_FLAGS.FLAGS_7 names; bit $20 is also the
   * one the hit test refuses a target for.
   */
  var MODE_BITS = [[0x01, 'knockback'], [0x02, '$02'], [0x04, 'walking'], [0x08, 'running'], [0x10, 'attacking'], [0x20, 'casting/dodging (invulnerable)'],
    [0x4000, 'charging: contact damage'], [0x8000, 'charging: contact damage']];
  function modeText(mode) {
    if (!mode) return '';
    var names = MODE_BITS.filter(function(b) { return mode & b[0]; }).map(function(b) { return b[1]; });
    if (mode & 0x3fc0) names.push('$' + (mode & 0x3fc0).toString(16));
    return ' · mode ' + names.join(', ');
  }

  /** Spawn flags (+0x05 → entity +0x10) by everscript's FLAG_ENEMY names. */
  var SPAWN_FLAG_BITS = [[0x0001, 'inactive+invisible'], [0x0002, 'invincible'], [0x0004, 'party/bombable'], [0x0020, 'inactive'], [0x0040, 'mosquito'], [0x0400, 'phasing'], [0x1000, 'invisible+invincible+inactive']];
  function spawnFlagsText(v) {
    var names = SPAWN_FLAG_BITS.filter(function(b) { return v & b[0]; }).map(function(b) { return b[1]; });
    var rest = v & ~SPAWN_FLAG_BITS.reduce(function(m, b) { return m | b[0]; }, 0);
    if (rest) names.push('$' + rest.toString(16));
    return names.length ? names.join(', ') : 'none';
  }

  /** Which ticks of this frame reach the target, if one is on stage. */
  function targetText(frame) {
    var t = currentAnimData && currentAnimData.target;
    if (!t || !t.hits) return '';
    var hits = walkOn() ? t.hits : (t.hitsStill || t.hits);
    var start = frameStartTicks[currentFrameIdx] || 0;
    var end = start + frame.ticks + (currentFrameIdx === currentAnimData.frames.length - 1 ? flightTail : 0);
    var n = hits.melee.filter(function(k) { return k >= start && k < end; }).length +
      (hits.contact || []).filter(function(k) { return k >= start && k < end; }).length +
      hits.projectile.filter(function(p) { return p.tick >= start && p.tick < end; }).length;
    return n ? ' · hits ' + t.name + ' (' + n + ' tick' + (n === 1 ? '' : 's') + ')' : '';
  }

  /** Where the frame ends up: x/y from the start and height, when the animation moves. */
  function motionText(frame) {
    if (!currentAnimData || !currentAnimData.moves || !frame.motion || !frame.motion.length) return '';
    var m = frame.motion[frame.motion.length - 1];
    var sign = function(v) { return (v > 0 ? '+' : '') + v; };
    var peak = 0;
    frame.motion.forEach(function(p) { peak = Math.max(peak, p[2]); });
    return ' · x ' + sign(m[0]) + ' y ' + sign(m[1]) + (peak ? ' · up to ' + (peak / 16).toFixed(1) + ' px high' : '');
  }

  function renderChunks(chunks) {
    if (!chunksBody) return;
    chunksBody.innerHTML = '';
    if (chunksCount) chunksCount.textContent = '(' + chunks.length + ' chunks)';
    var pal = currentPaletteAddr();
    chunks.forEach(function(ch) {
      var tr = document.createElement('tr');
      var props = [];
      if (ch.large) props.push('16×16'); else props.push('8×8');
      if (ch.flipX) props.push('FlipX');
      if (ch.flipY) props.push('FlipY');
      props.push('Prio ' + ch.priority);
      var palBits = (ch.flags >> 1) & 7;
      if (palBits) props.push('Palette 2');
      tr.innerHTML =
        '<td></td>' +
        '<td>' + ch.blockHex + '</td>' +
        '<td>' + ch.x + ', ' + ch.y + '</td>' +
        '<td>' + ch.flagsHex + '</td>' +
        '<td>' + props.join(', ') + '</td>';
      if (window.SpritesThumbs) tr.firstChild.appendChild(window.SpritesThumbs.box({
        key: 'blk:' + ch.block + ':' + (ch.large ? 1 : 0) + ':' + (ch.flipX ? 1 : 0) + (ch.flipY ? 1 : 0) + ':' + palBits + ':' + selectedCharId + ':' + pal,
        block: ch.block, large: ch.large, flipX: ch.flipX, flipY: ch.flipY, pal: palBits, character: selectedCharId, paletteAddr: pal,
      }));
      chunksBody.appendChild(tr);
    });
  }

  function drawFrame() {
    if (!ctx || !currentAnimData || !currentAnimData.frames.length) return;
    var cur = currentAnimData.frames[currentFrameIdx];
    if (!cur) return;

    // Draw everything else even while this frame's image loads (it redraws when it
    // arrives), so a frame never shows the previous animation's sprite.
    var img = cur.png ? imageFor(cur.png) : null;

    var a = currentAnimData;
    var walk = walkOn();
    var box = sceneBoxFor(walk);

    // The canvas is the stage: a fixed surface centred on the character, its walk path, its
    // projectiles and the target. Aggro and trails draw over it and never rescale it; the
    // scale drops when the scene would not fit beside the floating controls.
    var stage = canvas.parentElement;
    var W = Math.max(200, stage ? stage.clientWidth : 320);
    var H = Math.max(200, stage ? stage.clientHeight : 320);
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    var pad = 24;
    var panel = stage ? stage.querySelector('.sp-stage-overlay') : null;
    var left = panel && panel.offsetWidth ? Math.min(W / 2, panel.offsetLeft + panel.offsetWidth) : 0;
    var bw = Math.max(1, box.maxX - box.minX);
    var bh = Math.max(1, box.maxY - box.minY);
    var scale = Math.min(animScale, (W - left - pad * 2) / bw, (H - pad * 2) / bh);
    if (scale >= 1) scale = Math.floor(scale * 2) / 2;   // half steps: whole steps waste most of the stage

    // Where the feet stood at the start, then where they are now.
    var ox = Math.floor(left + (W - left) / 2 - (box.minX + bw / 2) * scale);
    var oy = Math.floor(H / 2 - (box.minY + bh / 2) * scale);
    var pos = motion ? motion.positionAt(a, currentFrameIdx, tickCounter, walk) : { x: 0, y: 0, z: 0 };
    var cx = ox + pos.x * scale;
    var cy = oy + pos.y * scale;
    var lift = pos.z * scale;

    // The second sprite slot (the shadow) stays on the ground; height lifts the sprite.
    if (cur.shadowPng && a.shadow) {
      var sh = imageFor(cur.shadowPng);
      if (sh) ctx.drawImage(sh, cx - a.shadow.originX * scale, cy - a.shadow.originY * scale, a.shadow.width * scale, a.shadow.height * scale);
    }
    if (img) ctx.drawImage(img, cx - a.originX * scale, cy - lift - a.originY * scale, a.width * scale, a.height * scale);
    if (motion && cur.segments) motion.drawSegments(ctx, a, cur, tickCounter, cx, cy, lift, scale, imageFor);

    var chars = getCharacters();
    var c = chars.find(function(x) { return x.id === selectedCharId; });
    var r = c && c.hitbox ? c.hitbox.radius : 0;

    // Overlay 1: Body Hitbox (2r × r) — the ground footprint, so it stays on the ground
    if (chkBody && chkBody.checked && r > 0) {
      var bw = r * 2 * scale;
      var bh = r * scale;
      // Charging (mode & $C000): running into another body deals contact damage ($8FB52C).
      var charging = !!cur.contact;
      var contactHit = charging && motion && motion.hitAt(a, motion.nowTick(frameStartTicks, currentFrameIdx, tickCounter), walkOn()) === 'contact';
      ctx.setLineDash(charging ? [5, 2] : []);
      ctx.strokeStyle = charging ? '#ff5577' : '#00f0a0';
      ctx.lineWidth = charging ? 2 : 1.5;
      ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
      ctx.setLineDash([]);
      ctx.fillStyle = contactHit ? 'rgba(255, 51, 85, 0.5)' : charging ? 'rgba(255, 85, 119, 0.18)' : 'rgba(0, 240, 160, 0.15)';
      ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
      if (charging) {
        ctx.fillStyle = '#ff8fa3';
        ctx.font = '11px sans-serif';
        ctx.fillText('contact damage', cx - bw / 2, cy - bh / 2 - 4);
      }
    }

    // Overlay 2: Hurt region — half-size r centred on the feet ($8FB63A), on the ground.
    // Height is a separate test: 30 px or more up, a ground-level attack cannot reach it.
    if (chkHurt && chkHurt.checked && r > 0) {
      var hw = r * 2 * scale;
      var outOfReach = a.reach && pos.z16 >= a.reach.above;
      // Centred on feet + (+0x42, 16 + +0x44): the hit test's own offsets ($8FB63D).
      var off = hurtOffsetNow(cur);
      var hx = cx + off[0] * scale;
      var hy = cy + (16 + off[1]) * scale;
      var shielded = !!cur.invulnerable;      // mode bit $20: the hit test skips it ($8FB61E)
      ctx.setLineDash(outOfReach ? [4, 3] : shielded ? [2, 2] : []);
      ctx.strokeStyle = outOfReach ? '#888888' : shielded ? '#b48cff' : '#ffaa00';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx - hw / 2, hy - hw / 2, hw, hw);
      ctx.setLineDash([]);
      if (!outOfReach && !shielded) {
        ctx.fillStyle = 'rgba(255, 170, 0, 0.10)';
        ctx.fillRect(hx - hw / 2, hy - hw / 2, hw, hw);
      } else {
        ctx.fillStyle = shielded ? '#b48cff' : '#aaaaaa';
        ctx.font = '11px sans-serif';
        ctx.fillText(shielded ? 'invulnerable' : 'out of reach', hx - hw / 2, hy + hw / 2 + 12);
      }
    }

    // Overlay 3: Strike Box, centred at (dx, dy) from the feet; red-filled harder when it lands
    var activeStrike = cur.strikeBox;      // exactly the ticks the script runs it
    if (chkStrike && chkStrike.checked && activeStrike) {
      var sw = activeStrike.width * scale;
      var shh = activeStrike.height * scale;
      var sx = cx + activeStrike.dx * scale - sw / 2;
      var sy = cy + activeStrike.dy * scale - shh / 2;   // on the ground; its height is the body's
      ctx.strokeStyle = '#ff3355';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, sw, shh);
      ctx.fillStyle = motion && motion.hitAt(a, motion.nowTick(frameStartTicks, currentFrameIdx, tickCounter), walkOn()) === 'melee'
        ? 'rgba(255, 51, 85, 0.55)' : 'rgba(255, 51, 85, 0.25)';
      ctx.fillRect(sx, sy, sw, shh);
    }

    // Aggro: |dx| < range and |dy| < range from the feet ($8FD72D) — a square, not a circle
    var range = aggroRange();
    if (range > 0) {
      var rs = range * scale;
      var inside = a.target && Math.abs(a.target.x - pos.x) < range && Math.abs(a.target.y - pos.y) < range;
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = inside ? '#c6ff8a' : 'rgba(155, 227, 143, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - rs, cy - rs, rs * 2, rs * 2);
      ctx.setLineDash([]);
      if (inside) { ctx.fillStyle = 'rgba(155, 227, 143, 0.08)'; ctx.fillRect(cx - rs, cy - rs, rs * 2, rs * 2); }
      ctx.fillStyle = 'rgba(155, 227, 143, 0.9)';
      ctx.font = '11px sans-serif';
      ctx.fillText('aggro ' + range + ' px' + (inside ? ' · target inside' : ''), cx - rs + 4, cy - rs + 13);
    }

    // Fading damage of the last few ticks, when a trail length is set
    if (motion && trailTicks() > 0) motion.drawTrail(ctx, a, frameStartTicks, motion.nowTick(frameStartTicks, currentFrameIdx, tickCounter), trailTicks(), ox, oy, scale, walk);

    // The second character, drawn before projectiles so they fly over it
    if (motion && a.target) motion.drawTarget(ctx, a, motion.nowTick(frameStartTicks, currentFrameIdx, tickCounter), ox, oy, scale, imageFor, walk);

    // Overlay 4: Projectiles in flight, from where the thrower stood
    if (motion && projectilesOn()) {
      motion.drawProjectiles(ctx, a, motion.nowTick(frameStartTicks, currentFrameIdx, tickCounter), ox, oy, scale, walk, imageFor);
    }

    // Overlay 5: Origin Crosshair (+) on the ground, and a line up to the body when airborne
    if (chkOrigin && chkOrigin.checked) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
      ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
      if (lift > 0) { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - lift); }
      ctx.stroke();
      if (walk && (pos.x || pos.y)) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.moveTo(ox - 4, oy); ctx.lineTo(ox + 4, oy);
        ctx.moveTo(ox, oy - 4); ctx.lineTo(ox, oy + 4);
        ctx.stroke();
      }
    }
  }

  /** The hurt offset on this tick: a segmented body's follows its head, others the frame's. */
  function hurtOffsetNow(frame) {
    var segs = frame.segments;
    if (segs && segs.ticks.length) {
      var t = segs.ticks[Math.min(segs.ticks.length - 1, Math.max(0, Math.floor(tickCounter)))];
      if (t && t[0]) return t[0];                 // $908886: segment_step copies the head here
    }
    return frame.hurt || [0, -16];
  }

  // ── All palettes ────────────────────────────────────────────────────────────
  var paletteOverride = 0;        // a palette chosen from the grid, until the character changes
  var keepPlayback = false;       // the next reply only recolours: keep frame and tick
  var paletteOverrideChar = -1;
  var palettePanel = document.getElementById('sp-palette-panel');
  var paletteGrid = document.getElementById('sp-palette-grid');
  var paletteStatus = document.getElementById('sp-palette-status');
  var btnPalettes = document.getElementById('sp-btn-palettes');
  var btnPaletteOwn = document.getElementById('sp-btn-palette-own');

  function requestPaletteGrid() {
    var cur = currentAnimData && currentAnimData.frames[currentFrameIdx];
    // A segmented body has no main sprite: show its head instead.
    var sprite = (cur && cur.spriteAddr) || (cur && cur.segments && parseInt(String(cur.segments.sprites[0]).replace('$', ''), 16)) || 0;
    if (!sprite) {
      if (paletteGrid) paletteGrid.innerHTML = '';
      if (paletteStatus) paletteStatus.textContent = 'this frame draws no sprite';
      return;
    }
    paletteGridFor = selectedCharId;
    if (paletteStatus) paletteStatus.textContent = 'rendering…';
    if (vsApi) vsApi.postMessage({ command: 'getPaletteGrid', sprite: sprite });
  }

  function renderPaletteGrid(grid) {
    if (!paletteGrid) return;
    paletteGrid.innerHTML = '';
    if (paletteStatus) paletteStatus.textContent = grid.length + ' palettes · click to play in one';
    grid.forEach(function(p) {
      var tile = document.createElement('div');
      tile.className = 'sp-pal-tile' + (p.addr === paletteOverride ? ' sp-active' : '');
      tile.title = p.addrHex + ' — ' + p.owners.join(', ');
      tile.innerHTML = '<img src="' + p.png + '" alt=""><span>' + p.addrHex + '</span><span>' + escHtml(p.owners[0] || '') + '</span>';
      tile.addEventListener('click', function() {
        paletteOverride = p.addr;
        paletteGrid.querySelectorAll('.sp-pal-tile').forEach(function(t) { t.classList.remove('sp-active'); });
        tile.classList.add('sp-active');
        keepPlayback = true;            // a recolour, not a new animation: stay on this frame
        loadCurrentAnimation();
        var pc = getCharacters().find(function(x) { return x.id === selectedCharId; });
        if (pc) renderAnimGrid(pc);
      });
      paletteGrid.appendChild(tile);
    });
  }

  // ── Sidebar tabs: Stats, Script, Chunks, Palettes ─────────────────────────
  var sideTab = 'anims';
  function setSideTab(name) {
    sideTab = name;
    document.querySelectorAll('.sp-side-tab').forEach(function(b) { b.classList.toggle('sp-active', b.dataset.side === name); });
    document.querySelectorAll('.sp-side-pane').forEach(function(p) { p.style.display = p.dataset.side === name ? '' : 'none'; });
    if (name === 'palettes') requestPaletteGrid();
  }
  document.querySelectorAll('.sp-side-tab').forEach(function(b) {
    b.addEventListener('click', function() { setSideTab(b.dataset.side); });
  });
  var paletteGridFor = -1;          // the character the grid was last drawn for

  if (btnPaletteOwn) btnPaletteOwn.addEventListener('click', function() {
    paletteOverride = 0;
    if (paletteGrid) paletteGrid.querySelectorAll('.sp-pal-tile').forEach(function(t) { t.classList.remove('sp-active'); });
    keepPlayback = true;
    loadCurrentAnimation();
  });

  // ── Sprites view sidebar: Chunks, Palettes ─────────────────────────────────
  var rawSideTab = 'chunks';
  var rawPaletteGrid = document.getElementById('sp-raw-palette-grid');
  var rawPaletteStatus = document.getElementById('sp-raw-palette-status');
  function setRawSideTab(name) {
    rawSideTab = name;
    document.querySelectorAll('[data-rawside]').forEach(function(el) {
      if (el.classList.contains('sp-side-tab')) el.classList.toggle('sp-active', el.dataset.rawside === name);
      else el.style.display = el.dataset.rawside === name ? '' : 'none';
    });
    if (name === 'palettes') requestRawPaletteGrid();
  }
  document.querySelectorAll('.sp-side-tab[data-rawside]').forEach(function(b) {
    b.addEventListener('click', function() { setRawSideTab(b.dataset.rawside); });
  });
  function requestRawPaletteGrid() {
    if (rawPaletteStatus) rawPaletteStatus.textContent = 'rendering…';
    if (vsApi) vsApi.postMessage({ command: 'getPaletteGrid', sprite: selectedRawAddr, target: 'raw' });
  }
  function renderRawPaletteGrid(grid) {
    if (!rawPaletteGrid) return;
    rawPaletteGrid.innerHTML = '';
    if (rawPaletteStatus) rawPaletteStatus.textContent = grid.length + ' palettes · click to use one';
    grid.forEach(function(p) {
      var tile = document.createElement('div');
      tile.className = 'sp-pal-tile' + ((0x900000 | p.addr) === rawPalette ? ' sp-active' : '');
      tile.title = p.addrHex + ' — ' + p.owners.join(', ');
      tile.innerHTML = '<img src="' + p.png + '" alt=""><span>' + p.addrHex + '</span><span>' + escHtml(p.owners[0] || '') + '</span>';
      tile.addEventListener('click', function() {
        rawPalette = 0x900000 | p.addr;
        rawPaletteGrid.querySelectorAll('.sp-pal-tile').forEach(function(t) { t.classList.remove('sp-active'); });
        tile.classList.add('sp-active');
        if (rawPaletteSel) rawPaletteSel.value = String(rawPalette);
        loadRawSprite(selectedRawAddr);
        renderList();                    // list thumbnails follow the palette
      });
      rawPaletteGrid.appendChild(tile);
    });
  }

  if (typeof ResizeObserver === 'function' && canvas && canvas.parentElement) {
    new ResizeObserver(function() { drawFrame(); }).observe(canvas.parentElement);
  }

  var STAGE_MIN_H = 270;
  var STAGE_MAX_H = 520;

  /**
   * Show the whole scene: the stage grows up to STAGE_MAX_H, and a canvas bigger than
   * that (a boomerang's lap, a long lob) is scaled down to fit — never up.
   */
  function fitToStage() {
    var stage = canvas.parentElement;
    if (!stage || !stage.clientWidth) return;
    // The stage fills the space between the controls and the seek bar; scale down to fit it.
    var availH = stage.clientHeight > 40 ? stage.clientHeight - 4 : STAGE_MAX_H;
    var k = Math.min(1, (stage.clientWidth - 4) / canvas.width, availH / canvas.height);
    canvas.style.width = Math.floor(canvas.width * k) + 'px';
    canvas.style.height = Math.floor(canvas.height * k) + 'px';
  }

  /** Movement speed per cardinal facing, in the stage overlay, for animations that move. */
  var speedReadout = document.getElementById('sp-speed-readout');
  var FACING_NAME = { 0: 'N', 4: 'E', 8: 'S', 12: 'W' };
  function renderSpeedReadout() {
    if (!speedReadout) return;
    var a = currentAnimData;
    var sp = a && a.speeds;
    // Attacks with four poses round a diagonal facing to east or west ($908343).
    var note = a && a.facingRounded
      ? '<span class="sp-hud-head sp-hud-note" title="Starting an attack whose record has four poses rounds the facing through $90815B ($908343): steps and projectiles go this way">Attack faces ' + (FACING_NAME[a.facing] || a.facing) + '</span>'
      : '';
    if (!sp) { speedReadout.innerHTML = note; return; }
    var cur = FACING_NAME[selectedFacing & 0x0c];
    var html = note + '<span class="sp-hud-head">Moves (per cycle)</span>';
    ['N', 'E', 'S', 'W'].forEach(function(k) {
      var v = sp[k];
      if (!v) return;
      var cls = k === cur ? ' class="sp-hud-cur"' : '';
      html += '<span' + cls + '>' + k + '</span><span' + cls + '>' + v.perTick.toFixed(2) + ' px/tick</span><span' + cls + '>' + Math.round(v.perSecond) + ' px/s</span>';
    });
    speedReadout.innerHTML = html;
  }

  /** The header swatch follows the palette the stage is drawn in (weapon, form, script or chosen). */
  function showStagePalette(a) {
    if (!a || !a.paletteColors) return;
    var palHex = document.getElementById('sp-palette-hex');
    var swatch = document.getElementById('sp-palette-swatch');
    if (palHex) palHex.textContent = '$' + (a.paletteAddr || 0).toString(16).padStart(4, '0');
    if (swatch) swatch.innerHTML = a.paletteColors.map(function(hex) { return '<span style="background-color:' + hex + '" title="' + hex + '"></span>'; }).join('');
  }

  /** The palette the stage is drawn in right now: a chosen one, the weapon/form's, or 0 (own). */
  function currentPaletteAddr() {
    if (paletteOverride) return paletteOverride;
    if (currentAnimData && currentAnimData.paletteAddr) return currentAnimData.paletteAddr;
    var c = getCharacters().find(function(x) { return x.id === selectedCharId; });
    if (c && hasVariants(c) && c.weapons[selectedWeaponId]) return c.weapons[selectedWeaponId].paletteAddr || 0;
    return 0;
  }

  var motion = (typeof window !== 'undefined' && window.SpritesMotion) || null;
  var sceneCache = { data: null, key: '', box: null };

  function walkOn() { return !chkWalk || chkWalk.checked; }
  function projectilesOn() {
    var pr = currentAnimData && currentAnimData.projectiles;
    return !!(pr && pr.spawns && pr.spawns.length && chkProj && chkProj.checked);
  }
  /** Something moves between frame changes, so the stage must redraw every tick. */
  function animatesBetweenFrames() {
    return projectilesOn() || trailTicks() > 0 || !!(currentAnimData && (currentAnimData.moves || currentAnimData.target
      || currentAnimData.frames.some(function(f) { return f.segments; })));
  }

  /** The viewed character's aggro range (+0x13), when the Aggro overlay is on. */
  function aggroRange() {
    if (!chkAggro || !chkAggro.checked) return 0;
    var c = getCharacters().find(function(x) { return x.id === selectedCharId; });
    return c && c.stats ? c.stats.aggro_range : 0;
  }

  function sceneBoxFor(walk) {
    var key = walk + ':' + projectilesOn() + ':' + !!(currentAnimData && currentAnimData.target) + ':' + aggroRange();
    if (sceneCache.data !== currentAnimData || sceneCache.key !== key) {
      var a = currentAnimData;
      sceneCache = {
        data: a, key: key,
        box: motion ? motion.sceneBox(a, { walk: walk, projectiles: projectilesOn(), target: !!a.target })
          : { minX: -a.originX, maxX: a.width - a.originX, minY: -a.originY, maxY: a.height - a.originY },
      };

    }
    return sceneCache.box;
  }

  /** A cached Image for a PNG data URI, or null while it loads (then redraws). */
  function imageFor(png) {
    var img = loadedImages[png];
    if (img) return img;
    if (typeof Image !== 'function') return null;
    img = new Image();
    img.onload = function() { loadedImages[png] = img; drawFrame(); };
    img.src = png;
    return null;
  }

  // ── Raw Sprites Mode Handling ───────────────────────────────────────────────
  function selectRawSprite(addr) {
    selectedRawAddr = addr;
    if (listEl) {
      listEl.querySelectorAll('.sp-list-item').forEach(function(el) {
        el.classList.toggle('sp-selected', parseInt(el.dataset.addr) === addr);
      });
    }
    loadRawSprite(addr);
    if (rawSideTab === 'palettes') requestRawPaletteGrid();
  }

  function loadRawSprite(addr) {
    if (vsApi) {
      vsApi.postMessage({
        command: 'getRawSprite',
        address: addr,
        paletteAddr: rawPalette,
      });
    }
  }

  if (rawBgSel) {
    rawBgSel.addEventListener('change', function() {
      rawBg = rawBgSel.value;
      var stage = document.getElementById('sp-raw-stage');
      if (!stage) return;
      if (rawBg === 'green') stage.style.background = '#00ff00';
      else if (rawBg === 'light') stage.style.background = '#e0e0e0';
      else if (rawBg === 'none') stage.style.background = 'transparent';
      else stage.style.background = '#121212';
    });
  }

  if (rawPaletteSel) {
    rawPaletteSel.addEventListener('change', function() {
      rawPalette = parseInt(rawPaletteSel.value, 16);
      loadRawSprite(selectedRawAddr);
    });
  }

  function populateRawPalettes() {
    if (!rawPaletteSel) return;
    rawPaletteSel.innerHTML = '';
    var chars = getCharacters();
    if (!chars || !chars.length) return;
    chars.forEach(function(c) {
      if (!c) return;
      var pal = (c.stats && c.stats.palette !== undefined) ? c.stats.palette : 0;
      var opt = document.createElement('option');
      opt.value = pal.toString(16);
      opt.textContent = (c.name || '#' + c.id) + ' (' + (c.paletteAddrHex || '$0000') + ')';
      if (c.id === 0) opt.selected = true;
      rawPaletteSel.appendChild(opt);
    });
  }

  // ── Backend Message Listener ────────────────────────────────────────────────
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('message', function(event) {
      var data = event.data;
      if (!data) return;

      if (data.command === 'spriteAnimationData') {
        var prevFrame = currentFrameIdx;
        var prevTick = tickCounter;
        currentAnimData = data.animation;
        showStagePalette(currentAnimData);
        currentFrameIdx = 0;
        tickCounter = 0;
        if (keepPlayback && currentAnimData && currentAnimData.frames.length) {
          currentFrameIdx = Math.min(prevFrame, currentAnimData.frames.length - 1);
          tickCounter = prevTick;
        }
        var recolourOnly = keepPlayback;
        keepPlayback = false;
        frameStartTicks = [];
        var acc = 0;
        ((currentAnimData && currentAnimData.frames) || []).forEach(function(f) { frameStartTicks.push(acc); acc += f.ticks; });
        flightTail = 0;
        var pr = currentAnimData && currentAnimData.projectiles;
        ((pr && pr.spawns) || []).forEach(function(sp) {
          flightTail = Math.max(flightTail, sp.tick + (sp.path ? sp.path.length : 0) + 1 - acc);
        });
        renderSpeedReadout();
        if (script) {
          script.renderScript(currentAnimData, { character: selectedCharId, paletteAddr: currentPaletteAddr() });
          script.renderOwners(currentMode === 'anims' ? pinnedRecord : script.findRecord(requestedRecord));
        }
        // A new character or animation: the palette grid shows its frame, nothing selected.
        if (sideTab === 'palettes' && !recolourOnly) requestPaletteGrid();
        updateFrameUI();
      } else if (data.command === 'paletteGridData') {
        if (data.target === 'raw') renderRawPaletteGrid(data.grid || []);
        else renderPaletteGrid(data.grid || []);
      } else if (data.command === 'thumbsData') {
        if (window.SpritesThumbs) window.SpritesThumbs.onData(data.thumbs);
      } else if (data.command === 'rawSpriteData') {
        var s = data.sprite;
        if (!s) return;
        if (rawName) rawName.textContent = 'Raw Sprite ' + s.addrHex + ' (' + s.width + '×' + s.height + ')';
        if (rawBadge) rawBadge.textContent = s.chunkCount + ' chunks';

        // Render raw chunks
        if (rawChunksBody) {
          rawChunksBody.innerHTML = '';
          (s.chunks || []).forEach(function(ch) {
            var tr = document.createElement('tr');
            var props = [];
            if (ch.large) props.push('16×16'); else props.push('8×8');
            if (ch.flipX) props.push('FlipX');
            if (ch.flipY) props.push('FlipY');
            props.push('Prio ' + ch.priority);

            tr.innerHTML =
              '<td></td>' +
              '<td>' + ch.blockHex + '</td>' +
              '<td>' + ch.x + ', ' + ch.y + '</td>' +
              '<td>' + ch.flagsHex + '</td>' +
              '<td>' + props.join(', ') + '</td>';
            if (window.SpritesThumbs) tr.firstChild.appendChild(window.SpritesThumbs.box({
              key: 'blk:' + ch.block + ':' + (ch.large ? 1 : 0) + ':' + (ch.flipX ? 1 : 0) + (ch.flipY ? 1 : 0) + ':raw:' + rawPalette,
              block: ch.block, large: ch.large, flipX: ch.flipX, flipY: ch.flipY, paletteAddr: rawPalette,
            }));
            rawChunksBody.appendChild(tr);
          });
        }

        // Draw raw canvas
        if (rawCtx && typeof Image === 'function') {
          var img = new Image();
          img.src = s.png;
          img.onload = function() {
            var sc = 3;
            rawCanvas.width = Math.max(s.width * sc + 40, 256);
            rawCanvas.height = Math.max(s.height * sc + 40, 256);
            rawCtx.clearRect(0, 0, rawCanvas.width, rawCanvas.height);
            rawCtx.imageSmoothingEnabled = false;
            var x = Math.floor((rawCanvas.width - s.width * sc) / 2);
            var y = Math.floor((rawCanvas.height - s.height * sc) / 2);
            rawCtx.drawImage(img, x, y, s.width * sc, s.height * sc);
          };
        }
      }
    });
  }

  // ── Init on page load ───────────────────────────────────────────────────────
  try {
    populateRawPalettes();
    renderList();
    var initChars = getCharacters();
    if (initChars && initChars.length > 0) {
      selectCharacter(initChars[0].id);
    }
  } catch (err) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[Sprites] Init error:', err);
    }
  }
})();
