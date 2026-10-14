# src/mana-maps — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). The Secret of Mana Maps panel.
What the folder does: [README.md](README.md).

## Owns
- The panel lifecycle (`index.js`, one panel at a time) and its page (`webview/`).
- Webview state: selected area/map, zoom and view toggles (`webview/main.js`, `vscode.setState`).

## Dependencies
- Reads Mana data only through `som://` (`vscode.workspace.fs`; pictures via
  `asWebviewUri`, JSON via the page's `read` message). Never `require`s `mana/`,
  `mana-resources/` or any Evermore domain (`.depcruise.js` `mana-maps-reads-som-only`).
- The page loads the shared map-view pieces from `src/shared/webview/map-view/` (chips,
  their CSS, the tile-animation player) — the same files the Evermore Rooms tab uses.

## Invariants
- Only maps: area list on the left, pictures in the middle, a filter bar of view
  toggles (BG1 | BG2 | Collision, Animate, Specials, zoom). No editing tools, no
  right-hand dock. A view feature Evermore has and Mana supports uses the shared piece;
  one Mana lacks (cuttable tiles) is not shown.
- Maps are SVGs sized by width/height attributes; never scale map pictures with CSS
  (VS Code's default `img { max-width:100% }` squashed them).
- A figure loads its picture, overlays and animation only when scrolled into view.
- Page code lives in `webview/*.{html,js,css}`; the host fills only URIs, the CSP
  nonce and the `#init` JSON data block.
- `everscript.openMemoryRadar` opens this panel instead of the radar when
  `everscript.romPath` is a Secret of Mana ROM (wired in `extension.js`).

## Tests
- `tests/mana/mana-panel-dom.test.js` — the real page in headless Chromium with a stub host
  (unit tier; skips without playwright).
