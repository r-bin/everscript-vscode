# Static Recompilation — Open Tasks

> Domain: the Secret of Evermore recomp (repository SecretOfEvermoreRecomp, `docs/recomp/README.md` here) and its inputs here (`tools/recomp/`, `tools/compare/`, `src/platform/cdl/recomp-*.ts`)
> Details and evidence: that repository's `docs/progress.md`, `docs/progress-details.md`, `docs/bugs-and-todos.md`, `docs/great-recomp-gap-analysis.md`
> Status key: 🔴 blocks the next stage · 🟡 open gap · 🟢 later or optional · 👤 needs the owner's decision

Compiled 2026-11-04. Tasks are in working order: each section needs the one before it, except §6 to §8,
which can run at any time.

---

## Where it stands

Rated against Mega Man X Recompiled (2026-11-04): the emulation core is strong, and the project around it is not
there yet.

| Area | State |
|---|---|
| Accuracy | Replays 01, 02, 04, 05 and 06 match MesenCE at every compared NMI, on WRAM, VRAM, CGRAM and OAM, native and interpreted |
| Picture and sound | SRAM also identical; picture identical but for fade rounding and one key; ARAM and S-DSP identical but for a power-on default and 50 single keys |
| Compiled share | 99.92–99.98 % of the instructions in those replays |
| Speed | 368–500 frames/s headless on Apple Silicon |
| What that proof leaves out | The audio sample stream, and all but about 17.5 minutes of distinct play |
| Public state | GitHub lists no branches or tags, and the pinned framework commit is not on GitHub |
| Tests | 2 ROM-backed `ctest` tests; replay runs and everything else by hand |
| Release and player features | No release; save states only |

---

## 1. Publish: nobody else can build it yet

| | Task | Done when |
|---|---|---|
| 🔴👤 | **Settle `LICENSE`.** It is the scaffold's PolyForm Noncommercial with Matthew Stanley's copyright | The owner has picked the license and copyright line |
| 🔴👤 | **Decide where the framework work lives.** The pin `88bc5ef8` (branch `aot-resume`, 22 commits past `origin/main`) exists only locally | The pin is reachable from the URL in `.gitmodules`: upstream, or a fork named there |
| 🔴👤 | **Merge the work branch.** `snesrecomp-spc-access-cycles` is 28 commits ahead of `develop`; `develop` still pins the older framework | `develop` holds the sync work |
| 🔴 | **Push** `main` and `develop` | `git ls-remote origin` lists them |
| 🔴 | **Check a clean clone.** Fresh clone, submodules, `tools/regen.sh`, build, replay 06 | It passes on a machine or folder with no local state |
| 🟡 | **Send the snesrecomp changes upstream** as separate game-neutral PRs, smallest first (§9) | `framework_pins.txt` names upstream commits and the replays still sync |

---

## 2. Prove what the player sees and hears

