# Cross-Game Map Modes

> Domain: map presentation in the shared editor and emulator overlays (`src/core/map-editor/` and per-game adapters).
> Status key: 🔴 bug · 🟡 feature gap · 🟢 designed, not yet built

## 1. Layered Scroll / Parallax Preview

- **Status: 🟢 idea**
- **Goal:** Let a map adapter describe how its background layers move relative to the camera, so the shared map view can preview game-specific presentations such as Terranigma's tower background scrolling at a different rate while the player walks upward.
- **First step:** Document and verify the relevant layer and scroll behavior from each game's own code or runtime. Define a game-neutral render description for layer order, per-layer scroll source or rate, and foreground/character ordering; keep game-specific facts in that game's adapter and documentation.
- **Preview boundary:** The editor or emulator overlay may offset separately rendered layers for presentation without writing to game memory. This only changes the extension's preview; it does not create parallax in the ROM or alter gameplay.
- **Validation:** Compare the composed preview against the running game while the camera moves in both axes, including layer edges, priorities, entities, and rooms with no/hidden layers. Do not infer another game's behavior from a similar-looking Evermore room or SNES header.

## 2. Other Game-Specific Map Presentations

- **Status: 🟢 idea**
- Survey additional map display modes across supported games and add shared rendering support only for semantics that can be expressed game-neutrally. Keep game-specific decoding and mode selection in adapters; do not make the shared editor depend on another game's decoder.
- Preserve the existing game's output when a mode is absent or unknown. Treat engine or ROM changes as a separate feature requiring its own evidence and validation.