// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the Scripts tab's Animations and Alchemy views, and the animation
// player both use on the right: the frames the host renders (sprites'
// renderAnimation, injected), played at 60 ticks a second, wrapping to the
// tick the script loops from; the script lines the current frame ran are lit
// in the listing. State: _scr.record / formula / facing / anims / player.

var SCR_SCALE = 3;

function scrAnimKey(record) {
  return record + ':' + _scr.facing + (_scr.paletteOverride ? ':' + _scr.paletteOverride : '');
}

function scrAskAnim(record, paletteAddr) {
  if (record == null) return;
  var pal = paletteAddr || _scr.paletteOverride || 0;
  var k = scrAnimKey(record);
  if (_scr.anims[k]) return;
  _scr.anims[k] = 'pending';
  scrPost({ command: 'scriptsAnim', key: k, record: record, facing: _scr.facing, paletteAddr: pal });
}

/** The record the right side plays: the picked one, or the formula's first. */
function scrPlayingRecord() {
  if (_scr.view === 'anim') return _scr.record;
  var f = _scr.index && _scr.index.formulas[_scr.formula];
  if (!f) return null;
  if (_scr.record != null && f.records.some(function (r) { return r.record === _scr.record; })) return _scr.record;
  return f.records.length ? f.records[0].record : null;
}

function scrCommandHtml(l) {
  var html = scrEsc(l.text);
  if (l.spriteInfo) {
    var spr = l.spriteInfo.addr;
    var sprIdx = '#' + l.spriteInfo.index;
    var hex = l.spriteInfo.addrHex;
    var linkText = html.indexOf(sprIdx) >= 0 ? sprIdx : hex;
    var linkTitle = 'sprite #' + l.spriteInfo.index + ' (' + l.spriteInfo.addrHex + ')\nClick: open VFS | Hover: details';
    var linkHtml = '<a href="#" class="scr-script-link scr-sprite-link" data-sprite="' + spr + '" data-line-addr="' + l.address + '" title="' + scrEsc(linkTitle) + '">' + linkText + '</a>';
    if (html.indexOf(sprIdx) >= 0) html = html.replace(sprIdx, linkHtml);
    else if (html.indexOf(hex) >= 0) html = html.replace(hex, linkHtml);
  }
  if (l.palette) {
    var pal = l.palette.addr;
    var palIdx = '#' + (l.palette.index != null ? l.palette.index : '?');
    var palHex = '$' + pal.toString(16).padStart(4, '0');
    var palLinkText = html.indexOf(palIdx) >= 0 ? palIdx : palHex;
    var palTitle = 'palette #' + (l.palette.index != null ? l.palette.index : '?') + ' (' + palHex + ')\nClick: open VFS | Hover: details';
    var palLink = '<a href="#" class="scr-script-link scr-pal-link" data-palette="' + pal + '" data-line-addr="' + l.address + '" title="' + scrEsc(palTitle) + '">' + palLinkText + '</a>';
    if (html.indexOf(palIdx) >= 0) html = html.replace(palIdx, palLink);
    else if (html.indexOf(palHex) >= 0) html = html.replace(palHex, palLink);
  }
  return html;
}

function scrDetailHtml(l) {
  if (l.spriteInfo && l.spriteInfo.png) {
    return '<div class="scr-script-detail"><img src="' + l.spriteInfo.png + '" class="scr-px" style="max-width:54px; max-height:54px;" /></div>';
  }
  if (l.palette && l.palette.colors) {
    var chips = l.palette.colors.map(function(c, i) {
      return '<span style="background:' + (i === 0 ? 'transparent' : c) + '"></span>';
    }).join('');
    return '<div class="scr-script-detail"><div class="scr-script-swatch">' + chips + '</div></div>';
  }
  return '';
}

function scrListingHtml(a) {
  return '<table class="scr-rows scr-anim-rows"><tbody>' + a.script.map(function (l) {
    var detail = scrDetailHtml(l);
    return '<tr data-scr-line="' + l.address + '" class="' + (l.known ? '' : 'scr-unk') + (l.endFrame ? ' scr-endf' : '') + '">' +
      '<td class="scr-a">$' + l.addrHex.toUpperCase() + '</td><td class="scr-b">' + scrEsc(l.bytesHex) + '</td>' +
      '<td class="scr-s"><div class="scr-cmd-wrap">' + scrCommandHtml(l) + (l.endFrame ? ' <span class="scr-dim">⏎</span>' : '') + '</div>' + detail + '</td></tr>';
  }).join('') + '</tbody></table>';
}

