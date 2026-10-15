# src/shared/webview/map-editor-shell — the editor page both games are built from

Rules for agents: [AGENTS.md](AGENTS.md). Plan: [docs/architecture/one-map-editor.md](../../../../docs/architecture/one-map-editor.md).

The page the Evermore Rooms tab and the Secret of Mana Maps panel share: the frame (rail | splitter |
detail), the rail, the name line, the canvas column (card, floating tool pill, zoom chip, filter bar, status
bar), the dock and its tab strip, the resizable layout with its compact mode, zoom and pan. Each page passes
its own content in (rooms or maps, tools, tabs, the svg's contents) and gets the same look and behaviour.
Plain browser scripts (globals); `frame.js` also loads under Node, where the Rooms tab's host renders the
page with it.

| File | Role |
|---|---|
| `frame.js` | markup builders: `shellFrameHtml`, `shellRailHtml`, `shellRailTreeHtml`, `shellHeadHtml`, `shellCanvasParts` (the column in two halves around the svg), `shellToolButtonHtml` / `shellActButtonHtml` / `shellPillHtml` (+ `SHELL_TOOL_ICONS`), `shellSideBarHtml` (the Evermore level bar, the Mana variant bar), `shellStatusbarHtml`, `shellTabStripHtml`, `shellPanelHtml`, `shellSidebarTogglesHtml`; DOM: `shellDockMount` / `shellDockUnmount` |
| `layout.js` | rail and dock resize handles, collapsed sidebars, compact (narrow window) overlay mode; preferences go through `shellSavePref` (a page sets `shellPrefSaver`) |
| `zoom-pan.js` | `setupZoomPan(p)`: scale, pan offset, pinch, two-finger pan, the zoom chip; one svg unit is 8 px in both games' editors |
| `pan.js` | `shellPanStart` / `shellPanEnd`: dragging the map |
| `rail.js` | group and area collapse, the search filter, `shellRailBind({onSelect, onNew})` |
| `status.js` | `shellStatusBind(describe)`: the pointer's cell in the status bar |
| `shell-canvas.css`, `shell-layout.css`, `shell-rail.css`, `shell-tabs.css` | the look (tokens: `../map-view/map-view.css`) |

Contract between the files: the ids and classes of `frame.js`'s markup (`#rg-wrap`, `#rg-canvas`, `#rg-svg`,
`#rg-dock`, `#rg-panels`, `.rm-panels`, `.rm-rail`, …) are what the scripts and the stylesheets address.
