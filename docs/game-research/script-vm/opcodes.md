# Script opcodes

One row per opcode the dispatch table at `$8C:E8BD` sends to a handler (`$8C:D0A6` doubles the
opcode byte and calls `JSR ($E8BD,x)`); the other opcodes land on `STP` (`$8C:E8B5`-`$E8BC`) and stop the CPU.
Operand tokens and flow words: [README.md](README.md). Written from each handler's code (each has a
knowledge entry `rom/8cxxxx.md`) and checked against the running game (`tests/script-vm/`). `name` is
ours; an empty one means only the operands are known so far.

| op | handler | operands | flow | name | what it does |
|---|---|---|---|---|---|
| `00` | `$8C:D2E1` | — | ends | `end` | End this script: a called script returns to its caller (the call list at $2F28), the thread's first script ends the thread (clears the pointer's bank byte). |
| `04` | `$8C:D434` | `r16` | jumps | `jump` | Jump by a signed 16-bit offset counted from the end of the operand. |
| `05` | `$8C:D428` | `rb` | jumps | `jump_back` | Jump backwards: target = opcode address - (256 - byte). The byte is OR-ed with $FF00, so it can only go back. |
| `07` | `$8C:D400` | `u24` | starts a thread | `start_thread` | Start the script at a packed pointer as a new parallel thread (a free slot from $28FC); this one continues. |
| `08` | `$8C:D465` | `E r16` | branches | `jump_if_true` | Jump when the expression is not 0, else continue after the operand. |
| `09` | `$8C:D474` | `E r16` | branches | `jump_if_false` | Jump when the expression is 0. |
| `0A` | `$8C:D491` | `E u16 u8 r16` | branches | `jump_if_amount_at_least` | Jump when the 24-bit amount at $0AC6 + expression is at least the 24-bit immediate (u16 low, u8 high). |
| `0B` | `$8C:D4D0` | `E u16 u8 r16` | branches | `jump_if_amount_below` | Jump when the 24-bit amount at $0AC6 + expression is below the immediate. |
| `0C` | `$8C:D83E` | `u16 E` | continues | `set_flag` | Set (expression not 0) or clear one bit of the flag area at $2258; the operand is the bit number. |
| `0D` | `$8C:D82E` | `u16 E` | continues | `set_temp_flag` | The same for the flag area at $2834. |
| `0E` | `$8C:D81C` | `u8 E` | continues | `set_local_flag` | The same for the script slot's local bytes (slot + $0F). |
| `10` | `$8C:D804` | `u16 E` | continues | `write_byte` | Byte at $2258 + offset = expression. |
| `11` | `$8C:D7FF` | `u16 E` | continues | `write_temp_byte` | Byte at $2834 + offset = expression. |
| `12` | `$8C:D7E6` | `u8 E` | continues | `write_local_byte` | Byte at slot + $0F + offset = expression. |
| `14` | `$8C:D804` | `u16 E` | continues | `write_byte` | Same handler as 0x10. |
| `15` | `$8C:D7FF` | `u16 E` | continues | `write_temp_byte` | Same handler as 0x11. |
| `16` | `$8C:D7E6` | `u8 E` | continues | `write_local_byte` | Same handler as 0x12. |
| `17` | `$8C:D79D` | `u16 u16` | continues | `write_word_immediate` | Word at $2258 + offset = the immediate word. |
| `18` | `$8C:D7D1` | `u16 E` | continues | `write_word` | Word at $2258 + offset = expression. |
| `19` | `$8C:D7CC` | `u16 E` | continues | `write_temp_word` | Word at $2834 + offset = expression. |
| `1A` | `$8C:D7B3` | `u8 E` | continues | `write_local_word` | Word at slot + $0F + offset = expression. |
| `1B` | `$8C:D76B` | `u16 u16 u8 u8` | continues | `write_tile_pair` | Two words at $2258 + offsets = the two bytes times 8 (a tile position in pixels). |
| `1C` | `$8C:D7D1` | `u16 E` | continues | `write_word` | Same handler as 0x18. |
| `1D` | `$8C:D7CC` | `u16 E` | continues | `write_temp_word` | Same handler as 0x19. |
| `1E` | `$8C:D7B3` | `u8 E` | continues | `write_local_word` | Same handler as 0x1A. |
| `20` | `$8C:DBF0` | `u8 u8` | continues | `place_camera_tile` | Two bytes times 8 to $46/$48 (x, y in pixels), then $8F:B434. |
| `21` | `$8C:DBB9` | `u8 u8` | ends | `warp_in_room` | Like 0x20 after stopping the field ($80:85D8, $8C:CEE9, $8F:B38E); then stops the scripts ($8C:CE99) and ends this one. |
| `22` | `$8C:DB71` | `u8 u8 u16` | ends | `change_map` | Like 0x21 with a map word written to $0ADB first ($90:8E90): enter another map at the tile position. |
| `23` | `$8C:E405` | `u16` | continues | `set_0e6e` | Word to $0E6E. |
| `26` | `$8C:DC18` | — | continues | `fade_in` | Fade screen in to full brightness ($0B83 = $800F), clearing $0106 to 0 and centering camera ($90:94AB). |
| `27` | `$8C:DC10` | — | continues | `fade_out` | Fade screen out to black ($0B83 = $8000). |
| `29` | `$8C:D3C9` | `u24` | calls (yields) | `call` | Call the script at a packed pointer: it runs in this thread, this one resumes after it returns. |
| `2A` | `$8C:DB67` | `E` | continues | `freeze_entity` | Entity expression ($8C:EC8E), then $8F:CD78 (freeze/immobilize). |
| `2B` | `$8C:DB11` | `E` | continues | `unfreeze_entity` | Entity expression, then $8F:CD4D (unfreeze/mobilize). |
| `2C` | `$8C:DB2A` | `u8` | continues |  | One byte of bits; bit 3 applies $8F:CD78 to the slot's entity. |
| `2D` | `$8C:DAD4` | `u8` | continues |  | One byte of bits; bit 3 applies $8F:CD4D to the slot's entity. |
| `2E` | `$8C:D244` | `E` | yields | `wait` | Wait: an entity expression; yields until it is done (see knowledge rom/8cd244). |
| `30` | `$8C:D6A7` | `u8` | continues | `sound` | Sound effect: the byte indexes the word table at $8C:8362 (a negative entry is silent), played by $8C:82DC after driver command $30 with $243B. |
| `31` | `$8C:D6A7` | `u8` | continues | `sound` | Same handler as 0x30. |
| `32` | `$8C:D6A7` | `u8` | continues | `sound` | Same handler as 0x30. |
| `33` | `$8C:D6D6` | `u8` | continues | `music` | Music: the byte indexes the word table at $8C:8442 (a negative entry does nothing); driver commands $1A, $2A ($A0), $2C, then $8C:828F with interrupts held off. |
| `38` | `$8C:D20D` | — | yields | `yield` | Yield for one tick. |
| `39` | `$8C:D220` | `E` | yields | `sleep` | Sleep for expression ticks: wake at timer $0B19 + n - 1 (32-bit), state 4; 0 does not yield. |
| `3A` | `$8C:D20D` | — | yields | `yield` | Same handler as 0x38. |
| `3B` | `$8C:D220` | `E` | yields | `sleep` | Same handler as 0x39. |
| `3C` | `$8C:DCEC` | `u16 u16 u8 u8` | continues | `spawn` | Place an enemy or NPC: the first word is a byte offset into the ENEMY table at $8E:B55A (ENEMY value * 2), the second its state (bit 15: a spawner, $8F:DE98), then x and y in tiles (each * 8 to $46 / $48); $8F:A933, $8F:B094; the new entity goes to $0341. |
| `3D` | `$8C:DD4B` | `E u16` | continues |  | Entity expression; the word to entity +$66, $40 to entity +$68. |
| `3F` | `$8C:DD60` | `E u16 u16` | continues |  | Expression: an entity address (>= $2000) gets the two words at +$68 / +$66; a small index n gets them at $0EA2 / $0EAC + 2(n-1) (the second word is skipped when the first is 0). |
| `42` | `$8C:DFEE` | `E u16` | continues |  | Entity expression and a word whose two bytes times 8 go to $46 / $48. |
| `43` | `$8C:E00D` | `E E E` | continues |  | Entity expression and two expressions to $46 / $48. |
| `44` | `$8C:D890` | `u8 u8 u8 u8 u8` | continues | `open_message_box` | Five bytes (type, x, y, w, h); sets up message box through $8C:C543 and $8C:D967. |
| `45` | `$8C:D890` | `u8 u8 u8 u8 u8` | continues | `open_message_box` | Same handler as 0x44. |
| `46` | `$8C:D890` | `u8 u8 u8 u8 u8` | continues | `open_message_box` | Same handler as 0x44. |
| `47` | `$8C:D890` | `u8 u8 u8 u8 u8` | continues | `open_message_box` | Same handler as 0x44. |
| `48` | `$8C:D8FE` | — | continues | `text_start` | No operands; $8C:C543, then fixed values to $0361-$036B. |
| `49` | `$8C:D8FE` | — | continues | `text_start` | Same handler as 0x48. |
| `4A` | `$8C:D8FE` | — | continues | `text_start` | Same handler as 0x48. |
| `4B` | `$8C:D8FE` | — | continues | `text_start` | Same handler as 0x48. |
| `4C` | `$8C:D87C` | `skip` | continues | `skip_byte` | Skips one byte and continues. |
| `4D` | `$8C:D87E` | — | continues | `nop` | Does nothing. |
| `4E` | `$8C:DDB0` | `E` | continues | `bind_entity` | The slot's entity (slot + $0D) becomes the entity expression (reference counts at entity +$3E follow). |
| `50` | `$8C:D9FD` | `u8 u16` | continues | `text_in_window` | Show text: a window byte (record at $034D + $2C * n, $8C:D967), then the string key, looked up by $8C:CCF5 and shown by $8C:9E03. |
| `51` | `$8C:DA0A` | `u16` | continues | `text` | Show text in the default window ($034D): the string key, as 0x50. |
| `52` | `$8C:D99E` | `u16` | continues | `message` | Show a string key through $8C:CD33 and $8C:C521 (after $8C:C4F6 unless $23D3 or bit 15 of $0B2B is set). |
| `54` | `$8C:D97C` | `u8` | continues | `clear_window_and_advance_dialogue` | Clears window record `$034D + n*$2C`, then activates the next queued dialogue request through `$8C:C55D`. |
| `55` | `$8C:D988` | — | continues | `end_text_and_advance_dialogue` | Clears the default window record at `$034D`, then activates the next queued dialogue request through `$8C:C55D`. |
| `58` | `$8C:DC87` | — | continues | `fade_in_screen` | Sets the stepped-fade target `$9B` to `$10` and calls `$8C:8619` to fade toward full brightness. |
| `59` | `$8C:DC74` | — | continues | `fade_out_screen` | Sets the stepped-fade target `$9B` to `$F0` and calls `$8C:8619` to fade toward black. |
| `5A` | `$8C:DE8F` | — | continues | `reset_dialogue_and_wait` | Resets the cutscene dialogue queue/window state, then polls `$0B79` while servicing field ticks; the tested flag meanings remain unresolved. |
| `5B` | `$8C:DE95` | — | continues | `wait_for_dialogue_state` | Polls `$0B79` bits `$0040`/`$0080`, servicing field ticks while waiting; exact bit meanings remain unresolved. |
| `5C` | `$8C:DDCB` | `E E` | continues | `object` | Map object (first expression) goes to the state of the second, through $90:A36D: clamped to the object's highest state, kept at $107E + object, animated when it differs from the current one ($10CE + object). Decompiled as object[idx] = val; |
| `5D` | `$8C:DDFF` | `E u16` | continues | `object_state_by_flag` | Map object (expression) goes to its highest state ($7F, clamped) when the save flag (bit number) is set, else to 0 ($90:A36D). |
| `5E` | `$8C:DE2E` | `E u16` | continues | `object_state_unless_flag` | The same with the flag's meaning reversed: highest state when it is clear. |
| `5F` | `$8C:DE77` | `E u16` | continues | `add_object_state` | Map object (expression) goes to its target state ($107E + object) plus the word. |
| `60` | `$8C:DDDB` | `E` | continues | `next_object_state` | Map object (expression) goes to its target state + 1. |
| `61` | `$8C:DDED` | `E` | continues | `previous_object_state` | Map object (expression) goes to its target state - 1. |
| `62` | `$8C:DFCF` | `u8 u16 u16` | continues | `activate_background_tile_animation` | Uses the byte as a channel key and passes the two words in DP `$0A`/`$0C` to `$90:A2A2`, which searches and activates a matching room tile-animation channel. |
| `63` | `$8C:DF75` | — | continues | `field_transition_sequence` | Runs a fixed field-transition call sequence, clears `$0106` and sets `$0B83 = $800F` twice; individual internal call purposes are not fully established. |
| `64` | `$8C:DE9B` | `E` | continues | `set_0b73_and_poll_state` | Stores the expression in `$0B73`, then calls `$8C:C627` with X = 1; the helper polls `$0B79` and services field ticks under selected conditions. |
| `65` | `$8C:DEB4` | — | continues | `poll_field_state_1` | Calls `$8C:C627` with X = 1; polls `$0B79` and services field ticks under selected conditions. |
| `66` | `$8C:DEAB` | — | continues | `poll_field_state_1_alternate` | Calls `$8C:C67C` with X = 1; polls `$0B79` using a different condition set and services field ticks. |
| `68` | `$8C:DEBD` | `E` | continues | `set_0b75_and_poll_state` | Stores the expression in `$0B75`, then calls `$8C:C627` with X = 2; the helper polls `$0B79` and services field ticks under selected conditions. |
| `69` | `$8C:DED6` | — | continues | `poll_field_state_2` | Calls `$8C:C627` with X = 2; polls `$0B79` and services field ticks under selected conditions. |
| `6A` | `$8C:DECD` | — | continues | `poll_field_state_2_alternate` | Calls `$8C:C67C` with X = 2; polls `$0B79` using a different condition set and services field ticks. |
| `6C` | `$8C:DA67` | `E u8 u8` | continues | `move_entity_to_tile_position` | Entity and tile coordinates (each scaled by 8); submits the pixel destination through the shared tile/elevation and movement helper. |
| `6D` | `$8C:DA2F` | `E E E` | continues | `move_entity_by_tile_delta` | Entity and X/Y expressions scaled by 16 and added to its `+$1A`/`+$1C` coordinates; submits the result through the shared position helper. |
| `6E` | `$8C:DA60` | `E u8 u8` | continues | `stage_entity_tile_position` | Evaluates an entity and tile coordinates into DP `$46`/`$48`, but selects the shared path that skips the position helper; why this scratch-only path is used remains unresolved. |
| `6F` | `$8C:DA28` | `E E E` | continues | `stage_entity_expression_position` | Computes entity-relative coordinates into DP `$46`/`$48`, but selects the shared path that skips the position helper; why this scratch-only path is used remains unresolved. |
| `70` | `$8C:DF0D` | `E E` | continues | `face_towards_entity` | Evaluates target and source entities, computes the dominant-axis compass direction, and stores it in the source entity's facing field at `+$22`. |
| `71` | `$8C:DF1D` | `E E` | continues | `face_away_from_entity` | Evaluates target and source entities, computes the compass direction, flips it by 180 degrees, and stores it in the source entity's facing field at `+$22`. |
| `73` | `$8C:DA8D` | `E E E` | continues | `stage_entity_absolute_position` | Evaluates an entity and two coordinates into DP `$46`/`$48`; the shared path skips its position helper, with the purpose of staging unresolved. |
| `74` | `$8C:DEDF` | `E` | continues | `face_north` | Entity (expression) faces direction 0 (NORTH): its +$22 (FACE_DIRECTION) = 0. Decompiled as face(entity, NORTH); |
| `75` | `$8C:DEF5` | `E` | continues | `face_south` | Entity faces direction 8 (SOUTH): +$22 = 8. Decompiled as face(entity, SOUTH); |
| `76` | `$8C:DF01` | `E` | continues | `face_west` | Entity faces direction 12 (WEST): +$22 = 12. Decompiled as face(entity, WEST); |
| `77` | `$8C:DEE9` | `E` | continues | `face_east` | Entity faces direction 4 (EAST): +$22 = 4. Decompiled as face(entity, EAST); |
| `78` | `$8C:E0B0` | `E u16 E` | continues |  | Entity expression, a word, an expression that picks one of six routines at $8C:E100 (none reads operands). |
| `79` | `$8C:E156` | `E u16 E` | yields |  | Same as 0x78, then yields. |
| `7A` | `$8C:E08E` | `E E` | continues | `write_word_by_address` | Writes the second expression as a word to the `$7E`-bank address selected by the first expression. |
| `7B` | `$8C:E09D` | `E E` | continues | `write_byte_by_address` | Writes the low byte of the second expression to the `$7E`-bank address selected by the first expression. |
| `7C` | `$8C:D557` | `E u16 u8` | continues | `add_immediate_to_amount` | Adds the word-plus-byte 24-bit immediate to the three-byte amount at `$0AC6,X`/`$0AC8,X`, where X is the expression result. |
| `7D` | `$8C:D501` | `E u16 u8` | continues | `subtract_immediate_from_amount` | Subtracts the word-plus-byte 24-bit immediate from the three-byte amount at `$0AC6,X`/`$0AC8,X`, where X is the expression result. |
| `7E` | `$8C:D5AA` | `E E E E` | continues | `prepare_palette_transfer` | Uses SNES math registers and `$90:D34C` to stage palette data, then calls `$80:85FA` for transfer; exact expression roles remain unresolved. |
| `7F` | `$8C:E17A` | `u16` | continues | `run_indexed_field_transition` | Selects paired values from `$8C:E1FD/$8C:E1FF` and runs a field/render transition sequence; semantic names for the table values are unknown. |
| `80` | `$8C:E203` | — | continues | `advance_dialogue_queue` | Calls `$8C:C55D` to activate the next queued dialogue request and construct its 20-by-30 text window. |
| `81` | `$8C:E209` | — | continues | `enable_cutscene_pause_guard` | Calls `$8C:C543` to enable the cutscene pause guard and lock player engine inputs. |
| `82` | `$8C:E20F` | — | continues | `restore_color_math_snapshot` | Copies `$235B-$235E` to PPU color-math registers and sets/clears `$0B29` bit 0 from `$22EA` bit 7. |
| `83` | `$8C:E247` | — | continues | `apply_color_math_settings` | Copies `$0F80-$0F83` to PPU color-math registers and sets/clears `$0B29` bit 0 from `$22EA` bit 7. |
| `84` | `$8C:D588` | `E E` | continues | `add_to_amount` | Adds the second expression to the low word at `$0AC6,X` and carries into `$0AC8,X`; X comes from the first expression. |
| `85` | `$8C:D532` | `E E` | continues | `subtract_from_amount` | Subtracts the second expression from the low word at `$0AC6,X` and borrows into `$0AC8,X`; X comes from the first expression. |
| `86` | `$8C:E27B` | `E` | continues | `send_audio_command_28` | Sends the expression in Y with command `$28` through the APU handshake at `$8C:81FD`; its audio-side meaning is unknown. |
| `87` | `$8C:E295` | `E` | continues | `send_audio_command_2a` | Sends the expression in Y with command `$2A` through the APU handshake at `$8C:81FD`; its audio-side meaning is unknown. |
| `88` | `$8C:E2AA` | — | continues | `reset_catalog_parameter_state` | Writes `$FFFF` to `$0B95` and clears `$0E6C`, state consumed by opcodes `0x89`/`0x8A`. |
| `89` | `$8C:E2B5` | `E E` | continues | `configure_catalog_parameters` | Scans for a free `$0B95` slot, sets `$0E6C` range bits, writes a table byte and `$FF` to `$0B95`/`$0B96`, then stores the second expression at `$0BC5`. |
| `8A` | `$8C:E357` | `E` | continues | `set_shop_parameter` | Stores the expression at `$05A7`, selects a mode entry via `$0E6C`, and conditionally calls `$8E:9FA8` for shop-catalog behavior. |
| `8C` | `$8C:E39A` | `u16` | continues | `show_transition_text` | Resolves/decompresses the string key through `$8C:CD33`, runs a field-transition sequence, then clears `$143A`. |
| `8D` | `$8C:E385` | `u8` | continues | `start_screen_shake` | A nonzero byte starts a shake at magnitude 4 on both axes via `$90:9897`; zero skips the call and leaves shake state unchanged. |
| `8E` | `$8C:D483` | `E E r16` | branches |  | Two expressions, then a jump offset like 0x08. |
| `8F` | `$8C:D4C2` | `E E r16` | branches |  | Two expressions, then a jump offset like 0x09. |
| `90` | `$8C:DC35` | `E` | continues | `fade_to` | Fade screen to expression brightness ($0B83 = $8000 \| E), centering camera as 0x26. |
| `91` | `$8C:DC56` | `E` | continues | `set_brightness` | Set INIDISP brightness shadow directly ($0106 = E), centering camera as 0x26. |
| `92` | `$8C:E430` | `E E` | continues | `queue_adjusted_entity_damage` | Consumes `$23D5`; otherwise checks entity HP/flag, optionally transforms the amount via `$23D7`, then adds pending damage at `+$76` and sets `$0038` at `+$12`. |
| `93` | `$8C:E486` | `E E` | continues | `queue_entity_damage` | If entity HP at `+$2A` is nonzero, adds the amount to pending damage at `+$76` and sets bit `$0008` at `+$12`. |
| `94` | `$8C:E410` | `E E` | continues | `restore_entity_hp_with_effect` | Calls `$8F:C09A` to restore HP with palette feedback, update the player HUD, and clear pending damage/state fields. |
| `95` | `$8C:E420` | `E E` | continues | `add_entity_hp` | Calls `$8F:C0A5` to add and cap entity HP, update the player HUD when applicable, and clear pending damage/state fields. |
| `96` | `$8C:E49D` | `E E` | continues | `teleport_active_entities_by_screen_offset` | Evaluates horizontal and vertical screen offsets and calls `$90:A001`, which moves the camera and attempts to shift active entities by 512 pixels per screen. |
| `97` | `$8C:E4B1` | `E E E E E E E` | continues | `prepare_and_transfer_palette` | Builds palette transfer parameters, stages data at `$7E:65F1` through `$90:D34C`, holds NMI uploads via `$0F3C`, and calls `$80:85FA`; parameter roles are partly unresolved. |
| `98` | `$8C:E5A1` | `E` | continues | `switch_active_character` | If the expression differs from `$0F42`, calls `$8C:F1A7` to toggle active-character state between Boy and Dog. |
| `99` | `$8C:E66F` | `E E E E E E` | continues | `configure_screen_transition` | Stores six expressions in `$0E70`/`$0E74-$0E78`, then calls transition and synchronized field/render helpers; individual parameter meanings remain unknown. |
| `9A` | `$8C:E6CF` | `E` | continues | `dispatch_c4_parameter_record` | Selects a record from bank `$C4` through `$8C:E6E6`/`$8C:9DAF`; writes intermediate values to `$0B3D/$0B3F/$0B43` and DP `$92`; purpose unresolved. |
| `9B` | `$8C:DD33` | `E` | continues | `release_entity_reference` | Decrements entity `+$3E`, then calls `$8F:B2DE` to release attached resources, restore motion, clear HP, and dispose when the reference count reaches zero. |
| `9C` | `$8C:DD41` | `E` | continues | `decrement_entity_reference` | Decrements entity `+$3E` without calling the cleanup helper. |
| `9D` | `$8C:DA88` | `E E E` | continues | `move_entity_to_coordinates` | Stages an entity and two coordinate expressions, then requests movement through `$8F:AA82`; unlike a teleport, this path does not directly write entity coordinates. |
| `9E` | `$8C:D0D0` | `E E E Z` | continues |  | Entity expression, two expressions, then expressions up to one that is 0 (stored to a free slot from $91:9759). Without a free slot it reads three more expressions and the list from where it stands: the same end only for lists of three or more. |
| `9F` | `$8C:E5B0` | — | continues | `initialize_script_text_window` | Initializes the `$0435` window record, prepares the frame, increments `$0CB3`, and requests graphics/palette resources. |
| `A0` | `$8C:E628` | — | continues | `expand_current_amount_in_text` | Uses the selected three-byte amount at `$0AC6/$0AC8` as formatting parameters, then calls `$80:B21F` and `$8C:9E03` to expand text. |
| `A1` | `$8C:E65F` | — | continues | `clear_script_text_window` | Calls `$8C:ADE5` on the `$0435` window record and clears `$0CB3`. |
| `A2` | `$8C:DC9A` | `u16 u16 E E` | continues | `spawn_at` | As 0x3C with x and y as expressions (pixels). |
| `A3` | `$8C:D3A0` | `u8` | calls (yields) | `call_global` | Call a global script by id (see knowledge rom/8cd3a0). |
| `A4` | `$8C:D395` | `u16` | calls (yields) | `call_trigger` | Call the script whose packed pointer is at $92:8000 + word[$92:8000] + the word. |
| `A5` | `$8C:D35C` | `cb` | calls (yields) | `call_back` | Call a script that starts before this opcode: packed(opcode) - (256 - byte). |
| `A6` | `$8C:D340` | `c16` | calls (yields) | `call_back_far` | Call a script that starts before this opcode: packed(opcode) + word - $10000. |
| `A7` | `$8C:D217` | `u8` | yields | `sleep` | Sleep for the byte's number of ticks (as 0x39). |
| `A8` | `$8C:D20F` | `u16` | yields | `sleep` | Sleep for the word's number of ticks. |
| `A9` | `$8C:E6EA` | `E E` | continues |  | Entity expression, an expression that picks one of the routines at $8C:E6F8 (none reads operands). |
| `AA` | `$8C:E7EF` | — | continues | `call_helper_for_boy_and_dog` | If `$23C7` is zero, calls `$91:B9A7` first with the Boy pointer and then with the Dog pointer; otherwise skips both calls. The helper's broader effect is not established here. |
| `AB` | `$8C:E8B1` | — | resets the game | `reset_game` | Jumps to $80:84C9: screen off, interrupts off, stack reset, the reset entry at $80:8034. |
| `AC` | `$8C:D0C3` | `E E E Z` | continues |  | Same as 0x9E with the slot at $4F37 checked first. |
| `AD` | `$8C:D752` | `u16 u16 u8 u8` | continues | `write_temp_tile_pair` | As 0x1B for $2834. |
| `AE` | `$8C:D71F` | `u8 u8 u8 u8` | continues | `write_local_tile_pair` | As 0x1B for the slot's local bytes. |
| `AF` | `$8C:D3C6` | `A u24` | calls (yields) | `call_with_args` | Arguments (to $0E80), then as 0x29. |
| `B0` | `$8C:D39D` | `A u8` | calls (yields) | `call_global_with_args` | Arguments, then as 0xA3. |
| `B1` | `$8C:D392` | `A u16` | calls (yields) | `call_trigger_with_args` | Arguments, then as 0xA4. |
| `B2` | `$8C:D34C` | `A cb` | calls (yields) | `call_back_with_args` | Arguments, then as 0xA5. |
| `B3` | `$8C:D331` | `A c16` | calls (yields) | `call_back_far_with_args` | Arguments, then as 0xA6. |
| `B4` | `$8C:D3FD` | `A u24` | starts a thread | `start_thread_with_args` | Arguments, then as 0x07. |
| `B5` | `$8C:E81B` | `E E E E E E E E` | continues | `configure_projectile_motion` | Fills parameters consumed by `$90:DCC0`, which writes descriptor fields and dispatches through `$90:D986`; exact expression roles remain unresolved. |
| `B6` | `$8C:E85D` | `E E E E` | continues | `reserve_entity_extra_graphics` | Passes four expression-derived parameters through `$8C:E899` and `$90:D50F` to reserve a graphics range in descriptor tables. |
| `B7` | `$8C:E88A` | `E` | continues | `clear_entity_extra_graphics` | Passes its expression through `$8C:E899` and clears the selected `$13D2` descriptor word. |
| `B9` | `$8C:E040` | `E E E` | continues | `move_entity_by_pixel_offset` | Probes relative pixel movement through `$8F:AF48`; commits coordinates through `$8F:C2E4` only when the probe succeeds. |
| `BA` | `$8C:DCD9` | `u8 u8 u8` | continues | `spawn` | As 0x3C with an ENEMY value byte (doubled by the handler) and state 0. |
| `BB` | `$8C:E467` | `E E` | continues | `queue_damage` | Entity and amount expressions; if current HP is nonzero and entity flag bit `$1000` is clear, adds the amount to pending damage at `+$76` and sets state bits `$0018` at `+$12`. HP loss and damage-number display are handled downstream. |
| `BC` | `$8C:DB1B` | — | continues | `freeze_boy` | Freeze Boy via `$8F:CD78` (halts motion and sets the immobilized flag). |
| `BD` | `$8C:DAC5` | — | continues | `unfreeze_boy` | Unfreeze Boy via `$8F:CD4D` (restores motion and clears immobilization state). |
| `BE` | `$8C:DB20` | — | continues | `freeze_dog` | Freeze Dog via `$8F:CD78` (halts motion and sets the immobilized flag). |
| `BF` | `$8C:DACA` | — | continues | `unfreeze_dog` | Unfreeze Dog via `$8F:CD4D` (restores motion and clears immobilization state). |
| `C0` | `$8C:DB25` | — | continues | `freeze_boy_and_dog` | Freeze both Boy and Dog via `$8F:CD78`. |
| `C1` | `$8C:DACF` | — | continues | `unfreeze_boy_and_dog` | Unfreeze both Boy and Dog via `$8F:CD4D`. |
| `C2` | `$8C:DCC3` | `u8 u8 u8` | continues | `add_enemy_spawner` | As 0xBA with state $8000: places a spawner. |
