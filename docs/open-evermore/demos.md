# Open Evermore Demos and MesenCE Verification *(proposal)*

See [README.md](README.md) for the resource model, [extending.md](extending.md) for what each kind allows today, [tool.md](tool.md) for the CLI verbs and proof, [debugging-a-rom.md](../reverse-engineering/debugging-a-rom.md) for boot-scene testing, and [reference-emulators](../../.agents/skills/reference-emulators/SKILL.md) for why MesenCE is the WRAM and visual reference.

Unit tests (`npm test`) and `in-game.test.mts` catch structural mistakes and simple boot assertions, but `snes9x2005` fails to draw the Boy or Dog in Brian's room where MesenCE draws both *(repo — see [debugging-a-rom.md](../reverse-engineering/debugging-a-rom.md))*, and building a ROM alone does not prove new sprites, palettes, alchemy math, consumables, or custom rooms behave cleanly in hardware-accurate PPU/WRAM emulation. This document proposes four end-to-end playable demos stored cleanly in git and verified automatically against **MesenCE**.

---

## 1. The four demos

Each demo exercises a distinct Open Evermore axis: graphics + pointer tables (`dog_forms`), gameplay items + WRAM (`items/consumables`), spell economy + ingredients (`alchemy`), and room geometry + palette + script boot (`maps` + `palettes` + `scripts`).

