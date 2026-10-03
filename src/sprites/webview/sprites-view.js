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
  var selectedFacing = 0; // South
  var animScale = 3;
  var selectedWeaponId = 0;
  var weaponGroup = document.getElementById('sp-weapon-group');
  var weaponSel = document.getElementById('sp-weapon-sel');

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
  var frameStartTicks = [];  // playback tick each frame starts on, for projectile flight

  var statsGrid = document.getElementById('sp-stats-grid');
  var chunksBody = document.getElementById('sp-chunks-body');
  var chunksCount = document.getElementById('sp-chunks-count');

  var rawPaletteSel = document.getElementById('sp-raw-palette-sel');
  var rawBgSel = document.getElementById('sp-raw-bg-sel');
  var rawChunksBody = document.getElementById('sp-raw-chunks-body');
  var rawName = document.getElementById('sp-raw-name');
  var rawBadge = document.getElementById('sp-raw-badge');

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
    renderList();
    if (mode === 'raw') loadRawSprite(selectedRawAddr);
    if (mode === 'chars' && pinnedRecord) { pinnedRecord = null; selectCharacter(selectedCharId); }
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
        li.className = 'sp-list-item' + (c.id === selectedCharId ? ' sp-selected' : '');
        li.dataset.id = String(c.id);
        li.innerHTML = '<span class="sp-li-name">' + (c.name || '#' + c.id) + '</span>' +
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
    if (badgeEl) {
      var disp = c.disposition || {};
      badgeEl.textContent = disp.label || '';
      badgeEl.className = 'sp-badge ' + (c.id === 0 || c.id === 1 ? 'sp-badge-hero' : disp.hostile ? 'sp-badge-enemy' : 'sp-badge-npc');
    }
    if (palHex) palHex.textContent = c.paletteAddrHex || '$0000';
    if (swatch && c.paletteColors) {
      swatch.innerHTML = c.paletteColors.map(function(hex) {
        return '<span style="background-color:' + hex + '" title="' + hex + '"></span>';
      }).join('');
    }

    // Weapon selection for the Boy
    if (weaponGroup && weaponSel) {
      if (c.id === 0 && c.weapons && c.weapons.length) {
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

  function populateAnimationDropdown(c) {
    if (!animSel) return;
    animSel.innerHTML = '';

    var defaultKey = 'stand';

    // If Boy with weapons:
    if (c.id === 0 && c.weapons && c.weapons[selectedWeaponId]) {
      var w = c.weapons[selectedWeaponId];
      var wGroup = document.createElement('optgroup');
      wGroup.label = 'Weapon: ' + w.name;
      (w.anims || []).forEach(function(a) {
        var opt = document.createElement('option');
        opt.value = a.key;
        opt.textContent = a.label;
        opt.dataset.category = 'weapon';
        wGroup.appendChild(opt);
      });
      if (wGroup.children.length) animSel.appendChild(wGroup);
      defaultKey = 'w_atk0';
    }

    var stdGroup = document.createElement('optgroup');
    stdGroup.label = c.id === 0 ? 'General Actions' : 'Standard Animations';
    var extGroup = document.createElement('optgroup');
    extGroup.label = 'Special / Opcode Triggers';

    (c.anims || []).forEach(function(a) {
      if (a.category === 'weapon') return;
      var opt = document.createElement('option');
      opt.value = a.key;
      opt.textContent = a.label + (a.valueHex ? ' (' + a.valueHex + ')' : '');
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
      { key: 'prize_chance', label: 'Prize Chance', val: s.prize_chance, hex: '$' + s.prize_chance.toString(16), desc: m.prize_chance },
      { key: 'radius', label: 'Collision Radius', val: s.radius + ' px (' + (s.radius*2) + '×' + s.radius + ')', hex: '$' + s.radius.toString(16), desc: m.radius },
      { key: 'flags', label: 'Flags', val: '$' + s.flags.toString(16).padStart(4, '0'), hex: '$' + s.flags.toString(16), desc: m.flags },
      { key: 'palette', label: 'Palette', val: '$' + s.palette.toString(16), hex: '$' + s.palette.toString(16), desc: m.palette },
      { key: 'charge_limit', label: 'Charge Limit', val: s.charge_limit, hex: '$' + s.charge_limit.toString(16), desc: m.charge_limit },
      { key: 'charge_speed', label: 'Charge Speed', val: s.charge_speed, hex: '$' + s.charge_speed.toString(16), desc: m.charge_speed },
      { key: 'attack_proc', label: 'Attack Proc', val: '$' + s.attack_proc.toString(16), hex: '$' + s.attack_proc.toString(16), desc: m.attack_proc },
      { key: 'ai_script', label: 'AI Script', val: '$' + s.ai_script.toString(16), hex: '$' + s.ai_script.toString(16), desc: m.ai_script },
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

  // ── Load Animation Data ─────────────────────────────────────────────────────
  function loadCurrentAnimation() {
    var chars = getCharacters();
    var c = chars.find(function(x) { return x.id === selectedCharId; });
    if (!c) return;

    var animOpt = null;
    if (currentMode === 'anims' && pinnedRecord) {
      animOpt = { key: 'record', category: 'external', animRec: pinnedRecord.record, paletteAddr: pinnedRecord.paletteAddr || 0 };
    }
    if (!animOpt && c.id === 0 && c.weapons && c.weapons[selectedWeaponId]) {
      animOpt = (c.weapons[selectedWeaponId].anims || []).find(function(a) { return a.key === selectedAnimKey; });
    }
    if (!animOpt) {
      animOpt = (c.anims || []).find(function(a) { return a.key === selectedAnimKey; });
    }
    if (!animOpt) animOpt = { key: 'stand', offset: 0x32 };
    // The Boy is drawn in the equipped weapon's palette (weapon +0x04), whatever he is doing.
    if (currentMode === 'chars' && c.id === 0 && c.weapons && c.weapons[selectedWeaponId] && !animOpt.paletteAddr) {
      animOpt = Object.assign({}, animOpt, { paletteAddr: c.weapons[selectedWeaponId].paletteAddr });
    }
    requestedRecord = animOpt.animRec || 0;

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

  [chkBody, chkHurt, chkStrike, chkOrigin, chkProj, chkWalk].forEach(function(chk) {
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

    if (tickCounter >= holdTicks) {
      tickCounter -= holdTicks;
      if (currentFrameIdx + 1 < currentAnimData.frames.length) {
        currentFrameIdx++;
        updateFrameUI();
        return;
      } else if (isLooping) {
        currentFrameIdx = 0;
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
      frameInfo.textContent = 'Frame ' + (currentFrameIdx + 1) + '/' + currentAnimData.frames.length + ' (' + cur.ticks + ' ticks' +
        (cur.random ? ', random ' + cur.random[0] + '–' + cur.random[1] : '') + ')' +
        (cur.spawns && cur.spawns.length ? ' · throws ' + cur.spawns.map(function(sp) { return '$' + sp.id.toString(16); }).join(', ') : '') +
        motionText(cur);
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

    chunks.forEach(function(ch) {
      var tr = document.createElement('tr');
      var props = [];
      if (ch.large) props.push('16×16'); else props.push('8×8');
      if (ch.flipX) props.push('FlipX');
      if (ch.flipY) props.push('FlipY');
      props.push('Prio ' + ch.priority);

      tr.innerHTML = 
        '<td>' + ch.blockHex + '</td>' +
        '<td>' + ch.x + ', ' + ch.y + '</td>' +
        '<td>' + ch.flagsHex + '</td>' +
        '<td>' + props.join(', ') + '</td>';
      chunksBody.appendChild(tr);
    });
  }

  function drawFrame() {
    if (!ctx || !currentAnimData || !currentAnimData.frames.length) return;
    var cur = currentAnimData.frames[currentFrameIdx];
    if (!cur) return;

    var img = imageFor(cur.png);
    if (!img) return;                       // redraws when it loads

    var scale = animScale;
    var a = currentAnimData;
    var walk = walkOn();
    var box = sceneBoxFor(walk);

    // The canvas holds the whole scene: path, jump height, projectile flights.
    var pad = 40;
    var sceneW = (box.maxX - box.minX) * scale + pad * 2;
    var sceneH = (box.maxY - box.minY) * scale + pad * 2;
    canvas.width = Math.max(320, sceneW);
    canvas.height = Math.max(320, sceneH);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    // Where the feet stood at the start, then where they are now.
    var ox = Math.floor(pad + (canvas.width - sceneW) / 2 - box.minX * scale);
    var oy = Math.floor(pad + (canvas.height - sceneH) / 2 - box.minY * scale);
    var pos = motion ? motion.positionAt(a, currentFrameIdx, tickCounter, walk) : { x: 0, y: 0, z: 0 };
    var cx = ox + pos.x * scale;
    var cy = oy + pos.y * scale;
    var lift = pos.z * scale;

    // The second sprite slot (the shadow) stays on the ground; height lifts the sprite.
    if (cur.shadowPng && a.shadow) {
      var sh = imageFor(cur.shadowPng);
      if (sh) ctx.drawImage(sh, cx - a.shadow.originX * scale, cy - a.shadow.originY * scale, a.shadow.width * scale, a.shadow.height * scale);
    }
    ctx.drawImage(img, cx - a.originX * scale, cy - lift - a.originY * scale, a.width * scale, a.height * scale);

    var chars = getCharacters();
    var c = chars.find(function(x) { return x.id === selectedCharId; });
    var r = c && c.hitbox ? c.hitbox.radius : 0;

    // Overlay 1: Body Hitbox (2r × r) — the ground footprint, so it stays on the ground
    if (chkBody && chkBody.checked && r > 0) {
      var bw = r * 2 * scale;
      var bh = r * scale;
      ctx.strokeStyle = '#00f0a0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
      ctx.fillStyle = 'rgba(0, 240, 160, 0.15)';
      ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
    }

    // Overlay 2: Hurt Box (2r × 2r) standing up from the feet, lifted with the body
    if (chkHurt && chkHurt.checked && r > 0) {
      var hw = r * 2 * scale;
      var hh = r * 2 * scale;
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - hw / 2, cy - lift - hh, hw, hh);
      ctx.fillStyle = 'rgba(255, 170, 0, 0.10)';
      ctx.fillRect(cx - hw / 2, cy - lift - hh, hw, hh);
    }

    // Overlay 3: Strike Box, centred at (dx, dy) from the feet and at the body's height
    var activeStrike = cur.strikeBox;      // exactly the ticks the script runs it
    if (chkStrike && chkStrike.checked && activeStrike) {
      var sw = activeStrike.width * scale;
      var shh = activeStrike.height * scale;
      var sx = cx + activeStrike.dx * scale - sw / 2;
      var sy = cy - lift + activeStrike.dy * scale - shh / 2;
      ctx.strokeStyle = '#ff3355';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, sw, shh);
      ctx.fillStyle = 'rgba(255, 51, 85, 0.25)';
      ctx.fillRect(sx, sy, sw, shh);
    }

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

  var motion = (typeof window !== 'undefined' && window.SpritesMotion) || null;
  var sceneCache = { data: null, key: '', box: null };

  function walkOn() { return !chkWalk || chkWalk.checked; }
  function projectilesOn() {
    var pr = currentAnimData && currentAnimData.projectiles;
    return !!(pr && pr.spawns && pr.spawns.length && chkProj && chkProj.checked);
  }
  /** Something moves between frame changes, so the stage must redraw every tick. */
  function animatesBetweenFrames() {
    return projectilesOn() || !!(currentAnimData && currentAnimData.moves);
  }

  function sceneBoxFor(walk) {
    var key = walk + ':' + projectilesOn();
    if (sceneCache.data !== currentAnimData || sceneCache.key !== key) {
      var a = currentAnimData;
      sceneCache = {
        data: a, key: key,
        box: motion ? motion.sceneBox(a, { walk: walk, projectiles: projectilesOn() })
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
        currentAnimData = data.animation;
        currentFrameIdx = 0;
        tickCounter = 0;
        frameStartTicks = [];
        var acc = 0;
        ((currentAnimData && currentAnimData.frames) || []).forEach(function(f) { frameStartTicks.push(acc); acc += f.ticks; });
        if (script) {
          script.renderScript(currentAnimData);
          script.renderOwners(currentMode === 'anims' ? pinnedRecord : script.findRecord(requestedRecord));
        }
        updateFrameUI();
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
              '<td>' + ch.blockHex + '</td>' +
              '<td>' + ch.x + ', ' + ch.y + '</td>' +
              '<td>' + ch.flagsHex + '</td>' +
              '<td>' + props.join(', ') + '</td>';
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