function scrCandidatePalettesHtml(a) {
  var cands = a.candidatePalettes || [];
  if (!cands.length) return '';
  var rows = cands.map(function (p) {
    var activeClass = p.isCurrent ? ' scr-pal-choice-active' : '';
    var swatches = p.colors.map(function (c, i) {
      return '<i style="background:' + (i === 0 ? 'transparent' : c) + '"></i>';
    }).join('');
    return '<div class="scr-pal-choice-row' + activeClass + '" data-scr-pal="' + p.addr + '" title="Click to apply this palette">' +
      '<div class="scr-pal-choice-swatch">' + swatches + '</div>' +
      '<div class="scr-pal-choice-info">' +
        '<span class="scr-pal-choice-idx">#' + p.index + '</span> ' +
        '<span class="scr-pal-choice-addr">(' + p.addrHex + ')</span> ' +
        '<span class="scr-pal-choice-label">(' + scrEsc(p.label) + ')</span>' +
      '</div>' +
    '</div>';
  }).join('');

  return '<div class="scr-candidate-palettes">' +
    '<div class="scr-candidate-title">Inferred Palettes</div>' +
    '<div class="scr-candidate-list">' + rows + '</div>' +
  '</div>';
}

function scrPlayerHtml(a, record) {
  if (!a || a === 'pending') return '<div class="scr-empty">Rendering…</div>';
  if (a.error) return '<div class="scr-empty scr-warn">' + scrEsc(a.error) + '</div>';
  if (!a.frames.length) return '<div class="scr-empty">This script shows no sprite' + (a.stoppedAtHex ? ' (stopped at $' + a.stoppedAtHex + ')' : '') + '.</div>';
  var w = a.width * SCR_SCALE, h = a.height * SCR_SCALE, shadow = '';
  if (a.shadow) {
    shadow = '<img id="scr-anim-shadow" class="scr-px" alt="" style="left:' + (a.originX - a.shadow.originX) * SCR_SCALE + 'px;top:' +
      (a.originY - a.shadow.originY) * SCR_SCALE + 'px;width:' + a.shadow.width * SCR_SCALE + 'px;height:' + a.shadow.height * SCR_SCALE + 'px">';
  }
  return '<div class="scr-side-h">Record <code>$' + scrHex(record, 4) + '</code> <span class="scr-dim">' + a.frames.length + ' frames · ' + a.totalTicks +
    ' ticks' + (a.complete ? (a.loopFrom ? ' · loops from tick ' + a.loopFrom : ' · loops') : ' · cut') + '</span></div>' +
    '<div class="scr-stage"><div class="scr-sprite" style="width:' + w + 'px;height:' + h + 'px">' + shadow +
    '<img id="scr-anim-img" class="scr-px" alt="" style="width:' + w + 'px;height:' + h + 'px"></div></div>' +
    '<div class="scr-ctl"><button class="scr-btn" data-scr-play>' + (_scr.player.playing ? '❚❚' : '▶') + '</button>' +
    '<button class="scr-btn" data-scr-step="-1" title="Previous frame">◀︎</button><button class="scr-btn" data-scr-step="1" title="Next frame">▶︎</button>' +
    '<span class="scr-dim" id="scr-anim-pos"></span></div>' +
    scrCandidatePalettesHtml(a);
}

function scrRenderAnim(mid, side) {
  var rec = _scr.record;
  if (rec == null) { mid.innerHTML = '<div class="scr-empty">Pick an animation record on the left.</div>'; side.innerHTML = ''; scrStopPlayer(); return; }
  scrAskAnim(rec);
  var a = _scr.anims[scrAnimKey(rec)];
  var entry = _scr.index.animations.find(function (x) { return x.record === rec; }) || {};
  mid.innerHTML = '<div class="scr-h">' + scrEsc(entry.label || '') + ' <span class="scr-dim">record $' + scrHex(rec, 4) + ' · script ' + scrEsc(entry.scriptHex || '') + '</span></div>' +
    (a && a.script ? scrListingHtml(a) : '<div class="scr-note">Disassembling…</div>');
  side.innerHTML = scrPlayerHtml(a, rec);
  scrStartPlayer(a);
}

