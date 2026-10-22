# data-tab/ — Data tab

The radar panel's **Data** tab: the game's data that is not a script, read from the user's ROM.
Three columns like the Scripts tab (it shares its styles): a filterable list, the data, and a
picture of it.

| View | List | Middle | Right |
|---|---|---|---|
| **Tables** | only tables decoded into readable values: XP per level, character stats, the sine helper, the boomerang orbit | the values, the entry's note, a `soe://` link | a line chart with a crosshair readout; a path (the orbit) at equal scale |
| **Enums** | id lists the game defines: character blobs (WRAM, ROM), the record's fields, contact handlers (+$30), AI selectors (+$03), alchemy formulas, CAST ids, ingredient names, rooms | the entries, and where the list is read (`source`) | the selected entry with its details |
| **Palettes** | the sprite palettes in bank `$90`, then the map palettes `$9C:C322` the rooms load | 16 equal colour boxes | a card per user: the character's sprite, or the room's most used tiles drawn in that palette |

Enums are read from the user's ROM (names are the ROM's own text: `$C4:5D09`, `$C4:5FC5`, the
record's name pointer) or from a knowledge entry that says how it was found (the record fields,
the WRAM blobs). The compiler's `.evs` enums are not used: they were partly guessed and carry
hack-specific entries. A list that cannot be verified is left out (the other entity slots).

A "tile family" in the room format is a map palette: an index into `$9C:C322`, 16 colours. A
room lists up to 14; `$90:D020` copies 7 of them, from the set `$7E:2437` picks, into BG palettes
1–7.

| File | Role |
|---|---|
| `index.ts` | Public API: `handlesDataMessage` / `handleDataMessage`, `buildDataTabHtml` |
| `host.ts` | The `dataInit` request; the character list is injected |
| `render-data-tab.ts` | The pane scaffold |
| `model/tables.ts` | XP per level (`$8C:8BD0`, `$8C:8CFC`), character stats, sine (`$80:88A3`), boomerang orbit |
| `model/enums.ts` | Character blobs and record fields, contact handlers, AI selectors, formulas, CAST, ingredients, rooms |
| `model/palettes.ts` | Sprite palettes and map palettes with their users; the room samples |
| `webview/data-tab.dom.ts` | The page (bundle `DataTab`, set up inside the radar's script) |
| `webview/data-tab.css` | What the tab adds to the Scripts tab's styles (`dat-` prefix) |

Host protocol: page → `dataInit`, host → `dataIndex { tables, enums, palettes }` (once per ROM,
about 0.4 MB) or `{ error }`; page → `dataPaletteSamples { family }`, host → `dataPaletteSamples
{ family, samples: [{ room, slot, images }] }` when a map palette is opened. Links post
`openVfs { uri }` (answered by the sprites host).
