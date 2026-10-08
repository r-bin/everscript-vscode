'use strict';
// Ownership: making `soe://` addresses load inside a webview.
//
// A webview cannot fetch `soe://rom/x` itself; it can fetch the URL
// `webview.asWebviewUri(soe://rom/x)`, which VS Code serves by reading the
// file system provider. So every `soe://<authority>/` prefix is swapped for
// that authority's webview base: on the host for the HTML string, and in the
// page for elements a script adds later.

const vscode = require('vscode');

const AUTHORITIES = ['rom', 'ram'];
const root = a => vscode.Uri.parse(`soe://${a}/`);

/** Add to a webview's `localResourceRoots`, or it may not read `soe://`. */
function soeResourceRoots() {
    return AUTHORITIES.map(root);
}

/** `{ rom: 'https://soe+rom.vscode-resource…/', ram: … }` for one webview. */
function soeBases(webview) {
    return Object.fromEntries(AUTHORITIES.map(a => [a, String(webview.asWebviewUri(root(a)))]));
}

/** Rewrite every `soe://rom/…` and `soe://ram/…` in an HTML string. */
function rewriteSoeUrls(html, webview) {
    const bases = soeBases(webview);
    return html.replace(/soe:\/\/(rom|ram)\//g, (_, a) => bases[a]);
}

/**
 * Page script that rewrites `src`/`href` of elements added after load and
 * exposes `window.soeUrl(addr)`. The literal scheme is split so
 * `rewriteSoeUrls` leaves this script alone.
 */
function soeClientScript(webview) {
    return `(function () {
  var bases = ${JSON.stringify(soeBases(webview))};
  var prefix = 'soe:' + '//';
  function soeUrl(u) {
    if (typeof u !== 'string' || u.indexOf(prefix) !== 0) return u;
    var rest = u.slice(prefix.length), slash = rest.indexOf('/');
    var base = bases[slash < 0 ? rest : rest.slice(0, slash)];
    return base ? base + (slash < 0 ? '' : rest.slice(slash + 1)) : u;
  }
  function fix(el) {
    if (!el || !el.getAttribute) return;
    ['src', 'href'].forEach(function (attr) {
      var v = el.getAttribute(attr);
      if (v && v.indexOf(prefix) === 0) el.setAttribute(attr, soeUrl(v));
    });
    if (el.querySelectorAll) Array.prototype.forEach.call(el.querySelectorAll('[src^="soe:"],[href^="soe:"]'), fix);
  }
  window.soeUrl = soeUrl;
  new MutationObserver(function (records) {
    records.forEach(function (r) {
      if (r.type === 'attributes') fix(r.target);
      else Array.prototype.forEach.call(r.addedNodes, fix);
    });
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'href'] });
  fix(document.documentElement);
})();`;
}

module.exports = { soeResourceRoots, rewriteSoeUrls, soeClientScript };
