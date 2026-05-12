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