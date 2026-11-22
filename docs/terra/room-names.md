# Terranigma room names

The ROM holds no room names (the room table, [README.md §3](README.md), is pointers to scripts). The names the
Maps panel shows are ours: `src/games/terra/decoder/names.ts`, put on every room by `roomCatalog`
(`terra://rom/rooms/index.json`: `area`, `name`, `guess`).

## How a room gets its name

1. **Exit graph** ([README.md §3.7](README.md)): every exit's target is an edge (a choice by flag counts).
2. **World maps leave the graph.** `$002` (overworld; 87 exits), `$003` (underworld) and `$005` (flying overworld)
   reach every area, so they would join them all. Without them the 903 rooms fall into about 130 connected
   pieces: a town with its houses, a tower, a cave. 51 have two or more rooms; the rest are single rooms a world
   map leads to ("Hidden area $xxx") or rooms nothing links ("Room $xxx").
3. **One anchor per piece** names it (`AREAS`). Evidence: the piece's largest room rendered
   (`terra://rom/rooms/<hex>.png`); for towns the story name that fits the picture and the rooms around it.
   Check: room `$00F` (Ark's house, [§5](README.md)) is in the piece named **Crysta** — the test
   (`tests/terra/terra-rom.test.mts`) holds it.
4. **Inside a piece**: the room(s) with an exit to a world map are the area itself (`Loire`; `Loire 1`, `Loire 2`
   when there are several ways in); the others are `<area>, room N` in breadth-first walking order from the way in.

## What is a name and what is a description

`guess: false` — the town's own name (Crysta, Loire, Louran, Stockholm, Liberty, Suncoast, Nirlake, Astarica);
a town seen in two eras is two pieces ("Liberty", "Liberty (modern)"; "Suncoast", "Suncoast (modern)").
`guess: true` — the piece's name could not be checked against the game, so it says what the picture shows
("Ice cave", "Metal fortress", "Houses (west)"). Do not turn these into proper names without proof (a walked route
or the game's own text); rename the anchor's entry and set `guess` false when you have it.

Open: the pieces named "Houses (…)", "Cottage…" and "Purple castle" are only placed by picture. Which town they
belong to is not read; each is entered from a world map in its own right in the exit graph.

## Provenance

The piece structure is computed from the ROM. The proper town names come from the story as the game tells it; a
third-party map editor's room list was looked at only to learn which names and naming style (area, then place,
then "room N") exist, nothing was copied from it, and every assignment above was checked against our own render
and exit graph.