function scrBlockHtml(f) {
  var at = {};
  f.records.forEach(function (r) { at[r.at] = r; });
  var cells = [];
  for (var i = 0; i + 1 < f.bytes.length; i += 2) {
    var r = at[i], word = scrHex(f.bytes[i] | f.bytes[i + 1] << 8, 4);
    cells.push(r ? '<button class="scr-word scr-rec' + (r.record === scrPlayingRecord() ? ' scr-on' : '') + '" data-scr-rec="' + r.record + '" title="+' + scrHex(i) +
      ': animation record ' + r.recHex + (r.effect ? ' (signals effect_done)' : '') + '">' + word + '</button>'
      : '<span class="scr-word" title="+' + scrHex(i) + '">' + word + '</span>');
  }
  return '<div class="scr-words">' + cells.join('') + '</div>';
}

function scrRenderAlchemy(mid, side) {
  var f = _scr.index.formulas[_scr.formula];
  if (!f) { mid.innerHTML = '<div class="scr-empty">Pick a formula on the left.</div>'; side.innerHTML = ''; scrStopPlayer(); return; }
  var rec = scrPlayingRecord();
  if (rec != null) scrAskAnim(rec);
  var a = rec == null ? null : _scr.anims[scrAnimKey(rec)];
  var shared = _scr.index.formulas.filter(function (g) { return g.block === f.block && g.index !== f.index; }).map(function (g) { return g.name; });
  mid.innerHTML = '<div class="scr-h">' + scrEsc(f.name) + ' <span class="scr-dim">formula ' + f.index + ' · block <code>' + f.blockHex + '</code></span></div>' +
    '<div class="scr-sub">ALCHEMY_ANIM_MAP[' + f.index + '] = <code>$' + scrHex(f.offset) + '</code> → <code>$91:80A6</code> + ' + f.offset + ' → <code>' + f.blockHex + '</code>' +
    (shared.length ? ' · shared with ' + scrEsc(shared.join(', ')) : '') + '<br>The block\'s words (' + f.length + ' bytes); the lit ones are animation records — click to play.</div>' +
    scrBlockHtml(f) +
    (rec == null ? '<div class="scr-note">This block names no animation record.</div>'
      : '<div class="scr-sub" style="margin-top:12px">Record <code>$' + scrHex(rec, 4) + '</code></div>' + (a && a.script ? scrListingHtml(a) : '<div class="scr-note">Disassembling…</div>'));
  side.innerHTML = rec == null ? '<div class="scr-empty">Nothing to play.</div>' : scrPlayerHtml(a, rec);
  scrStartPlayer(a);
}

// ── Player ───────────────────────────────────────────────────────────────────
function scrStopPlayer() {
  if (_scr.player.raf) cancelAnimationFrame(_scr.player.raf);
  _scr.player.raf = 0;
}

function scrFrameAt(a, tick) {
  var t = 0;
  for (var i = 0; i < a.frames.length; i++) { t += a.frames[i].ticks; if (tick < t) return i; }
  return a.frames.length - 1;
}

function scrShowFrame(a) {
  var p = _scr.player, i = scrFrameAt(a, p.tick), f = a.frames[i];
  var img = document.getElementById('scr-anim-img');
  if (!img) return;
  if (p.frame !== i || img.getAttribute('src') !== f.png) {
    img.src = f.png;
    var sh = document.getElementById('scr-anim-shadow');
    if (sh) { if (f.shadow) { sh.src = f.shadow; sh.style.display = ''; } else sh.style.display = 'none'; }
    var lit = {};
    (f.lines || []).forEach(function (l) { lit[l] = 1; });
    document.querySelectorAll('[data-scr-line]').forEach(function (tr) { tr.classList.toggle('scr-lit', !!lit[tr.dataset.scrLine]); });
  }
  p.frame = i;
  var pos = document.getElementById('scr-anim-pos');
  if (pos) pos.textContent = 'frame ' + (i + 1) + '/' + a.frames.length + ' · tick ' + p.tick + '/' + a.totalTicks;
}

function scrStartPlayer(a) {
  scrStopPlayer();
  if (!a || !a.frames || !a.frames.length) return;
  var p = _scr.player, key = scrAnimKey(scrPlayingRecord());
  if (p.key !== key) { p.key = key; p.tick = 0; p.frame = -1; }
  p.frame = -1;
  scrShowFrame(a);
  if (typeof requestAnimationFrame !== 'function') return;
  p.last = 0;
  var step = function (now) {
    if (!document.getElementById('scr-anim-img')) { p.raf = 0; return; }
    if (p.playing) {
      if (!p.last) p.last = now;
      var ticks = Math.floor((now - p.last) / (1000 / 60));
      if (ticks > 0) {
        p.last += ticks * (1000 / 60);
        p.tick += ticks;
        if (p.tick >= a.totalTicks) p.tick = a.complete && a.loopFrom < a.totalTicks ? a.loopFrom + (p.tick - a.totalTicks) % Math.max(1, a.totalTicks - a.loopFrom) : 0;
        scrShowFrame(a);
      }
    } else p.last = 0;
    p.raf = requestAnimationFrame(step);
  };
  p.raf = requestAnimationFrame(step);
}

