# What our map editor can learn from the upcoming Zelda 3 map editor

> Status: notes, 2026-10-26. The Zelda 3 (A Link to the Past) editor is unreleased; everything here
> comes from three preview screenshots of its UI, described in our own words. No code, data or art
> from it exists in this repo, and none is wanted (`AGENTS.md` §0.1). Our side: the Rooms tab editor
> (`src/games/evermore/rooms/webview/map-editor-*.js`, shell in `src/core/map-editor/`).

## 1. What the preview shows

One screen, three columns, no nesting:

- **Top bar**: `Map Editor` · area name (`Kakariko`) · save state in colour (`not saved yet`) · then
  word buttons in small groups: `Undo Redo` | `Fit Grid Walls` | `Areas Project` | `Reset Save` |
  `Help Close`. `Grid` lights up when on; `Save` is tinted while there are unsaved changes.
- **Left: a labelled tool list in two groups.** `TILES`: Brush, Shapes, Fill, Pick, Select, Erase.
  `PLACE`: Objects, Decoration, Sprite, Door, Warp. Every row is icon + word. `Zoom 2` sits under it.
- **Canvas**: the map, a grid, and a **minimap** in the bottom-right corner showing the whole area
  with the view outlined.
- **Right: one panel whose content follows the tool.**
  - With Brush: `PAINT WITH` + `S M L` thumbnail size; source tabs `Tiles | Other area | Mine`;
    two dropdowns, `This area` and `Everything`; a tile grid; then a **"Your brush" card**: big
    preview, name (`Ledge and ground`), a `Keep (K)` button and a `Last used:` strip of recent
    brushes. A fade at the bottom says `more below – wheel or bar`.
  - With Objects: `OBJECTS OF THE GAME`, then plain two-way choices: `Under Link | Over Link`,
    `Solid as in the game | Just a picture`, `Put as: A picture | Real tiles`,
    `Light World | Dark World | Both`, a `Show: All` filter, and big thumbnails.
- **Status line**: `Column 37, row 31: Ledge and ground (yours; the game's: wall)` · `Zoom 2`, and on
  the right an echo of the current action: `Brush: ledge and ground.`
- **Tooltips** have a bold title with the shortcut (`Objects (J)`) and two or three plain sentences:
  what it is, how it behaves, and how to click / drag / delete it.
- **Where it runs**: inside the game (`F9` outdoors opens it); maps leave as a `.zip` map pack that a
  mod plays.

## 2. Where we stand

| Theme | Zelda 3 preview | Ours today |
|---|---|---|
| Tools | 11 labelled rows, grouped Tiles / Place | 7 icon-only glyphs (`↖ ✎ ⌫ ⤵ ⧉ ✥ ❖`) in a pill, tooltip only |
| What a tool draws | The tool itself (Door, Warp, Sprite…) | The *open tab* decides what the pencil draws (`editDrawKind`); the same pencil paints a tile, a special, a trigger or a widget |
| Panel structure | One panel, contents follow the tool | 6 tabs, Tile has 3 sub-tabs, Animation has 2 more, Info has 3 — three levels deep |
| Current brush | Large card with name, Keep, last-used strip | A selection ring in a sheet; no name, no history |
| Tile sources | `This area / Other area / Mine` + filter dropdown | Family chips, search box, `auto|front|ground`, `H|V`, related-score sort, neighbours panel |
| Status line | Column/row, the tile's **name**, and painted vs game collision | `x: 07 y: 04 · interact: … · step-on: …` |
| Save state | `not saved yet` in the title, Save tinted | Debounced autosave to globalStorage; vanilla drafts not written to ROM |
| Overview | Minimap with viewport box | None; `Fit` only |
| Shortcuts | Letter per tool, shown in the tooltip (`J`, `K`) | Cmd/Ctrl+Z/C/V only; no tool letters |
| Words | "Under Link", "Solid as in the game", "Just a picture", "Walls" | "Special", "Widget", "Construct", "Disband", "Stamp", "Cuttable", "canopy/terrain" |
| Playtest | In the game itself | `Play in emulator` and `Export ROM…` behind `⋯` |

Where we are ahead and should not lose ground: vanilla-attested neighbour suggestions, the 16
collision shapes and 8 px pen, triggers with scripts, the Budget view against ROM ceilings, animated
tiles and palette cycles, ROM export. The lesson is not "have fewer features"; it is "make the ones
we have easier to find and to read".

## 3. What to take

Ranked by value for effort. Each says what changes and where.

### 3.1 The status line names things and states the game's opinion (small, high value)

`Column 37, row 31: Ledge and ground (yours; the game's: wall)` is the best idea in the preview. It
answers "what is this?" and "will it behave the way I think?" in one line, without a click.

We have everything needed: the family name (`_famCatalogue`), the stamp's collision estimate, the
user's override in `_edit.coll`, the special in `_edit.specialCells`, the trigger under the cell.
Proposal for `setupStatusBar` (`map-editor-filterbar.js`):

`Column 12, row 4: Jungle grass, edge (yours: solid; the game's: walkable) · step-on: script 0x2a3`

Only show `interact`/`step-on` when there is one; drop the `x: 07` hex-padded form for words (hex
stays in the tooltip/Info for those who want it). Add the right-hand echo of the last action
(`Painted 14 cells of jungle grass`), which doubles as feedback that a stroke landed.

### 3.2 Make the brush a visible object (small–medium)

