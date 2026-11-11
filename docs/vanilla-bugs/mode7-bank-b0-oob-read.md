# Mode 7 Bank `$B0` Out-of-Bounds ROM Read (`$80:D113`)

- **ROM Routine**: [`row_table_low_bytes_from_bank_b0`](../../src/games/evermore/localizations/knowledge/routines/row_table_low_bytes_from_bank_b0.md) (`$80:D113` – `$80:D22C`, falling through from [`mode7_camera_matrix_projection_update`](../../src/games/evermore/localizations/knowledge/routines/mode7_camera_matrix_projection_update.md) at `$80:CFA9`)
- **VFS URI**: `soe://rom/code/row_table_low_bytes_from_bank_b0/info.md`, `soe://tags/mode7/bug_bank_b0.md`
- **Subsystem**: Bank `$80` Mode 7 Overworld Flight Engine ([`docs/disassembly/engine-core/mode7-overworld-engine.md`](../disassembly/engine-core/mode7-overworld-engine.md))
- **Affected Bus / File Range**: Reads `$B0:E293,X` (`X = $7E:14C6 << 6`, `0x0000..0x0780`), mapping to unheadered ROM file offsets **`0x30E293` – `0x30EA51`** in the unpopulated 4th megabyte of the 3 MB (24 Mbit) HiROM cartridge
- **Affected WRAM Range**: Writes 32 bytes to **`$7E:2090` – `$7E:20AF`** ([`MODE7_PERSPECTIVE_SCALE_BYTES`](../../src/games/evermore/localizations/knowledge/wram/MODE7_PERSPECTIVE_SCALE_BYTES.md))
- **Visible In-Game Symptom**: **None on retail hardware** (the destination buffer `$7E:2090..$7E:20AF` is dead WRAM that is never read by any CPU instruction or DMA transfer), **critical WRAM divergence** in lockstep emulator comparisons, static recompilation (`SecretOfEvermoreRecomp`), 4 MB HiROM expansions, and ExHiROM conversions.

---

## 1. Summary

During Mode 7 overworld flight scenes (triggered via Everscript opcode `0x99` at `$8C:E66F` → `$80:BC00`), the routine at `$80:CFA9` updates the 32-column **PPU Mode 2 Offset-Per-Tile (OPT) vertical scroll table** in WRAM (`$7E:2050..$7E:208F`) used to shear the sky layer when the aircraft banks left or right.

Immediately after writing those 32 16-bit words from the Bank `$80` lookup table at `$80:E293,X`, execution falls through to `$80:D113`, which switches the 65c816 Data Bank register (`DB`) using `PEA $B090; PLB; PLB` and copies 32 low bytes from **`$B0:E293,X`** into **`$7E:2090..$7E:20AF`**.

Because `PLB` pops the low byte (`$90`) first and the high byte (`$B0`) second, `DB` becomes **`$B0`**. In HiROM mapping, Bank `$B0` (`$B0:8000–$B0:FFFF`) mirrors the upper half of Bank `$F0` (`$F0:8000–$F0:FFFF`), corresponding to ROM file offset **`0x308000–0x30FFFF`** — inside the **4th megabyte (`0x300000–0x3FFFFF`)** of a ROM that is only **3 megabytes (`0x000000–0x2FFFFF`)** long.

---

## 2. Disassembly & Root Cause

### 2.1 First Pass (`$80:CFA9` – `$80:D112`): Mode 2 Sky OPT Vertical Scroll Words

At `$80:CFA9` ([`mode7_camera_matrix_projection_update`](../../src/games/evermore/localizations/knowledge/routines/mode7_camera_matrix_projection_update.md)), the engine computes `X = $7E:14C6 * 64` (where `$7E:14C6` is the roll/bank tilt index `0..30`, neutral `15` / `$0F`, so `X = $03C0` when flying level) and unrolls 32 16-bit word additions from the table at **`$80:E293`** (`31 rows × 32 words = 1,984 bytes`, `$80:E293..$80:EA52`):

