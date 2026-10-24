# Wolfgang Sequence Event State

This note records a small set of runtime observations from the Secret of Evermore SPC driver. SPC addresses below are addresses in the driver's audio RAM, not SNES bus addresses.

## Stream Fetch

The active track byte is fetched by the self-modified read around SPC `$1A44`; the observed post-instruction PC is `$1A47`. The byte is dispatched through a computed jump at `$1A4D`. Consequently, values that resemble commands and operands in a static byte listing can each be separate fetched events. The Scripts view preserves unclassified bytes individually rather than assuming an operand width.

## Observed State and Timer Values

Runtime traces of Main Title tracks 0 and 1 showed:

| Stream context | Handler | Observed effect | Confidence |
|---|---|---|---|
| `$9C` | `$188C` | Leaves `Y = $3C` | Confirmed for this value |
| `$D3` | `$188C` | Leaves `Y = $73` | Confirmed for this value |
| `$1E` after `$9C` | `$18D4` | Loads 30 into the track timer at `$B4 + track index`; it counts down before the next track byte is read | Confirmed for Main Title track 0 |
| `$0A` after `$9C` | `$18D4` | Loads 10 into the track timer at `$B4 + track index`; it counts down before the next track byte is read | Confirmed for Main Title track 1 |

These observations support driver-state and timer annotations in the Scripts tab. They do not establish a musical pitch mapping, a general duration encoding, voice allocation, or the meaning of other values. Keep those values unclassified until their effects are independently traced.

## Evidence

Observed with the in-memory SPC700 interpreter harness in `everscript/tools/dump_spc.py`, running the workspace ROM's audio driver and filtering sequence reads to Main Title track ranges. The decoder's regression checks are in `tests/memory/scripts-tab.test.js`; the implementation is `src/games/evermore/music/model/sequence-decoder.ts`.
