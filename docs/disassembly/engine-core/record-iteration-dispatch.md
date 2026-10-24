# Indirect Sequence Iteration and Dispatch

**Routine:** `$8E:A3EB`\
**Range:** `$8E:A3EB`–`$8E:A443`\
**Confidence:** observed control flow; caller and data semantics unresolved

## Observed Flow

The clean vanilla VFS disassembly places an `RTS` at `$8E:A3EA`, immediately before this routine's entry, and another `RTS` at `$8E:A443`. The code between those boundaries forms a loop. It calls `$8E:AE85`, sets up a repeated operation using direct-page pointer `$95`, calls `$8E:ADBC`, and branches back to `$8E:A3EB` when that call returns with carry clear.

When `$8E:ADBC` returns with carry set, the routine tests accumulator bit `$0040`. If the bit is clear, it returns. If set, it derives an index through reads relative to `$95`, performs two indexed reads in bank `$8E`, and invokes the indirect subroutine selected through `$8E:A444,X`. That subroutine's carry-clear path repeats the loop; its carry-set path returns.

The reconstruction in [`reconstructed-c/8E/8EA3EB_indirect_sequence_dispatch.c`](../../../reconstructed-c/8E/8EA3EB_indirect_sequence_dispatch.c) keeps the called routines and banked memory accesses as explicit boundaries where their complete effects are not represented here.

## Evidence and Limits

- Read from the clean vanilla VFS at file offset `$0EA3EB`, which maps to `$8E:A3EB`.
- The entry begins after the preceding routine's `RTS`; `$8E:A443` contains the terminal `RTS`, and the indexed dispatch begins at `$8E:A444`.
- The routine calls `$8E:AE85`, already identified separately as a screen/ring-menu cleanup routine. This call alone does not establish the purpose of `$8E:A3EB`.
- No caller has been established. The structure and meaning of the data reached through `$95`, the lookup tables at `$8E:8000` and `$8E:0000`, and the dispatch entries at `$8E:A444` remain unresolved.
- The calls at `$8C:AF2B`, `$8C:9E03`, and `$8E:ADBC` are not given additional behavior here; their effects on registers and memory may affect the loop's inputs.