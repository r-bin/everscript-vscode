# Research & visualisation topics

Ideas for what to research or visualise next, ranked by payoff against effort. They
build on data the extension already records: CDL (calls, xrefs, script xrefs, hit
counts, SPC700), live WRAM, the script decoder, room data, TAS recordings and the
extended-map layers. ✨ marks the visually ambitious ones. Written 2026-10-08. Nothing
here is scheduled.

**Suggested start:** #12 world atlas, #1 call-graph galaxy (prototype exists) and #5
flag DAG. #5 also unblocks the interpreter work in `simulation/`.

## Tier 1 — big visual payoff, data already collected

1. ✨ **Call-graph galaxy.** A force-directed graph of the CDL call stack and xrefs.
   Node size is hits, colour is bank, and clicking a node shows its disassembly.
   **Prototype:** `tools/call-graph-galaxy/` (see the follow-ups below).
2. ✨ **ROM heat-strip timelapse.** The ROM tab's coverage strip, coloured by hits per
   frame and played back over a TAS replay, so you can see which code lights up in
   combat, menus or a map load.
3. ✨ **Script execution flame graph.** Record every Everscript invocation through the
   debugger's script call/end hooks and show it as a flame chart: which room scripts
   run, for how long, and what they call.
4. ✨ **WRAM write-pulse heatmap.** The Memory Radar grid with cells that glow on
   write and fade like phosphor, filterable by the writing routine (CDL ownership).
5. **Event-flag dependency DAG.** Every flag set and test across all room scripts,
   drawn as "flag X gates script Y, which sets flag Z". This is effectively the game's
   progression graph.

## Tier 2 — engine research

6. ✨ **RNG state-space explorer.** The generator's cycle, how many calls each frame
   consumes, and the manipulation windows for drops and alchemy procs. Pairs with TAS.
7. **Entity AI state machines.** Per enemy: the states and transitions behind its
   behaviour pointers, highlighted live in the emulator.
8. ✨ **SPC700 / music visualiser.** A piano roll per channel decoded from the sequence
   data, plus instrument sample waveforms. A sound test inside VS Code.
9. **DMA/HDMA and VRAM upload timeline.** What gets copied into VRAM, and when, in
   each frame. It explains slowdown, the canopy and parallax effects, and fade timing.
10. **Collision physics probe.** Movement vectors, slopes and hurt/strike box
    interactions, scrubbable frame by frame.
11. **Damage formula sandbox, verified live.** Compare the `scaling/` predictions with
    real emulator hits and plot the residuals. This closes the loop on
    `docs/alchemy-damage.md`.

## Tier 3 — world-scale views

12. ✨ **Stitched world atlas.** Every room laid out using its exits, zoomable from
    a whole act down to single tiles, with overlays for enemies, loot, flags and CDL
    coverage per room.
13. **Room transition graph.** Exits and doors weighted by route or TAS frame cost.
    It feeds the route planner and `simulation/routes.md`.
14. ✨ **Speedrun ghost overlay.** Several TAS recordings drawn at once as trails on
    the atlas or extended map.
15. **Loot and drop table atlas.** For every enemy and chest: what drops, at what
    odds, and where.

## Tier 4 — tooling (recomp / hacking)

16. **Unknown-byte triage board.** ROM-tab gaps plus CDL never-executed regions,
    ranked by size and by the known structures next to them. A research queue.
17. **Asar export diff visualiser.** Vanilla against a rebuilt ROM, byte by byte, with
    moved tables, relocated pointers and padding colour-coded.
18. ✨ **Pixel provenance inspector.** Hover a pixel and trace it through OAM or BG,
    the tile, its VRAM address, the DMA source and the ROM offset to the decompressor
    that produced it.
19. **Text and dialogue corpus.** Every string with its speaker and script location,
    searchable, with unreferenced strings flagged.
20. ✨ **Cut-content hunter.** #16 + #19 + unreachable script branches + unreferenced
    rooms, sprites and animations, in one gallery of what's in the ROM but never seen.

## Galaxy follow-ups

The prototype (`tools/call-graph-galaxy/`) is **for people**. Its graph is pruned and
its layout is meaningless to a machine. Next steps, cheapest first:

1. **Record a fresh library.** The current SoE library predates hit counters (v0.173),
   so sizing by hits is greyed out, and only 31 scripts have attribution. A longer
   session would fill both in.
2. **One AI-readable text file per function.** Generate a dossier per function from
   the same `xref-index`: callers, callees, WRAM reads and writes with memory-map
   names, ROM assets, I/O, scripts and full disassembly. An agent can grep a folder of
   these, and each fits in context. This fits naturally beside the CDL export
   (`functions.json` already holds the footprint without names or code).
3. **`lookup` as an agent tool.** `src/emulator/cdl/lookup.js` already answers "who
   calls X" and "who touches $0A37". Exposing it as an MCP server or CLI would let
   agents ask targeted questions against the live library instead of reading the
   whole graph.
4. **Port to a tab.** If it earns a place in the extension, put it next to the ROM
   tab's CDL views and feed it live while recording, so the graph grows as you play.
   Keep the human view and the AI dossiers on the same index so they agree.
5. **Name the unnamed.** Unnamed WRAM pages with many users, and functions with many
   callers, are the best candidates for new labels in `memory-map.md` and the
   function names.
