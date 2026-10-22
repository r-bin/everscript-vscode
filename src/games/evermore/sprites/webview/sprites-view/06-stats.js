// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the Characters tab's Stats cards — one box per record field: its label and its value,
// shown the way it is used (palettes as index + colours, behaviour by name, flags as bits), and a
// one-line native tooltip (no hover popup: those clipped at the panel's edge).

  /** Spawn flags (+0x05 → entity +0x10) by everscript's FLAG_ENEMY names. */
  var SPAWN_FLAG_BITS = [[0x0001, 'inactive+invisible'], [0x0002, 'invincible'], [0x0004, 'party/bombable'], [0x0020, 'inactive'], [0x0040, 'mosquito'], [0x0400, 'phasing'], [0x1000, 'invisible+invincible+inactive']];
  /** Flags +0x07, as the code tests them ($8FC4BA, $8FBA46, $8C86A6 / $8C86DA, $8FB9FB). */
  var FLAGS2_BITS = [[0x01, 'listed at $58AF'], [0x02, '−30 hit rate'], [0x04, 'script bit 2'], [0x08, 'script bit 3'], [0x10, 'immune to projectiles']];

  function bitNames(v, table) {
    var names = table.filter(function(b) { return v & b[0]; }).map(function(b) { return b[1]; });
    var rest = v & ~table.reduce(function(m, b) { return m | b[0]; }, 0);
    if (rest) names.push('$' + rest.toString(16));
    return names;
  }
  function spawnFlagsText(v) { var n = bitNames(v, SPAWN_FLAG_BITS); return n.length ? n.join(', ') : 'none'; }

  /** `width` bits, high first, in groups of four; a set bit is lit and every bit names itself on hover. */
  function bitsHtml(v, width, table) {
    var out = '';
    for (var b = width - 1; b >= 0; b--) {
      var mask = 1 << b, named = table.find(function(t) { return t[0] === mask; });
      out += '<span class="sp-bit' + (v & mask ? ' sp-bit-on' : '') + '" title="bit ' + b + ' ($' + mask.toString(16) + ')' + (named ? ': ' + named[1] : '') + '">' + (v & mask ? 1 : 0) + '</span>';
      if (b && b % 4 === 0) out += '<span class="sp-bit-gap"></span>';
    }
    var names = bitNames(v, table);
    return '<span class="sp-bits">' + out + '</span><span class="sp-stat-note">' + escHtml(names.length ? names.join(', ') : 'none') + '</span>';
  }

  /** A palette as its index and its colours (the first, transparent, left out). */
  function paletteHtml(index, addr, colours) {
    if (!addr) return '—';
    var sw = (colours || []).slice(1).map(function(h) { return '<span style="background:' + h + '"></span>'; }).join('');
    return (index >= 0 ? '#' + index : '$' + addr.toString(16)) + (sw ? ' <span class="sp-stat-swatch">' + sw + '</span>' : '');
  }

  /** Behaviour (+0x03) as a drop-down of the compiler's IDLE_BEHAVIOR names; the tab only reads the ROM, so a pick changes nothing. */
  function behaviourHtml(v) {
    var list = (typeof SPRITES_BEHAVIOURS !== 'undefined' ? SPRITES_BEHAVIOURS : []) || [];
    var opts = list.map(function(b) {
      var text = b.name.replace(/_/g, ' ').toLowerCase() + (b.note && /^UNKNOWN/.test(b.name) ? ' — ' + b.note : '');
      return '<option value="' + b.value + '"' + (b.value === v ? ' selected' : '') + ' title="' + escHtml(b.note || '') + '">' + escHtml(text) + '</option>';
    });
    if (!list.some(function(b) { return b.value === v; })) opts.unshift('<option selected>$' + v.toString(16) + ' (unnamed)</option>');
    return '<select class="sp-select sp-stat-select" title="The value in the ROM is selected; the tab reads the ROM and saves nothing">' + opts.join('') + '</select>';
  }

  /** A stat's tooltip: its field and what the game does with it, in one short line (addresses left out). */
  function statTip(desc, raw) {
    var m = /^[^(]*\((\+0x[0-9a-f]+)\)\.?\s*([\s\S]*)$/i.exec(desc || '');
    var field = m ? m[1] : '';
    var text = (m ? m[2] : desc || '').replace(/\s*\((?:\$|\+0x)[^)]*\)/gi, '').split(/(?<=\.)\s/)[0].trim();
    if (text.length > 90) text = text.slice(0, 87) + '…';
    return [field, raw, text].filter(Boolean).join(' · ');
  }

  function renderStats(c) {
    if (!statsGrid) return;
    statsGrid.innerHTML = '';
    var s = c.stats || {};
    var m = c.statMeanings || {};
    var hex = function(v) { return '$' + v.toString(16); };

    // `html` replaces the escaped value; `wide` takes the whole row.
    var fields = [
      { label: 'HP', val: s.hp, desc: m.hp },
      { label: 'Attack', val: s.attack, desc: m.attack },
      { label: 'Defense', val: s.defense, desc: m.defense },
      { label: 'M. Defense', val: s.magic_defense, desc: m.magic_defense },
      { label: 'Evade', val: s.evade, desc: m.evade },
      { label: 'Hit Rate', val: s.hit_rate, desc: m.hit_rate },
      { label: 'Aggro Range', val: s.aggro_range + ' px', desc: m.aggro_range },
      { label: 'Aggro Chance', val: Math.round(s.aggro_chance / 256 * 100) + '%', raw: hex(s.aggro_chance), desc: m.aggro_chance },
      { label: 'EXP', val: s.exp, desc: m.exp },
      { label: 'Money (Talons)', val: s.money, desc: m.money },
      { label: 'Prize Chance', val: Math.round(s.prize_chance / 128 * 100) + '%', raw: hex(s.prize_chance), desc: m.prize_chance },
      { label: 'Collision Radius', val: s.radius + ' px (' + (s.radius * 2) + '×' + s.radius + ')', desc: m.radius },
      { label: 'Palette', html: paletteHtml(c.paletteIndex, s.palette, c.paletteColors), raw: hex(s.palette), desc: m.palette },
      { label: 'Palette 2', html: paletteHtml(c.palette2Index, s.palette2, c.palette2Colors), raw: s.palette2 ? hex(s.palette2) : '', desc: m.palette2 },
      { label: 'Behaviour', html: behaviourHtml(s.ai_script), raw: hex(s.ai_script), desc: m.ai_script, wide: true },
      { label: 'Spawn Flags (+0x05)', html: bitsHtml(s.flags, 16, SPAWN_FLAG_BITS), raw: hex(s.flags), desc: m.flags, wide: true },
      { label: 'Flags (+0x07)', html: bitsHtml(s.flags2, 8, FLAGS2_BITS), raw: hex(s.flags2), desc: m.flags2, wide: true },
      { label: 'Charge Limit', val: s.charge_limit, desc: m.charge_limit },
      { label: 'Charge Speed', val: s.charge_speed, desc: m.charge_speed },
      { label: 'Attack Proc', val: hex(s.attack_proc), desc: m.attack_proc },
      { label: 'Level (+0x2A)', val: s.unknown2a, desc: m.unknown2a },
      { label: '+0x11', val: s.unknown11, desc: m.unknown11 },
      { label: '+0x17', val: s.unknown17, desc: m.unknown17 },
    ];

    fields.forEach(function(f) {
      var card = document.createElement('div');
      card.className = 'sp-stat-card' + (f.wide ? ' sp-stat-wide' : '');
      card.title = statTip(f.desc, f.raw ? 'raw ' + f.raw : '');
      card.innerHTML = '<div class="sp-stat-header"><span>' + escHtml(f.label) + '</span></div>' +
        '<div class="sp-stat-val">' + (f.html !== undefined ? f.html : escHtml(f.val)) + '</div>';
      statsGrid.appendChild(card);
    });
  }
