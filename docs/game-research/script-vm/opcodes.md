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
| `26` | `$8C:DC18` | — | continues |  | No operands; writes $0B83 = $800F (and $0106 = 0 unless $0105 says otherwise). |
| `27` | `$8C:DC10` | — | continues |  | No operands; writes $0B83 = $8000. |
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
| `54` | `$8C:D97C` | `u8` | continues |  |  |
| `55` | `$8C:D988` | — | continues |  |  |
| `58` | `$8C:DC87` | — | continues |  |  |
| `59` | `$8C:DC74` | — | continues |  |  |
| `5A` | `$8C:DE8F` | — | continues |  |  |
| `5B` | `$8C:DE95` | — | continues |  |  |
| `5C` | `$8C:DDCB` | `E E` | continues | `object` | Map object (first expression) goes to the state of the second, through $90:A36D: clamped to the object's highest state, kept at $107E + object, animated when it differs from the current one ($10CE + object). Decompiled as object[idx] = val; |
| `5D` | `$8C:DDFF` | `E u16` | continues | `object_state_by_flag` | Map object (expression) goes to its highest state ($7F, clamped) when the save flag (bit number) is set, else to 0 ($90:A36D). |
| `5E` | `$8C:DE2E` | `E u16` | continues | `object_state_unless_flag` | The same with the flag's meaning reversed: highest state when it is clear. |
| `5F` | `$8C:DE77` | `E u16` | continues | `add_object_state` | Map object (expression) goes to its target state ($107E + object) plus the word. |
| `60` | `$8C:DDDB` | `E` | continues | `next_object_state` | Map object (expression) goes to its target state + 1. |
| `61` | `$8C:DDED` | `E` | continues | `previous_object_state` | Map object (expression) goes to its target state - 1. |
| `62` | `$8C:DFCF` | `u8 u16 u16` | continues |  |  |
| `63` | `$8C:DF75` | — | continues |  |  |
| `64` | `$8C:DE9B` | `E` | continues |  |  |
| `65` | `$8C:DEB4` | — | continues |  |  |
| `66` | `$8C:DEAB` | — | continues |  |  |
| `68` | `$8C:DEBD` | `E` | continues |  |  |
| `69` | `$8C:DED6` | — | continues |  |  |
| `6A` | `$8C:DECD` | — | continues |  |  |
| `6C` | `$8C:DA67` | `E u8 u8` | continues |  |  |
| `6D` | `$8C:DA2F` | `E E E` | continues |  |  |
| `6E` | `$8C:DA60` | `E u8 u8` | continues |  |  |
| `6F` | `$8C:DA28` | `E E E` | continues |  |  |
| `70` | `$8C:DF0D` | `E E` | continues |  |  |
| `71` | `$8C:DF1D` | `E E` | continues |  |  |
| `73` | `$8C:DA8D` | `E E E` | continues |  |  |
| `74` | `$8C:DEDF` | `E` | continues | `face_north` | Entity (expression) faces direction 0 (NORTH): its +$22 (FACE_DIRECTION) = 0. Decompiled as face(entity, NORTH); |
| `75` | `$8C:DEF5` | `E` | continues | `face_south` | Entity faces direction 8 (SOUTH): +$22 = 8. Decompiled as face(entity, SOUTH); |
| `76` | `$8C:DF01` | `E` | continues | `face_west` | Entity faces direction 12 (WEST): +$22 = 12. Decompiled as face(entity, WEST); |
| `77` | `$8C:DEE9` | `E` | continues | `face_east` | Entity faces direction 4 (EAST): +$22 = 4. Decompiled as face(entity, EAST); |
| `78` | `$8C:E0B0` | `E u16 E` | continues |  | Entity expression, a word, an expression that picks one of six routines at $8C:E100 (none reads operands). |
| `79` | `$8C:E156` | `E u16 E` | yields |  | Same as 0x78, then yields. |
| `7A` | `$8C:E08E` | `E E` | continues |  |  |
| `7B` | `$8C:E09D` | `E E` | continues |  |  |
| `7C` | `$8C:D557` | `E u16 u8` | continues |  |  |
| `7D` | `$8C:D501` | `E u16 u8` | continues |  |  |
| `7E` | `$8C:D5AA` | `E E E E` | continues |  |  |
| `7F` | `$8C:E17A` | `u16` | continues |  |  |
| `80` | `$8C:E203` | — | continues |  |  |
| `81` | `$8C:E209` | — | continues |  |  |
| `82` | `$8C:E20F` | — | continues |  |  |
| `83` | `$8C:E247` | — | continues |  |  |
| `84` | `$8C:D588` | `E E` | continues |  |  |
| `85` | `$8C:D532` | `E E` | continues |  |  |
| `86` | `$8C:E27B` | `E` | continues |  |  |
| `87` | `$8C:E295` | `E` | continues |  |  |
| `88` | `$8C:E2AA` | — | continues |  |  |
| `89` | `$8C:E2B5` | `E E` | continues |  |  |
| `8A` | `$8C:E357` | `E` | continues |  |  |
| `8C` | `$8C:E39A` | `u16` | continues |  |  |
| `8D` | `$8C:E385` | `u8` | continues |  |  |
| `8E` | `$8C:D483` | `E E r16` | branches |  | Two expressions, then a jump offset like 0x08. |
| `8F` | `$8C:D4C2` | `E E r16` | branches |  | Two expressions, then a jump offset like 0x09. |
| `90` | `$8C:DC35` | `E` | continues |  |  |
| `91` | `$8C:DC56` | `E` | continues |  |  |
| `92` | `$8C:E430` | `E E` | continues |  |  |
| `93` | `$8C:E486` | `E E` | continues |  |  |
| `94` | `$8C:E410` | `E E` | continues |  |  |
| `95` | `$8C:E420` | `E E` | continues |  |  |
| `96` | `$8C:E49D` | `E E` | continues |  | See knowledge rom/8ce49d. |
| `97` | `$8C:E4B1` | `E E E E E E E` | continues |  |  |
| `98` | `$8C:E5A1` | `E` | continues |  |  |
| `99` | `$8C:E66F` | `E E E E E E` | continues |  |  |
| `9A` | `$8C:E6CF` | `E` | continues |  |  |
| `9B` | `$8C:DD33` | `E` | continues |  |  |
| `9C` | `$8C:DD41` | `E` | continues |  |  |
| `9D` | `$8C:DA88` | `E E E` | continues | `teleport` | Entity expression and two coordinate expressions (x, y); decompiled as teleport(entity, x, y); |
| `9E` | `$8C:D0D0` | `E E E Z` | continues |  | Entity expression, two expressions, then expressions up to one that is 0 (stored to a free slot from $91:9759). Without a free slot it reads three more expressions and the list from where it stands: the same end only for lists of three or more. |
| `9F` | `$8C:E5B0` | — | continues |  |  |
| `A0` | `$8C:E628` | — | continues |  |  |
| `A1` | `$8C:E65F` | — | continues |  |  |
| `A2` | `$8C:DC9A` | `u16 u16 E E` | continues | `spawn_at` | As 0x3C with x and y as expressions (pixels). |
| `A3` | `$8C:D3A0` | `u8` | calls (yields) | `call_global` | Call a global script by id (see knowledge rom/8cd3a0). |
| `A4` | `$8C:D395` | `u16` | calls (yields) | `call_trigger` | Call the script whose packed pointer is at $92:8000 + word[$92:8000] + the word. |
| `A5` | `$8C:D35C` | `cb` | calls (yields) | `call_back` | Call a script that starts before this opcode: packed(opcode) - (256 - byte). |
| `A6` | `$8C:D340` | `c16` | calls (yields) | `call_back_far` | Call a script that starts before this opcode: packed(opcode) + word - $10000. |
| `A7` | `$8C:D217` | `u8` | yields | `sleep` | Sleep for the byte's number of ticks (as 0x39). |
| `A8` | `$8C:D20F` | `u16` | yields | `sleep` | Sleep for the word's number of ticks. |
| `A9` | `$8C:E6EA` | `E E` | continues |  | Entity expression, an expression that picks one of the routines at $8C:E6F8 (none reads operands). |
| `AA` | `$8C:E7EF` | — | continues |  |  |
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
| `B5` | `$8C:E81B` | `E E E E E E E E` | continues |  |  |
| `B6` | `$8C:E85D` | `E E E E` | continues |  |  |
| `B7` | `$8C:E88A` | `E` | continues |  |  |
| `B9` | `$8C:E040` | `E E E` | continues |  |  |
| `BA` | `$8C:DCD9` | `u8 u8 u8` | continues | `spawn` | As 0x3C with an ENEMY value byte (doubled by the handler) and state 0. |
| `BB` | `$8C:E467` | `E E` | continues |  |  |
| `BC` | `$8C:DB1B` | — | continues | `unfreeze_boy` | Unfreeze Boy character ($8F:CD4D). |
| `BD` | `$8C:DAC5` | — | continues | `unfreeze_dog` | Unfreeze Dog character ($8F:CD4D). |
| `BE` | `$8C:DB20` | — | continues | `unfreeze` | Unfreeze bound entity ($8F:CD4D). |
| `BF` | `$8C:DACA` | — | continues | `freeze_boy` | Freeze Boy character ($8F:CD78). |
| `C0` | `$8C:DB25` | — | continues | `freeze` | Freeze bound entity ($8F:CD78). |
| `C1` | `$8C:DACF` | — | continues | `freeze_dog` | Freeze Dog character ($8F:CD78). |
| `C2` | `$8C:DCC3` | `u8 u8 u8` | continues | `add_enemy_spawner` | As 0xBA with state $8000: places a spawner. |
