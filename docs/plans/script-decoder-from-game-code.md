# Plan: rebuild the script decoder from the game's own code

**Decision (2026-10-11):** the script decoder (`src/games/evermore/script/`), the sprite/character readers
(`src/games/evermore/maps/sprites.ts`, `src/games/evermore/maps/character-record.ts`, `src/games/evermore/sprites/character-model.ts`) and
everything else ported from SoEScriptDumper/SoETilesViewer is re-implemented **from the game
itself**. We have the author's written agreement, but we choose not to build on their work.
Names (`src/games/evermore/script/names.json`, room names) stay for now; room names are rewritten in our own
style and the disassembly text is reinvented in the everscript compiler's spelling
(`docs/cleanup.md` D4).

## Principle

The real specification of the script format is the game's **script interpreter**. Every
opcode's length, operands and control flow can be read from its handler in the ROM and
confirmed by watching the game execute it. That makes the new decoder an independent
derivation with its own evidence trail.

Working rules for whoever implements it (human or agent):
- Do **not** open SoEScriptDumper/SoETilesViewer sources, and do not read the legacy decoder's
  opcode handling (`src/games/evermore/script/decoder.ts`, `expression.ts`, `ops-*.ts`) while writing the new
  one. Comparing *test outputs* (lengths, stop points) is allowed.
- Everything learned goes into knowledge entries (`game-knowledge` skill) and
  `docs/game-research/script-vm/`, in our own words. That doc is the spec the code is written
  from.
- Goldens contain only facts we observed (offsets, lengths, opcode numbers) — never ROM bytes.

## Phases

### 1. Spec from the interpreter
- Start at the opcode dispatch, `$8C:D0A6` (already known): read its jump table, create a
  `rom/` knowledge entry per handler.
- Per handler, from disassembly (`soe://rom/<off>.asm`, CDL library): which routine fetches
  operand bytes and how many, which operands go through the expression evaluator, what the
  handler does to the script PC (advance / jump / call / return / yield / end), side effects.
- Find and document the expression evaluator the same way: operand encodings, operators,
  how it knows where an expression ends.
- Output: `docs/game-research/script-vm/opcodes.md` (one row per opcode, our words) and a
  machine-readable opcode spec (opcode → operand schema → flow effect) written **by hand from
  that doc**.

### 2. Goldens from the running game
- The custom core already reports script calls/ends and has a per-opcode interpreter hook
  (`SDBG_DISPATCH`). Record `(script pc, opcode, bytes consumed, flow)` while the game runs:
  intro, a set of rooms with known scripts, a few bosses, a save-load cycle.
- Store as JSON of offsets and lengths only. Coverage report: which opcodes were observed.

### 3. Implement
- New library domain `src/games/evermore/script-vm/` (`docs/architecture/multi-game.md`) (strict TS, own naming, own output wording), table-driven
  from the phase-1 spec. Never guesses a length: an opcode without a spec stops the walk.

### 4. Validate
- Unit tier: spec self-consistency; synthetic scripts.
- ROM tier: every traced instruction decodes to exactly the length and flow the game used;
  a static walk over all scripts in the user's ROM terminates cleanly.
- Temporary safety net: compare only *structure* (instruction boundaries, stop points) with the
  legacy decoder over all scripts; investigate each difference against the game, not upstream.

### 5. Switch and delete
- Move consumers (debugger source map, hover, Rooms scripts, `soe://` scripts, ROM tab) to
  `src/script-vm/`.
- Delete: legacy decoder files (`tools/generate-script-names.js` is gone, v0.261.0),
  the parity tests that read upstream output (`script-parity`, `script-loot` upstream parts),
  `script_parser/` (the `sandbox/` corpora are already deleted), the hard-coded upstream
  ROM path in `src/games/evermore/maps/render-script-model.js`.

### B. Sprites and characters (parallel, smaller)
- Re-derive sprite block pools, the sprite list walk and the character record from the ROM
  routines that read them (trace which code reads `$8E:B678`-area records and how), document
  as knowledge entries, rewrite `sprites.ts` / `character-record.ts` from that, and validate
  with the existing ROM-tier render tests.

## Done when
- No file in `src/` declares itself a port of, or reads anything from, the upstream projects.
- Every opcode has a knowledge entry with `confidence: confirmed` or a documented gap.
- `docs/cleanup.md` step 2 is ticked.
