// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the Characters tab's Stats cards — one box per record field, all the same size: the
// label, the raw value in the top-right corner, and the value as it is used (palettes as index +
// colours; behaviour, attack proc and charge limit as drop-downs; flags as bits), with a one-line
// native tooltip (no hover popup: those clipped at the panel's edge). The tab reads the ROM only, so
// a drop-down shows the ROM's value among the others and a pick changes nothing.

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
    statsGrid.innerHTML = '';
    var s = c.stats || {};
    var m = c.statMeanings || {};
    var hex = function(v) { return '$' + v.toString(16); };

    // `html` replaces the escaped value; `raw` goes in the top-right corner.
    var fields = [
      { label: 'HP', val: s.hp, raw: hex(s.hp), desc: m.hp },
      { label: 'Attack', val: s.attack, raw: hex(s.attack), desc: m.attack },
      { label: 'Defense', val: s.defense, raw: hex(s.defense), desc: m.defense },
      { label: 'M. Defense', val: s.magic_defense, raw: hex(s.magic_defense), desc: m.magic_defense },
      { label: 'Evade', val: s.evade, raw: hex(s.evade), desc: m.evade },
      { label: 'Hit Rate', val: s.hit_rate, raw: hex(s.hit_rate), desc: m.hit_rate },
      { label: 'Aggro Range', val: s.aggro_range + ' px', raw: hex(s.aggro_range), desc: m.aggro_range },
      { label: 'Aggro Chance', val: Math.round(s.aggro_chance / 256 * 100) + '%', raw: hex(s.aggro_chance), desc: m.aggro_chance },
      { label: 'EXP', val: s.exp, raw: hex(s.exp), desc: m.exp },
      { label: 'Money (Talons)', val: s.money, raw: hex(s.money), desc: m.money },
      { label: 'Prize Chance', val: Math.round(s.prize_chance / 128 * 100) + '%', raw: hex(s.prize_chance), desc: m.prize_chance },
      { label: 'Collision Radius', val: s.radius + ' px (' + (s.radius * 2) + '×' + s.radius + ')', raw: hex(s.radius), desc: m.radius },
      { label: 'Palette', html: paletteHtml(c.paletteIndex, s.palette, c.paletteColors), raw: hex(s.palette), desc: m.palette },
      { label: 'Palette 2', html: paletteHtml(c.palette2Index, s.palette2, c.palette2Colors), raw: hex(s.palette2), desc: m.palette2 },
      { label: 'Behaviour', html: namedSelect('behaviour', s.ai_script), raw: hex(s.ai_script), desc: m.ai_script },
      { label: 'Attack Proc', html: namedSelect('attackProc', s.attack_proc), raw: hex(s.attack_proc), desc: m.attack_proc },
      { label: 'Spawn Flags', html: bitsHtml(s.flags, 16, SPAWN_FLAG_BITS), raw: hex(s.flags), desc: m.flags },
      { label: 'Flags', html: bitsHtml(s.flags2, 8, FLAGS2_BITS), raw: hex(s.flags2), desc: m.flags2 },
      { label: 'Charge Limit', html: chargeHtml(s.charge_limit), raw: hex(s.charge_limit), desc: m.charge_limit },
      { label: 'Charge Speed', val: s.charge_speed, raw: hex(s.charge_speed), desc: m.charge_speed },
      { label: '+0x11', val: s.unknown11, raw: hex(s.unknown11), desc: m.unknown11 },
      { label: '+0x17', val: s.unknown17, raw: hex(s.unknown17), desc: m.unknown17 },
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