`npm run compare:full` compares every RAM, the picture and the S-DSP's state at every key of the sync replays. All RAM the CPU
side uses is identical; the open items are what it found (recomp repository's `docs/progress-details.md`, "Picture and sound").

| | Task | Done when |
|---|---|---|
| 🟡 | **Fades round differently:** up to 8 of 255 below full brightness (`imperfections/fade-rounding.md`); the picture's only regular difference, 4,405 of 71,055 keys | Fixed upstream, or by the glue where brightness holds for a frame |
| 🟡 | **A brightness write during a frame** reached rows already past: replay 05, key 2992, rows 0-24. Why they were not yet drawn is not traced | Explained and fixed |
| 🟡 | **ENDX seen a clock early:** an SPC700 read sees a voice's end flag early, 48 single keys of S-DSP state, one of ARAM (`imperfections/dsp-endx-read.md`). Proven at two keys, not yet at every key | Every key explained; the clock rule found |
| 🟡 | **Compare the sample stream.** `sound` is state once per key, because MesenCE's Lua has no audio access. Needs a WAV from MesenCE, or a build of it that exposes the samples | Samples compared over a replay, with what the open keys do to the sound |
| 🟢 | **BRR offset at power-on:** harmless; one line upstream (`imperfections/dsp-brr-offset-reset.md`) | Sent with §9 |
| 🟡 | **Close the DMA-only fixes.** VRAM and CGRAM writes during rendering are handled for DMA alone, and `$213B` bit 7 for DMA reads; CGRAM uses colour 0 as measured | CPU-side cases are fixed or shown not to occur |
| 🟡 | **Try the new renderer on the picture comparison** once Mode 4 exists upstream (§9) | `SoeAfterConfig`'s override is removed, or the reason to keep it is written down |

---

## 3. Prove the whole game

| | Task | Done when |
|---|---|---|
| 🔴 | **Milestone checks.** Generate `(address, expected value)` lists for rooms, boss flags and items from the WRAM map and `docs/scripts/` | Checks are named facts, not magic numbers |
| 🔴 | **Play `03-complete-run-7h` on the native build, checked by events only.** It does not sync, so this is never a frame comparison or a native-share measurement | Every region, boss and the ending are reached in order, recorded in `progress.md` |
| 🟡 | **A person finishes the game** on the native build | Written down with the build and the date |
| 🟡 | **Record more MesenCE replays** in the later acts. Hand-played recordings found bugs 01 and 02 never reached (D flag on NMI, `$4212`, writes during rendering) | One synced replay per act |
| 🟡 | **Re-run the older checks on the current pin:** `tools/verify-intro.js`, the 21 fights in room `0x38`, save states | Pass, or the tool is removed as superseded |
| 🟡 | **Audit the 208 pushed-address returns** in `recomp/bank*.cfg`. The exclusion for `$8C:CFFD` was lifted, and `$8F:9817` is still suspected | A native-vs-interpreted run reaches each, or each is explained |
| 🟡 | **Replay the 86 stored playbacks** on the recomp, checked by game events | A list of which pass |

---

## 4. Tests and CI

| | Task | Done when |
|---|---|---|
| 🔴 | **ROM-free CI build on every push** (`-DSNESRECOMP_SETUP_HOST=ON`). Needs a public pin (§1) | Green on GitHub, on Windows, Linux and macOS |
| 🟡 | **`tools/check-sync.sh`:** run the sync replays against MesenCE and fail at the first differing NMI; before releases, not on every push | One command with an exit code |
| 🟡 | **Run native against interpreted as a standing check** (`native-vs-interp.mts`) after each regeneration | Part of `check-sync.sh` |
| 🟡 | **Arm snesrecomp's runtime tripwires in headless runs** (M/X claim, DB, stack drift, phantom PC). No tool of ours uses them yet; step 2 in `lessons-from-mmx-and-lufia2.md` | A trip fails the run |
| 🟡 | **Event-based regression test** for gameplay outcomes, since matching hashes alone can miss a softlock (§3's checks) | In `ctest`, skipped without a ROM |
| 🟢 | **"All mods off equals vanilla" test** once mods exist | Replays sync with every mod compiled in and off |

---

## 5. First release

| | Task | Done when |
|---|---|---|
| 🟡 | **Fix "needs local framework branches" in the status text** once §1 is done: `README.md`, `docs/README.md`, `progress.md` say the pin is local | The docs match the public state |
| 🔴 | **Build and run on Windows and Linux.** `release.yml` targets them, but every recorded measurement is from a Mac | Replay 06 syncs on each |
| 🟡 | **Player README:** feature table, ROM table with hashes, controls, how to report problems. No screenshots (`AGENTS.md` rule 1) | A stranger can follow it |
| 🟡 | **Tag a setup pack** with `scripts/package_release.sh` and `release.yml` | A public release with no ROM data or generated C |
| 🟡 | **Session replay recording.** In memory, hashes per frame on disk, capped | A player's report replays in `compare.mts` |
| 🟢 | **Other ROMs:** other releases need their own addresses (`docs/evermore-releases.md`); keep refusing them with a clear message until then | — |

---

## 6. Native share (goal 100 %)

| | Task | Done when |
|---|---|---|
| 🟡 | **First instruction of bound routines** (about 82,000 on 01, 144,000 on 02): calls reaching a bound entry at a deadline. The largest interpreted item | Compiled code exists at those entries |
| 🟡 | **Single steps around the NMI** (about 30,000 per replay): about 3 % run interpreted, cause open | Traced inside snesrecomp and explained |
| 🟡 | **74 interpreter-only variants.** The `$8E:9EBE`–`$8E:AD3D` dispatchers need `noreturn_jsr` for `jsr (abs,x)`; `$91:B7FA` and `$91:BB72` dispatch through 16-byte records, which `idx:X` cannot describe. Both need framework support | Variants compiled, or left interpreted with the reason written down |
| 🟢 | **Code the CDL never recorded** (about 10 % of the ROM, assets included) | Seeds from later replays or Ghidra / REA exports; speed only, not correctness |

---

## 7. Readable C

| | Task | Done when |
|---|---|---|
| 🟡 | **Bind more routines** with the proof already used: both replays stay in sync, the C path runs often, `SOE_HLE_MUTATE=1` is caught. 3 are bound of 309 reconstructed | Each new binding has a row in `progress-details.md`'s "Bound C" |
| 🟡 | **Next targets:** LZ decompressors (checked TypeScript decoders in `src/games/evermore/maps/`), then the room tilemap loader and collision unpacker | Bound and proven |
| 🟡 | **Add a build report** listing which routines run as C, compiled or interpreted | Written by each build |

---

## 8. Speed

| | Task | Done when |
|---|---|---|
| 🟡 | **Measure on weaker machines.** About half the time is the PPU's per-pixel renderer; only Apple Silicon is measured | Numbers for one low-end PC and a Steam Deck class device |
| 🟢 | **Optional faster mode** if a target falls short, with the accurate build kept as the default reference | Only after a measured need |

---

## 9. Upstream reports for snesrecomp

Written up in the recomp repository's `docs/bugs-and-todos.md` §3 and `docs/upstream-access-timing.md`. We do not
change snesrecomp for these beyond the owner's branches; each one goes out as its own report or PR.

| | Report |
|---|---|
| 🟡 | Access-exact timing: SPC ports, S-DSP per clock, DMA rule, bus-exact compiled code, compiled resume (the four local branches) |
| 🟡 | BG Mode 4 in `NewRenderer` |
| 🟡 | File save states omit `g_cpu`, the beam driver's resume point and the clocks |
| 🟡 | `RtlReset` does not reset `g_cpu` or call `session_reset` |
| 🟡 | D flag not cleared on an interrupt (`cpu_push_interrupt_frame_at`) |
| 🟡 | An empty `$420B` write is charged as a DMA |
| 🟡 | Stack-frame context lost in `interp_tier_dispatch_tail` |
| 🟡 | Function names choose resume entries: break the tie by entry PC |
| 🟡 | Every HiROM mirror is compiled (233 of 317 files never ran) |
| 🟡 | `getenv` on every interpreter entry (about 1 % of the main thread) |
| 🟡 | Save root cut at 96 bytes without an error |

---

## 10. Player features

All are mods that leave vanilla intact, and none starts before the mod hook layer exists. Designs: the recomp
repository's `docs/snesmod-addons.md`, `docs/enhancements.md`, `docs/great-recomp-gap-analysis.md` §2.6 and §2.7.

| | Task | Note |
|---|---|---|
| 🟡 | Mod hook layer | Change a decision where it is used, not a value other routines compare later |
| 🟡 | Rewind and a save-state browser | Save states already work, so these need no new reverse engineering |
| 🟡 | Widescreen | Needs room prefill and HUD pinning; sprites past the original edge are culled by the game |
| 🟡 | Fix for the 5-status-effects bug | Cause known: `docs/5-status-effects-bug.md` |
| 🟢 | Quality of life: hotkeys, hitbox overlay, translations | Existing work in `everscript` `hacks/hotkeys` and `localizations/` |
| 🟢 | MSU-1 music | Sound port commands are known |
| 🟢 | Co-op, then netplay | Last: they change game state, so §3 comes first |
