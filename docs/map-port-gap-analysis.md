# Map Data Port & Rooms Tab UX — Gap Analysis

> Status: living document, last updated 2026-09-20 (post v0.14.0).
> See the `map-format` skill before acting on anything here — it has the
> "port, don't re-derive" ground rules this document assumes.

## Closed in v0.12.0

| Gap | Outcome |
|---|---|
| Grid misaligned with the map | **Confirmed real, 54 of 127 rooms.** A trigger at the map edge widens the SVG viewBox past the map (`x2 = sx+sw+1`), and the map image was a CSS-stretched `<img>` filling the canvas — so it was scaled to the widened box and the grid drifted 1–3% across the map (up to 3.3% on 0x10). The image is now an SVG `<image>` placed at the map's own extent in viewBox units, sharing one coordinate system with the grid, so it cannot drift. Regression-tested. |
| No export of the current view | `export png` in the top bar saves exactly what is on screen — same layer, same overlay flags — via a save dialog. Distinct from `everscript.exportRoomMaps`, which asks for scope and layer up front. |
| No pinch zoom | Trackpad pinch (a `ctrlKey` wheel event in Chromium) zooms anchored on the cursor, so the map does not walk away from what you were looking at. The zoom buttons now anchor on the viewport centre for the same reason. |
| Objects listed as a flat table | Replaced by a collapsible browser. Superseded in v0.13.0 by a linked list — see below. |

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

Still open, and why:

- **1.1 (write path)** — untouched. It is the largest single item here (922 lines
  of encoder plus its own byte-exact parity harness) and delivers nothing
  user-visible without an editing UI on top, so it wants to be its own piece of
  work rather than a tail end of this one.
- **1.4 / 1.5 / 2.6 (animation)** — still blocked on upstream research. No
  `docs/map-format/*.md` documents the animation frame table or whether CGRAM
  cycling is used at all. Porting cannot start before that exists.
- **1.2** — closed in v0.11.0, the opposite way round from what this section
  originally argued. See the v0.11.0 table above.
- **1.6 verification**, **2.9 (world overview)**, **2.10 (diff view)** — not
  started.

What's already true, verified: `src/maps/` decodes all 127 vanilla rooms
identically to `everscript`'s `tools/dump_room.py` (`npm run check:maps`,
`MAP_PARITY_ALL=1`), and renders them pixel-identical to `tools/render_map.py`
across 9 sample rooms up to 2048×1120 (`checkRenderParity` in the same test).
That is the floor this document builds on — everything below is what's still
missing for a *complete* port and for the Rooms tab to be a genuinely good
map-editing tool, not a bug list against what's already shipped.

Two independent axes, and they don't move together: a change can close a
format-fidelity gap without improving the user's day-to-day experience, or
vice versa (e.g. a loading spinner improves UX without touching the decoder
at all).

---

## Part 1 — Format/data port completeness

### 1.1 The write path is entirely unported

`encode_room.py` (922 lines: LZSS/Markov encoders, the never-grows guarantee,
`--verify-rebuild` round-trip proof) has no TypeScript counterpart. Nothing in
this repo can turn an edited room model back into ROM bytes. This is the
single largest gap: **everything today is read-only.** Any feature described
as "map editor" rather than "map viewer" is blocked on this.

Porting it is the same shape of work as the decoder, with a higher bar: a
faithful port needs its own parity harness proving `encodeRoom(decodeRoom(rom,
id)) === originalBlobBytes` for byte-for-byte, not just "renders the same,"
because a rebuilt blob that's even one byte too long overflows into the next
room's data.

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

### 1.3 ~~Collision overlay draws fills, upstream draws contour outlines~~ — CLOSED v0.10.0

`render_map.py`'s default collision mode is **contour lines** — a 1-2px edge
where solid meets open, per plane, so overlapping elevation levels read as
crossing outlines rather than stacked colored blobs (see the docstring at
`render_map.py` `render_collision_overlay`, point 2). The extension currently
fills every solid/partial tile with a translucent color instead. On a
single-plane room this looks similar; on a multi-plane room (0x06, 0x1b, ...)
upstream's contour approach and the extension's fill approach will look
noticeably different, and only one of them has been eyeballed against the
actual game rendering. Worth a deliberate decision, not a default.

### 1.4 Animated tiles render as a single static frame