/** Steps one frame forward or back (pauses). */
function scrStepFrame(dir) {
  var a = _scr.anims[scrAnimKey(scrPlayingRecord())];
  if (!a || !a.frames || !a.frames.length) return;
  var p = _scr.player, i = (scrFrameAt(a, p.tick) + dir + a.frames.length) % a.frames.length, t = 0;
  for (var k = 0; k < i; k++) t += a.frames[k].ticks;
  p.playing = false; p.tick = t;
  var b = document.querySelector('[data-scr-play]');
  if (b) b.textContent = '▶';
  scrShowFrame(a);
}

function scrOnAnimMessage(msg) {
  _scr.anims[msg.key] = msg.error ? { error: msg.error } : (msg.anim || { error: 'Nothing to play for this facing.' });
  if ((_scr.view === 'anim' || _scr.view === 'alchemy') && msg.key === scrAnimKey(scrPlayingRecord())) scrRenderMain();
}

// ── Rich Tooltip for Scripts Tab ─────────────────────────────────────────────
var scrTipEl = null;
var scrTipTimeout = null;

function scrGetTipEl() {
  if (!scrTipEl) {
    scrTipEl = document.getElementById('scr-rich-tooltip');
    if (!scrTipEl) {
      scrTipEl = document.createElement('div');
      scrTipEl.id = 'scr-rich-tooltip';
      scrTipEl.className = 'evs-rich-tooltip';
      scrTipEl.style.display = 'none';
      document.body.appendChild(scrTipEl);
      scrTipEl.addEventListener('mouseenter', function() {
        if (scrTipTimeout) { clearTimeout(scrTipTimeout); scrTipTimeout = null; }
      });
      scrTipEl.addEventListener('mouseleave', function() {
        scrHideRichTooltip();
      });
    }
  }
  return scrTipEl;
}

function scrShowRichTooltip(html, x, y) {
  var tip = scrGetTipEl();
  if (!tip) return;
  if (scrTipTimeout) { clearTimeout(scrTipTimeout); scrTipTimeout = null; }
  tip.innerHTML = html;
  tip.style.display = 'block';
  var pad = 12;
  var tw = tip.offsetWidth || 270;
  var th = tip.offsetHeight || 160;
  var left = x + pad;
  var top = y + pad;
  if (left + tw > window.innerWidth - 10) left = Math.max(10, x - tw - pad);
  if (top + th > window.innerHeight - 10) top = Math.max(10, y - th - pad);
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}

function scrHideRichTooltip() {
  if (scrTipTimeout) clearTimeout(scrTipTimeout);
  scrTipTimeout = setTimeout(function() {
    var tip = scrGetTipEl();
    if (tip) tip.style.display = 'none';
  }, 250);
}

function scrSpriteTipHtml(info) {
  var tagsHtml = (info.tags || []).map(function(t) { return '<span class="evs-tip-badge">' + scrEsc(t) + '</span>'; }).join('');
  var chars = (info.characters || []).map(function(c) { return scrEsc(c.name); }).join(', ') || '—';
  var anims = (info.animations || []).slice(0, 3).map(function(a) { return scrEsc(a.label); }).join(', ') || '—';
  var vfsUri = 'soe://rom/assets/sprites/' + info.addr.toString(16).padStart(6, '0');
  var imgHtml = info.png ? '<div class="evs-tip-preview"><img src="' + info.png + '" class="evs-tip-img" style="image-rendering:pixelated; max-width:80px; max-height:80px;" /></div>' : '';

  return '<div class="evs-tip-header">' +
    '<span>Sprite <strong>#' + info.index + '</strong></span>' +
    '<code>' + info.addrHex + '</code>' +
  '</div>' +
  imgHtml +
  '<div class="evs-tip-meta">' +
    '<div class="evs-tip-row"><span class="evs-tip-label">Size:</span><span class="evs-tip-val">~' + info.widthPx + '×' + info.heightPx + ' px (' + (info.chunkCount || 0) + ' chunks)</span></div>' +
    (tagsHtml ? '<div class="evs-tip-row"><span class="evs-tip-label">Tags:</span><span class="evs-tip-val">' + tagsHtml + '</span></div>' : '') +
    '<div class="evs-tip-row"><span class="evs-tip-label">Characters:</span><span class="evs-tip-val">' + chars + '</span></div>' +
    '<div class="evs-tip-row"><span class="evs-tip-label">Animations:</span><span class="evs-tip-val">' + anims + '</span></div>' +
  '</div>' +
  '<div class="evs-tip-vfs"><a href="#" data-vfs="' + vfsUri + '">Open VFS: ' + vfsUri + '</a></div>';
}