```asm
; $80:CFA9 — 16-bit A/X, DB = $7E (or caller DB; uses 24-bit long addressing $80:E293,X)
$80CFA9  c2 30       rep #$30
$80CFAB  ad c6 14    lda $14C6          ; Roll/bank angle index (0..30, neutral = 15)
$80CFAE  0a          asl a
$80CFAF  0a          asl a
$80CFB0  0a          asl a
$80CFB1  0a          asl a
$80CFB2  0a          asl a
$80CFB3  0a          asl a              ; A = $14C6 * 64 (byte offset of 32-word row)
$80CFB4  aa          tax                ; X = row offset ($03C0 when $14C6 == 15)
$80CFB5  18          clc
$80CFB6  bf 93 e2 80 lda $80E293,x      ; Column 0 Mode 2 OPT word ($A000 | vscroll)
$80CFBA  6d c8 14    adc $14C8          ; + sky vertical offset ($7E:14C8)
$80CFBD  8f 50 20 7e sta $7E2050        ; -> WRAM $7E:2050 (Row 1, Col 0 of VRAM $6400 OPT table)
...
; (Unrolled for all 32 tile columns: $80:E293+2n,X + $14C8 -> $7E:2050+2n .. $7E:208E)
```

Each entry in `$80:E293` has bit 15 (`$8000`, Mode 2 OPT vertical scroll select) and bit 13 (`$2000`, enable OPT for BG1) set (`$A0xx`). During V-Blank, `$80:D91B` ([`vram_dma_upload_window_attribute_buffer`](../../src/games/evermore/localizations/knowledge/routines/vram_dma_upload_window_attribute_buffer.md)) and `$80:CA5E` DMA **128 bytes (`$0080`)** from **`$7E:2010..$7E:208F`** to **VRAM word `$6400`** (`BG3SC = $64` in Mode 2):
- `$7E:2010..$7E:204F` (64 bytes, zeroed at init): **Row 0** of `BG3` (horizontal OPT offsets = 0).
- `$7E:2050..$7E:208F` (64 bytes, written by `$80:CFA9`): **Row 1** of `BG3` (vertical OPT offsets shearing the 32 columns of the Mode 2 sky layer above the horizon scanline).

### 2.2 Second Pass (`$80:D113` – `$80:D22C`): The Bank `$B0` Bug

Immediately after storing the 32nd word to `$7E:208E`, `$80:CFA9` falls through to `$80:D113` ([`row_table_low_bytes_from_bank_b0`](../../src/games/evermore/localizations/knowledge/routines/row_table_low_bytes_from_bank_b0.md)):

```asm
$80D113  e2 20       sep #$20           ; 8-bit accumulator
$80D115  8b          phb                ; Save caller Data Bank
$80D116  f4 90 b0    pea $B090          ; Push $B0 (high), $90 (low)
$80D119  ab          plb                ; Pop $90 into DB
$80D11A  ab          plb                ; Pop $B0 into DB  <-- BUG: DB is now $B0!
$80D11B  bd 93 e2    lda $E293,x        ; Reads $B0:E293,X (file 0x30E293+X, past 3 MB ROM!)
$80D11E  8f 90 20 7e sta $7E2090        ; Writes to $7E:2090
$80D122  bd 95 e2    lda $E295,x        ; Reads $B0:E295,X
$80D125  8f 91 20 7e sta $7E2091        ; Writes to $7E:2091
...
; (Unrolled 32 times for $E293+2n,X -> $7E:2090+n .. $7E:20AF)
$80D219  bd d1 e2    lda $E2D1,x        ; Reads $B0:E2D1,X
$80D21C  8f af 20 7e sta $7E20AF        ; Writes to $7E:20AF
$80D220  ab          plb                ; Restore caller Data Bank
$80D221  c2 30       rep #$30           ; 16-bit A/X
$80D223  ad 50 20    lda $2050          ; Column 0 Mode 2 OPT word ($A000 | vscroll)
$80D226  29 ff 01    and #$01FF         ; Strip $A000 OPT control bits, keep 9-bit scroll
$80D229  8d 50 20    sta $2050          ; Column 0 uses hardware BG1VOFS ($210E) in $80:DF72
$80D22C  60          rts
```

