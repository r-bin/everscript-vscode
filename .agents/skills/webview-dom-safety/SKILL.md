---
name: webview-dom-safety
description: Use when writing or debugging clicks, delegated events or SVG in a webview: idempotent binding, target walk-up, [hidden] vs display, flex overflow, and why green tests still ship broken UI.
applyTo: "src/**/webview/**"
---

# Skill: Webview DOM Safety

Four bugs shipped in the map editor's webview code, all from the same underlying
mistake: assuming the webview DOM behaves like a page that loads once. It doesn't — a
panel's `innerHTML` is replaced on every re-render while the panel *element* survives,
`e.target` is never the element you attached `data-*` to, and half of the browser APIs
a normal page relies on are simply absent. This skill is the checklist that would have
caught all four before they shipped.

## 1. Delegated listeners must be bound exactly once per node

**Symptom:** a toggle button "works every now and then" — on click 1 it fires, click 2
does nothing, click 3 fires again. Any handler that changes state through a *toggle*
(edit mode on/off, a form open/closed) will look intermittently broken; a handler with a
non-idempotent side effect (e.g. `postMessage`) will fire that side effect N times.

**Cause:** the panel container (`#room-detail`, `#rg-outer`, …) is created once and
never removed — only its `innerHTML` is replaced on re-render. A `bindEditControls(...)`
called from the render path attaches a **new** `click` listener to the same still-alive
node every time, so after two renders one click fires two stacked handlers, which
toggles the state twice and looks like nothing happened.

**Fix:** guard every delegated bind with a dataset flag on the node itself, checked
before attaching:

```js
function bindEditControls(panel, room) {
  _editPanelRoom = room;              // state that DOES need to change every render
  if (!panel || panel.dataset.editBound) return;   // the LISTENER does not
  panel.dataset.editBound = '1';
  panel.addEventListener('click', /* ... */);
}
```

Anything that legitimately changes between renders (which room is active, which
callback closure to use) must be stored in a module-level variable the handler reads
at call time — not baked into the closure — because the closure is created only once.

