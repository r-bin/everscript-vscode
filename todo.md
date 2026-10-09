# TODO

This file tracks open work for the VS Code extension.

## Needed From User

- Provide an Atlas-specific damage trace for a `100%` charge hit.
Reason: the current `100% Atlas stays weak` behavior is matched by tests and in-game observation, but it is not yet proven from an Atlas-specific trace.

- Provide an Atlas-specific damage trace for a sub-`100%` charge hit.
Reason: this is the comparison case needed to prove the `100%` vs `<100%` Atlas split against the ROM path instead of just behavior matching.

- Prefer capturing both Atlas traces against the same enemy.
Reason: this removes enemy-defense differences from the comparison.

- Include these memory/status values in the trace if possible: `0x4ED3`, `0x4EE1`, `0x4EE3`, `0x4EE5`, boy attack, charge/stamina, enemy defense source, and final shown damage.
Reason: the remaining open question is whether the Atlas subtraction and clamp-bypass behavior come from these live status values exactly as currently inferred.

- See [docs/atlas-trace-request.md](/Users/v/Documents/GitHub/everscript-vscode/docs/atlas-trace-request.md) for the fuller trace request.

## Open Extension Work

- Replace the current hardcoded Atlas subtraction approximation (`attack - 480`) with a trace-backed source if the Atlas trace shows a different live-status-driven value.

- Re-verify the `100% Atlas weak hit` path against the new trace and update the Scaling tab if the trace disproves the current model.

- Re-verify the `<100% Atlas mostly-999` path against the new trace and update tests if needed.

- Keep the Scaling tab on one shared physical damage formula.
Requirement: no separate shortcut range formula should return to the chart, stats panel, crosshair info, or docs preview.

- Flesh out the Route tab simulation only after the physical and spell damage models are grounded enough to avoid fake certainty.

## User-Requested Product Direction

- Keep bullet points as the primary documentation style in the Docs tab.

- Keep detailed fractions for Atlas odds instead of overly coarse percentages.

- Keep the Route tab visible as a mock UI.

- Add real spell damage graphs later so alchemy route steps stop being placeholders.
## Secret of Mana Content Port

- Requirement: support, or at least understand, the Secret of Mana (SoM) map data.
Reason: every porting question below depends on decoding SoM rooms into layers, tiles, palettes and triggers.

- Requirement: be able to add new tiles, characters and (ideally) sounds to the SoE ROM.
Reason: ported content needs free ROM space, room in the master tile table (`$EE0000`), character/animation table entries and SPC sample slots. See the `map-editor-rules` skill for current ROM budgets.

- Question: can SoM maps be ported to SoE?
Idea: both games use the SNES PPU's tile-based backgrounds, so a room reduces to BG layers + 8×8/16×16 tiles + palettes + collision. Needs SoM maps sliced into layers and tiles, plus triggers (doors, events) once we know how SoM encodes them.
Open: collision/priority bits, animated tiles and trigger semantics probably do not map 1:1 onto SoE's metatile, collision and script model.

- Question: can SoM enemies be ported to SoE?
Idea: convert their sprite frames and animations into SoE animation scripts (see the `animation-script` and `map-entities` skills), and scale/position them to match where SoE enemies sit (body/hurt/strike boxes).
Open: SoM's AI and stats have no SoE equivalent, so a ported enemy would reuse an existing SoE AI with new graphics.

- Question: is there an open-source SoM map editor or documentation that already decodes maps, tiles, triggers and enemies?
Reason: reusing an existing decoder is far cheaper than reverse engineering SoM from scratch. Check licenses before porting any code.

## Side Quest: Combo ROM (SoE + another game, e.g. ALttP)

- Question: would a single combo ROM like SMZ3 (ALttP + Super Metroid) work with SoE?
Known so far:
  - SMZ3 is MIT-licensed: https://github.com/tewtal/alttp_sm_combo_randomizer_rom
  - SMZ3 uses ExHiROM: ALttP runs from banks `$00-$3F`, Super Metroid from `$80`/`$C0`. A dispatcher in bank `$00` routes NMI/IRQ by a "current game" byte in SRAM. Each game's save lives in its own SRAM bank (`$A0`, `$A1`, multiworld state in `$A2`).
  - SoE is HiROM FastROM (`$31`), 3MB, 8KB SRAM. Its reset/NMI/IRQ vectors jump straight to bank `$80`, so SoE could sit at its native `$C0-$EF` in Super Metroid's place, with `$F0-$FF` spare.
  - Switching games is save → force-load at a chosen entrance; no live WRAM survives the switch.

- Required work:
  - Use the CDL recorder over a full playthrough to list every SoE ROM access through `$00-$3F:8000+` or `$40-$7D`; in ExHiROM those addresses would hit the partner game's ROM. Patch each one. A rough jump-target scan showed nothing worse than random noise, but it can't see data reads.
  - Move SoE's SRAM accesses to their own bank (as `sm/hirom.asm` does for Super Metroid).
  - SoE-side transition: write the save block, then load straight into a map entrance; make sure SoE's sound driver is re-uploaded on that path.
  - Shared item table, "item from the other game" messages and graphics, and SoE pickups rewritten via Everscript (gourds and chests are script-driven).
  - Randomizer logic for the SoE half (look at existing SoE randomizers such as evermizer; check licenses).

- Reusable from SMZ3: the ALttP half almost as-is (`z3/hirom.asm`, `z3/transition.asm`, `z3/teleport.asm`, z3randomizer items), the vector/NMI dispatcher and header in `common.asm`, the SRAM layout pattern in `sram.asm`, `spc_play.asm`, and the multiworld item queue.

- First spike: build an ExHiROM image with SoE at `$C0` and ALttP at `$00` using SMZ3's dispatcher, boot both games headless (see the headless boot setup), then try one portal.

- Cheaper alternative to compare against: Archipelago multiworld runs SoE and ALttP as two separate ROMs (unverified this session). A combo ROM only adds value if seamless in-cartridge transitions are the goal.
