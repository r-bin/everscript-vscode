# Shared Flag Bytes `$7E:22EA` and `$7E:22EB`

Both addresses are byte-wide bitfields with multiple owners. Neither is a single-purpose room-state enum. Several native handlers use 16-bit accumulator operations at these addresses; their masks preserve the neighboring byte, so this access width does not make the script-visible flags word-wide.

## `$7E:22EA`: Gameplay, Room-Load, and Render Flags

| Mask | Observed role | Evidence and limits |
|---|---|---|
| `0x01` | Last loot attempt succeeded. | Global `0x3E` clears it before counting a pickup and sets it only on success; the gourd driver clears it for the Dog's fake pickup. [`92a584`](soe://rom/code/loot_gourd_count_in/info.md), [`92a482`](soe://rom/code/loot_gourd/info.md). |
| `0x02` | Unknown. | No meaning established. |
| `0x04` | Set during the cold-start/SRAM initialization path. | The boot code sets this bit. Its full lifecycle and all readers remain unresolved. |
| `0x08` | Room-load readiness: map/collision data ready. | The room pre-roll waits for this bit. The detailed room-spawn analysis associates it with map geometry initialization. |
| `0x10` | Room-load readiness: character records positioned. | The room pre-roll waits for this bit; it is also manipulated in intro scripts. |
| `0x20` | Room-load palette readiness; reused by intro/outro control. | The room pre-roll waits for it. Room `0x31`/`0x61` scripts clear/set it, and global `0x56` exits its hold loop when it is set. This reuse means it is not a dedicated readiness enum field. |
| `0x40` | Unknown in the game evidence reviewed here. | A prior external-core name associates it with a death screen, but no matching ROM evidence was established. |
| `0x80` | Screen-layer override latch. | Opcode `0x82` (restore) and `0x83` (apply) copy this bit into `$7E:0B29` bit 0 after updating PPU screen/color-math registers. [`8CE20F`](soe://rom/code/restore_color_math_snapshot/info.md), [`8CE247`](soe://rom/code/apply_color_math_settings/info.md). |

### Decompiled Access Paths

The following C-like descriptions summarize the reconstructed handlers; they are not claims that the bits form one state machine.

```c
// $8C:E20F, opcode 0x82: restore saved screen/color-math registers.
write_ppu(0x212C, read8(0x235B));
write_ppu(0x212D, read8(0x235C));
write_ppu(0x2131, read8(0x235D));
write_ppu(0x2130, read8(0x235E));
write8(0x0B29, read8(0x0B29) & 0xFE);
if (read8(0x22EA) & 0x80) write8(0x0B29, 0x01);

// $8C:E247, opcode 0x83: apply temporary screen/color-math registers.
write_ppu(0x212C, read8(0x0F80));
write_ppu(0x212D, read8(0x0F81));
write_ppu(0x2131, read8(0x0F82));
write_ppu(0x2130, read8(0x0F83));
// The same $22EA bit 7 -> $0B29 bit 0 latch follows.

// $8E:E508: room-entry pre-roll, after spawning queued Boy/Dog scripts.
do {
    per_frame_field_tick();
} while ((read16(0x22EA) & 0x0038) != 0x0038);
```

For loot, global `0x3E` is the writer of `$22EA` bit 0 after inventory capacity is checked; global `0x3A` (`$92:A482`) uses the result to choose success or bag-full feedback. See the two routine entries above.

## `$7E:22EB`: Room-Transition and Script Flags

| Mask | Observed role | Evidence and limits |
|---|---|---|
| `0x01` | Room-local script latch in rooms `0x02` and `0x77`. | Explicitly set and cleared by room scripts; `$90:8E90` clears it again at room entry. Exact event meaning unresolved. |
| `0x02` | Unresolved latch. | `$80:8C96` sets it on a post-room-entry branch. A second apparent write at `$80:8BA2` is in a block skipped by the visible branches at `$80:8B7A`/`$80:8B9E`, so its runtime reachability is unconfirmed. |
| `0x04` | Main-loop reload request. | `$80:8BF1` tests it and branches to `$80:8C70`; that path fades out, reloads the ROM's default starting room ID, and enters it. After room entry, `$80:8C87` tests the bit again and `$80:8C8C` clears it only if it remains set. The writer and intended trigger remain unresolved. |
| `0x08` | Unknown. | No meaning established. |
| `0x10` | Quicksand Field route handoff. | Rooms `0x5B` and `0x67` set it before entering room `0x59`; room `0x59` clears it when exiting through its east/south routes. |
| `0x20` | Exit-sequence marker. | Globals `0x27` (`$92:9FA0`) and `0x2E` (`$92:A010`) set it before fading/walking/waiting. Its consumer and clear path remain unknown. |
| `0x40` | Doorway-arrival latch. | Many indoor/outdoor transitions set it before the map change; destination enter scripts test it and clear it after the arrival branch. |
| `0x80` | Timed B-trigger gate in room `0x0A`. | The trigger checks it alongside a frame-counter threshold; setter and exact meaning unresolved. |

### Decompiled Access Paths

```c
// $80:8BB5: recurring loop checks the request and jumps to $80:8C70.
if (read16(0x22EB) & 0x0004) {
    fade_out_audio_and_reset_dsp();
    clear_sprite_priority_buffers();
    current_room_id = read16(0x928002);  // ROM default starting room
    enter_room(current_room_id);

    // $80:8C83-$80:8C93: acknowledge only after room entry.
    if (read16(0x22EB) & 0x0004) {
        write16(0x22EB, read16(0x22EB) & 0xFFFB);
        goto main_loop;
    }
}

// $90:8E90, reset_per_room_state: clear only bit 0.
write16(0x22EB, read16(0x22EB) & 0xFFFE);
```

The reset instruction operates on a word beginning at `$22EB`; `0xFFFE` clears only `$22EB` bit 0 and leaves all other bits, including the neighboring `$22EC` byte, unchanged. Do not interpret this as a full-byte clear. The existing reconstructed C summary of `$80:8B66` currently models bit 2 as cleared before re-entering the current room; the native path above instead reloads the ROM default room and acknowledges the bit after room entry, so the C summary is not authoritative for this branch.

## Interpretation

The script inventory covers room scripts only. Engine routines and global scripts add users that do not appear in that inventory: `$22EA` is shared with the loot and PPU paths, while `$22EB` is read/written by the main loop, room reset, and transition globals. The byte-wide labels describe the masks used by scripts; the wider native load/store instructions are documented separately above.

Sources: [room entry](soe://rom/code/enter_room/info.md), [main loop](soe://rom/code/main_loop_entry/info.md), [room reset](soe://rom/code/reset_per_room_state/info.md), [opcode 0x82](soe://localization/knowledge/rom/8ce20f.md), [opcode 0x83](soe://localization/knowledge/rom/8ce247.md), [room-script audit](../../scripts/unnamed-memory-audit.md).