Both the Python original and the TypeScript port add `animated_tiles` (the
Section 2 descriptors) to the tile lookup pool but never cycle them — a
waterfall or torch tile decodes to whichever single graphic its VRAM word
currently points at. This is upstream parity, not a regression, but it means
neither implementation shows what the tile actually looks like in motion.
Fixing it needs the animation *rate and frame table*, which — as far as this
document's research found — no `docs/map-format/*.md` describes yet. That's
upstream research, not a porting task.

### 1.5 No CGRAM palette animation (water/lava color cycling)

Real SNES rendering of water, lava, and similar effects uses palette-index
cycling (the same 16 colors, reassigned to different RGB values over time),
not tile swapping. Neither `render_map.py` nor the port touch this — palettes
are extracted once and treated as static. Unresearched: whether Secret of
Evermore uses this technique at all, and if so, which color slots and rooms.

### 1.6 Untested against non-vanilla / patched ROMs

Every verification so far (`check:maps`, the render comparison, all 127-room
sweeps) runs against the stock retail ROM. `parseBlobLayout`'s deterministic
offset-walking has no fallback if a patch changes a room's section framing,
relocates the map pointer table, or adds an 128th+ room. The extension's own
`patches/` / `scale_enemies` detection (`src/shared/config.js`,
`detectScaleEnemies`) exists for *script* behavior, not map data — nobody has
checked whether any shipped or hypothetical map-editing patch would break
`decodeRoom`'s assumptions. If `src/map-editor/` (see the `map-format` skill's
"planned domain" section) is ever built against a ROM the user is actively
patching, this needs an answer before it needs a UI.

### 1.7 New TypeScript modules have no unit-level tests, only end-to-end parity

`palette.ts`, `chr.ts`, `render.ts` are covered exclusively by comparing final
pixels against Python output (`map-parity.test.js`). That test is strong
evidence the *whole pipeline* is correct, but there's no test asserting, in
isolation, "color index 0 is always transparent," "hflip mirrors exactly,"
or "mode-2 CHR decompression handles all 16 nibble commands" — so a future
refactor could introduce two compensating bugs that still pass the end-to-end
diff by coincidence on the sampled rooms, and only fail on an unsampled room
or after `MAP_PARITY_ALL=1` is run. Low risk today (127/127 passes), but a
real gap in test *design*, not just coverage.

### 1.8 No export path out of the extension

`tools/render_map.py --all-rooms -o out/maps` batch-exports every room as a
PNG from the command line. The extension can only display one room's render
inside a webview `<img>` — there is no "save this room as an image" command,
and no way to batch-export from inside VS Code. Anyone wanting the PNGs today
still needs to run the Python tool directly.

---

## Part 2 — Rooms tab user experience

### 2.1 The render cache never invalidates when the ROM changes

`tile-overlay.js` exports `invalidateRoomRenders()`, but **nothing calls it.**
`src/shared/rom-readers.js`'s `loadRomBuffer()` correctly detects a changed ROM
by mtime and returns a fresh buffer — but `tile-overlay.js`'s own render cache
is keyed only by `roomId:layer`, not by ROM identity, so after the user runs
"Build and Run" (`everscript.buildAndRun`) and recompiles a modified ROM, the
Rooms tab keeps serving the **stale pre-rebuild render** indefinitely, with no
visible sign anything is wrong. This is the single biggest correctness gap for
anyone actually iterating on map data — it makes the map view actively
misleading rather than merely incomplete. Wiring `invalidateRoomRenders()`
into the `buildAndRun` command handler (or keying the cache by ROM mtime, the
same way `loadRomBuffer` already does) is a small, high-value fix.

### 2.2 The ROM render likely never activates for Live (author's own) rooms

The Rooms tab has two trees: **Vanilla** (the 127 reference rooms, built from
`VANILLA_ROOMS`) and **Live** (parsed from the user's currently-open `.evs`
project). The new ROM overlay is gated on `roomVanillaIdNum(room)`, which
expects `room.vanillaId` to already be a hex-parseable value. For Live rooms,
`file-scanner.js` resolves the numeric ROM room id via
`getMapEnum(wsRoot).get(vid)` into a separate `roomNum` — `vid` itself looks
like it may be a symbolic enum name, not a hex string. If that's right, the
render/collision/object overlays added in v0.8.x silently never trigger for
the primary "author is editing their own map" workflow, only for the
reference Vanilla tree. **This needs verification against a real
`in/core/`-style project**, not just the vanilla-ROM testing this feature
shipped with — it wasn't caught because there's no test project with Live
rooms in this repo.

### 2.3 No loading state during the render round trip

