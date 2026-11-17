# What to move to the SA-1: the profile, and the pathfinding offload experiment

Status: **experiment, built and measured (2026-11-18).** The busy-scene profile ([uses.md](uses.md) use 1) is
done, and an image whose SA-1 CPU runs Evermore's pathfinding steps plays the attract loop for 40,000 frames and
the new-game replay 02 without breaking. Lockstep with the original ends on purpose (offloaded work changes the
timing), so the checks are "plays, no hang, no crash" and the per-frame load, not frame identity.

All numbers are *(MesenCE)* runs of the original US ROM or the offload image, unless labelled *(CDL)* (the CDL
library's `functions.json`, ~2.8 M recorded frames).

---

## 1. Where the S-CPU's time goes

Two sources agree.

**CDL library** *(CDL)*: self time per function over all recorded play, in master clocks (365 k per NMI, so the
sum is one frame per NMI):

| Share | What | Functions |
|---|---|---|
| ~25 % | idle: spinning for the NMI | `field_spare_time_loop` ($8F:9817) polling with no task to run 19 %, `wait_for_nmi` ($80:858C) 6 % |
| ~31 % | **pathfinding** (dog and enemy navigation), in spare time only | raycast `$8F:9F05` 12.4 %, elevation step `$8F:A458` 5.5 %, breadcrumbs `$8F:9967` 4.0 %, tile collision `$90:9DE8` 4.3 % (most of its calls), … (§2) |
| ~16 % | sprites: OAM building and sorting | `$80:904D` 10.3 %, depth sort `$8F:C773`, `$80:960A`, `$8F:C6C5` |
| rest | entity physics and AI, scripts, map effects, NMI (2 %), sound uploads | |

**Per frame** (`npm run sa1:load`, *MesenCE*): the clock from a frame's NMI to the spare-time loop is the frame's
*fixed* work; a frame whose fixed work passes the next NMI is a slowdown frame.

| Input | Field frames | Slowdown frames | Fixed load median / 95th |
|---|---|---|---|
| recomp replay 01 (attract loop) | 7,035 | 196 (2.8 %) | 46 % / 81 % |
| recomp replay 02 (new game to the flowers) | 21,180 | 104 (0.5 %) | 43 % / 70 % |
| replay 06 (raptor fight, from a state) | 4,481 | 3 (0.1 %) | 50 % / 65 % |
| replay 07 (alchemy fight, from a state) | 2,718 | 44 (1.6 %) | 38 % / 78 % |

Slowdown is rare and comes in spikes, not steady load. In its slowdown frames, the alchemy fight spends 60 % of a
frame in `per_frame_map_effects` ($90:9839, the spell's map effect); the prologue spends 80 % in
`script_scheduler_pass` ($8C:CFFD, cutscenes). The steady fixed work is entity physics and AI
(`entity_physics_and_gravity_tick` $8F:AFAE, 6–15 %) and the sprite draw queue (`update_entity_physics`
$80:96BB, 8–15 %).

### What this says about "move everything to the SA-1?"

- The engine is built to fill every frame: after the fixed work, `field_spare_time_loop` runs pathfinding steps
  until the NMI. "92 % busy" is by design, and **the pathfinding is elastic**: it can't cause slowdown, it only gets
  more or fewer steps.
- Only fixed work causes slowdown, and Evermore has little of it: 0.1–3 % of field frames, in spikes (spell
  effects, cutscene scripts). Moving all of it ([other-hacks.md](other-hacks.md) §5, months of work) would remove
  those spikes and little else.
- So the order is: (1) move the spikes' code if smoother spells/cutscenes are the goal, (2) the steady entity and
  sprite work if more enemies on screen is the goal, (3) the pathfinding for *better AI* (more steps), not speed.
  A whole-game move pays only together with new load (more enemies, uses 37, 40).

## 2. The experiment: pathfinding on the SA-1

Chosen because it is "enemy handling" (the 6 task slots of `field_spare_time_loop` belong to the dog and to
chasing enemies), the largest share of CPU time, asynchronous by design, and a closed call tree:

- the loop `$8F:9817–9866` and its jump table `$8F:9867` (8 entries: `$8F:A4CA` and `$8F:9AC6`, round-robin by
  `$3BC5`), the step bodies `$8F:9AC6–9F04` and `$8F:A4CA–A722`;
- 21 functions they call: in `$8F` (breadcrumbs `$9967`, raycast `$9F05`, elevation `$A458`, waypoints `$9937`,
  `$9916`, `$A8E2`, FIFO `$9E49`/`$9E77`, probes `$9EA3`/`$9EC3`, facing `$9DBD`, directions `$AA51`,
  `$A963–$A9B1`, plane `$A914`, `$A774`), `$90:9DE8` (tile collision), `$80:859B` (RNG), `$8C:CFF4`.

### How the image is built (`npm run sa1:offload`, `tools/sa1/offload.mts` + `offload.asm`)

1. The C1 image ([port.md](port.md)); BW-RAM grows to 256 KB (header `$FFD8` = `$08`).
2. Banks `$8F`, `$90`, `$80`, `$8C` (LoROM views) are copied to `$21–$24` in the free block 1, at the same
   offsets, so branches, JSR, jump tables and code-bank tables keep working.
3. In the copies, each instruction of the tree (decoded with the CDL's M/X flags) is retargeted:
   long `$7E/$7F` → `$42/$43` (the mirror), `PEA $7E7E` → `$4242` (data bank), `MVN/MVP $7E` → `$42`, JSL/JML
   inside the tree → the copy, the loop's exit → `sa1_done`; the S-CPU multiplier (`$4202/$4203` → `$4216`, two
   8 × 8 sites in the raycast) → JSLs of the same length to helpers on the SA-1's multiplier (`$2251/$2253` →
   `$2306`). The loop's frame-counter reads become `LDA #0` and `LDA $F000` (STOP in the mirror). The one `[dp]`
   pointer (`[$56]`, the raycast's grid pointer, bank byte `$58` = `$7F` set outside the tree) is rebanked by the
   SA-1 when a job starts. The builder refuses anything else that reaches S-CPU-only memory, and **any store that
   the copy back would not bring home** (§3).
4. `$8F:9817` (LoROM view) jumps to `offload_spare` at `$20:8000`; the SA-1 starts at `$00:E000` → `sa1_main`.

### What runs, each field frame

| | S-CPU (`offload_spare`) | SA-1 (`sa1_main`) |
|---|---|---|
| 1 | no live task slot → wait for the NMI, as the original | idle, polling the mailbox (I-RAM `$0600`) |
| 2 | line ≥ 110 → skip (no time for the copies), but at most 3 frames in a row | |
| 3 | grid `$7F:0000–7FFF` → `$43`: all after a room change, else 2 KB a job | |
| 4 | snapshot by DMA (channel 3): DP → I-RAM, `$0000–$01FF`, `$2900–$2C1F`, `$3BC0–$50FF` → mirror; `$08EE`, `$0F46` | |
| 5 | JOB = 1, then wait until line 185 (or the NMI) | runs the copied loop: steps until STOP |
| 6 | STOP = 1, wait for DONE | finishes the current step, DONE = 1 |
| 7 | copy back: `$3BC3–$50FF` by DMA, RNG `$0133–$013A`, the word at script thread + 9 (×11) | |
| 8 | wait for the NMI, leave by the original tail `$8F:9861` | |

The two CPUs never run game code at the same time, so copying whole ranges back is exact: nothing else writes them
in between. Memory: BW-RAM `$40:0000` the save, `$42–$43` the WRAM mirror, `$42:F000` STOP; I-RAM `$0000–$00FF`
the SA-1's direct page, `$0600–$0611` mailbox, `$0700–$07FF` its stack.

## 3. Results

| | Attract loop (replay 01) original | offload | Replay 02 original | offload |
|---|---|---|---|---|
| Field frames | 7,035 | 7,082 | 21,180 | 22,163 |
| Slowdown frames | 196 | **155** | 104 | **69** |
| Fixed load median / 95th | 46 % / 81 % | **37 % / 71 %** | 43 % / 70 % | **40 % / 58 %** |
| Steps per frame, demo rooms `$0A` / `$1A` / `$54` | 85 / 80 / 72 | 60 / 40 / 33 | | |

- **Plays**: the attract loop cycles through all its rooms for 40,000 frames; replay 02 plays the prologue and
  the lab. Screenshots of the castle demo and of Prehistoria (an earlier build that reached it) look right. Replay 02
  then stays in the lab: the replayed presses drift without lockstep (the scene keeps moving), which says nothing
  about the image.
- **Fewer slowdown frames** although the fixed work is the same code: in the original, the last step started
  before the NMI runs past it and delays the next frame. With the steps on the SA-1, the S-CPU is idle at the NMI.
- **Less pathfinding**: the S-CPU's copies (snapshot ~9 KB ≈ 55 lines, copy back ~5.4 KB ≈ 32 lines) eat the
  spare time the SA-1 was meant to use. The SA-1 runs a third fewer steps than the original's spare time did.
  **Data moves cost more than the work moved**: a median frame runs ~6 steps, ~30 k clocks, while the copies
  cost ~120 k.

### Bugs met on the way (each a rule now)

| Symptom | Cause | Kept as |
|---|---|---|
| S-CPU waits forever for DONE | the NMI's STOP could come before the SA-1 entered its loop, which then pushed STOP=1 as its "start" value | the copy's first read is `LDA #0` |
| crash in the anim VM ($90:80FC) | (a) the step bodies, which aren't function records, also store `+$10`/`+$12` of entity records; (b) Asar evaluated `$3DE5+!n*$8E` left to right and copy_back wrote across the projectile pool | the builder checks every store against the copied ranges; `asar 1.90` in offload.asm |
| S-CPU halted at once | Asar assembled `CMP #!SNAP_LINE` (decimal 110) as an 8-bit immediate in 16-bit code | `.w` on defines and short numbers in 16-bit code |
| demo stuck in room `$19` forever | jobs skipped every frame there (spare time starts after line 110); demo scripts wait for actors to arrive | a forced job after 3 skips |
| SA-1 exec callbacks never fire in MesenCE | need `emu.memType.sa1Memory` as well as `emu.cpuType.sa1` | `load.mts` |

MesenCE facts used *(Mesen source, Sa1.cpp, Sa1IRamHandler.h)*: I-RAM is write-protected per 256-byte page for
both CPUs at reset (SIWP `$2229`, CIWP `$222A`); the SA-1's I-RAM is at `$0000–$07FF` and `$3000–$37FF`;
BW-RAM size comes from header `$FFD8`, at most 256 KB; `$2254` starts a multiply.

## 4. Next, ranked

1. **Cut the copies, not the code.** Copy only the fields the tree reads (from the CDL read set of the bodies too,
   not only `functions.json`), or keep the 6 task slots in BW-RAM for good (only the tree uses them: move, don't
   mirror). That is C2 for one subsystem, and the step to more steps per frame.
2. **Run concurrently**: let the SA-1 work during the next frame's fixed work on the snapshot, and merge at the
   spare loop. Needs a per-field merge (the S-CPU writes entity records meanwhile).
3. **The spikes**: `per_frame_map_effects` in spell frames and `script_scheduler_pass` in cutscenes are where the
   rare slowdown is; profile one spell effect before choosing.
4. Second emulator / hardware ([port.md](port.md) §6) before anything ships.

Code: `tools/sa1/offload.mts`, `offload.asm`, `load.mts` ([README](../../tools/sa1/README.md)). Images and reports go
to `out/sa1/`, never committed.
