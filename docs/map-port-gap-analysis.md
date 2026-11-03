# Map Data Port & Rooms Tab UX — Gap Analysis

> Status: living document; the closed-gap tables date from v0.15.0, the open-gaps table was re-checked 2026-11-03.
> See the `map-format` skill before acting on anything here — it has the
> "port, don't re-derive" ground rules this document assumes.

## Closed in v0.12.0

| Gap | Outcome |
|---|---|
| Grid misaligned with the map | **Confirmed real, 54 of 127 rooms.** A trigger at the map edge widens the SVG viewBox past the map (`x2 = sx+sw+1`), and the map image was a CSS-stretched `<img>` filling the canvas — so it was scaled to the widened box and the grid drifted 1–3% across the map (up to 3.3% on 0x10). The image is now an SVG `<image>` placed at the map's own extent in viewBox units, sharing one coordinate system with the grid, so it cannot drift. Regression-tested. |
| No export of the current view | `export png` in the top bar saves exactly what is on screen — same layer, same overlay flags — via a save dialog. Distinct from `everscript.exportRoomMaps`, which asks for scope and layer up front. |
| No pinch zoom | Trackpad pinch (a `ctrlKey` wheel event in Chromium) zooms anchored on the cursor, so the map does not walk away from what you were looking at. The zoom buttons now anchor on the viewport centre for the same reason. |
| Objects listed as a flat table | Replaced by a collapsible browser. Superseded in v0.13.0 by a linked list — see below. |

## Closed in v0.15.0

| Gap | Outcome |
|---|---|
| 1.4 / 2.6 animated tiles static | **Closed.** Section 2's channel table was documented all along in `map_tile_graphics_decompression.md` §7 — this document's claim that it was undocumented was simply wrong. The doc had two errors (see below); with those fixed the Rooms tab plays the animation. |
| Animation "blocked on upstream research" | Retracted. Only 1.5 (CGRAM palette cycling) is still unresearched, and no evidence has turned up that the map renderer uses it at all. |

**Two corrections to §7 of the format doc**, both verified ROM-wide: the second
descriptor byte is the channel's **frame count**, not a timer (1020/1020
channels), and the `0xFF` terminates the **descriptor table**, not the frame
stream (95/95 rooms; the first channel offset lands just past it). A frame
stream has no terminator — channel `i` runs to channel `i+1`'s offset, and a
tile id with low byte `0xFF` would otherwise truncate it.

Channels have no useful common period, so there is no global frame counter.
The Rooms tab renders one small transparent overlay per block of animated
cells per frame and gives each block its own clock.

## Closed in v0.14.0

| Gap | Outcome |
|---|---|
| 1.9 object stamp payload | **Solved** from a hardware trace — XOR deltas with an interleaved tile mask. See below. |
| No state previews | Every state now renders exactly: its chip in the object list is the room with that state applied, cropped to what the object touches. |
| Cannot customise the room | Picking a chip re-renders the map with those states stamped in, collision included — it resolves from the same metatile ID. |

## Closed in v0.13.0

| Gap | Outcome |
|---|---|
| Object stamp header undecoded | Solved — `[tw][th][mask][words]`, see 1.9. Upstream misses the mask byte. |
| Objects not linked to the map | The object rectangles are now SVG hit targets over the baked raster: hover to highlight, click to select the list row (and scroll it into view), click a row or state chip to highlight the rectangle. |
| Object list unreadable at 13+ objects | Flat table with a state chip row per object, styled like the trigger tables with a blue section rule. A "hide boring" filter drops objects with nothing to pick between — single-state, or several states with byte-identical stamps. That is 81.7% of them. |
| v0.12.0 said box extents were guessed | **Wrong, corrected.** `tw`/`th` are read correctly; the boxes were always right. See 1.9. |

## 1.9 ~~Object stamp payload~~ — SOLVED in v0.14.0

Closed by a Mesen CPU trace of looting the chest on map 0x71 (object 0x14),
which the user captured. The format, the semantics and the state model all
came straight off `$90A4C2..$90A4F2`; full write-up in
`docs/map-format/map_objects.md` §4b.

```
[tw][th] then, per tile row-major: a mask byte supplies 8 bits (LSB first);
         set -> a 16-bit value follows inline; clear -> tile untouched.
```

And the part no amount of statistics was going to guess, `$90A4E8`:

