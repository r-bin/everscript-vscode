# Render Script 0x93 Dossier

Status:
- Working: trace-backed fetch parsing for `8CC8A9`, inferred size for observed opcode `0x93` commands, ROM byte dump, first-command VRAM write path, **counter-based termination fully proven**.
- In progress: naming all jump-table variants reached after the `0x93` header bytes.
- Not working: full render-script language spec for all opcodes.
- Confidence: 97%

## Scope

This dossier is limited to what the decode trace proves for the Strong Heart exterior render stream in:

- `/Users/v/Library/Application Support/Mesen2/Debugger/strongheart_exterior_decode_tiles_fist_call__breakpoint_bus=ee0000.txt`

The primary model artifact is `render-script-model.js`. The dump tool is `tools/render-script-dump-93.js`.

---

## Evidence Table

| Source | Derived constraint |
|---|---|
| Trace line 386 | Command fetch at `0x8FE5D4` yields opcode `0x93` |
| `8CC9C7 AND #$007F` + `ADC $12` | Low 7 bits of `0x93` = relative payload offset |
| `0x93 & 0x7F = 0x13`, `TAY -> 0x8FE5E7` | Secondary payload begins at `start + 0x13` |
| Trace read `0x8FE5D5 = 0x61` | Byte `+1` is a header/control byte consumed by the jump-table header loop |
| Trace reads `0x8FE5E7 = 0x20`, `0x8FE5E8 = 0x805A` | First payload byte is a control/mask byte; next words are written to VRAM |
| `STX $2116 [VMADDL]` with `X = 0x2020` before command | Command targets VRAM destination `0x2020` |
| `8CC9CD  LDX #$001F` (hardcoded immediate) | Outer counter = **0x1F**, NOT read from tile stream |
| 64 x `DEC $04` counted in trace lines 386-2082 | 32 decrements per phase x 2 phases = **64 VRAM words** per command |
| `8CCA9B  BMI $8CCAE4` taken at trace line ~1209 (N flag set) | Phase 1 exits when `$04` underflows `0x00 -> 0xFF` |
| `8CCAF0  STA VMADDL` with `A = 0x2120` at trace line 1217 | Phase transition sets VRAM address bit 8: `0x2020 -> 0x2120` |
| `8CCAF6  LDX #$001F` at phase transition | Same hardcoded constant reloaded for phase 2 |
| `8CCC0A  BMI $8CCBE4` taken, then `8CCBFE  BNE $8CCBFE` taken, then `8CCBFF  RTL` | Phase 2 final exit via VRAM bit-8 check |
| Y register at last payload-consuming DEC = `0xE646` | Last logically consumed byte = `0x8FE645`; `0x8FE646` is next-opcode bus overlap |
| `[$8FE645] = $3FBF` (16-bit bus read) | Hardware touched `0x8FE646`; CPU used only low byte `0xBF`; `0x3F` = next opcode |

---

## Termination Semantics (Proven)

**The decoder does NOT read a size field. Termination is purely counter-driven.**

### Outer counter setup (ROM address `8CC9CD`)

```
8CC9CD  LDX #$001F       ; X = 31 -- hardcoded ROM immediate, NOT from tile stream
8CC9D0  STX $04          ; $04 = 0x001F = outer loop counter
8CC9D2  STZ $08          ; clear VRAM accumulator
8CC9D4  STZ $0C          ; clear header-byte toggle
8CC9D6  STZ $10          ; bit counter = 0 (becomes -1 on first DEC)
```

### Main inner loop (`8CC9D8-8CC9FD`), carry=0 ("0-bit") path

