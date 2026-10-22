// TODO port to TS (docs/todo/port-to-ts.md)

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
   * The Animations tab. Default: the character's own animations (and the Boy's weapon / the
   * Dog's form), as tiles. All: every record in the ROM, previewed as it looks played on this
   * character in its palette, even where that is not the palette the game would use. Each tile
   * names the animation and its index (#n, the record's place in the record table).
   */
  var animGrid = document.getElementById('sp-anim-grid');
  var animFilter = 'default';
  var animSearch = document.getElementById('sp-anim-search');
  var ALL_LIMIT = 240;              // tiles drawn at once in All; the search narrows the rest
  function animMatches(q, label, index) {
    if (!q) return true;
    var idx = q.replace(/^#/, '');
    return label.toLowerCase().indexOf(q) >= 0 || (/^\d+$/.test(idx) && String(index) === idx);
  }
  function animTile(key, label, sub, record, active, thumb, onPick) {
    var tile = document.createElement('div');
    tile.className = 'sp-anim-tile' + (active ? ' sp-active' : '');
    tile.dataset.key = key;
    var index = record ? animIndexOf(record) : -1;
    tile.title = label + (sub ? ' ' + sub : '') + (record ? '\nRecord $' + record.toString(16) : '');
    if (record && window.SpritesThumbs) tile.appendChild(window.SpritesThumbs.box(thumb));
    else { var empty = document.createElement('span'); empty.className = 'sp-li-thumb'; tile.appendChild(empty); }
    var name = document.createElement('span'); name.className = 'sp-anim-label'; name.textContent = label; tile.appendChild(name);
    var idx = document.createElement('span'); idx.className = 'sp-anim-sub'; idx.textContent = (index >= 0 ? '#' + index : '—') + (sub ? ' ' + sub : ''); tile.appendChild(idx);
    tile.addEventListener('click', function() {
      animGrid.querySelectorAll('.sp-anim-tile').forEach(function(t) { t.classList.toggle('sp-active', t === tile); });
      onPick();
    });
    return tile;
  }
  function renderAnimGrid(c) {
    if (!animGrid || !animSel) return;
    animGrid.innerHTML = '';
    document.querySelectorAll('[data-anim-filter]').forEach(function(b) { b.classList.toggle('sp-active', b.dataset.animFilter === animFilter); });
    var q = animSearch && animSearch.value ? animSearch.value.toLowerCase().trim() : '';
    var variantPal = hasVariants(c) && c.weapons[selectedWeaponId] ? c.weapons[selectedWeaponId].paletteAddr : 0;
    if (animFilter === 'all') {
      // Played on this character: its palette (the Boy's weapon's), not the record owner's.
      var pal = paletteOverride || (c.id === DOG ? 0 : variantPal) || 0;
      var shown = 0, matched = 0;
      getAnimations().forEach(function(a, i) {
        if (!animMatches(q, a.label, i)) return;
        matched++;
        if (shown >= ALL_LIMIT) return;
        shown++;
        animGrid.appendChild(animTile('rec:' + a.record, a.label, a.facingCount > 1 ? '×' + a.facingCount : '', a.record,
          !!(pickedRecord && pickedRecord.record === a.record),
          { key: 'anim:' + c.id + ':' + a.record + ':' + selectedFacing + ':' + pal, record: a.record, facing: selectedFacing, character: c.id, paletteAddr: pal },
          function() { pickedRecord = a; loadCurrentAnimation(); }));
      });
      if (matched > shown) {
        var more = document.createElement('div');
        more.className = 'sp-anim-group';
        more.textContent = (matched - shown) + ' more — search to narrow';
        animGrid.appendChild(more);
      }
      return;
    }
    var byKey = {};
    (c.anims || []).forEach(function(a) { byKey[a.key] = a; });
    if (hasVariants(c) && c.weapons[selectedWeaponId]) (c.weapons[selectedWeaponId].anims || []).forEach(function(a) { byKey[a.key] = a; });
    var shownRecords = {};          // one tile per record: a field that reuses an earlier one's ("→ Idle") is not repeated
    Array.prototype.forEach.call(animSel.querySelectorAll('option'), function(opt) {
      var a = byKey[opt.value] || {};
      if (a.animRec && shownRecords[a.animRec]) return;
      if (a.animRec) shownRecords[a.animRec] = true;
      var m = /^(.*?)(\s\(→ .*\))$/.exec(opt.textContent);
      var label = m ? m[1] : opt.textContent;
      if (!animMatches(q, label, a.animRec ? animIndexOf(a.animRec) : -1)) return;
      var pal = paletteOverride || a.paletteAddr || (c.id === DOG ? 0 : variantPal) || 0;
      animGrid.appendChild(animTile(opt.value, label, m ? m[2].trim() : '', a.animRec || 0, !pickedRecord && opt.value === selectedAnimKey,
        { key: 'anim:' + c.id + ':' + a.animRec + ':' + selectedFacing + ':' + pal, record: a.animRec, facing: selectedFacing, character: c.id, paletteAddr: pal },
        function() {
          pickedRecord = null;
          animSel.value = opt.value;
          selectedAnimKey = opt.value;
          syncStaminaTo(opt.value);
          loadCurrentAnimation();
        }));
    });
  }
  document.querySelectorAll('[data-anim-filter]').forEach(function(b) {
    b.addEventListener('click', function() {
      animFilter = b.dataset.animFilter;
      var fc = getCharacters().find(function(x) { return x.id === selectedCharId; });
      if (fc) renderAnimGrid(fc);
    });
  });
  if (animSearch) animSearch.addEventListener('input', function() {
    var fc = getCharacters().find(function(x) { return x.id === selectedCharId; });
    if (fc) renderAnimGrid(fc);
  });

  /** A stat's tooltip: its field and what the game does with it, in one short line (addresses left out). */
  function statTip(desc, raw) {
    var m = /^[^(]*\((\+0x[0-9a-f]+)\)\.?\s*([\s\S]*)$/i.exec(desc || '');
    var field = m ? m[1] : '';
    var text = (m ? m[2] : desc || '').replace(/\s*\((?:\$|\+0x)[^)]*\)/gi, '').split(/(?<=\.)\s/)[0].trim();
    if (text.length > 90) text = text.slice(0, 87) + '…';
    return [field, raw, text].filter(Boolean).join(' · ');
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
      { key: 'flags2', label: 'Flags (+0x07)', val: flags2Text(s.flags2), hex: '$' + s.flags2.toString(16), desc: m.flags2 },
      { key: 'palette2', label: 'Palette 2', val: s.palette2 ? '$' + s.palette2.toString(16) : '—', hex: '$' + s.palette2.toString(16), desc: m.palette2 },
      { key: 'unknown11', label: '+0x11', val: s.unknown11, hex: '$' + s.unknown11.toString(16), desc: m.unknown11 },
      { key: 'unknown17', label: '+0x17', val: s.unknown17, hex: '$' + s.unknown17.toString(16), desc: m.unknown17 },
      { key: 'unknown2a', label: 'Level (+0x2A)', val: s.unknown2a, hex: '$' + s.unknown2a.toString(16), desc: m.unknown2a },
    ];

    // A card is the label and the value; the raw value shows in the tooltip only where it differs.
    fields.forEach(function(f) {
      var card = document.createElement('div');
      card.className = 'sp-stat-card';
      card.title = statTip(f.desc, String(f.val) === String(parseInt(f.hex.slice(1), 16)) || f.val === f.hex ? '' : 'raw ' + f.hex);
      card.innerHTML = '<div class="sp-stat-header"><span>' + escHtml(f.label) + '</span></div>' +
        '<div class="sp-stat-val">' + escHtml(f.val) + '</div>';
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
    syncStaminaTo(selectedAnimKey);
    var chars = getCharacters();
    var c = chars.find(function(x) { return x.id === selectedCharId; });
    if (!c) return;

    // A record picked under All plays on this character, in its palette (below).
    var animOpt = null;
    if (pickedRecord) animOpt = { key: 'record', category: 'external', animRec: pickedRecord.record };
    if (!animOpt && hasVariants(c) && c.weapons[selectedWeaponId]) {
      animOpt = (c.weapons[selectedWeaponId].anims || []).find(function(a) { return a.key === selectedAnimKey; });
    }
    if (!animOpt) {
      animOpt = (c.anims || []).find(function(a) { return a.key === selectedAnimKey; });
    }
    if (!animOpt) animOpt = { key: 'stand', offset: 0x32 };
    // The Boy is drawn in the equipped weapon's palette (weapon +0x04), whatever he is doing.
    // The Dog's own fields are its Act 1 wolf, so only its form animations take the form's.
    if (hasVariants(c) && c.id !== DOG && c.weapons[selectedWeaponId] && !animOpt.paletteAddr) {
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
        animKey: pickedRecord ? 'record' : selectedAnimKey,
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