### 2.3 Why `PEA $B090; PLB; PLB` Happened

Every other `PHB; PEA $xxxx; PLB; PLB` sequence in Bank `$80` duplicates the bank byte (for example, `PEA $7E7E` at `$80:BC9A` and `$80:C0DF`, or `PEA $7F7F` at `$80:C0F5` and `$80:D9AA`). Here:
1. The first pass (`$80:CFA9`) already reads `$80:E293,X` using 24-bit absolute long indexed addressing (`BF 93 E2 80`).
2. The second pass (`$80:D113`) uses 16-bit absolute indexed addressing (`BD 93 E2`, `LDA $E293,X`) with the identical base offset `$E293` and the same `X = $14C6 * 64` index, extracting the 32 low bytes of the row into `$7E:2090..$7E:20AF`.
3. Instead of `PEA $8080` (to read the low bytes of `$80:E293,X`), the instruction was assembled as `PEA $B090` (`F4 90 B0`), leaving `DB = $B0`.

---

## 3. Call Chain & Trigger Conditions

`$80:CFA9` → `$80:D113` is reached from two paths during Mode 7 overworld scenes (opcode `0x99`, handler [`script_op_99_mode7_scene`](../../src/games/evermore/localizations/knowledge/routines/script_op_99_mode7_scene.md) at `$8C:E66F` → `JSL $80BC00`):

1. **Bootstrap Initialization (`$80:BC00` → `$80:BC7A` → `$80:CFA5` → `$80:CFA9`)**:
   - Executed **once** at the start of every Mode 7 scene (regardless of whether `$7E:0E70` selects full-screen Mode 7 or split-screen Mode 2 + Mode 7), with initial roll angle `$7E:14C6 = 15` (`X = $03C0`), reading `$B0:E653..$B0:E691` (every even byte, 32 reads).
2. **Per-Frame Banking Tilt Update (`$80:C95B` → `$80:CE35` → `$80:CEB4`/`$80:CEC4` → `$80:CFA9`)**:
   - Executed during split-screen Mode 7 flight (`$80:C95B`) whenever the player banks left or right (`$80:CEB4` increments `$14C6` up to `30`, `$80:CEC4` decrements `$14C6` down to `0`, and `$80:CF39`/`$80:CF64` return `$14C6` toward neutral `15` when D-pad Left/Right is released) or when pitch altitude `$7E:14B8` changes (`$80:CEA2`).
   - Across all roll angles `$14C6` in `0..30`, `X = $14C6 * 64` ranges from `$0000` to `$0780`, so `$B0:E293,X` can address **`$B0:E293` through `$B0:EA51`** (`0x30E293..0x30EA51`).

---

## 4. Why the Bug Is Invisible on Retail Hardware (`$7E:2090..$7E:20AF` Is Unread)

An exhaustive search of all instructions and DMA configurations in Bank `$80` (and across the entire ROM) shows that **`$7E:2090..$7E:20AF` is never read**:

1. **CPU Instructions**: The only instructions in the ROM that reference `$2090..$20AF` (via 24-bit `$7E:2090..$7E:20AF` or 16-bit `$2090..$20AF`) are the 32 `STA $7E2090..$7E20AF` instructions at `$80:D11E..$80:D21C` (plus the general WRAM clear loop at boot).
2. **VRAM DMA (`$80:D91B` and `$80:CA5E`)**: Both callers transfer **128 bytes (`$0080`)** starting at **`$7E:2010`** to VRAM word `$6400`:
   $$\text{Range} = \text{\$7E:2010} + \text{\$0080} - 1 = \text{\$7E:208F}$$
   The DMA transfer stops at `$7E:208F`, the last byte of `$7E:2050..$7E:208F`, and never touches `$7E:2090..$7E:20AF`.
