# NMI and Auto-Joypad Setup

- **Routine:** `$80:8507`
- **Source:** [ROM disassembly](soe://bus/808507.asm?rom=vanilla)
- **C reconstruction:** [`808507_enable_nmi_auto_joypad.c`](../../../reconstructed-c/80/808507_enable_nmi_auto_joypad.c)

## Behavior

The routine saves the processor status with `PHP`, disables maskable interrupts with `SEI`, and temporarily selects 8-bit accumulator mode. It writes `$81` to the NMI/auto-joypad control register `$4200` and its WRAM mirror `$0E6B`.

It then selects 16-bit accumulator mode, sets X to `$858B`, loads A with `$0080`, stores A to `$012D`, and stores X to `$012B`. The meanings of `$012B` and `$012D` are not established here, so they remain address-named fields in the model. `PLP` restores the original processor status before `RTL`.

On return, A is `$0080`, X is `$858B` (assuming 16-bit index-register mode on entry), and the processor status is restored. The routine's only documented hardware control write in this reconstruction is `$4200 = $81`.

## Instruction-to-C Mapping

| Assembly operation | Reconstructed effect |
|---|---|
| `PHP` / `SEI` | Save P and set its interrupt-disable bit for the critical writes |
| `SEP #$20`; `LDA #$81`; `STA $4200`; `STA $0E6B` | Write the control byte and its mirror |
| `REP #$20`; `LDX #$858B`; `LDA #$0080` | Set the final 16-bit X and A values |
| `STA $012D`; `STX $012B` | Store the two values in WRAM |
| `PLP`; `RTL` | Restore P and return to the caller |