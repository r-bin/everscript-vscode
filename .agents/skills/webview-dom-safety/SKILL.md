---
name: webview-dom-safety
description: Use when writing or debugging click/pointer handling, delegated event binding, or SVG-based rendering in any src/**/webview/** file in everscript-vscode. Covers idempotent binding, event-target walk-up, VS Code webview API gaps, SVG coordinate systems, and why a green suite still ships broken UI — `[hidden]` losing to author `display` rules, flex items propped open by unwrappable text (only visible at the real container width), and module-level state leaking across tests. The bug class behind "the caret does nothing", "the edit button works every now and then", "new room does nothing", a dropdown visibly stuck open for three releases, and "H/V moves the side bar".
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
handler was silently dead code (a scripted edit had no-op'd — see the `code-quality`
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

If an editor lets a stroke append new dictionary entries (new metatiles, new stamps)
and those entries are referenced elsewhere **by index** (`cells[key] = dictionaryIndex`),
undoing the stroke has to consider dropping the entry it created — otherwise the
dictionary only ever grows and any "used N of M slots" meter becomes a lie. But the
entry can only be dropped from the **tail** of the list:

```js
function editPruneAdded(palette) {
  while (_edit.added.length) {
    var index = base + _edit.added.length - 1;   // the LAST entry only
    if (used[index] || _edit.brush === index) break;
    _edit.added.pop();
  }
}
```

Removing from the middle would silently repoint every surviving entry above it to the
wrong picture — index `i` names position `i`, not identity `i`. This generalizes beyond
undo: any "compact the dictionary" or "remove unused entries" feature over a
positionally-addressed format has the same constraint, and needs the same tail-only
rule or an explicit re-indexing pass over every reference.

## 7. Three ways a green test suite still shipped a visibly broken UI

Each of these passed every assertion and was caught only by a person looking at the
rendered panel. They are why §5 is not enough on its own.

### 7a. `[hidden]` loses to any author `display` rule

**Symptom:** a dropdown that should be closed is visibly open — for three releases —
while every test that "closes" it passes.

The browser hides `[hidden]` with a **user-agent** stylesheet rule. Author styles beat
user-agent styles by *origin*, before specificity is even consulted, so a component rule
like `.rg-filter-popup { display: flex }` overrides `hidden` no matter how weak its
selector is. The element keeps its `hidden` attribute, `el.hidden` stays `true`, and it
paints anyway.

**Fix:** pair every author `display` rule on a hideable element with an explicit
override — `.rg-filter-popup[hidden] { display: none }`.
**Test:** never assert visibility through the `.hidden` IDL property or the attribute.
Assert `getComputedStyle(el).display === 'none'` — that is the only check that agrees
with what the user sees.

### 7b. Reproduce at the real container width — and measure position, not just size

**Symptom:** "clicking H/V moves the side bar to the right." A Playwright repro at a
1400px-wide viewport measured the dock's *width* before and after the click and found
**no change at all**, so the report looked unreproducible.

It was real, and both halves of that repro were wrong. The dock never got wider — it
**moved**. Its sibling, the canvas column (`#rg-outer`), is a flex item, and a flex
item's default `min-width` is `auto`: it may not shrink below its content's min-content
width. That content included the status-bar note, which is `white-space: nowrap`.
Re-arming the brush on an H/V click writes the editor's longest note, the canvas column
grows to hold it, and the fixed-width dock is shoved right until it clips off-screen. At
1400px there was slack to absorb the growth, and a width-only measurement could never
have seen a move anyway.

**Fix:** `min-width: 0` on the flex item that holds unwrappable text
(`.rg-edit-row > .rg-outer`), plus `min-width: 0` and an ellipsis on the text itself so
it truncates instead of propping its column open.

**Rules:**
- Render at the width the component actually ships at, with its real content. When a
  layout bug will not reproduce, the viewport is the first suspect.
- Measure **position** (`getBoundingClientRect().left`) as well as size. "It moved" and
  "it grew" are different bugs, and checking only one of them hides the other.
- Any flex item containing `nowrap` text needs `min-width: 0`, or the longest string it
  will ever show becomes that column's minimum width.
- **Do not "fix" it with `overflow-x: hidden`** — that clips the control instead of
  fitting it, trading a visible bug for an invisible one.

### 7c. Module-level state leaks across tests — and across the real UI

**Symptom:** two assertions about which layer a tile is badged for failed, reporting
every tile as `ground`.

The webview files share one concatenated scope, so a `var _layerForce` is a single
global. A test that set it to `'terrain'` to exercise one path and never reset it
silently forced every *later* badge in the same page. The failures looked exactly like
the product bug being investigated.

**Rule:** any test that writes a module-level webview variable restores it — the same
suite runs every check in one page. And treat the same leak as a real product risk: if
a code path sets shared state like `_layerForce` without clearing it, the UI shows the
identical symptom to the user.
