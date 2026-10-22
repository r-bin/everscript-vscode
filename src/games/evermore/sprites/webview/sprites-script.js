// TODO port to TS (docs/todo/port-to-ts.md)
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
    var m = /\$([0-9a-f]{6})/i.exec(text);
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

  /** The command text, with sprite, palette and projectile addresses as links. */
  function commandHtml(l) {
    var html = esc(l.text);
    if (l.spriteInfo) {
      var spr = l.spriteInfo.addr;
      var sprIdx = '#' + l.spriteInfo.index;
      var hex = l.spriteInfo.addrHex;
      var linkText = html.indexOf(sprIdx) >= 0 ? sprIdx : hex;
      var sInf = l.spriteInfo;
      var sprTitle = 'sprite #' + sInf.index + ' (' + sInf.addrHex + ')' +
        (sInf.widthPx ? ' · ~' + sInf.widthPx + '×' + sInf.heightPx + ' px' : '') +
        '\nClick: view sprite | Hover: details';
      var linkHtml = '<a href="#" class="sp-script-link sp-sprite-link" data-sprite="' + spr + '" data-line-addr="' + l.address + '" title="' + esc(sprTitle) + '">' + linkText + '</a>';
      if (html.indexOf(sprIdx) >= 0) html = html.replace(sprIdx, linkHtml);
      else if (html.indexOf(hex) >= 0) html = html.replace(hex, linkHtml);
    }
    if (l.palette) {
      var pal = l.palette.addr;
      var palIdx = '#' + (l.palette.index != null ? l.palette.index : '?');
      var palHex = '$' + pal.toString(16).padStart(4, '0');
      var palLinkText = html.indexOf(palIdx) >= 0 ? palIdx : palHex;
      var palTitle = 'palette #' + (l.palette.index != null ? l.palette.index : '?') + ' (' + palHex + ')\nClick: open VFS | Hover: details';
      var palLink = '<a href="#" class="sp-script-link sp-pal-link" data-palette="' + pal + '" data-line-addr="' + l.address + '" title="' + esc(palTitle) + '">' + palLinkText + '</a>';
      if (html.indexOf(palIdx) >= 0) html = html.replace(palIdx, palLink);
      else if (html.indexOf(palHex) >= 0) html = html.replace(palHex, palLink);
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
      if (l.spriteInfo && l.spriteInfo.png) {
        var sprBox = document.createElement('div');
        sprBox.className = 'sp-script-sprite-box';
        sprBox.innerHTML = '<img src="' + l.spriteInfo.png + '" class="sp-script-img" style="image-rendering:pixelated; max-width:64px; max-height:64px" />';
        box.appendChild(sprBox);
      } else {
        var spr = l.spriteInfo ? l.spriteInfo.addr : spriteOf(l.text);
        var pal = lastCtx.paletteAddr || 0;
        if (spr && window.SpritesThumbs) box.appendChild(window.SpritesThumbs.box({
          key: 'spr:' + spr + ':' + (pal || 'c' + lastCtx.character), sprite: spr,
          character: lastCtx.character, paletteAddr: pal,
        }));
      }
      if (l.palette) {
        var sw = document.createElement('div');
        sw.className = 'sp-script-swatch';
        sw.title = 'Palette #' + l.palette.index + ' ($' + l.palette.addr.toString(16) + ')';
        l.palette.colors.forEach(function(c, i) {
          var span = document.createElement('span');
          span.style.background = i === 0 ? 'transparent' : c;
          span.title = i === 0 ? 'transparent' : c;
          sw.appendChild(span);
        });
        box.appendChild(sw);
      }
      if (l.projectile && l.projectile.animRec && window.SpritesThumbs) {
        var pp = l.projectile.paletteAddr || (lastCtx.paletteAddr || 0);
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

  var tipEl = document.getElementById('sp-rich-tooltip');
  var tipTimeout = null;

  function showRichTooltip(html, x, y) {
    if (!tipEl) tipEl = document.getElementById('sp-rich-tooltip');
    if (!tipEl) return;
    if (tipTimeout) { clearTimeout(tipTimeout); tipTimeout = null; }
    tipEl.innerHTML = html;
    tipEl.style.display = 'block';
    var pad = 12;
    var tw = tipEl.offsetWidth || 270;
    var th = tipEl.offsetHeight || 160;
    var left = x + pad;
    var top = y + pad;
    if (left + tw > window.innerWidth - 10) left = Math.max(10, x - tw - pad);
    if (top + th > window.innerHeight - 10) top = Math.max(10, y - th - pad);
    tipEl.style.left = left + 'px';
    tipEl.style.top = top + 'px';
  }

  function hideRichTooltip() {
    if (tipTimeout) clearTimeout(tipTimeout);
    tipTimeout = setTimeout(function() {
      if (tipEl) tipEl.style.display = 'none';
    }, 250);
  }

  if (tipEl) {
    tipEl.addEventListener('mouseenter', function() {
      if (tipTimeout) { clearTimeout(tipTimeout); tipTimeout = null; }
    });
    tipEl.addEventListener('mouseleave', function() {
      hideRichTooltip();
    });
  }

  function spriteTipHtml(info) {
    var tagsHtml = (info.tags || []).map(function(t) { return '<span class="evs-tip-badge">' + esc(t) + '</span>'; }).join('');
    var chars = (info.characters || []).map(function(c) { return esc(c.name); }).join(', ') || '—';
    var anims = (info.animations || []).slice(0, 3).map(function(a) { return esc(a.label); }).join(', ') || '—';
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
    '<div class="evs-tip-vfs"><a href="#" class="evs-vfs-link" data-vfs="' + vfsUri + '">Open VFS: ' + vfsUri + '</a></div>';
  }

  function paletteTipHtml(pal) {
    var tagsHtml = (pal.tags || []).map(function(t) { return '<span class="evs-tip-badge">' + esc(t) + '</span>'; }).join('');
    var chars = (pal.characters || []).map(function(c) { return esc(c.name + (c.role ? ' (' + c.role + ')' : '')); }).join(', ') || '—';
    var anims = (pal.animations || []).slice(0, 3).map(function(a) { return esc(a.label); }).join(', ') || '—';
    var vfsUri = 'soe://rom/assets/palettes/' + pal.addr.toString(16).padStart(4, '0');
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
    '<div class="evs-tip-vfs"><a href="#" class="evs-vfs-link" data-vfs="' + vfsUri + '">Open VFS: ' + vfsUri + '</a></div>';
  }

  if (bodyEl) {
    bodyEl.addEventListener('mouseover', function(e) {
      var a = e.target;
      while (a && a !== bodyEl && !(a.classList && (a.classList.contains('sp-sprite-link') || a.classList.contains('sp-pal-link')))) a = a.parentNode;
      if (!a || a === bodyEl) return;
      var lineAddr = parseInt(a.dataset.lineAddr, 10);
      var line = lastAnim && lastAnim.script ? lastAnim.script.find(function(x) { return x.address === lineAddr; }) : null;
      if (!line) return;
      if (a.classList.contains('sp-sprite-link') && line.spriteInfo) {
        showRichTooltip(spriteTipHtml(line.spriteInfo), e.clientX, e.clientY);
      } else if (a.classList.contains('sp-pal-link') && line.palette) {
        showRichTooltip(paletteTipHtml(line.palette), e.clientX, e.clientY);
      }
    });

    bodyEl.addEventListener('mouseout', function(e) {
      hideRichTooltip();
    });

    bodyEl.addEventListener('click', function(e) {
      var vfsLink = e.target.closest('[data-vfs]');
      if (vfsLink) {
        e.preventDefault();
        var vsApi = (typeof vs !== 'undefined' && vs) ? vs : (typeof acquireVsCodeApi === 'function' ? (function() { try { return acquireVsCodeApi(); } catch(e) { return null; } })() : null);
        if (vsApi) vsApi.postMessage({ command: 'openVfs', uri: vfsLink.dataset.vfs });
        return;
      }
      var a = e.target;
      while (a && a !== bodyEl && !(a.classList && a.classList.contains('sp-script-link'))) a = a.parentNode;
      if (!a || a === bodyEl) return;
      e.preventDefault();
      if (a.dataset.palette) {
        var palNum = parseInt(a.dataset.palette, 10);
        var palHex4 = palNum.toString(16).padStart(4, '0');
        var vsApi = (typeof vs !== 'undefined' && vs) ? vs : (typeof acquireVsCodeApi === 'function' ? (function() { try { return acquireVsCodeApi(); } catch(e) { return null; } })() : null);
        if (vsApi) vsApi.postMessage({ command: 'openVfs', uri: 'soe://rom/assets/palettes/' + palHex4 });
        return;
      }
      if (a.dataset.sprite && lastCtx.onSprite) lastCtx.onSprite(parseInt(a.dataset.sprite, 10));
      if (a.dataset.record && lastCtx.onRecord) lastCtx.onRecord(parseInt(a.dataset.record, 10));
    });
  }

  document.addEventListener('click', function(e) {
    var vfsLink = e.target.closest('[data-vfs]');
    if (vfsLink) {
      e.preventDefault();
      var vsApi = (typeof vs !== 'undefined' && vs) ? vs : (typeof acquireVsCodeApi === 'function' ? (function() { try { return acquireVsCodeApi(); } catch(e) { return null; } })() : null);
      if (vsApi) vsApi.postMessage({ command: 'openVfs', uri: vfsLink.dataset.vfs });
    }
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
      empty.innerHTML = '<strong>No animations loaded.</strong><br><span style="opacity:0.75">No Secret of Evermore ROM in the ROM library. Add your own with Everscript: Switch ROM.</span>';
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
