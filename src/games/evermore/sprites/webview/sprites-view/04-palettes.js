// TODO port to TS (docs/todo/port-to-ts.md)

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
    note = staminaNote() + note;
    if (!sp) { speedReadout.innerHTML = note; return; }
    // Diagonals move the full step on both axes, with the E or W script when the record has
    // four poses, so NE climbs faster than N whenever E's step is longer.
    var html = note + '<span class="sp-hud-head" title="px per tick over the repeating part of the cycle. A diagonal moves the full step on x and y ($8FAD51)">Moves (px/tick)</span>' +
      '<span class="sp-hud-sub"></span><span class="sp-hud-sub">x</span><span class="sp-hud-sub">y</span><span class="sp-hud-sub">px/s</span>';
    ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].forEach(function(k) {
      var v = sp[k];
      if (!v) return;
      var cls = v.facing === selectedFacing ? ' class="sp-hud-cur"' : '';
      var n = function(x) { return Math.abs(x) < 0.005 ? '·' : Math.abs(x).toFixed(2); };
      html += '<span' + cls + '>' + k + '</span><span' + cls + '>' + n(v.xPerTick) + '</span><span' + cls + '>' + n(v.yPerTick) + '</span><span' + cls + '>' + Math.round(v.perSecond) + '</span>';
    });
    speedReadout.innerHTML = html;
  }

  // ── Stamina: which attack level plays, and how hard it hits ──────────────
  // $9082D8: under $400 (100%) +0x38, under $800 +0x3A, under $C00 +0x3C, else +0x3E.
  // $8FC02B: power (record +0x19) /4 under $200, /2 under $400, ×1, ×2 from $800, ×4 from $C00.
  var STAMINA = {
    q: { level: 0, power: '¼', text: '< 50%' },
    h: { level: 0, power: '½', text: '50–99%' },
    1: { level: 1, power: '1', text: '100%' },
    2: { level: 2, power: '2', text: '200%' },
    3: { level: 3, power: '4', text: '300%' },
  };
  var staminaSel = document.getElementById('sp-stamina');
  /** 0–3 for an attack field (character, Boy weapon, Dog form slots 5–8), else -1. */
  function attackLevelOf(key) {
    var m = /^(?:w_)?atk([0-3])$/.exec(key || '');
    if (m) return +m[1];
    m = /^d_slot([5-8])$/.exec(key || '');
    return m ? +m[1] - 5 : -1;
  }
  function attackKeyAt(key, level) {
    if (/^d_slot/.test(key)) return 'd_slot' + (5 + level);
    return key.replace(/[0-3]$/, String(level));
  }
  /** Picking an attack tile moves the stamina to match (Lvl 0 keeps < 50% if it was chosen). */
  function syncStaminaTo(key) {
    var lvl = attackLevelOf(key);
    if (!staminaSel || lvl < 0) return;
    if (lvl === 0) { if (staminaSel.value !== 'q') staminaSel.value = 'h'; }
    else staminaSel.value = String(lvl);
  }
  if (staminaSel) staminaSel.addEventListener('change', function() {
    var lvl = STAMINA[staminaSel.value].level;
    if (attackLevelOf(selectedAnimKey) >= 0) {
      var key = attackKeyAt(selectedAnimKey, lvl);
      if (key !== selectedAnimKey && animSel && animSel.querySelector('option[value="' + key + '"]')) {
        selectedAnimKey = key;
        animSel.value = key;
        if (animGrid) animGrid.querySelectorAll('.sp-anim-tile').forEach(function(t) { t.classList.toggle('sp-active', t.dataset.key === key); });
        loadCurrentAnimation();
        return;
      }
    }
    renderSpeedReadout();
  });
  function staminaNote() {
    if (!staminaSel || attackLevelOf(selectedAnimKey) < 0) return '';
    var st = STAMINA[staminaSel.value];
    return '<span class="sp-hud-head sp-hud-note" title="$9082D8 picks the attack by stamina; $8FC02B scales its power">Stamina ' + st.text + ': power ×' + st.power + '</span>';
  }

  /** The header swatch follows the palette the stage is drawn in (weapon, form, script or chosen). */
  function showStagePalette(a) {
    if (!a || !a.paletteColors) return;
    var palHex = document.getElementById('sp-palette-hex');
    var swatch = document.getElementById('sp-palette-swatch');
    var palAddr = a.paletteAddr || 0;
    var palHexStr = '$' + palAddr.toString(16).padStart(4, '0');
    var palIdxStr = a.paletteIndex != null && a.paletteIndex >= 0 ? '#' + a.paletteIndex : '';
    if (palHex) palHex.textContent = palIdxStr ? palIdxStr + ' (' + palHexStr + ')' : palHexStr;
    if (swatch) {
      swatch.innerHTML = a.paletteColors.map(function(hex) { return '<span style="background-color:' + hex + '" title="' + hex + '"></span>'; }).join('');
      var vfsUri = 'soe://rom/assets/palettes/' + palAddr.toString(16).padStart(4, '0');
      var tooltip = 'Palette ' + (palIdxStr ? palIdxStr + ' ' : '') + '(' + palHexStr + ')\n' + vfsUri + '\nClick to open in VFS';
      swatch.title = tooltip;
      swatch.style.cursor = 'pointer';
      swatch.onclick = function() {
        if (vsApi && palAddr) vsApi.postMessage({ command: 'openVfs', uri: vfsUri });
      };
    }
    renderCandidatePalettes(a);
  }

  function renderCandidatePalettes(a) {
    var listEl = document.getElementById('sp-candidate-list');
    if (!listEl) return;
    var cands = a.candidatePalettes || [];
    if (!cands.length) {
      listEl.innerHTML = '<span class="sp-dim" style="font-size:11px">No inferred palettes</span>';
      return;
    }
    listEl.innerHTML = cands.map(function(p) {
      var activeClass = p.isCurrent ? ' sp-pal-choice-active' : '';
      var swatches = p.colors.map(function(c, i) {
        return '<span style="background:' + (i === 0 ? 'transparent' : c) + '"></span>';
      }).join('');
      return '<div class="sp-pal-choice-row' + activeClass + '" data-pal-addr="' + p.addr + '" title="Click to apply this palette">' +
        '<div class="sp-pal-choice-swatch">' + swatches + '</div>' +
        '<div class="sp-pal-choice-info">' +
          '<span class="sp-pal-choice-idx">#' + p.index + '</span> ' +
          '<span class="sp-pal-choice-addr">(' + p.addrHex + ')</span> ' +
          '<span class="sp-pal-choice-label">(' + p.label + ')</span>' +
        '</div>' +
      '</div>';
    }).join('');

    listEl.querySelectorAll('.sp-pal-choice-row').forEach(function(row) {
      row.onclick = function() {
        var addr = parseInt(row.dataset.palAddr, 10);
        if (addr) {
          paletteOverride = addr;
          loadCurrentAnimation();
        }
      };
    });
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