**When the handler closes over a per-open object** (the Secret of Mana editor's `E`, made anew for each map),
a dataset guard is the wrong fix: it would keep the first map's `E` forever. Keep the handler in a variable and
remove it in the editor's `close()`. `manaEditorOpen` once added its pill/filter-bar click handler to
`#room-detail` on every map open and never removed it: after the second map every chip flipped twice and the
filter bar "could not be interacted with" (v0.218.0). A test that opens one map never sees it — open a second.

This is not hypothetical: `setupEditGestures` and `setupEditKeys` in this codebase
already had this guard (`wrap.dataset.editBound`, `window._editKeysBound`) before
`bindEditControls` was written without it. When adding a new delegated handler, copy
the guard from one of those, don't write the binder from scratch.

**Test it:** call the bind function twice, then dispatch one click, then assert the
state changed exactly once. A test that binds once will never catch this.

## 2. `e.target` is the deepest node, not the one carrying your data attribute

**Symptom:** clicking a button does nothing, but clicking a different pixel of the same
button works. Classic case: a `<button data-panel="families"><span
class="caret">▾</span> families</button>` — clicking the caret glyph puts the `<span>`
in `e.target`, whose `dataset` is empty, so `t.dataset.panel` is `undefined` and the
click is silently dropped.

**Fix:** walk up from `e.target` to the delegation root, looking for a known set of
data-attribute names, and use the first ancestor (including `e.target` itself) that
carries one:

```js
var EDIT_CLICK_KEYS = ['editTool', 'editPhase', 'editAct', /* ... */];
function editClickTarget(el, root) {
  for (var n = el; n && n !== root; n = n.parentNode) {
    if (!n.dataset) continue;
    for (var i = 0; i < EDIT_CLICK_KEYS.length; i++) {
      if (n.dataset[EDIT_CLICK_KEYS[i]] !== undefined) return n;
    }
  }
  return el;
}
```

Every new clickable control's data-attribute name must be added to that key list, or
the walk-up will skip past it silently — the same failure mode, one step removed.

## 3. VS Code webviews are missing browser APIs a normal page has

`window.prompt`, `window.confirm` and `window.alert` do not exist in a VS Code webview.
Calling `window.prompt(...)` does not throw — it is simply inert, so `var name =
window.prompt('name?')` assigns nothing and the code after it runs anyway with garbage
input, which reads exactly like "the button does nothing."

**Fix:** never reach for a blocking browser dialog. Build an inline form (a `<div>` of
inputs plus a confirm/cancel button pair, toggled by a module-level `_open` flag) and
read `document.getElementById(...).value` from an explicit "go" handler. See
`map-editor-newroom.js` for the pattern this codebase settled on.

Before using *any* global browser API in a webview file, check it isn't one of these —
`localStorage` also behaves differently (`memory-radar` skill territory), but
`prompt`/`confirm`/`alert` are the ones that fail silently instead of throwing, which
makes them the dangerous ones.

## 4. SVG: viewBox units are not pixels, and baked geometry does not follow content

Everything inside an SVG that declares `viewBox="0 0 W H"` is positioned in **viewBox
units**, and the `width`/`height` HTML attributes on the `<svg>` element (or on an
`<image>` inside it) only control final on-screen scaling — they are two different
coordinate spaces. Setting an `<image>`'s `width` to its *pixel* width when the viewBox
unit is 8px-per-tile makes the image 8x too large on screen. Always compute element
sizes in the same unit the viewBox is declared in (`pixels / TILE_PX`, not raw pixels).

A second, independent trap: if a builder function **bakes** derived markup (grid line
paths, clip rects, anything computed from the currently-rendered content's extent) at
render time, swapping the underlying content for something a different size — a new
blank room, say — leaves the old baked markup on screen pointing at the old extent.
Regenerating that markup is not automatic just because the image changed; call the
regeneration function explicitly whenever the size changes:

```js
function regridMap(unitsW, unitsH) { /* rebuilds the grid <path> `d` attributes */ }
```

And check whether the builder enforces a **minimum** viewBox size "so small content
isn't blown up absurdly" — that same floor makes genuinely small content (a 2x2 room)
draw grid lines past its own edge, looking like a larger room with empty cells. If the
content is meant to be small, the viewBox has to be allowed to be exactly that small.

## 5. Verify click-handling bugs in a real headless browser, with the real stylesheet

Reading webview code twice missed both the caret bug (§2) and a bug where a click
handler was silently dead code (a scripted edit had no-op'd — see the `architecture`
skill's note on scripted substitutions). Both were found immediately by driving a real
page with Playwright and clicking a real element.

**The stylesheet is not optional.** Without the shared CSS loaded, every swatch/button
renders at 0×0, so a test that dispatches a click "succeeds" (the click handler fires)
while telling you nothing about whether a *user* could have clicked that pixel. Load
the actual `shared.css` (or the domain's own stylesheet) into the test page:

```js
const CSS = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'shared', 'shared.css'), 'utf8');
await page.setContent(`<!doctype html><html><head><style>${CSS}</style></head>...`);
```

Concatenate the webview's own files in the same order the real bundle loads them (see
any existing `FILES = [...]` array in `tests/memory/*-dom.test.js` for the order), stub
only the handful of things the webview reaches for outside itself (`vs.postMessage`,
`escH`, VS Code globals), and assert on real DOM state (`classList`, computed
`getBoundingClientRect()`, dispatched `postMessage` payloads) rather than on whether a
function was merely callable.

These tests skip cleanly (not fail) when no browser is installed — see the `try {
chromium.launch() } catch { console.log(...); return; }` pattern already in
`tests/memory/map-editor-dom.test.js` — so they never block a fresh clone that hasn't
run `npx playwright install`.

## 6. Undo/redo over a positionally-addressed dictionary can only prune from the tail

When a stroke appends dictionary entries (stamps) that cells reference **by index**, undo must
drop the ones it created — or "used N of M slots" lies — but only from the **tail**
(`editPruneAdded`: pop while the last entry is unused and not the brush). Removing from the
middle repoints every later entry to the wrong picture: index `i` names a position, not an
identity. Any "remove unused entries" feature over such a format needs the same tail-only rule
or a re-indexing pass over every reference.

## 7. Three ways a green test suite still shipped a visibly broken UI

Each passed every assertion and was caught only by a person looking at the panel.

- **`[hidden]` loses to any author `display` rule.** The browser hides `[hidden]` with a
  user-agent rule, and author styles win by origin, so `.rg-filter-popup { display: flex }`
  kept a "closed" dropdown open for three releases while `el.hidden` stayed `true`. Fix: pair
  every author `display` rule on a hideable element with `[hidden] { display: none }`. Test with
  `getComputedStyle(el).display === 'none'`, never the attribute or `.hidden`.
- **Reproduce at the real container width, and measure position as well as size.** "H/V moves
  the side bar": a flex item's default `min-width: auto` let a `nowrap` status note grow the
  canvas column and shove the fixed-width dock off-screen. A 1400 px repro had slack, and a
  width-only check could not see a move. Any flex item holding `nowrap` text gets `min-width: 0`
  (and the text an ellipsis); never paper over it with `overflow-x: hidden`.
- **Module-level state leaks across tests and the real UI.** The webview files share one scope,
  so a test that set `_layerForce` and never reset it forced every later badge — exactly the
  symptom of the bug under investigation. A test that writes a module-level webview variable
  restores it; a code path that sets shared state clears it.

## 8. VS Code's own webview stylesheet caps images

Every webview gets a default stylesheet with `img, video { max-width: 100%; max-height: 100% }`.
An `<img width=W height=H>` wider than its container keeps its height and loses width, so a
wide map reads as "vertically stretched" (Secret of Mana Maps, v0.205.0). Plain Chromium has no
such rule, so a headless test passes unless it injects it. Draw map pictures as SVGs sized by
their `width`/`height` attributes (or set `max-width:none; max-height:none` on purpose), and
add the rule in DOM tests: `tests/mana/mana-panel-dom.test.js` does
(`img,video{max-width:100%;max-height:100%}` loaded as a stylesheet file, since the page's CSP
blocks inline styles).
