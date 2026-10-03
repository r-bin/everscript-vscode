// Ownership: the Sprites tab's resizable splitters and its lazy list thumbnails — rows ask
// the extension for their preview only once they scroll into view. Exposes
// window.SpritesThumbs; splitters wire themselves.
(function() {
  var vsApi = (typeof vs !== 'undefined' && vs) ? vs : null;
  var WIDTH_KEY = 'sp-widths';

  // ── Splitters ───────────────────────────────────────────────────────────────
  // `data-resize="rail"` sizes the list on its left; `data-resize="side"` the sidebar on its right.
  function loadWidths() {
    try { return JSON.parse(localStorage.getItem(WIDTH_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveWidths(w) {
    try { localStorage.setItem(WIDTH_KEY, JSON.stringify(w)); } catch (e) { /* storage may be blocked */ }
  }
  function panelFor(split) {
    return split.dataset.resize === 'rail' ? split.previousElementSibling : split.nextElementSibling;
  }
  var widths = loadWidths();
  function applyWidth(kind, px) {
    document.querySelectorAll('[data-resize="' + kind + '"]').forEach(function(split) {
      var panel = panelFor(split);
      if (panel) { panel.style.width = px + 'px'; panel.style.flex = 'none'; }
    });
  }
  Object.keys(widths).forEach(function(k) { applyWidth(k, widths[k]); });

  document.querySelectorAll('[data-resize]').forEach(function(split) {
    split.addEventListener('mousedown', function(e) {
      var panel = panelFor(split);
      if (!panel) return;
      e.preventDefault();
      var kind = split.dataset.resize;
      var startX = e.clientX;
      var startW = panel.getBoundingClientRect().width;
      function move(ev) {
        var dx = ev.clientX - startX;
        var w = Math.max(200, Math.min(900, kind === 'rail' ? startW + dx : startW - dx));
        widths[kind] = Math.round(w);
        applyWidth(kind, widths[kind]);
      }
      function up() {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        saveWidths(widths);
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  });

  // ── Lazy thumbnails ─────────────────────────────────────────────────────────
  var cache = {};          // key → data URI (or '' when there is nothing to draw)
  var waiting = {};        // key → item, requested but not answered
  var queue = {};          // key → item, to request in the next batch
  var timer = null;
  var observer = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(function(entries) {
        entries.forEach(function(en) {
          if (!en.isIntersecting) return;
          observer.unobserve(en.target);
          want(en.target.__thumbItem);
        });
      }, { rootMargin: '200px' })
    : null;

  function fill(key) {
    var src = cache[key];
    document.querySelectorAll('[data-thumb-key="' + key + '"]').forEach(function(box) {
      if (src && !box.firstChild) { var img = document.createElement('img'); img.src = src; img.alt = ''; box.appendChild(img); }
    });
  }

  function want(item) {
    if (!item || item.key in cache || item.key in waiting) return;
    queue[item.key] = item;
    if (!timer) timer = setTimeout(flush, 30);
  }

  function flush() {
    timer = null;
    var items = Object.keys(queue).map(function(k) { return queue[k]; });
    queue = {};
    if (!items.length || !vsApi) return;
    for (var i = 0; i < items.length; i += 120) {
      var batch = items.slice(i, i + 120);
      batch.forEach(function(it) { waiting[it.key] = it; });
      vsApi.postMessage({ command: 'getThumbs', items: batch });
    }
  }

  /** A square box that fills itself with `item`'s preview once it is on screen. */
  function box(item, cls) {
    var span = document.createElement('span');
    span.className = cls || 'sp-li-thumb';
    span.dataset.thumbKey = item.key;
    if (cache[item.key]) {
      var img = document.createElement('img'); img.src = cache[item.key]; img.alt = ''; span.appendChild(img);
    } else if (!(item.key in cache)) {
      span.__thumbItem = item;
      if (observer) observer.observe(span); else want(item);
    }
    return span;
  }

  function onData(thumbs) {
    Object.keys(thumbs || {}).forEach(function(k) {
      cache[k] = thumbs[k] || '';
      delete waiting[k];
      fill(k);
    });
  }

  var api = { box: box, onData: onData };
  if (typeof window !== 'undefined') window.SpritesThumbs = api;
})();