function scrPaletteTipHtml(pal) {
  var tagsHtml = (pal.tags || []).map(function(t) { return '<span class="evs-tip-badge">' + scrEsc(t) + '</span>'; }).join('');
  var chars = (pal.characters || []).map(function(c) { return scrEsc(c.name + (c.role ? ' (' + c.role + ')' : '')); }).join(', ') || '—';
  var anims = (pal.animations || []).slice(0, 3).map(function(a) { return scrEsc(a.label); }).join(', ') || '—';
  var vfsUri = 'soe://rom/assets/palettes/' + (pal.index != null ? pal.index : pal.addr.toString(16).padStart(4, '0'));
  var swatches = (pal.colors || []).map(function(c, i) {
    return '<span style="background:' + (i === 0 ? 'transparent' : c) + '" title="' + c + '"></span>';
  }).join('');

  return '<div class="evs-tip-header">' +
    '<span>Palette <strong>#' + pal.index + '</strong></span>' +
    '<code>' + pal.addrHex + '</code>' +
  '</div>' +
  '<div class="evs-tip-swatch">' + swatches + '</div>' +
  '<div class="evs-tip-meta">' +
    '<div class="evs-tip-row"><span class="evs-tip-label">Address:</span><span class="evs-tip-val"><code>$90' + pal.addr.toString(16).padStart(4, '0') + '</code></span></div>' +
    (tagsHtml ? '<div class="evs-tip-row"><span class="evs-tip-label">Tags:</span><span class="evs-tip-val">' + tagsHtml + '</span></div>' : '') +
    '<div class="evs-tip-row"><span class="evs-tip-label">Characters:</span><span class="evs-tip-val">' + chars + '</span></div>' +
    '<div class="evs-tip-row"><span class="evs-tip-label">Animations:</span><span class="evs-tip-val">' + anims + '</span></div>' +
  '</div>' +
  '<div class="evs-tip-vfs"><a href="#" data-vfs="' + vfsUri + '">Open VFS: ' + vfsUri + '</a></div>';
}

document.addEventListener('mouseover', function(e) {
  var a = e.target.closest('.scr-sprite-link, .scr-pal-link');
  if (!a) return;
  var rec = scrPlayingRecord();
  var anim = rec != null ? _scr.anims[scrAnimKey(rec)] : null;
  if (!anim || !anim.script) return;
  var lineAddr = parseInt(a.dataset.lineAddr, 10);
  var line = anim.script.find(function(x) { return x.address === lineAddr; });
  if (!line) return;
  if (a.classList.contains('scr-sprite-link') && line.spriteInfo) {
    scrShowRichTooltip(scrSpriteTipHtml(line.spriteInfo), e.clientX, e.clientY);
  } else if (a.classList.contains('scr-pal-link') && line.palette) {
    scrShowRichTooltip(scrPaletteTipHtml(line.palette), e.clientX, e.clientY);
  }
});

document.addEventListener('mouseout', function(e) {
  var a = e.target.closest('.scr-sprite-link, .scr-pal-link');
  if (a) scrHideRichTooltip();
});

document.addEventListener('click', function(e) {
  var vfsLink = e.target.closest('[data-vfs]');
  if (vfsLink) {
    e.preventDefault();
    scrPost({ command: 'openVfs', uri: vfsLink.dataset.vfs });
    return;
  }
  var palLink = e.target.closest('[data-scr-pal]');
  if (palLink) {
    var addr = parseInt(palLink.dataset.scrPal, 10);
    var rec = scrPlayingRecord();
    if (rec != null && addr) {
      _scr.paletteOverride = addr;
      scrAskAnim(rec, addr);
      var curAnim = _scr.anims[scrAnimKey(rec)];
      if (curAnim) scrRenderMain();
    }
    return;
  }
  var sprLink = e.target.closest('.scr-sprite-link');
  if (sprLink && sprLink.dataset.sprite) {
    e.preventDefault();
    var hex6 = parseInt(sprLink.dataset.sprite, 10).toString(16).padStart(6, '0');
    scrPost({ command: 'openVfs', uri: 'soe://rom/assets/sprites/' + hex6 });
  }
});
