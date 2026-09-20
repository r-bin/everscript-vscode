---
name: map-format
description: Use before touching ROM map/room decoding in src/maps/, tools/generate_data.py, or anything that reads Secret of Evermore room/tilemap bytes in everscript-vscode. src/maps/ is a TypeScript port of the sibling everscript repo's verified decoder — port and validate against it, never re-derive it.
applyTo: "src/maps/**,tools/generate_data.py,src/language/data/index.json,src/rooms/rendering/tile-overlay.js"
---

# Skill: Map Format — Port the Authoritative Implementation, Don't Re-derive It

`everscript-vscode` twice independently re-derived domain logic that the sibling
`everscript` repo (the compiler) already solved correctly and verified byte-exact. Both
times the re-derivation was weaker than the original. Read this **before** writing or
extending ROM map-decoding logic, or the `.evs` language-data generator.

**The distinction that matters:** a *faithful port*, validated against the original's
own output, is fine and is what `src/maps/` now is. An *independent re-derivation*
("I'll work out the format from the bytes") is what failed twice. Porting is allowed;
guessing is not.

## Current state: src/maps/ is a validated TypeScript port

`src/maps/*.ts` ports `everscript`'s `tools/dump_room.py`, `collision.py` and
`cuttable_grass.py`. `npm run check:maps` decodes rooms with both implementations and
diffs them; it passes on **all 127 rooms**, including `0x38` (which the retired decoder
failed on) and `0x15` (uncompressed Block 3). Any change to the decoder must keep that
green — run it with `MAP_PARITY_ALL=1` for the full sweep.

The root `tsconfig.json` is typecheck-only, so this domain has its own emit config
(`tsconfig.maps.json` → `src/maps/dist/`, via `npm run build:maps`). Consumers
`require('../maps')`, which is a thin JS facade over the compiled output.

`render_map.py`'s graphics pipeline is ported too (`palette.ts`, `chr.ts`, `render.ts`):
palettes, CHR decompression, 4bpp planar decoding, and Mode 1 compositing. Its output is
**pixel-identical** to the Python renderer, and `npm run check:maps` verifies that by
dumping raw RGBA from both sides — so neither PNG encoder can hide a difference.

## The two original instances (do not repeat this pattern a third time)

1. **The sentinel decoder** — a `strict7`/`short6` heuristic scan for locating
   compressed map blocks, which worked on a handful of simple rooms and **failed on room
   `0x38`**. Now shelved in `sandbox/maps/` (`map-pipeline-model.js`,
   `map-blob-evidence-model.js`) as exploration-only, out of the extension's runtime
   path. **Do not revive or extend it** — `src/maps/` supersedes it.
2. **`tools/generate_data.py`** (in this repo) — regexes `in/core/*.evs` by hand
   (`r'^enum\s+(\w+)\s*\{'`, `r'^fun\s+(\w+)\s*\(([^)]*)\)'`) to produce
   `src/language/data/index.json` (hover docs / completion data). This is a second,
   independent, weaker guess at the same grammar `everscript`'s `compiler/lexer.py` +
   `compiler/parser.py` (a real `rply` LALR(1) grammar) already implement correctly. It
   silently drifts from `in/core/` because nothing wires it into a build step. **Still
   unfixed** — the same port-or-bridge choice applies when someone takes it on.

The TextMate grammar (`src/language/syntaxes/everscript.tmLanguage.json`, see the
`grammar-rules` skill) is a deliberate, correct exception — it has to be a fast
synchronous regex grammar for paint-every-keystroke highlighting, and reuse of the real
parser was explicitly evaluated and rejected for that specific case (see
`docs/vscode-highlighter-spec.md §Grammar Strategy`). The rule here is about decoding
*data* (ROM bytes, declarations), not about baseline syntax highlighting.

## Working on the decoder

- **Validate every change**: `npm run check:maps`, and `MAP_PARITY_ALL=1 npm run
  check:maps` for all 127 rooms. The harness skips (does not fail) when the ROM or the
  `everscript` checkout is missing, so a green run on a machine without them means
  nothing — check the output says rooms were actually compared.
- **Port, don't invent.** If the decoder is wrong for some room, the fix is in the
  Python original's logic, not a new heuristic. Read the corresponding `tools/*.py`
  function and the docs in `docs/map-format/`.
- If you fix a genuine format bug, fix it **upstream too** — `everscript`'s copy is the
  authoritative one and its `rom-map-data` skill says as much.
- Grids are numbers, never hex strings. Format at render time.
- Never hand-decode a collision word; use `passability()`, `tilePlane()`,
  `driftVector()`, `entityGate()` from `src/maps/collision.ts`.