```
TXA ; EOR [$B0] ; STA [$AD]      new = current XOR value
```

The values are **XOR deltas against whatever is in the grid**, not metatile
IDs. `0x5CC8 ^ 0x2470 = 0x78B8` and `0x5CD0 ^ 0x2410 = 0x78C0` in the trace,
matching its writes exactly. Because XOR is an involution, one record both
applies and undoes a transition, so a descriptor is the delta *between* two
appearances: descriptor `s` turns appearance `s` into `s+1`, and an object
with `max_state` descriptors has `max_state + 1` appearances.

**This also retracts two claims made here earlier.** The doc's
"Total states = max_state + 1" was right, and so was its `1 + max_state*5`
record size — they are not in conflict, because state 0 needs no descriptor.
The test that "disproved" it looked for an extra descriptor at the same anchor
as state 0, which assumed descriptors were states. They are transitions, and
they legitimately carry different anchors.

Whole-ROM validation, now enforced by `checkObjectStamps` in the parity suite:

| Invariant | Result |
|---|---|
| Computed record length lands exactly on the next record's offset | 2726 / 2726 |
| Cumulative XOR yields a metatile ID in the room's Block 3 table | 19797 / 19797 |

Why the earlier attempts failed, for the record: every hypothesis treated the
values as identifiers, so the best fit was `word/8` at 43.4% — high enough to
look promising and completely wrong. The state-0 oracle failed for the same
reason (6 of 8522): state 0 has no descriptor, so descriptor 0 was being
compared against the grid it transitions *away* from. Both dead ends were
artefacts of the same wrong premise, which is exactly why the trace was worth
more than more statistics.

## Closed in v0.11.0

| Gap | Outcome |
|---|---|
| 1.2 annotation system | **Reversed, not deferred.** The whole of `render_full_composition` is ported (`overlay-features.ts` / `overlay-shapes.ts` / `collision-overlay.ts` / `font.ts`), including the 3x5 index labels. `checkOverlayParity` compares it to upstream at a **zero** pixel budget across 6 rooms. The earlier "by design" reasoning is recorded below for the record and is no longer the position. |
| 2.5 legend (again) | The legend is now upstream's, generated from the room's own features by `buildLegend()`, with entries greying out as their toggle goes off. `buildSummary()` supplies upstream's header banner. Both render as HTML rather than baked pixels. |
| Toggles never applied | `requestRoomTiles` dropped `msg.overlay` on the host side, so every render came back bare no matter what the top bar said — "collision is always off". Forwarded, and covered by a smoke test asserting one button per host flag, all on. |
| Only 3 of 9 features toggleable | Each pass now has its own flag (`c d p e n g o t l`) and its own button, plus an `all` button. Defaults to everything on. |

## Closed in v0.10.0

| Gap | Outcome |
|---|---|
| 1.3 fills vs contours | Superseded: the overlay is no longer hand-drawn SVG at all, but the ported raster, so contour style is upstream's by construction. |
| Panning snapped to 0,0 | `setupMouseEvents` receives a hand-built object literal; `_getPan` was never forwarded into it, so the accessor was `undefined` and every drag based at the origin. |

## Closed in v0.9.0

