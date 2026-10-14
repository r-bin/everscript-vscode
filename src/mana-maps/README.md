# src/mana-maps — Secret of Mana Maps panel

Rules for agents: [AGENTS.md](AGENTS.md). Opened by **Everscript: Secret of Mana: Open Maps**
(`everscript.openManaMaps`), or by **Open Memory Radar** when `everscript.romPath` is a Mana ROM.

Left: the areas (Potos Falls, Potos, …, then "Other maps"), each expandable to its map ids.
Middle: the chosen area's pictures side by side (maps that draw the same picture are shown
once, captioned with all their ids), or one map. Header: ½×/¼×/1×/2× zoom.

| File | Role |
|---|---|
| `index.js` | creates the panel, reads `som://rom/{info,maps/index,areas/index}.json` |
| `webview/index.html` | page shell (CSP, `#init` data) |
| `webview/main.js` | area list, pictures, zoom, persisted selection |
| `webview/style.css` | layout with VS Code theme colours |