3. **Why `$80:D113` Likely Exists**: Looks like a vestigial software pre-bake of the 8-bit vertical scroll offsets (`($80:E293,X) & $FF`) into `$7E:2090..$7E:20AF` that was superseded once `$80:CFA9` wrote full Mode 2 OPT words (`$A000 | vscroll`) directly into `$7E:2050..$7E:208F` for hardware DMA to `BG3SC` (`$6400`). Notice also lines `$80:D223–$80:D229` at the end of `$80:D113`: they strip the `$A000` OPT enable bits from column 0 (`$7E:2050 &= $01FF`) because the scanline 5 raster IRQ (`$80:DF72`) reads `$7E:2050` and writes it directly to hardware `BG1VOFS` (`$210E`) for the leftmost tile column!

---

## 5. Impact Across Hardware, Emulators, Recomp & ROM Hacks

Because `$B0:E293,X` maps to file offset `0x30E293 + X` in the unpopulated 4th MB of the 3 MB ROM, different platforms resolve the read differently (see [`.agents/skills/memory-map/SKILL.md`](../../.agents/skills/memory-map/SKILL.md) §6):

| Environment | What `$B0:E293,X` (`0x30E293+X`) Returns | Effect on `$7E:2090..$7E:20AF` |
|---|---|---|
| **Retail Cartridge / ares / bsnes** (2 MB + 1 MB ROM chips) | The 1 MB chip (`0x200000–0x2FFFFF`) is mirrored into the 4th MB (`0x300000–0x3FFFFF`), reading **file `0x20E293 + X`** (Bank `$E0:E293,X`). | Deterministic hardware bytes from Bank `$E0`; never read back by the game. |
| **Bundled `snes9x2005-wasm`** | Mirrors the 4th MB back to the 1st MB (`0x000000–0x0FFFFF`), reading **file `0x00E293 + X`** (Bank `$80:E293,X`, the actual Mode 2 OPT table!). | Matches what the programmer originally intended (`$80:E293,X`), masking the bug. |
| **MesenCE** (`BaseCartridge::Init` power-of-two rounding loop) | Due to a byte-vs-page counter bug in Mesen's non-power-of-two HiROM mirror loop, every `$8000` window in `$B0–$BF` / `$F0–$FF` maps to the first 32 KB of the 3rd MB (**file `0x200000 + (addr & 0x7FFF)`**, i.e., `0x206293 + X`). | Diverges from both hardware (`0x20E293+X`) and `snes9x2005` (`0x00E293+X`) at `$7E:2090..$7E:20AF`. |
| **`SecretOfEvermoreRecomp`** | Uses true hardware 2 MB + 1 MB mirroring (`0x20E293+X`) by default, with a compare-mode override for MesenCE lockstep (`docs/imperfections/mesen-rom-mirror.md` in the recomp repo). | Requires explicit handling in frame-accurate WRAM comparison harnesses. |
| **Everscript 4 MB HiROM Expansion** (`0x308000+` custom code/data) | Bank `$F0` (`0x300000–0x30FFFF`) is populated with compiled Everscript code and assets starting at `0x308000`, so `$B0:E293,X` reads **whatever custom code/data sits at `0x30E293..0x30EA51`**. | Changes `$7E:2090..$7E:20AF` whenever `0x30E293..0x30EA51` changes, breaking strict WRAM lockstep tests unless fixed or masked. |
| **ExHiROM 8 MB Port** (`tools/exhirom/convert.js`, `prove.js`) | Populates the 4th MB explicitly; [`docs/exhirom/port.md`](../exhirom/port.md) §4 caught this exact instruction during 30-movie CDL bus auditing (`$80:D113` reading `0x30E653..0x30E691` when `X = $03C0`). | Must mirror or patch `$80:D116` (`PEA $8080`) to keep WRAM identical across layouts. |

---

## 6. Clean Fix (1-Byte ROM Patch)

If a ROM hack or clean-room patch wishes to eliminate the out-of-bounds read so `$80:D113` reads Bank `$80` as intended:

```asm
; Change PEA $B090 ($80:D116: F4 90 B0) to PEA $8080 (F4 80 80):
org $80D116
    pea $8080
```

