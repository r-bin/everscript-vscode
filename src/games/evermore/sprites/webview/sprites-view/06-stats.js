// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the Characters tab's Stats cards — one box per record field, all the same size: the
// label, the raw value in the top-right corner, and the value as it is used (palettes as index +
// colours; behaviour, attack proc and charge limit as drop-downs; flags as bits), with a one-line
// native tooltip (no hover popup: those clipped at the panel's edge). The tab reads the ROM only, so
// a drop-down shows the ROM's value among the others and a pick changes nothing.

  /**
   * Spawn flags (+0x05 → entity +0x10): every bit, named by what the code that tests it does
   * (traced, docs/entities/entities-reference.md § Entity +0x10 bits); `?` where only a role is seen.
   */
  var SPAWN_FLAG_BITS = [
    [0x0001, 'hidden and paused', 'stamina and gravity skip it; everscript INACTIVE_INVISIBLE'],
    [0x0002, 'invincible (friendly)', 'no contact handler; the tab counts it as an NPC'],
    [0x0004, 'party side', 'the hit test compares attacker and target sides'],
    [0x0008, 'keeps its place?', 'teleport and the position setter skip their tile follow-up'],
    [0x0010, '—', 'no code tests it'],
    [0x0020, 'inactive', 'halted; left out of targeting'],
    [0x0040, 'in an animation', 'set by animate() and the animation VM; the hit reaction tests it'],
    [0x0080, '? (movement probe)', 'tested with $0400 by the movement probe'],
    [0x0100, '? (layer pair, low)', 'swapped with $0200 by the position setter'],
    [0x0200, '? (layer pair, high)', 'the other half of $0300'],
    [0x0400, 'phasing', 'no body collision; sprite priority; aggro filter'],
    [0x0800, 'following a trail', 'set by the companion follower; skips the movement probe'],
    [0x1000, 'no gravity', 'gravity skips it'],
    [0x2000, 'hides after a fall', 'gravity turns it into $0001'],
    [0x4000, 'takes no damage', 'the hit reaction skips it; set by attribute()'],
    [0x8000, '—', 'no code tests it'],
  ];
  /** Flags +0x07, as the code tests them ($8FC4BA, $8FBA46, $8C8658, $8FB9FB; docs/entities/character-properties.md). */
  var FLAGS2_BITS = [
    [0x01, 'side record', 'takes a side record at $58AF'], [0x02, '−30 hit rate', 'against the party member the player does not control'],
    [0x04, 'targetable friend', 'the target filter may pick it although it is friendly'],
    [0x08, 'target filter bit 3', 'required by one kind of target request'], [0x10, 'immune to projectiles', 'an automatic miss'],
    [0x20, '—', ''], [0x40, '—', ''], [0x80, '—', ''],
  ];
  var FLAG_TABLES = { spawn: SPAWN_FLAG_BITS, flags2: FLAGS2_BITS };

  function bitsText(v, width) {
    var out = '';
    for (var b = width - 1; b >= 0; b--) out += (v >> b & 1) + (b && b % 4 === 0 ? ' ' : '');
    return out;
  }
  function flagNames(v, table) {
    var n = table.filter(function(t) { return v & t[0]; }).map(function(t) { return t[1]; });
    return n.length ? n.join(', ') : 'none';
  }

  /** The flags as their bits on a drop-down button; it opens a list of every bit with a checkbox (flagsPopup). */
  function flagsHtml(v, kind) {
    var table = FLAG_TABLES[kind], width = kind === 'spawn' ? 16 : 8;
    return '<button class="sp-select sp-flag-btn" data-flags="' + v + '" data-kind="' + kind + '" title="' + escHtml(flagNames(v, table)) + '">' +
      '<span class="sp-bits">' + bitsText(v, width) + '</span></button>';
  }

  /** One list for the open flags button, fixed to the viewport so the panel edge never clips it. */
  var flagPop = null;
  function closeFlags() { if (flagPop) { flagPop.remove(); flagPop = null; } }
  function openFlags(btn) {
    closeFlags();
    var kind = btn.dataset.kind, table = FLAG_TABLES[kind], width = kind === 'spawn' ? 16 : 8;
    flagPop = document.createElement('div');
    flagPop.className = 'sp-flag-pop';
    flagPop.innerHTML = table.map(function(t) {
      return '<label title="' + escHtml(t[2]) + '"><input type="checkbox" data-bit="' + t[0] + '"' + (+btn.dataset.flags & t[0] ? ' checked' : '') + '>' +
        '<code>$' + t[0].toString(16).padStart(width / 4, '0') + '</code> ' + escHtml(t[1]) + '</label>';
    }).join('') + '<div class="sp-flag-note">The ROM\'s bits are ticked; the tab saves nothing.</div>';
    document.body.appendChild(flagPop);
    var r = btn.getBoundingClientRect(), pw = flagPop.offsetWidth, ph = flagPop.offsetHeight;
    flagPop.style.left = Math.max(4, Math.min(r.left, window.innerWidth - pw - 4)) + 'px';
    flagPop.style.top = (r.bottom + ph + 4 > window.innerHeight ? Math.max(4, r.top - ph - 2) : r.bottom + 2) + 'px';
    flagPop.addEventListener('change', function(e) {
      var bit = +e.target.dataset.bit, v = +btn.dataset.flags;
      v = e.target.checked ? v | bit : v & ~bit;
      btn.dataset.flags = String(v);
      btn.title = flagNames(v, table);
      btn.firstChild.textContent = bitsText(v, width);
    });
  }
  if (statsGrid) statsGrid.addEventListener('click', function(e) {
    var btn = e.target.closest && e.target.closest('.sp-flag-btn');
    if (!btn) return;
    e.stopPropagation();
    if (flagPop && flagPop.__for === btn) { closeFlags(); return; }
    openFlags(btn);
    flagPop.__for = btn;
  });
  document.addEventListener('click', function(e) { if (flagPop && !flagPop.contains(e.target)) closeFlags(); });

  /** A palette as its index and its colours (the first, transparent, left out). */
  function paletteHtml(index, addr, colours) {
    if (!addr) return '—';
    var sw = (colours || []).slice(1).map(function(h) { return '<span style="background:' + h + '"></span>'; }).join('');
    return (index >= 0 ? '#' + index : '$' + addr.toString(16)) + (sw ? ' <span class="sp-stat-swatch">' + sw + '</span>' : '');
  }

  function statNames(kind) {
    var all = (typeof SPRITES_STAT_NAMES !== 'undefined' ? SPRITES_STAT_NAMES : {}) || {};
    return all[kind] || [];
  }

  /** A drop-down of `options` ([value, text, title]) with `v` selected; a value with no option is added as its hex. */
  function selectHtml(options, v) {
    var opts = options.map(function(o) {
      return '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + (o[2] ? ' title="' + escHtml(o[2]) + '"' : '') + '>' + escHtml(o[1]) + '</option>';
    });
    if (!options.some(function(o) { return o[0] === v; })) opts.unshift('<option selected>$' + v.toString(16) + ' (unnamed)</option>');
    return '<select class="sp-select sp-stat-select" title="The ROM\'s value is selected; the tab saves nothing">' + opts.join('') + '</select>';
  }

  /** The compiler's names (IDLE_BEHAVIOR, ATTACK_PROC), with what uses the ones still unnamed. */
  function namedSelect(kind, v) {
    return selectHtml(statNames(kind).map(function(b) {
      var text = b.name.replace(/_/g, ' ').toLowerCase() + (b.note && /^UNKNOWN/.test(b.name) ? ' — ' + b.note : '');
      return [b.value, text, b.note];
    }), v);
  }

  /** Charge limit as a share of a full charge ($400 = 100%, $91AEDE). */
  function chargeHtml(v) {
    var pct = function(x) { return Math.round(x / 1024 * 100) + '%'; };
    return selectHtml([0x400, 0x800, 0xc00].map(function(x) { return [x, pct(x)]; }).concat(
      [0x400, 0x800, 0xc00].indexOf(v) < 0 ? [[v, pct(v)]] : []), v);
  }

  /** A stat's tooltip: its field and what the game does with it, in one short line (addresses left out). */
  function statTip(desc, raw) {
    var m = /^[^(]*\((\+0x[0-9a-f]+)\)\.?\s*([\s\S]*)$/i.exec(desc || '');
    var field = m ? m[1] : '';
    var text = (m ? m[2] : desc || '').replace(/\s*\((?:\$|\+0x)[^)]*\)/gi, '').replace(/^[:.\s]+/, '').split(/(?<=\.)\s/)[0].trim();
    if (text.length > 90) text = text.slice(0, 87) + '…';
    return [field, raw, text].filter(Boolean).join(' · ');
  }

  function renderStats(c) {
    if (!statsGrid) return;
    closeFlags();
    statsGrid.innerHTML = '';
    var s = c.stats || {};
    var m = c.statMeanings || {};
    var hex = function(v) { return '$' + v.toString(16); };

    // `html` replaces the escaped value; `raw` goes in the top-right corner.
    var fields = [
      { label: 'Max HP', val: s.hp, raw: hex(s.hp), desc: m.hp },
      { label: 'Attack', val: s.attack, raw: hex(s.attack), desc: m.attack },
      { label: 'Defense', val: s.defense, raw: hex(s.defense), desc: m.defense },
      // Signed: $FFC1 is −63 to the alchemy damage routine ($919C90).
      { label: 'M. Defense', val: s.magic_defense >= 0x8000 ? s.magic_defense - 0x10000 : s.magic_defense, raw: hex(s.magic_defense), desc: m.magic_defense },
      { label: 'Evade', val: s.evade, raw: hex(s.evade), desc: m.evade },
      { label: 'Hit Rate', val: s.hit_rate, raw: hex(s.hit_rate), desc: m.hit_rate },
      { label: 'Aggro Range', val: s.aggro_range + ' px', raw: hex(s.aggro_range), desc: m.aggro_range },
      { label: 'Aggro Chance', val: Math.round(s.aggro_chance / 256 * 100) + '%', raw: hex(s.aggro_chance), desc: m.aggro_chance },
      { label: 'EXP', val: s.exp, raw: hex(s.exp), desc: m.exp },
      { label: 'Money', val: s.money, raw: hex(s.money), desc: m.money },
      { label: 'Prize Chance', val: Math.round(s.prize_chance / 128 * 100) + '%', raw: hex(s.prize_chance), desc: m.prize_chance },
      { label: 'Collision Radius', val: s.radius + ' px (' + (s.radius * 2) + '×' + s.radius + ')', raw: hex(s.radius), desc: m.radius },
      { label: 'Palette', html: paletteHtml(c.paletteIndex, s.palette, c.paletteColors), raw: hex(s.palette), desc: m.palette },
      { label: 'Palette 2', html: paletteHtml(c.palette2Index, s.palette2, c.palette2Colors), raw: hex(s.palette2), desc: m.palette2 },
      { label: 'Behaviour', html: namedSelect('behaviour', s.ai_script), raw: hex(s.ai_script), desc: m.ai_script },
      { label: 'Attack Proc', html: namedSelect('attackProc', s.attack_proc), raw: hex(s.attack_proc), desc: m.attack_proc },
      { label: 'Spawn Flags', html: flagsHtml(s.flags, 'spawn'), raw: hex(s.flags), desc: m.flags },
      { label: 'Flags', html: flagsHtml(s.flags2, 'flags2'), raw: hex(s.flags2), desc: m.flags2 },
      { label: 'Charge Limit', html: chargeHtml(s.charge_limit), raw: hex(s.charge_limit), desc: m.charge_limit },
      { label: 'Charge Speed', val: s.charge_speed, raw: hex(s.charge_speed), desc: m.charge_speed },
      { label: '+0x11 (unused)', val: s.unknown11, raw: hex(s.unknown11), desc: m.unknown11 },
      { label: 'Leash', val: s.unknown17 ? s.unknown17 + ' px' : 'none', raw: hex(s.unknown17), desc: m.unknown17 },
    ];

    fields.forEach(function(f) {
      var card = document.createElement('div');
      card.className = 'sp-stat-card';
      card.title = statTip(f.desc, '');
      card.innerHTML = '<div class="sp-stat-header"><span>' + escHtml(f.label) + '</span><span class="sp-stat-raw">' + escHtml(f.raw) + '</span></div>' +
        '<div class="sp-stat-val">' + (f.html !== undefined ? f.html : escHtml(f.val)) + '</div>';
      statsGrid.appendChild(card);
    });
  }
