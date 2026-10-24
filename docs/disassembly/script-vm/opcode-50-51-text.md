# Script Opcodes 0x50 and 0x51: Render Dialogue Text

**Handlers:** `$8C:D9FD` (`0x50`), `$8C:DA0A` (`0x51`)\
**Confidence:** confirmed

## Opcode 0x50: Text in a Selected Window

Consumes a window-index byte, resolves the text-window record through `$8C:D967`, then consumes a 16-bit string key.

## Opcode 0x51: Text in the Default Window

Selects the default record at `$7E:034D`, then consumes a 16-bit string key.

## Shared Text Pipeline

Both handlers pass the key to `$8C:CCF5`, which looks up and unpacks the 24-bit dialogue string pointer from the table at `$91:D000` into buffer `$7F:D81E`. They then pass the selected window record to `$8C:9E03` for variable-token expansion and rendering. Both handlers return carry set.

The host-side models are in [8CD9FD_opcode_50_51_text.c](../../../reconstructed-c/8C/8CD9FD_opcode_50_51_text.c). String lookup and rendering internals are delegated to named helpers.

## Evidence

- Opcode table entries `$8C:E95D` and `$8C:E95F` dispatch to `$8C:D9FD` and `$8C:DA0A` respectively.
- `$8C:D9FD` calls `$8C:D967` before entering the shared text path; `$8C:DA0A` loads `$034D` as the default window record.
- The shared path consumes a 16-bit key, calls `$8C:CCF5`, loads the selected window record, calls `$8C:9E03`, restores the data bank, and returns carry set.