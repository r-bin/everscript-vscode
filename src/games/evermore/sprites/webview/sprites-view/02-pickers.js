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

  /**
   * The Default list, in groups. General: every animation field of the record (+0x32..+0x48),
   * empty ones too; the Boy's weapon ($8F:81C9) or the Dog's form ($8F:9471) overwrites nine of
   * them, as in WRAM. Form: the Dog form's other six slots (they go to $1443-$144D, not the
   * record). animate(): the compiler's named ids; ids from $8000 read the ROM record
   * ($8C:E139), so no weapon or form changes them. A record shows once: later entries that play it
   * fold into the first one's tile (`also`, shown as "+n" and named in its tooltip; `merged`).
   */
  function effectiveAnims(c) {
    var out = [];
    var w = hasVariants(c) ? c.weapons[selectedWeaponId] : null;
    var byField = {};
    if (w) (w.anims || []).forEach(function(a) { if (a.field) byField[a.field] = a; });
    (c.anims || []).filter(function(a) { return a.category === 'standard'; })
      .concat((c.emptyFields || []).map(function(f) { return { key: f.key, label: f.label, offset: f.offset, animRec: 0, category: 'standard' }; }))
      .sort(function(a, b) { return a.offset - b.offset; })
      .forEach(function(f) {
        var wa = byField[f.offset];
        // A form slot nothing names yet ("Slot 3") keeps the field's name.
        out.push({ key: f.key, label: wa && !/^Slot /.test(wa.label) ? wa.label : f.label, group: 'General', anim: wa || f, weapon: wa ? w.name : '' });
      });
    if (w) (w.anims || []).forEach(function(a) { if (!a.field) out.push({ key: a.key, label: a.label, group: 'Form: ' + w.name, anim: a }); });
    (c.anims || []).forEach(function(a) {
      if (a.category === 'external') out.push({ key: a.key, label: a.label + (a.valueHex ? ' (' + a.valueHex + ')' : ''), group: 'animate()', anim: a });
    });
    var first = {};
    out.forEach(function(e) {
      var r = e.anim.animRec;
      if (!r) return;
      if (first[r]) { first[r].also.push(e.label); e.merged = true; } else { first[r] = e; e.also = []; }
    });
    return out;
  }

  /** Whether the selected key is one of the entries folded into tile `e` (same record). */
  function isAlso(c, e, key) {
    var hit = effectiveAnims(c).find(function(x) { return x.key === key; });
    return !!(hit && hit.merged && hit.anim.animRec === e.anim.animRec);
  }

  /** The hidden select keeps the keys (stamina and facing code ask it which attack keys exist). */
  function populateAnimationDropdown(c) {
    if (!animSel) return;
    animSel.innerHTML = '';
    var list = effectiveAnims(c);
    list.forEach(function(e) {
      var opt = document.createElement('option');
      opt.value = e.key;
      opt.textContent = e.label;
      animSel.appendChild(opt);
    });
    if (!list.some(function(e) { return e.key === selectedAnimKey; })) selectedAnimKey = list.length ? list[0].key : 'stand';
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
    var idx = document.createElement('span'); idx.className = 'sp-anim-sub'; idx.textContent = record ? (index >= 0 ? '#' + index : '—') + (sub ? ' ' + sub : '') : sub || '—'; tile.appendChild(idx);
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
      var pal = paletteOverride || homePalette || variantPal || 0;
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
    var group = '';
    effectiveAnims(c).forEach(function(e) {
      var a = e.anim;
      if (e.merged) return;
      var names = [e.label].concat(e.also || []).join(' ');
      if (!animMatches(q, names, a.animRec ? animIndexOf(a.animRec) : -1)) return;
      if (e.group !== group) {
        group = e.group;
        var head = document.createElement('div');
        head.className = 'sp-anim-group';
        var wpn = hasVariants(c) ? c.weapons[selectedWeaponId] : null;
        head.textContent = group === 'General' && hasVariants(c) ? 'General · ' + (wpn ? wpn.name : c.id === DOG ? 'own record' : 'no weapon') : group;
        animGrid.appendChild(head);
      }
      var pal = paletteOverride || homePalette || variantPal || a.paletteAddr || 0;
      var also = e.also || [];
      var sub = (also.length ? '+' + also.length : '') + (a.animRec ? '' : 'none');
      var tile = animTile(e.key, e.label, sub, a.animRec || 0, !pickedRecord && (e.key === selectedAnimKey || also.length && isAlso(c, e, selectedAnimKey)),
        { key: 'anim:' + c.id + ':' + a.animRec + ':' + selectedFacing + ':' + pal, record: a.animRec, facing: selectedFacing, character: c.id, paletteAddr: pal },
        function() {
          pickedRecord = null;
          animSel.value = e.key;
          selectedAnimKey = e.key;
          syncStaminaTo(e.key);
          loadCurrentAnimation();
        });
      if (also.length) { tile.classList.add('sp-anim-repeat'); tile.title += '\nAlso played as: ' + also.join(', '); }
      if (!a.animRec) tile.classList.add('sp-anim-empty');
      if (e.weapon) tile.title += '\nFrom the ' + e.weapon + ' (equipping it overwrites this field)';
      animGrid.appendChild(tile);
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

  // ── Load Animation Data ─────────────────────────────────────────────────────
  function loadCurrentAnimation() {
    syncStaminaTo(selectedAnimKey);
    var chars = getCharacters();
    var c = chars.find(function(x) { return x.id === selectedCharId; });
    if (!c) return;

    // A record picked under All plays on this character, in its palette (below).
    var animOpt = null;
    if (pickedRecord) animOpt = { key: 'record', category: 'external', animRec: pickedRecord.record };
    if (!animOpt) {
      var entry = effectiveAnims(c).find(function(e) { return e.key === selectedAnimKey; });
      animOpt = entry ? entry.anim : { key: 'stand', offset: 0x32 };
    }
    // Palette, weakest first: the character's own; the Boy's weapon's or the Dog's form's (each loader
    // writes it to +0x09, so every animation draws in it, animate() ids too); a palette an earlier
    // animation loaded and the character kept (homePalette); the script's own (server side); one
    // picked in the Palettes tab (forced).
    if (hasVariants(c) && c.weapons[selectedWeaponId]) {
      animOpt = Object.assign({}, animOpt, { paletteAddr: c.weapons[selectedWeaponId].paletteAddr });
    }
    if (homePalette) animOpt = Object.assign({}, animOpt, { paletteAddr: homePalette });
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
      selectedWeaponId = parseInt(weaponSel.value, 10);
      if (!isFinite(selectedWeaponId)) selectedWeaponId = -1;
      setHomePalette(0);               // equipping loads the weapon's palette (+0x09) over any kept one
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