## Where the extension consumes it

- `src/rooms/rendering/tile-overlay.js` renders the room to a PNG data URI and builds
  the collision overlay as SVG paths grouped by fill colour (a 128x70 room is 8960
  tiles, so per-tile DOM nodes are not an option). It caches the 12 most recent renders:
  ~146ms cold for the largest room, ~2ms warm.
- `src/extension.js` handles a `requestRoomTiles` message from the Rooms tab webview and
  replies with `roomTiles`. Decoding is **on demand per selected room**: the rooms tree
  JSON carries no tile data, because 127 rooms of it would bloat every render.
- `src/shared/rom-readers.js` `loadRomBuffer()` caches the ~3MB ROM by path+mtime.

## Still Python-only upstream

**`encode_room.py` — the write path**, with its LZSS/Markov encoders and the
never-grows guarantee. Nothing in this repo can write a room back to ROM. Anything
map-*editing* needs that ported (and validated the same way: `--verify` round-trips all
127 rooms upstream, so parity is checkable) or reached over IPC.

Also unported from `render_map.py`: the annotation layers (per-plane contour outlines,
drift arrows, object stamps, trigger boxes, labels, legend banner) — roughly two thirds
of that file. The extension draws its own overlays in SVG instead, because they need to
stay interactive and zoomable rather than being baked into a bitmap.

`everscript`'s `docs/map_editor_vscode_plan.md` §3.2 recommends keeping ROM logic in
Python behind IPC. This repo went the other way for the read path, because a validated
port removes the Python runtime dependency for extension users. That reasoning applies
to the write path too, but the decision is not made — don't assume it.

## If a map-editor domain is added later

It would be a new ownership domain, sibling to `src/debugger/`, `src/rooms/`,
`src/emulator/`, `src/language/`. Before writing code against it: add it to
`AI_ARCHITECTURE_GUIDE.md`'s ownership-domain list and to
`docs/architecture/domain-overview.md`'s per-domain "Allowed deps" table, the same way
the existing domains are documented (see the `isolate-subsystem` skill). If it spawns
anything Python, reuse `src/shared/config.js`'s existing `everscript.repoPath` /
`pythonPath` resolution and the `child_process.spawn` pattern `src/extension.js` already
uses for "Build and Run" — don't invent a second of either.

## Related, not blocking, but worth knowing before building on top of them

- `src/rooms/`'s room-script disassembly (`src/emulator/room-script-model.js`'s
  `OPCODE_REGISTRY`) doesn't yet decode the variable-length "calculator"
  sub-instruction format. If map-editor work wires a trigger to its script, check
  `docs/rooms-settings-cleanup-dossier.md` (status: in progress) first rather than
  assuming the disassembly is complete.
- `src/debugger/mock-runtime.js` is a mock — "No actual bytecode execution" per its own
  header comment. If a map-editor feature wants a *live, debuggable* script view (not
  just static source navigation), that needs the mock runtime to become real first;
  treat that as separate, larger, unstarted work, not a dependency assumed to already
  exist.

## What's still missing

`docs/map-port-gap-analysis.md` tracks this in detail: format-fidelity gaps
(the unported write path, unported annotation rendering, untested patched-ROM
behavior) separately from Rooms tab UX gaps (a render-cache invalidation bug,
whether the overlay activates for Live/author rooms at all, missing
loading/error states). Read it before assuming a gap doesn't exist, and update
it when you close one.

## Where the full plan lives

This skill is the pointer, not the plan. The actual reasoning, alternatives considered,
and open TODOs live in the sibling `everscript` repo (same parent directory as this
repo, path resolved via `everscript.repoPath` if not literally adjacent):
- `docs/map_editor_design.md` — the original design doc (repo placement, extend vs.
  fork, editor architecture)
- `docs/map_editor_architecture_and_limitations.md` — architecture and known
  limitations
- `docs/map_editor_vscode_plan.md` — repo placement, lexer/parser reuse, IPC/packaging
  options, and what in `everscript-vscode` needs redoing (this skill summarizes its §1,
  §2, and §4.1)
- `.github/skills/rom-map-data/SKILL.md` — the authoritative index of the ROM map
  format itself (room header, trigger tables, compression pipeline, collision bitfield)
- `.github/skills/map-tooling/SKILL.md` — the practical runbook for
  `dump_room.py`/`encode_room.py`/`render_map.py`/`collision.py`/`cuttable_grass.py`

If those documents and this skill ever disagree, the `everscript` documents win — they
describe the authoritative implementation; this skill is a summary for
`everscript-vscode` work and can go stale independently.