A "Your brush" card at the bottom of the dock: large preview of the armed tile/widget/special,
its name, its layer and flip, and a **recent strip** (last 8 brushes, click to re-arm). `Keep (K)`
pins one to the strip. Today the armed brush is a ring in a sheet that scrolls away; when you change
tab you lose sight of it. This is a new piece of state (`_recentBrushes`, owner
`map-editor-families.js` or a new `map-editor-brush.js`; add the row to `STATE.md`).

### 3.3 Tools say what they place, not which tab is open (medium, structural)

Our biggest readability cost: one pencil whose meaning changes with the tab. The preview splits
tools into **paint** tools (Brush, Shapes, Fill, Pick, Select, Erase) and **place** tools (one per
kind of thing). For us that would be:

- **Tiles**: Brush, Fill (open, `docs/todo/map-editor.md` §1.1), Pick, Select/Copy, Move, Erase.
- **Place**: Widget (today's stamp), Trigger (step-on / B), Object, Special, Start.

The panel then follows the tool, and the tab strip shrinks to what is not a tool: Collision and
Animation become panels of their place/paint tools, Info stays a tab (it is read-only). This is the
same move as the earlier `room/deco` toggle removal (§8a.2 of `docs/map-editor-redesign-plan.md`):
let the selection decide, not a separate mode. It is a real restructure, so it needs a plan section
and the owner's yes before code (see the design-mock-fidelity rule: restructure, not restyle).

### 3.4 Words over glyphs on the tool column (small, but conflicts with the mock)

The preview's tool list is icon **plus** word, and it reads at a glance. Our pill is icon-only by the
earlier design mock's choice. Options: a labelled column when the dock is wide, icons-only when
narrow (the shell already knows rail/dock visibility); or keep the pill and show the active tool's
name next to it. Ask before changing — the icon pill was an explicit choice.

### 3.5 Plain-language names and two-way choices (small per item)

Replace engine words with what the user sees, keeping the engine term in the tooltip:

| Ours | Say instead |
|---|---|
| Special | Ground rules (or the specific: Stairs, Drift, Boy-only gate) |
| Widget / Construct | Object (the vanilla library) / My objects |
| Stamp | Place |
| Disband | Break apart into tiles |
| canopy / terrain, `auto|front|ground` | Over the Boy / Under the Boy / As the game does it |
| Cuttable | Cut with a weapon |
| See-through (bit 6) | Walk under (bridge) |

And copy the preview's pattern of **paired choices that name both sides**: `Solid as in the game |
Just a picture`, `Put as: A picture | Real tiles`. Our Widgets tab has a "Ready only" toggle and
filter chips (`fits, works, front, open`) whose off-state is unnamed; pairs make each state legible.

### 3.6 Tooltips: title, shortcut, then how to use it (small)

`Objects (J)` + "what · how it overlaps · click / drag / Del". Ours are long single paragraphs in
`EDIT_TOOLS` (`map-editor-toolbar.js`); the Erase one is five clauses. Restructure each into a bold
title line with the key, then at most three short sentences. `data-tip` already renders multi-line.

### 3.7 One letter per tool (small)

Add `B` brush, `F` fill, `I` pick, `M` select, `E` erase, `K` keep brush, `G` grid, `W` walls
(collision overlay), `H`/Space pan (open, §1.2). Show the letter in every tooltip. Bind in
`map-editor-gestures.js`'s keydown, skipped while a text input has focus.

### 3.8 Minimap (medium)

Rooms are often larger than the view at useful zoom. A corner overview with the viewport box,
click/drag to jump. We already render the room; the minimap is the same image scaled, with the box
from `zoom-pan.js`'s view. Belongs in `src/core/map-editor/view/` so Terranigma and Mana get it too
(`AGENTS.md` §0.6).

### 3.9 Save state in the title, toolbar as word groups (small)

`not saved yet` in colour next to the room name tells you, at the top, whether your work exists.
For us the honest states differ: a custom map is autosaved (`saved`), a vanilla draft is
`draft only — not in a ROM`, an imported Mana room is `converted, never saved` (already shown by
`importedNotSavedHtml`). Put one of those in the head line. Group the head actions the way the preview
does (history | view | project | file | help); move `Play in emulator` out of `⋯` into the file group,
since play-testing is the main loop.

### 3.10 Small touches

- `S M L` thumbnail size on tile and object grids (one CSS variable; save with `saveUiPref`).
- A "more below" fade on scrolled lists; our family groups load lazily and look finished when not.
- `This area | Other area | Mine` as the first filter on tiles: area is how users think; families
  can stay as the second level.
- A visible `Walls` toggle (collision overlay) next to `Grid`, instead of only inside the Collision
  sub-tab.
- A `Help` button that opens a one-screen cheat sheet (tools, keys, the colours of overlays).

## 4. What not to take

- **Running inside the game** (`F9`): a different product. Our loop is VS Code + embedded emulator;
  the equivalent is making `Play in emulator` one click and returning to the same room.
- **Fewer settings by hiding real ones.** The preview's Objects panel has four two-way choices; ours
  map to real collision-word bits and ROM budgets (`map-editor-rules` skill). Rename and regroup,
  never drop a control that writes a real bit, and never invent categories the ROM does not have.
- **Light World / Dark World** has no Evermore meaning; the nearest is our map-change phases
  (`map-editor-phases.js`), which already exist.

## 5. Suggested order

1. Status line (3.1) and tooltips (3.6) — words only, no layout change.
2. Brush card + recents (3.2), tool letters (3.7), `Walls` toggle and save state (3.9, 3.10).
3. Minimap in core (3.8).
4. Renames (3.5) — one pass across tabs, tooltips and docs together.
5. Tools-not-tabs restructure (3.3, with 3.4) — needs a plan section and the owner's decision first.
