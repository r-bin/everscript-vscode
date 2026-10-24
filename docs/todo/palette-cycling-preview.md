# Palette-Cycle Preview in the Map Editor

> Domain: Evermore room palettes and the map editor (`src/games/evermore/maps/`, `src/games/evermore/rooms/`)
> Status: 🟢 Implemented. Supported in Map Editor (`Tile > Animation > Palette` sub-tab), preview overlays, and tile picker.
> Format reference: [Room reference](../map-format/room-reference.md) §5; [palette extraction](../map-format/map_palette_extraction.md); [animated tiles](../map-format/map_animated_tiles.md) §6

## What It Does

Some room blobs contain a count followed by three-byte palette-cycle descriptors (Section 4.3). The room loader at `$9090A6` reads each record and calls `$90D50F`, which sets up state used to cycle colours over time. This changes colours in the rendered scene without replacing the tile graphics. It is a palette animation, not a tile-animation channel from Section 2.

The data model parses these records into typed `paletteCycles` objects with active pattern lettering (A, B, C...).
The map editor provides a dedicated `Tile > Animation > Palette` sub-tab, animates canvas overlays with individual `Tile cycle` and `Palette cycle` toggles, groups contiguous cells sharing cycle patterns, and renders previews using deduplicated `<defs>`/`<use>` sprites and pixel-difference filtering.

## Current Evidence and Confidence

The loader and `$90D50F` disassembly establish this flow:

| Record byte | Observed use |
|---|---|
| `b0` | Selects cycle state using `(b0 & 0x70) >> 3`; also contributes to the colour-buffer index calculated by the setup routine as `b0 + (b0 & 0x70)`. |
| `b1` | Supplies the cycle span/count used to initialise the direction-specific cycle state. |
| `b2` | Signed cycle rate; its sign selects the forward/reverse setup path. |

The setup routine writes state in `$1372`, `$13D2`, `$13F2`, `$1392`, and `$13B2`. `$90D590` and adjacent code process active cycles and request a palette DMA. The exact rate-to-frame timing, wrap behavior at the end of the span, and the mapping from the computed colour-buffer index to the rendered BG/OBJ palette still need a careful end-to-end trace. Treat the field names above as a working interpretation until that trace is completed.

Do not interpret the upper bits of `b0` as a standalone palette number: they participate in both a state-table selector and a computed colour-buffer index.

## Example Records

These examples use the raw bytes shown in the Maps panel. The computed values below describe the setup routine inputs; they do not claim a verified visual timing.

| Bytes | State selector `(b0 & 0x70) >> 3` | Computed colour-buffer index `b0 + (b0 & 0x70)` | Span | Signed rate |
|---|---:|---:|---:|---:|
| `1B 04 05` | 2 | `$2B` (43) | 4 | `+5` |
| `11 02 06` | 2 | `$21` (33) | 2 | `+6` |
| `21 09 01` | 4 | `$41` (65) | 9 | `+1` |
| `46 03 05` | 8 | `$86` (134) | 3 | `+5` |
| `2A 04 05` | 4 | `$4A` (74) | 4 | `+5` |
| `61 09 01` | 12 | `$C1` (193) | 9 | `+1` |

For instance, `1B 04 05` configures state selector 2, starts at computed buffer index `$2B`, uses a four-colour span, and has positive rate 5. The editor should show this decoded explanation beside the raw bytes, but should not label `$2B` as a particular BG palette entry until the DMA/source mapping is proven.

## Map-Editor Behavior

### Preview

- Add a **Palette cycles** inspector alongside the existing map/tile animation views. List each descriptor in room order, with raw bytes and decoded fields.
- Provide a clear **Play/Pause** control for previewing all cycles together, plus an optional per-record toggle for isolating one cycle.
- Animate the existing map image by changing palette colours only. Keep geometry, metatiles, collision, and tile-animation state untouched.
- Highlight the active descriptor and its affected palette swatches while the preview runs. Once the colour-buffer-to-rendered-palette mapping is verified, also highlight affected map pixels or cells; do not infer impact from matching RGB values alone.
- Keep the static view as the default or make animation explicitly pausable. The preview must not make ordinary map editing laggy or cause canvas dimensions/layout to shift.
- Support a preview speed multiplier for inspection, separate from the emulated game rate. The default must match game timing once it is known.
- Ensure export and serialization retain the original three bytes exactly unless the user explicitly edits descriptor fields.

### Editing

- Decode the record into editable fields only after the ranges and edge cases are verified. Keep a raw-byte view and round-trip tests so unknown bits are not lost.
- Make cycle selector, start colour, span, and signed rate understandable in the UI; offer numeric/hex inputs and a swatch preview rather than asking users to edit packed bytes by hand.
- Warn on values that exceed the destination palette/CGRAM range or overlap another active cycle, once those constraints have been established from the engine.
- Do not add or remove descriptors automatically when users paint tiles. Palette cycling is a room-level effect, independent of metatile placement.

### Suggested Interaction

1. Select **Palette cycles** in the map inspector.
2. The list shows one row per descriptor, e.g. `1B 04 05`, with its selector, computed colour-buffer start, span, and rate.
3. Press **Play** to animate the room preview; select a row to isolate it and inspect the affected swatches.
4. Pause the preview to return to a stable frame before editing or taking screenshots.

## Implementation Path

1. Trace the palette-cycle update and DMA path from `$90D50F` through the active-cycle tick to the CGRAM transfer. Record timing, span semantics, wrap behavior, buffer layout, and whether room descriptors can address BG palettes, OBJ palettes, or both.
2. Add a typed palette-cycle record to the room model while retaining compatibility with the existing serialized `extraGraphics` field. Validate all vanilla rooms against the ROM and preserve unknown/raw bits.
3. Factor colour-cycle application into a deterministic pure function over the decoded room palette buffer. Keep the renderer as the consumer; do not implement palette math in webview event handlers.
4. Add unit tests for record decoding, positive/negative rates, span boundaries, and stable output at a fixed tick. Compare representative preview frames with the running game or a trace-backed expected CGRAM state.
5. Add the inspector and preview controls, then visually verify the Maps view at desktop and mobile widths. Check selection/highlighting, play/pause, disposal when the tab closes, and that editing remains responsive.
6. Preserve exact room bytes on round-trip when descriptors are unchanged; test export/play ROM with at least one room that has cycles.

## Open Questions

- What game tick advances a cycle, and how is the signed rate converted to elapsed frames?
- Does `b1` mean a count of colours, a terminal offset, or another counter limit at all boundary values?
- How does the update routine wrap at the end of the cycle span, and can a cycle run backward across the start index?
- Does the computed source index refer directly to the room's palette buffer, a broader colour buffer, or a CGRAM address after a translation?
- Can cycle records target sprite/OBJ colours as well as the room's BG tile families?
- What happens when two descriptors target overlapping colours or the same state slot?
- Which vanilla rooms provide the clearest, visible test cases for each direction and rate?

## Related Work

- [Map Editor backlog](map-editor.md)
- [Room format reference](../map-format/room-reference.md)
- [Palette extraction](../map-format/map_palette_extraction.md)
- [Palette-cycle setup routine](../../src/games/evermore/localizations/knowledge/rom/90d50f.md)