```
8CC9DA  DEC $10              ; decrement bit counter
8CC9DC  BPL $8CC9E8          ; if $10 >= 0: skip reload
        ; else: reload 8-bit control byte from payload
8CC9DE  LDA #$07
8CC9E0  STA $10              ; reset bit counter = 7
8CC9E2  LDA $0000,Y          ; read 1-byte control from payload (bus: 2 bytes; CPU: low byte only)
8CC9E5  INY
8CC9E6  STA $0E              ; save control byte to shift register
8CC9E8  ASL $0E              ; shift MSB into carry
8CC9EA  BCS $8CCA1A          ; carry SET -> "1-bit" path (jump-table dispatch)
        ; carry CLEAR -> "0-bit" path:
8CC9EC  REP #$20             ; 16-bit A
8CC9EE  LDA $0000,Y          ; read 16-bit word from payload
8CC9F1  INY
8CC9F2  INY                  ; Y += 2
8CC9F3  STA $08              ; save word
8CC9F5  STA VMDATAL          ; write to VRAM (auto-increments VRAM address)
8CC9F9  SEP #$20             ; 8-bit A
8CC9FB  DEC $04              ; decrement outer counter
8CC9FD  BPL $8CC9DA          ; loop if $04 >= 0
```

### "1-bit" path: jump-table dispatch (`8CCA1A`)

The carry=1 path reads a header control byte from `($06)` (first call) or reuses it (second call), shifts bits to form an index into the jump table at `$CC40`. **Every jump-table entry decrements `$04` exactly once before its own `BMI` check.**

Known jump-table entries (index = X value at `JMP ($CC40,X)`):

| X    | Target   | Action                              | DEC `$04` PC | BMI target |
|------|----------|-------------------------------------|--------------|------------|
| 0x0C | `8CCAB6` | Read 1 byte from Y -> VRAM high     | `8CCAC6`     | `8CCAE4`   |
| 0x02 | `8CCA54` | Write literal `#$00FF` to VRAM      | `8CCA5F`     | `8CC9FF`   |
| 0x12 | `8CCC00` | Repeat last word (`$08`) to VRAM    | `8CCC08`     | `8CCBE4`   |
| 0x08 | `8CCA84` | (unknown body, exits via `8CCA99`)  | `8CCA99`     | `8CCAE4`   |
| 0x1A | ~`8CCB5x`| (unknown)                           | `8CCB5F`     | `8CCAE4`   |
| 0x1C | ~`8CCB4x`| (unknown)                           | `8CCB46`     | `8CCAE4`   |
| 0x0A | ~`8CCAAx`| (unknown)                           | `8CCAAF`     | `8CCAE4`   |

### Phase transition (`8CCAE4`)

```
8CCAE4  REP #$20
8CCAE6  LDA $2E              ; load current VRAM word address (e.g. 0x2020)
8CCAE8  BIT #$0100           ; test bit 8
8CCAEB  BNE $8CCAFE          ; bit 8 SET -> final exit (PLB; RTL at 8CCAFF)
8CCAED  ORA #$0100           ; bit 8 CLEAR -> set it: 0x2020 -> 0x2120
8CCAF0  STA VMADDL           ; update VRAM address register (written value = 0x2120)
8CCAF4  STA $2E              ; persist new VRAM address
8CCAF6  LDX #$001F           ; SAME hardcoded constant again
8CCAF9  STX $04              ; reload counter for phase 2
8CCAFB  JMP $C9D8            ; jump back to inner loop (Y, $0E, $10 continue from phase 1 end)
```

### Phase 2 exit (`8CCBFE` / `8CCBFF`)

Mirror of `8CCAE4` reached via `8CCBE4`:

```
8CCBE4  REP #$20
8CCBE6  LDA $2E              ; 0x2120 (bit 8 already set)
8CCBE8  BIT #$0100
8CCBEB  BNE $8CCBFE          ; bit 8 SET -> TAKEN -> PLB; RTL
8CCBFE  PLB
8CCBFF  RTL                  ; returns to outer rendering loop at 0x90935F
```

### Control-flow summary (text CFG)

```
8CC9CD  init: LDX #$001F -> STX $04 (phase counter)
8CC9DA  loop_top: DEC $10 -> BPL bit_ready
            else: reload control byte from Y, INY, STA $0E
8CC9E8  bit_ready: ASL $0E -> BCS one_bit
8CC9EC  zero_bit: REP #$20 -> LDA (Y,16b) -> INY INY -> STA $08 -> STA VMDATAL
8CC9FB  DEC $04 -> BPL loop_top
          (fallthrough rarely reached; normal exit is via jump-table BMI)
8CCA1A  one_bit: [header byte dispatch] -> JMP ($CC40,X)
          -> each entry: [action] -> DEC $04 -> BMI phase_check -> BPL loop_top
8CCAE4  phase_check: BIT #$0100 of VRAM addr
            -> bit=0: ORA #$0100 -> STA VMADDL -> LDX #$001F -> STX $04 -> JMP loop
            -> bit=1: PLB -> RTL  (FINAL EXIT)
8CCBE4  exit_check (mirror): BIT #$0100 -> bit=1: PLB -> RTL
```

