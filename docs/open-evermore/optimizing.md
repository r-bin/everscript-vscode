# Open Evermore: making explode and implode faster, easier and clearer

Status: **measured and planned (2026-11-25, v0.470.0); nothing here is built yet.** Back to [README.md](README.md).
Labels as there: *(repo)* = measured or exists today, *(proposal)* = a change to make.

What the tool costs today, where the time goes, and what to change, in three parts: performance (§2), usability
(§3) and readability (§4). Every change keeps the laws of [tool.md](tool.md) §4: explode is lossless, the hard rule,
G0 under `--strict`, the round trip on every implode that may move or change something.

---

## 1. The numbers *(repo)*

A fresh US tree on an Apple M4, Node 26, `dist/` built; `node --cpu-prof`, so each figure is ±10 %.
The tree: 36,792 files, 39 MB (`maps/rooms` 18.6 MB, `_base/_base.json` 4.4 MB, `sprites/metasprites` 4.2 MB).

| Run | Wall | Peak memory | Where the time goes |
|---|---:|---:|---|
| `explode` | 7.5 s | 0.5 GB | codecs 4.3 s (maps 1.4, strings 1.2, animations 0.4, tiles 0.3, knowledge base 0.5), `writeTree` 2.0 s (one `mkdirSync` + one `writeFileSync` per file), `json()` 0.6 s |
| `implode --check-only` | 3.9 s | — | `readTree` 1.1–1.6 s, names and enums, encode (strings 1.0 s) |
| `implode --strict` (unchanged) | 13.7 s | 1.3 GB | the above, build < 0.5 s, **round trip 9 s**: explode again 3.9 s, `canonical` + `json()` reformatting of both trees 4.8 s |
| `implode --random 42` | 14.4 s | 1.3 GB | as `--strict` |
| `prove --random <seed>` | ~1 min | — | two implodes, then the playbacks in lockstep ([tool.md](tool.md) §4.1) |

The hot spots, by what they cost an implode:

1. **The round trip compares every file through `canonical` and `json()`** (`implode.mts` `strip`): 4.8 s.
   `json()` (`tree.mts`) is ~28× slower than `JSON.stringify` (668 ms against 24 ms over the tree's 9,387 JSON files):
   `format` calls `inline(v)` on a node and again on each child, so a deep file is stringified once per level.
   The round trip calls it up to five times a file (the codec's `canonical`, `withoutKeys`, `tidy`, both trees).
2. **The round trip re-explodes everything** (3.9 s), even kinds where nothing moved and nothing changed.
3. **The strings encoder** (`strings.mts` `encode`, 1.0 s a call): at every position of a string it tries every
   dictionary entry with `every`. It runs in explode (is the vanilla encoding the shortest?), in implode's encode, and
   in the round trip's explode: ~3 s of an implode.
4. **File I/O**: `readTree` stats and reads 36,792 files one after another (1.1–1.6 s); `writeTree` creates the
   folder of every file again (2.0 s) and rewrites files whose bytes did not change.
5. **The knowledge base is parsed per process** (`readers.mts` `routines` → `knowledge.js entries`, 0.5 s).

---

## 2. Performance *(proposal)*

Ranked by what they save on the common run (an implode of a tree with a few edits). Targets: explode ≤ 4 s,
implode of an unchanged or slightly edited tree ≤ 4 s, `--random` ≤ 8 s.

| # | Change | Saves | Why it is safe |
|---|---|---:|---|
| P1 | **Raw bytes first in the round trip**: compare each file's bytes (`Buffer.equals`) and call `canonical` only for files that differ. A re-explode gives back most files byte for byte | ~4 s | `canonical` exists to forgive differences; identical bytes need no forgiving |
| P2 | **Compare canonical forms as `JSON.stringify`**, not `json()`: the comparison needs a stable serialisation, not an indented one (`tidy`, `withoutKeys` and the codecs' `canonical` return parsed values or compact text) | ~3 s of what P1 leaves | `json()` and `JSON.stringify` keep the same key order |
| P3 | **`json()` in one pass**: `inline` with a budget (stop building once past `line` characters), so each node is visited once | 0.5 s explode, the rest of implode | output byte-identical: test against today's `json()` on a fresh tree |
| P4 | **Skip the round trip when it proves nothing new**: `--strict`, no seed, the sha1 is vanilla's (G0) and every file's sha1 equals what explode wrote (explode records them in `_base/`) | ~9 s on an unchanged tree | then the re-explode is the original explode, file for file. An edit that implode ignores (a field it does not read) changes a file's sha1, so it still gets its round trip and its `round-trip` error |
| P5 | **A faster strings encoder**: the dictionary indexed by its first token (a `Map` of candidate entries per character), and a per-run memo text → bytes | ~2.5 s implode, ~1 s explode | the same dynamic programming over the same candidates: the same bytes. `g0.test.mts` and the strings round trip prove it |
| P6 | **Round trip per kind**: re-explode only the kinds that have a changed, moved or reordered item, or whose tables point at one (every kind on a `--random` build) | 1–3 s on a small edit | a kind whose items and tables are all as explode left them explodes to the same files (it is the same bytes at the same places) |
| P7 | **Write only what changed**: `writeTree` compares before writing and creates each folder once; `readTree` reads with `fs.promises` in parallel (bounded, ~64 at a time) | ~1.5 s explode, ~0.7 s implode | also spares the SSD and keeps editors' file watchers quiet on `--force` |
| P8 | **The knowledge base once**: parse its entries lazily and cache them in a module-level map (or a JSON next to `dist/` written by `build:ts`) | 0.5 s each | read only |
| P9 | **Less memory**: the round trip holds the tree, its re-explode and two stripped copies (1.3 GB). Strip and compare file by file instead of building two stripped trees | ~0.6 GB | the same comparison, streamed |

Later, for the editor's one click ([roadmap.md](roadmap.md) §5.3), **incremental implode**: keep each kind's encoded
items keyed by the sha1 of the files it read (`names`, `encode`), re-encode only kinds whose inputs changed, and keep
a warm process (`open-evermore.mts serve`, or the extension host calling `implode()` directly) so `dist/` loads once.
A one-file edit should then build in well under a second.

Do not: drop the round trip from random builds (it is what proves the layout), cache across tool versions (a cache
holds the codec's `version`), or speed a codec by copying a decoder out of `dist/` (one decoder, tool.md §4).

**How to measure.** `node --cpu-prof --cpu-prof-dir=<scratch> tools/open-evermore/open-evermore.mts implode <tree>
--strict`, then sum self and inclusive time per function from the `.cpuprofile` (a 30-line script; Chrome DevTools
opens it too). `/usr/bin/time -l` gives the peak memory. Always on a tree exploded by the same tool version, outside
the repository or under `out/`.

---

## 3. Usability *(proposal)*

| # | Today | Change |
|---|---|---|
| U1 | **A misspelt flag is ignored**: `implode <dir> --strcit` builds without `--strict` and says nothing | parse with `node:util` `parseArgs` (strict mode): an unknown flag, a missing value (`--out` last) or a second positional is an error with the usage |
| U2 | **The report lists all 43 kinds every time**, `0 resources` for the kinds read in place (records, menus, opcodes) and misaligned past 10 characters (`padEnd(10)`) | the terminal shows the kinds with a changed or moved item and a total line; the full table stays in `report.md`. A kind read in place says `in place` and the number of its files, not `0 resources` |
| U3 | **A plain implode of an unchanged tree says `grown … built as HiROM 4 MiB`**, which reads like a fault | say why: `the fast forms (absolute script calls) need ~10 KB more than 3 MiB holds; --strict builds the original` |
| U4 | **`explode --force` replaces the whole tree**, edits lost | refuse when a file differs from what explode wrote (the sha1s of P4), unless `--discard-edits`; and `explode --kinds a,b --into <tree>` refreshes those kinds only, for a tree exploded by an older version |
| U5 | **A tree from an older tool fails late** (a renamed field, a kind since split) | the manifest records each kind's codec `version` at explode; implode says `exploded with v0.467.0, kind menus is now version 3: re-explode it (--kinds menus --into)` before encoding |
| U6 | **Progress is silent** for 8–14 s | one line per stage on a TTY (`names`, `encode`, `place`, `build`, `round trip`), with its time; `--quiet` for scripts |
| U7 | **The next step is a guess** | end with the command that follows: after `implode`, `prove <dir> --random <seed>` for a random build, the emulator (`Play`) for a stable one; after an error, the first finding's file as a clickable `path:line` |
| U8 | **No `--help`**, and the flags live in three places (the header comment, `USAGE`, tool.md §1) | one table of flags in `open-evermore.mts` that prints `--help`, checks the arguments and is quoted by tool.md |
| U9 | Findings are a report file | `report.json` as Problems-panel diagnostics (already planned, tool.md §5) and implode from the Rooms tab (roadmap.md §5) |

---

## 4. Readability *(proposal)*

The game-neutral core is small; the weight is in the codecs and in two long signatures.

| # | Today | Change |
|---|---|---|
| R1 | `implode()` is one 135-line function; its stage comments skip 4 and do not match tool.md §3's six steps | one function per stage (`readManifest`, `resolveIds`, `encodeAll`, `place`, `build`, `roundTrip`), named and numbered as tool.md §3; `implode()` reads as the list of them |
| R2 | `Codec.explode(rom, name, options, count, nameAt)`: five positional arguments, two of them round-trip only | one `ExplodeContext` (`rom`, `name`, `options`, and `roundTrip?: { count, nameAt }`), as `encode` takes `ImplodeContext`; `explode()` itself (seven positional arguments) the same |
| R3 | Six codecs are over the 400-line limit (AI_ARCHITECTURE_GUIDE.md §3.9): `animations` 534, `animation-scripts` 528, `animation-analysis` 520, `menus` 511, `scripts` 430, `items` 414 | split each by concern before it grows: a codec file holds the `Codec` (paths, names, encode, tables, canonical); reading the ROM and the text form go beside it, as `script-lines.mts` and `operands.mts` already do for scripts |
| R4 | `canonical` mixes three jobs: drop derived fields, forgive hand-written formatting, equate an id with a name | the generic part (JSON key order and layout, `false` = absent) in `tree.mts`; a codec lists only its derived keys (`derived: ['id', 'packed']`) and keeps code for what is truly its own (scripts' call forms) |
| R5 | Rules for a resource (`Rule`) are bags of booleans (`ruleKey` lists eleven) | named presets in `codec.mts` (`Rules.scriptCode`, `Rules.musicPiece`) with one comment each saying which engine read needs it (the traps in the skill) |
| R6 | The kinds' order in `evermore/kinds.mts` carries meaning (who marks whom) only in comments | each codec declares `after: ['maps']`; the order is sorted from it and checked |

Order: U1 and P1–P3 first (small, no format change, minutes to prove: implode `--strict` = vanilla sha1 and two
`--random` round trips, then `g0.test.mts`); then P4, P5, U2–U4; R1–R2 with the next change to `implode.mts`; R3 when a
codec is next touched; incremental implode with the editor's build button.
