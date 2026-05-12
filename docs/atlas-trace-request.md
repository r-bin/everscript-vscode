# Atlas Trace Request

## Why This Is Needed

- The Scaling tab now uses one shared physical damage formula.
- Regular physical-hit behavior is anchored against the existing regular-hit trace and the Lua helper.
- One gap remains: Atlas-specific control flow is still behavior-matched, not fully trace-proven.
- The current model matches observed behavior well enough to be useful:
  - Atlas at 100% charge stays weak.
  - Atlas below 100% charge usually reaches 999 damage.
- That split should be verified against a real Atlas-specific trace instead of relying only on observed outcomes.

## Requested Trace

- Capture at least one Atlas-specific damage trace for a hit at 100% charge.
- Capture at least one Atlas-specific damage trace for a hit below 100% charge.
- Prefer capturing both cases against the same enemy if possible.
- Prefer including a weak low-defense target and a higher-defense target if practical.

## What The Trace Must Show

- Boy base attack before the hit.
- Current charge / stamina value.
- Atlas-related status values before the hit:
  - 0x4ED3
  - 0x4EE1
  - 0x4EE3
  - 0x4EE5
- Enemy pseudo-armor / defense source used by the damage helper.
- The exact path into the physical damage routine.
- The value written to the pre-RNG damage variable (`wram0012` / equivalent trace context).
- Whether the signed clamp is applied or bypassed.
- The final shown damage value.

## Questions The Trace Should Answer

- Does Atlas subtraction apply at 100% charge, or only below 100% charge?
- Is the same physical damage helper used in both Atlas and non-Atlas cases?
- At 100% Atlas, is the weak result caused by the normal signed clamp still being active?
- Below 100% Atlas, is the mostly-999 result caused by the wrapped underflow value bypassing that clamp?
- Is the current hardcoded subtraction (`attack - 480`) exact, or should it be derived from live status memory instead?

## Preferred Outcome

- Replace the remaining Atlas-specific inference with a trace-backed explanation.
- If the trace disproves the current model, update the Scaling tab and tests to match the trace.
- If the trace confirms the current model, keep the code and cite the trace as the missing proof.