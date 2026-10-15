// Ownership: tracking the pointer's cell into the status bar. Game-neutral: a page says how a mouse event
// maps to its cell and what to say about it. Plain browser script: globals. Markup: shellStatusbarHtml (frame.js).

/**
 * Bind the pointer read-out on `#rg-wrap`, once (its own dataset flag, per the webview-dom-safety skill),
 * in the **capture** phase: an editor's capture handler on the same node may call `stopPropagation()`
 * mid-stroke, which would starve a bubble-phase listener on an ancestor — listeners on the same node
 * still all run, so the read-out keeps updating while painting.
 *
 *   describe(e)  the text for the status line at mouse event `e` (e.g. 'x: 07 y: 04'), or null for none
 */
function shellStatusBind(describe) {
  var wrap = document.getElementById('rg-wrap');
  if (!wrap || wrap.dataset.statusBound) return;
  wrap.dataset.statusBound = '1';
  function write(text) {
    var el = document.getElementById('rg-status-xy');
    if (el) el.textContent = text;
  }
  wrap.addEventListener('mousemove', function (e) {
    var text = describe(e);
    write(text == null ? STATUS_NO_XY : text);
  }, true);
  wrap.addEventListener('mouseleave', function () { write(STATUS_NO_XY); }, true);
}
