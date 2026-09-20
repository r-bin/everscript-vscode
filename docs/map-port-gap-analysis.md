# Map Data Port & Rooms Tab UX — Gap Analysis

> Status: living document, last updated 2026-09-20 (post v0.9.0).
> See the `map-format` skill before acting on anything here — it has the
> "port, don't re-derive" ground rules this document assumes.

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
- **1.2** — unchanged by design: the extension keeps its own interactive SVG
  overlays rather than porting the bitmap annotation system. 1.3 narrows the
  visual gap; the rest stays deliberate.
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

### 1.2 `render_map.py`'s annotation system is not ported — by design, not oversight

Roughly two-thirds of `render_map.py` is `render_collision_overlay`: per-plane
contour outlines (not fills — see 1.3), drift/gate/transition tile
classification baked into a bitmap, object and trigger box labels, a header
banner, and a bottom legend. `src/maps/` intentionally does not port this —
see `render.ts`'s scope and the `map-format` skill. The Rooms tab draws its
own SVG overlays instead (`tile-overlay.js`), because they need to stay
interactive and zoomable, not be baked into a raster image.

**What this means concretely:** the extension's collision/drift/object
overlays are *not* validated against upstream the way the decoder and
compositor are — there is no parity test for them, because there is nothing
upstream to compare against pixel-for-pixel. If they diverge from what
`render_map.py --composition` shows (contour style, colors, what counts as
"drift"), that's a design choice to confirm with the user, not a bug to fix
by matching bytes.

### 1.3 Collision overlay draws fills, upstream draws contour outlines

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