| Demo | Concept | Feasibility today | What it proves |
|---|---|---|---|
| `purple_raptor` | New 7th Dog form (purple raptor) | 🟩 Ready (`v0.476.0`) | `dog_forms` growth past 6, `sprite_palettes` growth, 40-byte records, 21 bank bytes, 3 per-form tables (`$80:BF0E`, `$80:C707`, `$8E:B512`), `DOG_FORM_REQUEST` |
| `heal_999` | New consumable (heals 999 HP) | 🟩 Ready (`v0.461.0`) | `items/consumables` growth past 8, debug ring allocation, 16-bit heal power word (`$C4:5AA0`), heal block (`petals`), `temp[]` count cell & script consumption |
| `turd_ball` | Variant A: rework `hard_ball` -> `turd_ball` + 2 new ingredients; Variant B: add 36th formula | 🟩 Variant A ready (`v0.460.0`); 🟨 Variant B waits on formula growth | `ingredients` growth past 22 (`$C4:601F` cost pairs, ring items, script drops); Variant B serves as acceptance test for lifting the 35-formula cap |
| `brians_room_blue` | New room at id `0x7F` (blue glowing Brian's room) | 🟩 Ready | `maps`, `palettes`, and `scripts` relocation/growth, `load_map` wiring, CGRAM blue shift + enter-script lighting/glow |

### 1.1 `purple_raptor` (new Dog form)

*Source facts: [dog-forms.mts](../../tools/open-evermore/evermore/codecs/dog-forms.mts), [extending.md](extending.md) §1.*

- **Assets**: Creates a purple-shifted sprite palette in `sprite_palettes/` cloned from an existing Dog form palette (or Act 2 raptor palette *(to verify)*) and adds `characters/dog_forms/purple_raptor.json` as form index 6 (7th entry, after the 6 vanilla forms).
- **Boot scene**: Patches the opening enter script (`podunk_opening_over_the_machine` or a dedicated entrance hook) to write `DOG_FORM_REQUEST` (`$2443` / saved `$2363`) = `2 * (6 + 1)` (`14`), optionally setting `CHANGE_DOGGO` / loading a Dog-visible map (e.g., Podunk or Act 1 village).
- **Why it is hard for the packer**: Moving or growing `dog_forms` requires rewriting the `$8F:945D` pointer, 40-byte entries, 21 `lda.l` bank bytes, and the 3 per-form tables (`$80:BF0E`, `$80:C707`, `$8E:B512`). Any dropped relocation leaves garbage tiles, wrong palette, or softlock.

### 1.2 `heal_999` (new consumable)

*Source facts: [items.mts](../../tools/open-evermore/evermore/codecs/items.mts), [growable-items.md](../todo/growable-items.md), [extending.md](extending.md) §5.*

- **Assets**: Adds `items/consumables/heal_999.json` wired to heal effect block 51 (`petals`), power `999` (valid 16-bit word in `$C4:5AA0`), taking one of the free `debug_*` ring slots and a `temp[]` count cell (`items/consumables/` beyond index 8).
- **Boot scene**: Sets Boy HP below max (e.g. `10` / `200`), grants `heal_999` to inventory/ring, opens the consumable ring or runs a short script / simulated B-ring use, and asserts HP restores toward max (`min(max_hp, hp + 999)`) and count decrements by `1`.
- **Known constraint**: Until WRAM allocation milestone `W2` lands (`growable-items.md`), added consumables use `temp[]` slots which reset on room change; the boot scene must stay in the spawn room.

### 1.3 `turd_ball` (new alchemy + new ingredients)

*Source facts: [alchemy.mts](../../tools/open-evermore/evermore/codecs/alchemy.mts), [extending.md](extending.md) §4, [growable-items.md](../todo/growable-items.md).*

- **Variant A (playable today)**: Reworks vanilla `hard_ball` into `turd_ball` (`alchemy/formulas/hard_ball.json` or renamed alias, keeping the 35-formula table intact) and **adds two brand-new ingredients** under `items/ingredients/` (index 22+, using `growIngredients` from `v0.460.0` with `debug_*` ring items and custom icons/names/cost `$C4:601F`).
- **Variant B (planned gate)**: Keeps vanilla `hard_ball` intact and adds a **36th** formula `turd_ball` + 2 new ingredients. Marked `"status": "blocked_by_formula_cap"` until the 35-formula limit in `alchemy.mts` is lifted (`extending.md` §4), turning `turd_ball_v2` into the automated acceptance test for that feature.
- **Boot scene**: Grants the `turd_ball` formula bit + non-zero counts of the two new ingredients, triggers a cast on an active enemy (or simulated alchemy cast in a safe battle map), and verifies ingredient consumption, cast animation, and damage/text.

### 1.4 `brians_room_blue` (new glowing blue room)

*Source facts: [in-game.test.mts](../../tests/open-evermore/in-game.test.mts), [debugging-a-rom.md](../reverse-engineering/debugging-a-rom.md).*

- **Assets**: Clones Brian's room (`podunk_brians_room`) into a new map folder at id `0x7F` (`maps/brians_room_blue/`), computes a cool/blue-shifted palette variant from Brian's vanilla palette (no vanilla palette bytes stored in repo), adds a room enter script with `fade_in` plus a blue CGRAM / color-math glow effect (`$2132` fixed color / subscreen blend or darkened cool BG palette *(to verify exact script opcode vs ASM hook)*), and exposes a clean `load_map 23, 40, brians_room_blue` entrance.
- **Boot scene**: Redirects `podunk_opening_over_the_machine` enter script (`load_map` + Brian's room entrance `[0x17, 40]`, matching `in-game.test.mts`) so pressing Start/skip or letting the opening finish lands Boy + Dog directly inside `brians_room_blue`.

---

## 2. Storage format (legally clean, diff-friendly, non-rotting)

A demo **must never** copy an entire exploded directory (~thousands of files), commit extracted PNGs/palettes/ROM bytes (blocked by `tools/check-legal.mts`), or store `.ips`/`.bps` binary patches (which break whenever `explode` changes layout and leak ROM deltas).

Instead, store each demo as a **tiny overlay + declarative recipe** under `tools/open-evermore/demos/<name>/`:

```
tools/open-evermore/demos/<name>/
├── demo.json       # metadata, status, declarative transforms on an exploded dir, boot scene, verify spec
├── files/          # ONLY original human-authored Open Evermore inputs (new JSON records, scripts, Asar snippets)
├── apply.mts       # optional: only when procedural transforms exceed demo.json primitives
└── verify.lua      # optional override: extra MesenCE assertions beyond demo.json's declarative checks
```

### Why Overlay + Recipe wins

- **Legal**: Contains only small JSON recipes, original text scripts, and authored metadata — zero vanilla ROM bytes, zero palettes/graphics, zero binary diffs.
- **Format-resilient**: Transforming the freshly exploded folder (`clone`, `patchJson`, `recolorPalette`, `appendEnum`, `writeFile`) adapts automatically when `explode`'s schema evolves or `--random` shuffles free-space placement.
- **Composable**: Because transforms apply independently to an exploded workspace, two or more demos can be stacked into one workspace to prove combined mods do not collide.

### Example `demo.json` schema *(proposal)*

```json
{
  "name": "brians_room_blue",
  "title": "Brian's Room (Blue Glow)",
  "status": "ready",
  "release": "us",
  "transforms": [
    { "op": "cloneDir", "from": "maps/podunk_brians_room", "to": "maps/brians_room_blue" },
    { "op": "cloneFile", "from": "palettes/...", "to": "palettes/brians_room_blue.json" },
    { "op": "shiftPalette", "target": "palettes/brians_room_blue.json", "rgbScale": [0.45, 0.70, 1.35], "biasBlue": 6 },
    { "op": "patchJson", "target": "maps/brians_room_blue/meta.json", "set": { "id": "0x7F", "palette": "brians_room_blue" } },
    { "op": "copyFiles", "from": "files/" }
  ],
  "scene": {
    "description": "Redirect podunk_opening_over_the_machine to enter brians_room_blue at (23, 40)",
    "transforms": [
      { "op": "patchScript", "target": "scripts/podunk_opening_over_the_machine.txt", "replaceEnterWith": "load_map 23, 40, brians_room_blue" }
    ]
  },
  "verify": {
    "maxFrames": 1200,
    "expect": {
      "roomId": "0x7F",
      "stableFrames": 60,
      "minNonBlackPixels": 5000,
      "dominantChannel": "blue",
      "boyVisible": true,
      "dogVisible": true
    }
  }
}
```

Key split: **`transforms`** is the mod itself; **`scene`** is optional test scaffolding that drops the player straight into the demo from title/boot (skipped when building with `--no-scene` for normal playthroughs or `prove`).

---

## 3. Four-layer verification pipeline

Building a ROM with `implode` only proves the packer wrote bytes without throwing. Full confidence requires four tiers matching `test-discipline`:

### Layer 1 — Build, `--strict`, `--random`, and Asar parity

For every `"ready"` demo (applied on top of a clean `explode` of the US ROM):
1. Run `implode --strict` (with `scene` applied) and confirm zero errors.
2. Run `implode --random` (`--seed` recorded on failure) to verify nothing in the demo or codec hardcodes a vanilla address.
3. Run the Asar build (`--asar` / `_build/asar/`) and assert byte-exact or boot-equivalent output, confirming whole-game assembly rebuilds cleanly after the demo's additions.
4. *(Combined stack check)* Apply all `"ready"` non-conflicting demos together into one workspace (`purple_raptor` + `heal_999` + `turd_ball` + `brians_room_blue`) and run `implode --strict --random`, catching ID/ring/WRAM collisions across features.

### Layer 2 — Vanilla regression with `--no-scene`

Apply each demo **without** its `scene` boot redirect and run `open-evermore prove` (stored vanilla input playbacks) plus a MesenCE opening-boot check. A demo that breaks unrelated vanilla rooms, menus, or combat fails here even if its own test scene passes.

### Layer 3 — Headless MesenCE verification (`--testrunner`)

`tools/exhirom/mesen.js` already demonstrates headless MesenCE automation on macOS (`--testrunner`, `--snes.ramPowerOnState=AllZeros`, Lua callbacks). Reuse and generalize that runner for Open Evermore demos, respecting the documented MesenCE traps *(repo — see [reference-emulators](../../.agents/skills/reference-emulators/SKILL.md) and [debugging-a-rom.md](../reverse-engineering/debugging-a-rom.md))*:

- **Ignore Mesen's OS exit code**: `Mesen --testrunner` can exit `255` even after `emu.stop(0)`. Emit structured `PASS ...` / `FAIL ...` JSON lines on `stdout` and judge solely from `stdout`.
- **Isolate SRAM per run**: Copy the built `.sfc` to a unique temp path (e.g. `out/open-evermore-demos/<run-id>/rom.sfc`) so Mesen's per-filename `Saves/` SRAM never bleeds across test runs.
- **Deterministic boot**: Always pass `--snes.ramPowerOnState=AllZeros`.
- **Screenshots without disk IO**: `--testRunner` disables Lua file writes. Dump `emu.takeScreenshot()` bytes as hex on `stdout` (prefix `PNGHEX:` or `RAWHEX:`), decode in Node, and save debug frames to `out/open-evermore-demos/<name>.png` (gitignored `out/`, never committed).

#### Common health checks (every demo Lua script runs these)
- **No crash / reset**: `$7E0ADB` reaches the target room and stays non-zero; PC never hits `$00:0000` / BRK `$00` loop; frame counter advances cleanly.
- **Non-blank active screen**: Master brightness (`$2100`) settles `>= 0x0F`, non-black pixel count exceeds threshold.
- **Bounded frame stall**: NMI counter increments every frame after fade-in (detects infinite script loops or broken DMA).

#### Per-demo assertions
- **`purple_raptor`**: WRAM `$2443` / active Dog form index equals `6`, Dog OAM entries exist on screen (`OAM` y < 224), Dog CGRAM palette slice contains dominant purple hues (`B > G` and `R > G`) rather than vanilla grey/brown, and stepping/running across frames updates animation without garbage tile indices.
- **`heal_999`**: Pre-damaged Boy HP WRAM value (`< maxHp`) increases after item activation up to `min(maxHp, oldHp + 999)` and the `heal_999` inventory count decreases by `1`.
- **`turd_ball`**: Formula known-bit is set, both new ingredient counts (`>= 1`) decrement on cast, alchemy cast animation advances cleanly without NMI freeze, and spell effect resolves on target.
- **`brians_room_blue`**: Room ID `$7E0ADB == 0x7F`, `$7FD81E` / text or state is clean, both Boy and Dog OAM sprites are on-screen inside the room (explicitly catching what `snes9x2005` dropped), and sampled CGRAM/screenshot pixels show blue dominance (`mean(B) > mean(R)` and `mean(B) > mean(G)`) while preserving wall/bed structure.

#### Baseline negative check (anti-vacuous-pass guard)
Whenever a demo verification suite is added or edited, run its exact `verify.lua` against an unmodified vanilla ROM (or a build with that demo omitted). **Every** demo-specific assertion must print `FAIL` on the baseline — proving the check actually detects the demo rather than passing vacuously on boot.

### Layer 4 — CLI and test tiers (`test-discipline`)

- **Tool entry point**: Add a single action in `tools/open-evermore/open-evermore.mts`:
  - `open-evermore demo apply <name|all> <exploded-dir> [--no-scene]`
  - `open-evermore demo verify <name|all> [--mesen <path>] [--keep-out]`
- **Test tiers** (preserving fast `npm test` ~7s rule):
  - `unit` (`npm test`): validates `demo.json` schemas and checks clean merge/lint (no ROM or emulator).
  - `rom` (`npm run test:rom`): runs `explode` -> `demo apply` -> `implode --strict --random` + `--asar` + combined build (`test:rom`).
  - `emulator` (`npm run test:emulator` / dedicated `mesen` check): executes headless MesenCE scripts when a local ROM and `MESEN` binary exist, gracefully skipping with a clear message in CI environments without a ROM or Mesen binary.

---

## 4. Rollout order and open decisions

| Step | Scope |
|---|---|
| `D0` | Add `tools/open-evermore/demos/` loader + `demo apply` primitive set (`cloneDir`, `cloneFile`, `shiftPalette`, `patchJson`, `copyFiles`, `patchScript`). |
| `D1` | Generalize `tools/exhirom/mesen.js` into a reusable headless MesenCE runner (stdout protocol, SRAM isolation, screenshot hex export to `out/`). |
| `D2` | Implement and Mesen-verify the three immediately ready demos (`brians_room_blue`, `purple_raptor`, `heal_999`) plus `turd_ball` Variant A, and run baseline negative checks for each. |
| `D3` | Add combined multi-demo build test + `--no-scene` `prove` regression; keep `turd_ball` Variant B (`blocked_by_formula_cap`) ready to turn green when `alchemy/formulas` becomes growable. |

*(Owner's call — decide before implementing `D0`–`D2`)*:
1. **`turd_ball` Variant A vs waiting for Variant B**: Start with Variant A (reworking vanilla `hard_ball` -> `turd_ball` + 2 brand-new ingredients) right away, or prioritize lifting the 35-formula cap first so Variant B is the initial demo?
2. **`brians_room_blue` glow mechanism**: Tint the room's palette colors only (`palettes/*.json`), add SNES hardware color-math (`$2130`–`$2132` blue subscreen glow in the enter script / ASM), or both?
3. **Combined stack in `test:rom`**: Should `npm run test:rom` run each demo separately, only the combined stack (`purple_raptor` + `heal_999` + `turd_ball` + `brians_room_blue`), or both?
