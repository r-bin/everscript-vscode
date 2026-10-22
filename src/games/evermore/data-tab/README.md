# data-tab/ — Data tab

The radar panel's **Data** tab: the game's data that is not a script, read from the user's ROM.
Three columns like the Scripts tab (it shares its styles): a filterable list, the data, and a
picture of it.

| View | List | Middle | Right |
|---|---|---|---|
| **Tables** | the decoded tables (XP per level, the sine helper, the boomerang orbit), then every knowledge entry of kind `table` with a size, by category | the values (decoded tables) or the raw words (the rest), the entry's note, a `soe://` link | a line chart with a crosshair readout; a path (the orbit) at equal scale |
| **Enums** | Game lists (character blobs: WRAM entity slots and ROM records; map blobs: the map pointer table), then every enum of the Everscript core library grouped as ROM addresses, WRAM addresses, values | the entries: name, value, comment, `soe://` link | the selected entry |
| **Palettes** | the sprite palettes in bank `$90` (every address a script or character record names), then the map tile families the rooms load | the 16 colours | the characters / rooms that use it |

The enums come from the language data file (`../language/data/index.json`, generated from the
compiler's `in/core/*.evs`), the same one the hovers use; the tab adds no list of its own. An enum
is WRAM when most of its values are written `<0x…>` (or it is `CHARACTER_ADDRESS`), ROM when all
values are bus addresses `$80:0000` and up.

| File | Role |
|---|---|
| `index.ts` | Public API: `handlesDataMessage` / `handleDataMessage`, `buildDataTabHtml` |
| `host.ts` | The `dataInit` request; the character list is injected |
| `render-data-tab.ts` | The pane scaffold |
| `model/tables.ts` | XP per level (`$8C:8BD0`, `$8C:8CFC`), sine (`$80:88A3`), boomerang orbit, knowledge tables |
| `model/enums.ts` | Character and map blobs, the core enums by kind |
| `model/palettes.ts` | Sprite palettes and map tile families with their users |
| `webview/data-tab.dom.ts` | The page (bundle `DataTab`, set up inside the radar's script) |
| `webview/data-tab.css` | What the tab adds to the Scripts tab's styles (`dat-` prefix) |

Host protocol: page → `dataInit`, host → `dataIndex { tables, enums, palettes }` (once per ROM,
about 0.5 MB) or `{ error }`. Links post `openVfs { uri }` (answered by the sprites host).
