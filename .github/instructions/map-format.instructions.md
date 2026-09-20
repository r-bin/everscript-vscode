---
name: map-format
description: Use before touching ROM map/room decoding in src/maps/, tools/generate_data.py, or anything that reads Secret of Evermore room/tilemap bytes in everscript-vscode. The sibling everscript repo already has a verified, byte-exact implementation of this format — read this before writing or extending a second one.
applyTo: "src/maps/**,tools/generate_data.py,src/language/data/index.json"
---

# Skill: Map Format — Use the Authoritative Implementation, Don't Re-derive It

`everscript-vscode` has, twice now, independently re-derived domain logic that the
sibling `everscript` repo (the compiler) already solved correctly and verified
byte-exact. Both times the re-derivation was weaker than the original. This skill exists
so a third instance doesn't happen — read it **before** writing or extending ROM
map-decoding logic, or the `.evs` language-data generator.

## The two known instances (do not repeat this pattern a third time)

1. **`src/maps/map-pipeline-model.js`** — a sentinel/`strict7`/`short6` heuristic scan
   for locating compressed map blocks in ROM. It works on a handful of simple rooms and
   **explicitly fails on room `0x38`**. The `everscript` repo's `tools/dump_room.py` /
   `tools/encode_room.py` decode **all 127 rooms byte-exactly** (verified via
   `encode_room.py --verify`), including headers, trigger tables, tile families,
   metatile grids, collision words, and cuttable grass — the full format, not a subset.
   **Do not extend the sentinel model further.** If a map/room decoding need comes up,
   the answer is almost always "call the real decoder," not "improve the heuristic."
2. **`tools/generate_data.py`** (in this repo) — regexes `in/core/*.evs` by hand
   (`r'^enum\s+(\w+)\s*\{'`, `r'^fun\s+(\w+)\s*\(([^)]*)\)'`) to produce
   `src/language/data/index.json` (hover docs / completion data). This is a second,
   independent, weaker guess at the same grammar `everscript`'s `compiler/lexer.py` +
   `compiler/parser.py` (a real `rply` LALR(1) grammar) already implement correctly. It
   silently drifts from `in/core/` because nothing wires it into a build step.

The TextMate grammar (`src/language/syntaxes/everscript.tmLanguage.json`, see the
`grammar-rules` skill) is a deliberate, correct exception — it has to be a fast
synchronous regex grammar for paint-every-keystroke highlighting, and reuse of the real
parser was explicitly evaluated and rejected for that specific case (see
`docs/vscode-highlighter-spec.md §Grammar Strategy`). The rule here is about decoding
*data* (ROM bytes, declarations), not about baseline syntax highlighting.

## Planned direction: a map-server bridge, not a bigger JS decoder

The migration plan (written in the `everscript` repo — see "Where the full plan lives"
below) calls for `src/maps/` to stop trying to decode ROM bytes itself and instead call
into `everscript`'s verified Python implementation:

- The map format's ground truth lives in `everscript`'s `tools/dump_room.py`,
  `encode_room.py`, `collision.py`, `cuttable_grass.py`, `render_map.py` — pure Python,
  standard library only (zero third-party dependencies as of the plan being written).
- The intended shape is a spawned **map-server** process, not a library import (this
  extension is JS/TS in the extension host; the ROM-format logic stays Python because
  that's where the correct implementation is — not a language preference).
- **Reuse the existing spawn pattern**, don't invent a new one: `src/extension.js`
  already spawns `everscript.py` via `child_process.spawn` with newline-delimited
  output for the "Build and Run" command (~line 836). The map-server bridge should look
  like that, not like a new IPC mechanism.
- **Reuse the existing settings**, don't invent a second `repoPath`/`pythonPath`:
  `src/shared/config.js` already resolves `everscript.repoPath`, `everscript.romPath`,
  and `everscript.pythonPath`, consumed today by `src/rooms/`. Any map-server bridge
  code resolves the `everscript` checkout and Python interpreter through that same
  config, not a new setting.
- Transport/packaging (JSON-RPC via `vscode-jsonrpc` vs. hand-rolled newline JSON vs. a
  PyInstaller-frozen binary bundled in the `.vsix`) and repo placement (one repo vs. two)
  are **open decisions, not yet made** — don't assume a specific answer landed. Check
  `everscript`'s `docs/map_editor_vscode_plan.md` §3 and §5.3 for the live state before
  building the bridge.
- `tools/generate_data.py` has the same fix shape: spawn the same kind of process and
  drive the real `compiler.lexer` / `compiler.parser`, instead of regexing
  `in/core/*.evs` by hand. Wire the result into a build step so `index.json` can't
  silently go stale.

## What this means for `src/maps/` today, before the bridge exists

- Keep the header/trigger-table reading in `src/maps/` if an equivalent isn't yet
  available client-side — don't delete working code pre-emptively.
- Do **not** add new heuristics, new sentinel patterns, or "one more special case" to
  `map-pipeline-model.js` to handle a room it currently fails on. That's exactly the
  kind of incremental deepening of a known-weaker implementation this skill exists to
  stop. Prefer: flag it as a candidate for the map-server bridge instead of patching
  around it locally, unless the user explicitly asks for the sentinel model to be fixed.
- `map-blob-evidence-model.js` and `map-pipeline-model.js` are "evidence accumulation" —
  useful for *investigating* the format, not as a permanent parallel implementation.

## New domain, when the bridge lands

A map-editor / map-server bridge is a new ownership domain, sibling to `src/debugger/`,
`src/rooms/`, `src/emulator/`, `src/language/` — not yet created. Before writing code
against it: add it to `AI_ARCHITECTURE_GUIDE.md`'s ownership-domain list and to
`docs/architecture/domain-overview.md`'s per-domain "Allowed deps" table, the same way
the existing domains are documented (see the `isolate-subsystem` skill). The dependency
direction is fixed regardless of implementation details still being decided: **the
extension depends on the compiler/map-server, never the reverse.**

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