| Gap | Outcome |
|---|---|
| 2.1 stale render cache | Cache key now includes a ROM fingerprint, and `buildAndRun` drops both the ROM buffer and render caches explicitly. |
| 2.2 Live rooms never rendered | **Confirmed real.** `vanillaId` is a symbolic MAP enum name for live rooms, so `parseInt(…,16)` was `NaN`. The host-resolved numeric id is now threaded through as `romRoomId` for both trees. |
| 2.3 no loading state | Map area shows a "decoding ROM map…" badge and dims while the host renders. |
| 2.4 invisible failures | Render/decode errors now surface as an in-panel banner reusing the existing `rs-error` pattern, not just `console.warn`. |
| 2.5 no legend | The ROM MAP DATA section lists a swatch per elevation plane present, plus drift / object / grass keys. |
| 2.7 link asymmetry | Section header states the rows are decoded ROM bytes with no source lines. |
| 2.8 re-transfer on every switch | Webview caches overlays by `roomId:layer` (16 entries) and skips the round trip on a hit. |
| 1.3 fills vs contours | Both styles ship; contour (upstream's style) is the default, `solid` toggles fills. Contour is also ~7x smaller in path data. |
| 1.6 patched-ROM behaviour | `decodeRoom` validates room id, ROM size, pointer target and the section chain, failing with a specific message instead of decoding garbage. Still not *tested* against a real patched ROM — see below. |
| 1.7 no unit tests | `tests/memory/map-units.test.js` — 33 assertions covering palette expansion, bitplane weighting, flips, CHR mode 1, collision bitfield semantics, grass parsing, compositing priority and PNG structure. Runs without a ROM. |
| 1.8 no export | `Everscript: Export Room Maps as PNG` — single room or all 127, any layer, with progress and cancellation. |

## Open gaps

| Gap | State |
|---|---|
| 1.1 write path (`encode_room.py` → TypeScript) | **Closed since this page was written:** `src/games/evermore/maps/encode.ts` / `encode-streams.ts` exist and a custom map exports as a playable ROM ([rom-export.md](map-format/rom-export.md), [map_editor_architecture_and_limitations.md](map-format/map_editor_architecture_and_limitations.md)). Writing a draft into a vanilla room's own slot is still open ([todo/map-editor.md](todo/map-editor.md)). |
| 1.4 / 2.6 animated tiles | Closed in v0.15.0 (see above). |
| 1.5 CGRAM palette cycling | Unresearched for the *map renderer*; no evidence it uses it. Palette cycling exists as a script opcode ([opcode-b6-palette-cycle.md](disassembly/script-vm/opcode-b6-palette-cycle.md)), a different mechanism. |
| 1.6 patched / non-vanilla ROMs | `decodeRoom` validates room id, ROM size, pointer target and the section chain, but it is not *tested* against a real patched ROM. `parseBlobLayout` walks offsets deterministically and has no fallback if a patch changes section framing, relocates the map pointer table or adds a 128th room. Needs an answer before the editor targets a ROM the user is actively patching ([table-hack.md](table-hack.md)). |
| 2.9 world / area overview | Not started. The Rooms tab shows one room at a time; `[area]` groupings and adjacency are only a nested list. |
| 2.10 compare / diff view for a modified room | Not started. Mostly a rendering-and-highlight problem now that a structured model exists for both ROMs. |

Everything else in the original Part 1 (format port) and Part 2 (Rooms tab UX) is closed; the outcomes are
in the "Closed in v0.x" tables above. The original diagnoses (1.1, 1.3, 1.4–1.8, 2.1–2.10 and the
priority list) are archived in `docs/archive/2026-11/map-port-gap-analysis-closed-parts.md` (see
[archive/INDEX.md](archive/INDEX.md)).

What was verified when this page was written: `src/games/evermore/maps/` decodes all 127 vanilla rooms
identically to `everscript`'s `tools/dump_room.py` (`npm run check:maps`, `MAP_PARITY_ALL=1`) and renders
nine sample rooms pixel-identical to `tools/render_map.py` (`checkRenderParity`), up to 2048×1120.

---

## Lesson kept: gap 1.2

### 1.2 ~~`render_map.py`'s annotation system is not ported~~ — CLOSED v0.11.0

**This section was wrong, and it is left here because the reasoning is worth
not repeating.** It argued that the annotation system should stay unported
because the Rooms tab's overlays "need to stay interactive and zoomable."
What actually happened: the hand-drawn SVG substitute was missing features
outright (entity gates were simply absent), and its own paragraph below
conceded the real cost — *"there is no parity test for them, because there is
nothing upstream to compare against."* An unverifiable approximation of a
verified implementation is the exact failure mode the `map-format` skill
exists to prevent, and "it stays interactive" did not survive contact with
what the interactivity was worth: a worse-looking map.

The port covers every pass: per-plane contours, drift arrows, plane-transparent
and elevation-change washes, entity gates, cuttable grass, object stamps,
trigger boxes and the 3x5 index labels. `checkOverlayParity` holds it to a zero
pixel budget. Interactivity did not have to be traded away — the SVG layer
still carries hover, tooltips and jump-to-source on top of the raster, and
drops its own trigger paint when the baked boxes are showing.

Two pieces are deliberately still not baked: the header banner and the bottom
legend. Upstream grows the PNG to fit them, which would break the raster's
registration with the SVG overlay and make the text unreadable at fit zoom.
`buildSummary()` and `buildLegend()` return that content as data and the
webview renders it as HTML — same information, legible at any zoom.