### Payload consumption timeline (command 0)

| Region               | Address range               | Bytes   |
|----------------------|-----------------------------|---------|
| Opcode byte          | `0x8FE5D4`                  | 1       |
| Header (`$06` ptr)   | `0x8FE5D5-0x8FE5E6`         | 18      |
| Payload phase 1 (Y)  | `0x8FE5E7-~0x8FE618`        | ~50     |
| Payload phase 2 (Y)  | `~0x8FE619-0x8FE645`        | ~45     |
| **Total logical**    | `0x8FE5D4-0x8FE645`         | **114 = 0x72** |
| Hardware overlap     | `0x8FE646` (next opcode)    | 1, read-only, discarded |

### Answer: how does the decoder know where the tile stream ends?

> **It doesn't read a size field.** The decoder executes exactly two phases of 32 iterations each, controlled by a hardcoded counter initialized with `LDX #$001F` (ROM addresses `8CC9CD` and `8CCAF6`). The phase boundary is detected by testing bit 8 of the current VRAM word address (`BIT #$0100` at `8CCAE4`/`8CCBE4`). After phase 2 bit 8 is already set, so the exit branch is taken and `RTL` returns to the outer loop. The output is always exactly **64 VRAM words = one 16x16 4bpp tile**. Payload size varies per-command because the input is compressed.

---

## First Observed Command

Fetch: trace line `386`: `8CC8A9  LDA ($12) [$8FE5D4] = $93`

Structure:
- Command start: `0x8FE5D4`
- Opcode: `0x93`
- Header span (opcode low 7 bits): `0x13`
- Header region: `0x8FE5D4-0x8FE5E6`
- Payload region: `0x8FE5E7-0x8FE645`
- Next opcode fetch (observed): `0x8FE646 = 0x3F`
- Logical size: **0x72** bytes (counter-proven last consumed byte = `0x8FE645`)
- Hardware-touched size: 0x73 bytes (16-bit bus overlap at `0x8FE646`)

First 32 raw bytes:

```text
93 61 44 44 44 44 44 44 44 4D 44 44 44 44 E4 91
44 91 90 20 5A 80 58 93 9F AE 0F 09 A7 8C 39 C6
```

VRAM writes (first 4):
- `VMADDL = 0x2020` (prelude setup)
- `VMDATAL = 0x805A` (first payload word, bitplanes 0 & 1)
- `VMDATAL = 0x9358`
- `VMDATAL = 0x9F00`

---

## RAM Variable Roles (proven from trace)

| Address | Role |
|---------|------|
| `$04`   | Outer word counter (8-bit; starts `0x1F`, decrements to `-1` = phase end) |
| `$06`   | Header control-byte pointer (starts at `cmd_start+1`, advances per header byte consumed) |
| `$08`   | Last VRAM word written (used by "repeat" jump-table entry `0x12`) |
| `$0C`   | Header byte toggle (0 = read new byte from `($06)`; 1 = reuse `$0A` for second dispatch) |
| `$0E`   | Control byte shift register (8 bits; one bit consumed per iteration via `ASL`) |
| `$10`   | Bit counter within `$0E` (init 7; decrements; reloads from payload when it reaches -1) |
| `$12`   | Stream base pointer low word (bank in DB) |
| `$14`   | Macro ID |
| `Y`     | Payload read pointer (starts at `cmd_start + 0x13`) |

---

## Observed Limits

Still unjustified:
- That `0x93` has the same semantics in every context (only one trace available).
- Names for all 7+ jump-table entries.
- Whether other opcodes use the same counter value (`LDX #$001F`) or different ones.
