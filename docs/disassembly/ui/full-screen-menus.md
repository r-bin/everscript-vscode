# Full-screen menus (US 1.0): how a stone-background screen is built

What the game's own full-screen pages (Alchemy Setup, the Formulas / Ingredients pages, status, preferences) call,
found for the cheat menu demo ([cheat-menu.md](../../open-evermore/cheat-menu.md)), which uses every point below.
Evidence: *(run)* seen in MesenCE with new code calling it; *(read)* read in the code only.

## Which screen is which *(run)*

| Screen | Setup | Loop | Opened by |
|---|---|---|---|
| Alchemy Setup (list, side panel, description) | `$8D:B7D6` | `$8D:B98F` | script opcode `0x63` (`$8C:DF75`) |
| Alchemy Formulas / Ingredients (read only, L and R pages) | `$8D:C321` | `$8D:C803` | options ring, `ring_option_alchemy` `$8E:95A6` |

## Calling convention *(run)*

`jsl`, A / X / Y 16 bits, D = 0, DB = a bank that mirrors low WRAM (`$80`). A, X, Y and direct page `$02-$48` do not
survive a call: keep state in absolute WRAM.

## Enter and leave *(run)*

Enter: `menu_open_delay_frames_and_input_flush` (`$02` = `$10`, `$04` = `$E0`: fade out), `oam_finalize_and_blank_unused`,
`wait_for_nmi`, `dialogue_window_flush_to_vram`, `video_subsystem_hardware_registers_and_ppu_reset` (forced blank, mode
4, the 8bpp stone background on BG1, the 2bpp text and frame layer on BG2: nothing else is needed for the background),
the screen's own setup, then `$7E:0106` = 0 and `$7E:0B83` = `$800F` (fade in), the loop.

Leave: the same first four calls, `field_screen_ppu_layers_and_hud_vram_init`, `ui_dialog_decompression_bootstrap`,
`wait_for_nmi`, `window_system_reset_and_buffers_clear`, `field_hud_meters_refresh_and_reactivate` (X = the Boy), fade in.
Nothing of the field is saved: it is rebuilt.

A screen opened from the field loop also pauses the world (`cutscene_pause_activate` / `cutscene_dialogue_activate`).

## Frames, windows, text *(run)*

| What | How |
|---|---|
| blank the frame layer | `$8C:AFEB`, then boxes, then `$8C:AFD0` uploads the map |
| a sunken box | `window_box_frame_render` `$8C:B647`: `$02` column, `$04` row, `$06` width, `$08` height, in tiles |
| a text window | a `$2C`-byte descriptor, Y = its address, `window_open_setup` `$8C:AC8A`; vanilla uses `$034D`, `$0379`, `$03A5` |
| print a string | `$8C:9E03`: Y = descriptor, `$22/$24` long pointer; NUL-terminated ASCII, `$0A` newline, `$81` / `$82` the Boy's / Dog's name |
| a number | `$80:B21F`: `$02/$04` value, `$22/$24` output (`$7E:2FF4`), commas included; print it with the call above |
| clear a window | `window_tilemap_buffer_init` `$8C:AF2B`: blank, upload, cursor back to the margins |

Descriptor fields: `+0` cursor x, `+2` y (pixels), `+4` space width, `+6` / `+8` letter and line spacing, `+A` / `+C`
left and top margin, `+12` flags (`$0008` grey, `$0400` no wrap), `+14` / `+16` tile row and column, `+18` pixel buffer
(bank `$7F`), `+1A` VRAM word address, `+1C` / `+1E` width and height in tiles, `+20` height·8, `+26` = `$1924`,
`+2A` = 1 (opens at once; rewrite it to open again).

- Window tiles are stored column by column: column c starts at `c · height · 16` in the buffer and `c · height · 8` words
  after the VRAM address, so some rows can be cleared and uploaded alone.
- A buffer is `w · h · 16` bytes, in `$7F:A000-$C7FF`; VRAM `$0C00-$1F3F` is free for the windows.
- **Trap:** a string that wraps past the last line makes the printer wait for a button. Set `$0400`, and give a title
  window room for its longest title (a clipped one hung the charm page).
- Grey needs the text palette `$C4:1EE4` in CGRAM 0-3; the default one shows blue instead.
- The VRAM upload queue holds 64 entries and does not check: wait for an NMI after each printed row.
- Scrolling by a row: move each column's bytes in the buffer, print the new row, upload the window in two vertical
  blanks (printing a 7-row window again takes about twice as long).
- A press made while the screen draws is lost unless `$7E:0104` is read (and acknowledged) between the rows.

## Sprites *(run)*

- A still record: `direct_sprite_draw_oam` `$80:9033`, `$26/$28` the record, `$02` x, `$04` y, `$06` attributes
  (`$30 | slot << 1`), every frame before `oam_finalize_and_blank_unused`. New records in any bank work: count, offset
  of the chunks (2, or 6 after a bounding box when 3 or more), chunks `{ $10 8×8 / $11 16×16, dx, dy, block u16 }`.
- A ring item's animated icon: a 16-byte record (`$06A3 + 16·n`, the ring's own, free while a screen is open);
  `anim_vm_tick` `$90:80CE` (X = the item's animation reference, Y = record), then record `+$C` = palette slot·2; each
  frame `$90:80D2` then `$90:81BD`.
- Sprite palettes: `$90:CFB8`, A = palette address in bank `$90`, X = slot·2. It loads colours, not tiles.
- A formula's icon animation greys it when ingredients are short and loads that grey palette into a slot of 0-2 it
  takes for free, over a palette the screen loaded itself. Set `$7E:0B27` non-zero while the screen is open (as the
  alchemy screens do) and clear it after.
- Ring icons are anchored at their centre; the ingredients' animations sit 6 pixels right and 5 below that, and still
  records (charm and currency pictures) have anchors of their own.
- Button graphics are sprite blocks: `$079A` B, `$079B` A, `$079C` Y, `$079D` X; the L pill `$07A1` + `$07A0`, the R
  pill `$079F` + `$079E`; 8×8 hint letters from `$0B37` (S `$0B44`, E `$0B39`, T `$0B41`, A `$0B40`, L `$0B6C`).

## Input and the frame loop *(run)*

Each frame: draw sprites, `oam_finalize_and_blank_unused`, `$8C:B63B` (fades, waits for the NMI), then read `$7E:0104`
(pressed and not yet acknowledged; `$8597` acknowledges). `joypad_button_typematic_repeat` `$80:8838` (delay `$0347`,
rate `$0349`) must be called every frame, with 0 too, or a second press is swallowed.