Selecting a room fires `requestRoomTiles` and waits for an async
`roomTiles` reply. Cold renders measured 4-150ms depending on room size in
isolated benchmarking, but that was Node calling the decoder directly — the
real path adds IPC serialization of a multi-hundred-KB base64 image over
`postMessage`, decode-side ROM loading, and webview paint. There is no
placeholder, spinner, or skeleton state between clicking a room and the map
appearing; on a slow machine or the largest rooms (2048×1120 renders ~700KB+
of PNG), the map area will look empty or frozen with no feedback that
anything is happening.

### 2.4 Render/decode failures are invisible

If the ROM can't be found, or `decodeRoom`/`renderRoomComposite` throws (e.g.
from gap 1.6 — an unexpected ROM shape), the failure surfaces only as a
`console.warn` in the webview devtools console
(`bootstrap.js`'s `roomTiles` handler). The room panel already has an explicit
`roomError` banner pattern for missing-ROM / parse-failure cases in the
existing header/trigger code path (`c.roomError`) — the new overlay path
doesn't reuse it, so a user who hasn't opened devtools has no way to know
*why* the map isn't showing.

### 2.5 No visual legend for what the overlay colors mean

Plane colors (blue/red/green/purple), the drift-tile fill, and the grass tint
are documented in code comments and in this repo's skills, but nowhere in the
UI itself. A first-time user toggling `collision` sees colored shapes with no
key explaining "red = plane 1," `drift` sees dots with no explanation of what
drift means, etc. The existing `title=` tooltips on the filter buttons help,
but only for someone who hovers before clicking.

### 2.6 No animated-tile playback (see 1.4) means the map looks inert

Independent of whether the *data* gets animated (1.4), even a fixed frame that
visually differs from a "resting" tile would help — right now every torch,
waterfall, and similar effect tile shows whatever single VRAM frame happened
to be assigned, with no indication in the UI that it's one frame of a moving
effect.

### 2.7 No cross-linking from ROM-derived data back to source

The existing trigger tables link back to `.evs` source lines
(`data-line="N"`, "go to code"). The new ROM MAP DATA / ROM OBJECTS tables
added in 0.8.1 have no equivalent, because ROM objects and collision data are
compiled artifacts with no direct line in the user's source to jump to (this
is architecturally correct, not a bug — a Section 3 object doesn't come from
one `.evs` line). Still worth flagging as an asymmetry a user will notice:
some tables in the same panel are clickable, some aren't, with no visual
distinction explaining why.

### 2.8 Every layer/room switch re-transfers the full image

Toggling between `composite`/`layer1`/`layer2`, or switching rooms, sends a
fresh base64 PNG over `postMessage` every time — even back to a room+layer
combination the webview displayed a moment ago. The host caches the *encoded*
render (`RENDER_CACHE`, 24 entries), so re-encoding is skipped, but the
full payload still crosses the IPC boundary again. For the largest rooms this
is several hundred KB per switch. A webview-side image cache keyed by
`roomId:layer` (skip the round trip entirely on a cache hit) would remove
this for the common "flip back and forth between two layers" interaction.

### 2.9 No world/area overview

The Rooms tab shows one room at a time. There's no stitched multi-room map
showing how rooms connect (relevant given `src/rooms/` already parses
`[area]` groupings and room adjacency isn't currently visualized spatially at
all, only as a nested list). Out of scope for the current decoder work, but
the natural next "perfect UX" ask once single-room rendering is solid.

### 2.10 No compare / diff view for a modified room

Once map editing exists (1.1) — or even now, for a user who's hand-patched
ROM bytes outside this extension — there's no "show what changed vs. stock"
view. Given the decoder already produces a structured model for both an
original and a modified ROM, a diff view is mostly a rendering-and-highlight
problem once 1.1 exists, not a new decoding problem.

---

## Suggested priority if this list gets worked

Roughly in "most user-facing damage per unit effort" order, not a committed
plan:

1. **2.1** (stale cache after rebuild) — small fix, actively misleading today.
2. **2.2** (Live-room activation) — needs verification first; may already be
   fine, or may mean the shipped feature doesn't reach its main use case.
3. **2.4** (visible error state) — small, reuses an existing pattern.
4. **2.3** (loading state) — small, standard webview UX.
5. **1.1** (write path) — large, but it's the gate on "map editor" as opposed
   to "map viewer," which is the more valuable framing of this whole feature.
6. Everything else, roughly in the order listed.
