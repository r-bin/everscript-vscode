// Ownership: the Sprites tab's animation-script panel (listing, current-frame highlight, owners)
// and the Animations rail list. Exposes window.SpritesScript; sprites-view.js drives it.
(function() {
  var bodyEl = document.getElementById('sp-script-body');
  var wrapEl = document.getElementById('sp-script-wrap');
  var statusEl = document.getElementById('sp-script-status');
  var ownersEl = document.getElementById('sp-script-owners');
  var rowsByAddr = {};

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function(ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function getAnimations() {
    return (typeof SPRITES_ANIMATIONS !== 'undefined' ? SPRITES_ANIMATIONS : (typeof window !== 'undefined' ? window.SPRITES_ANIMATIONS : [])) || [];
  }

  var chkSpr = document.getElementById('sp-chk-script-spr');
  var lastAnim = null;
  var lastCtx = {};
  if (chkSpr) chkSpr.addEventListener('change', function() { renderScript(lastAnim, lastCtx); });

  /** The sprite a listing line loads, if it is a sprite command: the first $xxxxxx operand. */
  function spriteOf(text) {
    if (!/^(sprite|hud_|segments)/.test(text)) return 0;
    var m = /\$([0-9a-f]{6})/.exec(text);
    return m ? parseInt(m[1], 16) : 0;
  }

  /** Mode +0x16 bits, by everscript's FLAGS_7 names and the code that reads them. */
  var MODE_BITS = [[0x01, 'knockback'], [0x02, '$02 (unknown)'], [0x04, 'walking'], [0x08, 'running'], [0x10, 'attacking'],
    [0x20, 'casting/dodging (invulnerable)'], [0x4000, 'charging: contact damage'], [0x8000, 'charging: contact damage']];
  function modeBits(mode) {
    var out = MODE_BITS.filter(function(b) { return mode & b[0]; }).map(function(b) { return '$' + b[0].toString(16).padStart(4, '0') + ' ' + b[1]; });
    if (mode & 0x3fc0) out.push('$' + (mode & 0x3fc0).toString(16).padStart(4, '0') + ' (unknown)');
    return out.length ? out : ['none: back to idle'];
  }

  /** The command text, with sprite and projectile addresses as links. */
  function commandHtml(l) {
    var html = esc(l.text);
    var spr = spriteOf(l.text);
    if (spr && lastCtx.onSprite) {
      var hex = '$' + spr.toString(16).padStart(6, '0');
      html = html.replace(hex, '<a href="#" class="sp-script-link" data-sprite="' + spr + '" title="Open this sprite in the Sprites view">' + hex + '</a>');
    }
    if (l.projectile && l.projectile.animRec && lastCtx.onRecord) {
      var id = '$' + l.projectile.id.toString(16).padStart(4, '0');
      html = html.replace(id, '<a href="#" class="sp-script-link" data-record="' + l.projectile.animRec + '" title="Open the projectile\'s animation (record $' + l.projectile.animRec.toString(16) + ')">' + id + '</a>');
    }
    return html;
  }

  /** What goes under a command: mode bits always; previews of what it loads when ticked. */
  function detailOf(l, showPreviews) {
    var box = document.createElement('div');
    box.className = 'sp-script-detail';
    var m = /^mode \$([0-9a-f]{4})/.exec(l.text);
    if (m) {
      modeBits(parseInt(m[1], 16)).forEach(function(t) {
        var d = document.createElement('div'); d.textContent = '- ' + t; box.appendChild(d);
      });
    }
    if (showPreviews) {
      var spr = spriteOf(l.text);
      var pal = lastCtx.paletteAddr || 0;
      if (spr) box.appendChild(window.SpritesThumbs.box({
        key: 'spr:' + spr + ':' + (pal || 'c' + lastCtx.character), sprite: spr,
        character: lastCtx.character, paletteAddr: pal,
      }));
      if (l.palette) {
        var sw = document.createElement('div');
        sw.className = 'sp-script-swatch';
        sw.title = 'Palette $' + l.palette.addr.toString(16);
        l.palette.colors.forEach(function(c, i) {
          var span = document.createElement('span');
          span.style.background = i === 0 ? 'transparent' : c;
          span.title = i === 0 ? 'transparent' : c;
          sw.appendChild(span);
        });
        box.appendChild(sw);
      }
      if (l.projectile && l.projectile.animRec) {
        var pp = l.projectile.paletteAddr || pal;
        box.appendChild(window.SpritesThumbs.box({
          key: 'proj:' + l.projectile.animRec + ':' + (pp || 'c' + lastCtx.character),
          record: l.projectile.animRec, facing: lastCtx.facing != null ? lastCtx.facing : 8,
          character: lastCtx.character, paletteAddr: pp,
        }));
      }
    }
    return box.childNodes.length ? box : null;
  }

  /**
   * Fill the listing from a spriteAnimationData payload: address, command (with what it
   * loads shown beneath it), bytes. `ctx` = { character, paletteAddr, facing, onSprite(addr),
   * onRecord(record) }.
   */
  function renderScript(anim, ctx) {
    lastAnim = anim;
    lastCtx = ctx || {};
    var showPreviews = !!(chkSpr && chkSpr.checked && window.SpritesThumbs);
    rowsByAddr = {};
    if (!bodyEl) return;
    bodyEl.innerHTML = '';
    if (!anim || !anim.script) {
      if (statusEl) statusEl.textContent = anim === null ? 'No script' : '';
      return;
    }
    anim.script.forEach(function(l) {
      var tr = document.createElement('tr');
      tr.className = 'sp-script-row' + (l.endFrame ? ' sp-script-end' : '') + (l.known ? '' : ' sp-script-unknown');
      tr.innerHTML = '<td class="sp-script-addr">' + l.addrHex + '</td>' +
        '<td class="sp-script-text"><div class="sp-script-cmd">' + commandHtml(l) + '</div></td>' +
        '<td class="sp-script-bytes">' + l.bytesHex + '</td>';
      var detail = detailOf(l, showPreviews);
      if (detail) tr.children[1].appendChild(detail);
      bodyEl.appendChild(tr);
      rowsByAddr[l.address] = tr;
    });
    if (statusEl) {
      var parts = [anim.script.length + ' commands', anim.totalTicks + ' ticks'];
      if (anim.stoppedAtHex) parts.push('stops at ' + anim.stoppedAtHex + ' (command of unknown width)');
      else if (anim.complete) parts.push('complete cycle');
      if (anim.frames && !anim.frames.length) parts.push('draws nothing');
      if (anim.initialSprite && !anim.script.some(function(l) { return /^sprite/.test(l.text); }) && !anim.script.some(function(l) { return /^segments/.test(l.text); })) {
        parts.push('sets no sprite: keeps its standing one (' + anim.initialSprite + ')');
      }
      if (anim.loopFrom) parts.push('repeats from tick ' + anim.loopFrom + (anim.moves ? ' (still in the air at loop)' : ''));
      var thrown = anim.projectiles && anim.projectiles.spawns ? anim.projectiles.spawns : [];
      if (thrown.length) {
        var kinds = {};
        thrown.forEach(function(sp) { kinds[sp.idHex] = sp.model + (sp.onHit !== 'unknown' ? ', ' + sp.onHit + ' on hit' : ''); });
        parts.push('throws ' + Object.keys(kinds).map(function(k) { return k + ' (' + kinds[k] + ')'; }).join(', '));
      }
      statusEl.textContent = parts.join(' · ');
    }
  }

  if (bodyEl) bodyEl.addEventListener('click', function(e) {
    var a = e.target;
    while (a && a !== bodyEl && !(a.classList && a.classList.contains('sp-script-link'))) a = a.parentNode;
    if (!a || a === bodyEl) return;
    e.preventDefault();
    if (a.dataset.sprite && lastCtx.onSprite) lastCtx.onSprite(parseInt(a.dataset.sprite, 10));
    if (a.dataset.record && lastCtx.onRecord) lastCtx.onRecord(parseInt(a.dataset.record, 10));
  });

  /** Mark the commands that ran during `frame`, and keep the first in view. */
  function highlight(frame) {
    if (!bodyEl) return;
    var hot = bodyEl.querySelectorAll('.sp-script-hot');
    for (var i = 0; i < hot.length; i++) hot[i].classList.remove('sp-script-hot');
    if (!frame || !frame.lines) return;
    var first = null;
    frame.lines.forEach(function(a) {
      var tr = rowsByAddr[a];
      if (!tr) return;
      tr.classList.add('sp-script-hot');
      if (!first || tr.rowIndex < first.rowIndex) first = tr;
    });
    // Scroll the listing only; scrollIntoView would move the whole panel.
    if (first && wrapEl) {
      var top = first.offsetTop - wrapEl.clientHeight / 3;
      if (first.offsetTop < wrapEl.scrollTop || first.offsetTop > wrapEl.scrollTop + wrapEl.clientHeight - 20) {
        wrapEl.scrollTop = Math.max(0, top);
      }
    }
  }

  function ownerText(o) {
    if (o.kind === 'character') return o.name + ' · ' + o.label;
    if (o.kind === 'weapon') return (o.id === 1 ? 'Dog · ' : 'Boy · ') + o.name + ' · ' + o.label;
    if (o.kind === 'projectile') {
      var by = findRecord(parseInt(String(o.thrower).slice(1), 16));
      return 'projectile ' + o.idHex + ' thrown by ' + (by ? by.label + ' (' + by.recHex + ')' : o.thrower);
    }
    return 'animate id ' + o.idHex + (o.names.length ? ' (' + o.names.join(', ') + ')' : '');
  }

  /** Who uses the animation, or a hint when it is a character's own. */
  function renderOwners(entry) {
    if (!ownersEl) return;
    if (!entry) { ownersEl.textContent = ''; return; }
    var list = entry.owners || [];
    ownersEl.innerHTML = '<strong>Record ' + esc(entry.recHex) + '</strong> · ' + entry.facingCount +
      (entry.facingCount === 1 ? ' facing' : ' facings') + ' · used by: ' +
      (list.length ? list.map(function(o) { return esc(ownerText(o)); }).join('; ') : 'no character, weapon or animate id') +
      (entry.paletteFromScript ? ' · palette $' + (entry.paletteAddr || 0).toString(16) + ' loaded by the script'
        : entry.paletteInferred ? ' · palette inferred: ' + esc(entry.paletteInferred) : '');
  }

  /** The Animations rail: every record, filtered by the search box. */
  function renderCatalogList(listEl, query, selectedRecord, onSelect) {
    var all = getAnimations();
    if (!all.length) {
      var empty = document.createElement('div');
      empty.className = 'sp-empty-notice';
      empty.innerHTML = '<strong>No animations loaded.</strong><br><span style="opacity:0.75">Ensure a Secret of Evermore ROM is present or configured in Settings (<code>everscript.romPath</code>).</span>';
      listEl.appendChild(empty);
      return;
    }
    var q = (query || '').toLowerCase();
    var frag = document.createDocumentFragment();
    all.forEach(function(a) {
      if (q) {
        var hay = (a.recHex + ' ' + a.scriptHex + ' ' + a.label + ' ' + (a.owners || []).map(ownerText).join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return;
      }
      var li = document.createElement('li');
      li.className = 'sp-list-item' + (a.record === selectedRecord ? ' sp-selected' : '');
      li.dataset.record = String(a.record);
      li.innerHTML = '<span class="sp-li-name">' + esc(a.label) + '</span>' +
        '<span class="sp-li-addr">' + a.recHex + (a.facingCount > 1 ? ' ×' + a.facingCount : '') + '</span>';
      if (window.SpritesThumbs) {
        var tw = document.createElement('span');
        tw.className = 'sp-li-thumbs';
        tw.appendChild(window.SpritesThumbs.box({
          key: 'rec:' + a.record + ':' + (a.paletteAddr || 'c' + a.paletteCharacter),
          record: a.record, facing: 8, character: a.paletteCharacter, paletteAddr: a.paletteAddr || 0,
        }));
        li.insertBefore(tw, li.firstChild);
      }
      li.addEventListener('click', function() { onSelect(a); });
      frag.appendChild(li);
    });
    listEl.appendChild(frag);
  }

  function findRecord(record) {
    var all = getAnimations();
    for (var i = 0; i < all.length; i++) if (all[i].record === record) return all[i];
    return null;
  }

  var api = {
    renderScript: renderScript,
    highlight: highlight,
    renderOwners: renderOwners,
    renderCatalogList: renderCatalogList,
    findRecord: findRecord,
    count: function() { return getAnimations().length; },
  };
  if (typeof window !== 'undefined') window.SpritesScript = api;
})();
