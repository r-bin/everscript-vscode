// Ownership: the Secret of Mana Maps webview — the area list, the filter bar, and
// which maps are on screen. State owned here: selection, zoom and the view toggles
// (persisted with vscode.setState). Data comes from the #init block and from
// som:// files the host reads on request ({command:'read', path} -> 'file').
// Filter-bar markup: src/shared/webview/map-view/view-chips.js (shared with the
// Evermore Rooms tab); one map's SVG, overlays and animation: map-svg.js; the editor a
// map's Edit button opens: editor.js (on the core in src/shared/webview/map-editor-core/).
(function () {
  // @ts-ignore acquireVsCodeApi is provided by the webview host
  var vscode = acquireVsCodeApi();
  var init = JSON.parse(document.getElementById('init').textContent || '{}');
  var nav = document.getElementById('areas');
  var view = document.getElementById('view');
  var bar = document.getElementById('filters');
  var legend = document.getElementById('legend');
  var title = document.getElementById('title');
  var meta = document.getElementById('meta');

  var state = Object.assign({ area: null, map: null, edit: null, zoom: 1, a: true, b: true, collision: false, animate: true, specials: false, objects: false },
    vscode.getState() || {});
  var maps = new Map((init.maps || []).map(function (m) { return [m.id, m]; }));
  var areas = init.areas || [];
  var players = [];
  var editor = null;            // the open map editor (editor.js), if any
  var pending = new Map();      // path -> [callbacks]
  var files = new Map();        // path -> parsed JSON

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function save() { vscode.setState(state); }
  function label(id) { var m = maps.get(id); return m ? m.hex + ' (' + m.id + ') · ' + m.w + '×' + m.h : String(id); }

  /** Read a som://rom/ JSON file through the host, once. */
  function readJson(path, cb) {
    // Always async, so a caller can attach what it draws into before the data arrives.
    if (files.has(path)) { Promise.resolve().then(function () { cb(files.get(path)); }); return; }
    if (pending.has(path)) { pending.get(path).push(cb); return; }
    pending.set(path, [cb]);
    vscode.postMessage({ command: 'read', path: path });
  }
  window.addEventListener('message', function (ev) {
    var msg = ev.data || {};
    if (msg.command !== 'file') return;
    var data = null;
    try { data = msg.text ? JSON.parse(msg.text) : null; } catch (e) { data = null; }
    files.set(msg.path, data);
    (pending.get(msg.path) || []).forEach(function (cb) { cb(data); });
    pending.delete(msg.path);
  });

  function buildNav() {
    nav.textContent = '';
    areas.forEach(function (a) {
      if (!a.maps.length) return;
      var group = el('div', 'group');
      var row = el('div', 'area');
      row.append(el('span', '', a.name), el('span', 'n', String(a.maps.length)));
      row.dataset.area = a.slug;
      var list = el('div', 'maps');
      a.maps.forEach(function (id) {
        var item = el('div', 'map', label(id));
        item.dataset.map = String(id);
        item.dataset.area = a.slug;
        list.append(item);
      });
      group.append(row, list);
      nav.append(group);
    });
  }

  function buildBar() {
    bar.innerHTML = mapViewSegHtml([
      mapViewChipHtml({ label: 'BG1', on: state.a, attrs: { toggle: 'a' }, title: 'Layer A, drawn on BG1 (the 0xFE pieces). Both on is the picture as the game shows it.' }),
      mapViewChipHtml({ label: 'BG2', on: state.b, attrs: { toggle: 'b' }, title: 'Layer B, drawn on BG2 (the 0xFF pieces).' }),
      mapViewChipHtml({ label: 'Collision', on: state.collision, attrs: { toggle: 'collision' }, title: 'What the player bumps into, from layer A’s collision bytes (the movement code at $01:BE15).' }),
    ]) + mapViewChipHtml({ label: 'Animate', on: state.animate && state.a && state.b, attrs: { toggle: 'animate' },
      title: 'Play the animated tiles and colours — the game’s own animation routines, run frame by frame. Both layers must be on.' })
      + mapViewChipHtml({ label: 'Specials', on: state.specials, attrs: { toggle: 'specials' },
      title: 'Special cells (collision byte 1 bit 7): doors, signs and event spots the game can change. Labelled with that byte.' })
      + mapViewChipHtml({ label: 'Objects', on: state.objects, attrs: { toggle: 'objects' },
      title: 'The map’s objects: the records after its header the game spawns as characters (enemies, people). Labelled with their kind word.' })
      + '<span class="zoom-chips">' + [0.25, 0.5, 1, 2].map(function (z) {
        return mapViewChipHtml({ label: z === 0.25 ? '¼×' : z === 0.5 ? '½×' : z + '×', on: state.zoom === z, attrs: { zoom: z } });
      }).join('') + '</span>';
    legend.hidden = !state.collision;
  }

  function stopPlayers() { players.forEach(function (p) { p.stop(); }); players = []; }

  function closeEditor() { if (editor) { editor.close(); editor = null; } }

  /** The map editor for map `id`: its data first, then the page (editor.js). */
  function renderEditor(id) {
    var m = maps.get(id);
    bar.hidden = true;
    legend.hidden = true;
    stopPlayers();
    closeEditor();
    view.textContent = '';
    title.textContent = 'Edit ' + m.hex;
    meta.textContent = label(id);
    readJson('maps/' + m.hex + '.edit.json', function (data) {
      if (!data || state.edit !== id) { if (!data) view.append(el('div', 'message', 'Cannot read this map for editing.')); return; }
      view.textContent = '';
      editor = manaEditorOpen({ root: view, entry: m, data: data, somBase: init.somBase, state: state, save: save, readJson: readJson,
        onBack: function () { state.edit = null; state.map = id; save(); render(); } });
    });
  }

  function render() {
    bar.hidden = false;
    closeEditor();
    if (state.edit !== null && maps.has(state.edit)) { buildBar(); renderEditor(state.edit); return; }
    state.edit = null;
    buildBar();
    stopPlayers();
    nav.querySelectorAll('.sel').forEach(function (e) { e.classList.remove('sel'); });
    nav.querySelectorAll('.open').forEach(function (e) { e.classList.remove('open'); });
    view.textContent = '';
    var area = areas.find(function (a) { return a.slug === state.area; });
    if (!area) { title.textContent = init.title || 'Secret of Mana'; meta.textContent = maps.size + ' maps — pick an area'; return; }
    var row = nav.querySelector('.area[data-area="' + area.slug + '"]');
    if (row && row.parentElement) row.parentElement.classList.add('open');
    var one = state.map !== null && area.maps.indexOf(state.map) >= 0;
    // One figure per picture: map ids that draw the same picture share it.
    var groups = one ? area.pictures.filter(function (g) { return g.indexOf(state.map) >= 0; })
      .map(function (g) { return [state.map].concat(g.filter(function (id) { return id !== state.map; })); }) : area.pictures;
    var sel = one ? nav.querySelector('.map[data-map="' + state.map + '"]') : row;
    if (sel) sel.classList.add('sel');
    title.textContent = area.name;
    meta.textContent = one ? label(state.map) : area.maps.length + ' maps, ' + groups.length + ' pictures';
    groups.forEach(function (g) { view.append(figure(g[0], g.slice(1))); });
  }

  function figure(id, same) {
    var m = maps.get(id);
    var fig = el('figure');
    if (!m) return fig;
    var svg = buildMapSvg(m, state.zoom);
    // A big area holds a hundred maps: fetch a map's picture, overlays and
    // animation only once it scrolls into view.
    whenVisible(fig, function () { fillFigure(svg, m); });
    var also = same.length ? ' — same picture: ' + same.map(function (s) { return (maps.get(s) || { hex: s }).hex; }).join(', ') : '';
    var cap = el('figcaption', '', label(id) + also);
    cap.dataset.map = String(id);
    var edit = el('button', 'edit-btn', 'Edit');
    edit.dataset.edit = String(id);
    edit.title = 'Open this map in the editor (changes are not saved)';
    fig.append(svg, cap, edit);
    return fig;
  }

  var observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting || !e.target._mmShow) return;
      var show = e.target._mmShow;
      e.target._mmShow = null;
      observer.unobserve(e.target);
      show();
    });
  }, { root: view, rootMargin: '400px' }) : null;

  function whenVisible(node, show) {
    if (!observer) { show(); return; }
    node._mmShow = show;
    observer.observe(node);
  }

  function fillFigure(svg, m) {
    var pic = svg.querySelector('.mm-picture');
    if (pic) pic.setAttribute('href', mapPictureUrl(init.somBase, m.hex, { a: state.a, b: state.b }));
    if (state.collision || state.specials) {
      readJson('maps/' + m.hex + '.collision.json', function (c) {
        if (!c || !svg.isConnected) return;
        if (state.collision) drawCollision(svg, c);
        if (state.specials) drawSpecials(svg, c);
      });
    }
    if (state.objects) {
      readJson('maps/' + m.hex + '.objects.json', function (o) {
        if (o && svg.isConnected) drawObjects(svg, o);
      });
    }
    if (state.animate && state.a && state.b) {
      readJson('maps/' + m.hex + '.anim.json', function (a) {
        if (!svg.isConnected) return;
        var p = playAnimation(svg, a);
        if (p) players.push(p);
      });
    }
  }

  function select(area, map) { state.area = area; state.map = map; state.edit = null; save(); render(); }

  nav.addEventListener('click', function (ev) {
    var t = ev.target instanceof Element ? ev.target.closest('[data-area]') : null;
    if (!t) return;
    select(t.dataset.area || null, t.dataset.map ? Number(t.dataset.map) : null);
  });
  view.addEventListener('click', function (ev) {
    var e = ev.target instanceof Element ? ev.target.closest('[data-edit]') : null;
    if (e && e.classList.contains('edit-btn')) { state.edit = Number(e.dataset.edit); save(); render(); return; }
    var t = ev.target instanceof Element ? ev.target.closest('figcaption') : null;
    if (t && t.dataset.map) select(state.area, state.map === Number(t.dataset.map) ? null : Number(t.dataset.map));
  });
  bar.addEventListener('click', function (ev) {
    var b = ev.target instanceof Element ? ev.target.closest('button') : null;
    if (!b) return;
    if (b.dataset.zoom) state.zoom = Number(b.dataset.zoom) || 1;
    var k = b.dataset.toggle;
    if (k) {
      state[k] = !state[k];
      if (!state.a && !state.b) state[k === 'a' ? 'b' : 'a'] = true;   // there is no picture of nothing
    }
    save();
    render();
  });

  if (init.error) { view.append(el('div', 'message', init.error)); title.textContent = 'Secret of Mana'; return; }
  buildNav();
  if (!state.area && areas.length) state.area = areas[0].slug;
  render();
})();
