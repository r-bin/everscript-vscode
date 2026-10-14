# src/mana-maps — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). The Secret of Mana Maps panel.
What the folder does: [README.md](README.md).

## Owns
- The panel lifecycle (`index.js`, one panel at a time) and its page (`webview/`).
- Webview state: selected area/map and zoom (`webview/main.js`, `vscode.setState`).

## Dependencies
- Reads Mana data only through `som://` (`vscode.workspace.fs`, images via
  `asWebviewUri`). Never `require`s `mana/`, `mana-resources/` or any Evermore domain
  (`.depcruise.js` `mana-maps-reads-som-only`).

## Invariants
- Only maps: area list on the left, pictures in the middle. No editing tools, no
  right-hand dock, nothing from the Evermore tabs.
- Page code lives in `webview/*.{html,js,css}`; the host fills only URIs, the CSP
  nonce and the `#init` JSON data block.
- `everscript.openMemoryRadar` opens this panel instead of the radar when
  `everscript.romPath` is a Secret of Mana ROM (wired in `extension.js`).

## Tests
- No automated test yet; checked in headless Chromium with the real page files.
