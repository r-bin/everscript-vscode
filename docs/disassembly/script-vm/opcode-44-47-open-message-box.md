# Script Opcodes 0x44–0x47: Open a Message Box

**Routine:** `$8C:D890`\
**Confidence:** confirmed

## Shared Behavior

The handler calls `$8C:C543` to enable the cutscene pause guard and lock player input. It consumes a window index byte, resolves the window record at `$7E:034D + index*$2C`, then consumes four more bytes and writes them as words at offsets `+$16`, `+$14`, `+$1C`, and `+$1E`. The last byte is also shifted left three bits and written at `+$20`.

It clears `+$28`, initializes `+$0A`, `+$06`, `+$08`, `+$04`, and `+$0C`, calls `$8C:AC8A` to build the frame, then ORs a mode bit into `+$12`. For opcodes `0x44`–`0x46`, `+$26` receives `$7E:0B15`, `+$2A` is zero, and no mode bit is added. For `0x47`, `+$26` is `$1924`, `+$2A` is one, and `$0010` is ORed into `+$12`.

The host-side model is [8CD890_opcode_44_47_open_message_box.c](../../../reconstructed-c/8C/8CD890_opcode_44_47_open_message_box.c). Window-record mapping, the cutscene/player lock, and frame construction are delegated to named helpers.

## Evidence

- Opcode table entries `$8C:E945`, `$8C:E947`, `$8C:E949`, and `$8C:E94B` all dispatch to `$8C:D890`.
- `$8C:D967` consumes one byte and computes `$034D + index*$2C` using the SNES multiplication registers.
- `$8C:D890` reads four subsequent bytes and stores the values at the listed record offsets; the fourth is additionally shifted left three times for `+$20`.
- The saved dispatch-table offset is compared with `$008E`, identifying opcode `0x47`; that branch selects `$1924`, sets `+$2A` to one, and uses mode bit `$0010` at `+$12`.
- The common tail initializes record fields, calls `$8C:AC8A`, restores the data bank, and returns carry set.

## Opcodes 0x48–0x4B: Open the Default Message Box

The separate handler at `$8C:D8FE` uses the default record at `$7E:034D`, calls `$8C:C543` to lock player input, writes fixed geometry values (`+$14=2`, `+$16=2`, `+$1C=$1C`, `+$1E=$0A`, `+$20=$50`), and uses `$7E:0B15` as the style at `+$26`. It sets `+$2A`, `+$28`, `+$0A`, and `+$0C` to zero, initializes `+$06=1`, `+$08=0`, and `+$04=4`, then calls `$8C:AC8A`. The handler preserves the existing `+$12` flags and returns carry set.

Its host-side implementation is the second handler in [8CD890_opcode_44_47_open_message_box.c](../../../reconstructed-c/8C/8CD890_opcode_44_47_open_message_box.c).