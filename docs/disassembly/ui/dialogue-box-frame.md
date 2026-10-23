# Dialogue Window Frame & Message Queue Manager

**Addresses**:
- `dialogue_queue_tick`: `$8C:C436` – `$8C:C462`
- `dialogue_window_open_next`: `$8C:C463` – `$8C:C4F5`
- `dialogue_queue_reset`: `$8C:C4F6` – `$8C:C520`
- `dialogue_queue_push_message`: `$8C:C521` – `$8C:C542`
- `dialogue_queue_pause`: `$8C:C543` – `$8C:C55C`
- `dialogue_queue_unpause`: `$8C:C55D` – `$8C:C5E1`
- `window_frame_synthesize_tilemap`: `$8C:AC8A` – `$8C:ACCF`
- `window_tilemap_dma_commit`: `$8C:ACD0` – `$8C:AD9D`

**ROM Source**: Bank `$8C` (US 1.0)
**Subsystem**: User Interface / Text Window Engine

---

## 1. Overview & Architectural Role

The Secret of Evermore text presentation system uses a circular FIFO message queue to decouple game script execution from on-screen dialogue presentation. Script opcodes (such as opcode `0x52` `message`) push 24-bit far text pointers into this circular queue without blocking the script interpreter.

A dedicated frame stepper (`dialogue_queue_tick`) polls the queue each V-Blank / game loop iteration:
1. **Dynamic Pacing**: When the message queue accumulates 3 or more pending messages (queue depth $\ge 9$ bytes), the display timer accelerates from 120 frames (2.0 seconds at 60 Hz) to 60 frames (1.0 second) to prevent message overflow and backpressure.
2. **Window Frame Geometry**: Configures a 30-column by 2-row border window at scanline row 20 (`$14`) using base tile attribute `$1924`.
3. **Shadow VRAM Tilemap**: Synthesizes the 9-slice window border and background tiles directly into shadow RAM at `$7F:C800`, computing line strides (64 bytes = 32 tiles/row) and queueing synchronous VRAM DMA transfers via `$80:8650`.

---

## 2. Data Structures & Memory Layout

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CC436_dialogue_box_frame.c`](../../../reconstructed-c/8C/8CC436_dialogue_box_frame.c).
> [View in VFS: soe://rom/code/8CC436](soe://rom/code/8CC436?c=1&asm=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CC436_dialogue_box_frame.c`](../../../reconstructed-c/8C/8CC436_dialogue_box_frame.c).
> [View in VFS: soe://rom/code/8CC436](soe://rom/code/8CC436?c=1&asm=0)


---

## 4. Verification & Behavioral Equivalence

1. **Circular Queue Indexing**: Matches 3-byte entry layout (`uint16_t text_ptr_low`, `uint8_t text_ptr_bank`) wrapped at 24 bytes (`0x18`).
2. **Speed-Up Heuristic**: Verified against assembly `$8C:C47C` (`CMP #$0009`): 3 or more queued messages accurately trigger 60-frame countdown instead of 120 frames.
3. **Hardware Multiply & Stride**: Matches hardware registers `$4202` / `$4216` used to compute 64-byte row strides into `$7F:C800` shadow VRAM buffer and VRAM target address offset `+0x0800`.

