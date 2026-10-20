# Script Opcode Naming Review

One row per opcode handled by the US script VM dispatch table. Other byte values below `0xC3` point to `STP`; values `0xC3` and above index outside the handler table. This is the opcode-name review sheet, not a claim that every opcode has been semantically identified.

**Usage scope:** counts are instructions found by a static walk from every script pointer named by the configured US ROM room, trigger, global, call, and thread tables. `Not found (0)` means absent from that walk, not proven unused in every game state or ROM revision. ROM totals can differ by release.

**TileViewer labels:** condensed from the instruction descriptions emitted by `SoEScriptDumper/list-rooms.cpp` in the local SoETilesViewer checkout. This parser does not define one canonical mnemonic per opcode; labels marked `UNKNOWN` or `UNTRACED` preserve its own uncertainty. Everscript names are the enclosing `fun` declarations that emit each byte in the sibling compiler's `in/core` command and system definitions. Multiple names are listed when multiple wrappers emit the same byte; `Not verified` means no wrapper was found in those definitions.

**Recommendation status:** `Selected` records names chosen in this conversation. Other existing parser labels are provisional; alternatives are shown only where grounded candidates are available. Rows whose behavior remains blank or incomplete in the opcode research are marked `Needs handler research`; names should not be guessed from opcode numbers.

| Opcode | US ROM usage | What it does | TileViewer label | Everscript name | Name recommendations |
|---|---|---|---|---|---|
| `0x09` | Used (5332) | Jump when the expression is 0. | IF condition == FALSE; SKIP target | Not verified | Provisional: `jump_if_false`; `branch_if_false`; `goto_if_false` |
| `0x18` | Used (4858) | Word at $2258 + offset = expression. | WRITE save-area value | `await_buy_result()`; `await_sell_result()` | Provisional: `write_word`; `store_word`; `set_word` |
| `0xA7` | Used (4575) | Sleep for the byte's number of ticks (as 0x39). | Sleep ticks (8-bit) | `_sleep()` | Provisional: `sleep`; `delay`; `sleep_ticks` |
| `0xA3` | Used (4192) | Call a global script by id (see knowledge rom/8cd3a0). | Call global script | `save_dialog()`; `call_id()` | Provisional: `call_global`; `invoke_global`; `run_global` |
| `0x00` | Used (3801) | End this script: a called script returns to its caller (the call list at $2F28), the thread's first script ends the thread (clears the pointer's bank byte). | END (return) | `end()` | Provisional existing label: `end`; alternatives need grounded review |
| `0x51` | Used (2544) | Show text in the default window ($034D): the string key, as 0x50. | Show windowed text | `text()` | Provisional existing label: `text`; alternatives need grounded review | 
| `0x04` | Used (2520) | Jump by a signed 16-bit offset counted from the end of the operand. | SKIP (relative branch) | Not verified | Provisional existing label: `jump`; alternatives need grounded review | 
| `0x5C` | Used (2112) | Map object (first expression) goes to the state of the second, through $90:A36D: clamped to the object's highest state, kept at $107E + object, animated when it differs from the current one ($10CE + object). Decompiled as object[idx] = val; | Set object state | `object()` | Provisional existing label: `object`; alternatives need grounded review | 
| `0x0C` | Used (2075) | Set (expression not 0) or clear one bit of the flag area at $2258; the operand is the bit number. | Set/clear save flag bit | Not verified | Provisional: `set_flag`; `write_flag`; `assign_flag` |
| `0x19` | Used (2002) | Word at $2834 + offset = expression. | WRITE temp-area value | Not verified | Provisional: `write_temp_word`; `store_temp_word`; `set_temp_word` |
| `0x2E` | Used (1737) | Wait: an entity expression; yields until it is done (see knowledge rom/8cd244). | Wait for entity to reach destination | `wait()` | Provisional existing label: `wait`; alternatives need grounded review | 
| `0x08` | Used (1494) | Jump when the expression is not 0, else continue after the operand. | IF condition; SKIP target | Not verified | Provisional: `jump_if_true`; `branch_if_true`; `goto_if_true` |
| `0x78` | Used (1493) | Entity expression, a word, an expression that picks one of six routines at $8C:E100 (none reads operands). | UNTRACED INSTR (sprite/animation?) | `animate_boy()`; `animate()` | Needs handler research before grounded names can be recommended. |
| `0x55` | Used (1386) | Behavior not yet described in the opcode research. | Clear text | `text_end()`; `show_currency()` | Needs handler research before grounded names can be recommended. |
| `0x3A` | Used (1257) | Same handler as 0x38. | YIELD | `yield()` | Selected: `yield`; alternatives: `pause`, `wait_tick` |
| `0x1A` | Used (1109) | Word at slot + $0F + offset = expression. | WRITE SCRIPT argument | Not verified | Provisional: `write_local_word`; `store_local_word`; `set_local_word` |
| `0x1B` | Used (1069) | Two words at $2258 + offsets = the two bytes times 8 (a tile position in pixels). | Set two values (tile coordinates) | `init_map()` | Provisional: `write_tile_pair`; `store_tile_pair`; `set_tile_pair` |
| `0x29` | Used (1045) | Call the script at a packed pointer: it runs in this thread, this one resumes after it returns. | CALL (24-bit script) | call(pointer) | Provisional existing label: `call`; alternatives need grounded review | 
| `0x17` | Used (992) | Word at $2258 + offset = the immediate word. | WRITE save-area word (immediate) | Not verified | Provisional: `write_word_immediate`; `store_word_immediate`; `set_word_immediate` |
| `0x30` | Used (929) | Sound effect: the byte indexes the word table at $8C:8362 (a negative entry is silent), played by $8C:82DC after driver command $30 with $243B. | PLAY SOUND EFFECT | `sound()` | Provisional existing label: `sound`; alternatives need grounded review | 
| `0x5D` | Used (896) | Map object (expression) goes to its highest state ($7F, clamped) when the save flag (bit number) is set, else to 0 ($90:A36D). | If flag set, unload object (TODO: verify) | Not verified | `object_state_by_flag`; `set_object_state_if_flag`; `set_object_state_when_flag_set` |
| `0x43` | Used (854) | Entity expression and two expressions to $46 / $48. | Teleport entity to coordinates | `_teleport()`; `teleport()` | `set_entity_position`; `move_entity_to`; `teleport_entity` |
| `0x75` | Used (717) | Entity faces direction 8 (SOUTH): +$22 = 8. Decompiled as face(entity, SOUTH); | Make entity face SOUTH | `face()` | Provisional: `face_south`; `turn_south`; `orient_south` |
| `0x6F` | Used (704) | Behavior not yet described in the opcode research. | Make entity walk by coordinates (direct) | Not verified | Needs handler research before grounded names can be recommended. |
| `0xC2` | Used (699) | As 0xBA with state $8000: places a spawner. | Add NPC spawner | `add_enemy_spawner()` | Provisional existing label: `add_enemy_spawner`; alternatives need grounded review | 
| `0xA6` | Used (678) | Call a script that starts before this opcode: packed(opcode) + word - $10000. | Relative call (16-bit) | Not verified | Provisional: `call_back_far`; `invoke_back_far`; `run_back_far` |
| `0xBA` | Used (619) | As 0x3C with an ENEMY value byte (doubled by the handler) and state 0. | Load NPC | `add_enemy()` | Provisional: `spawn`; `spawn_entity`; `add_enemy` |
| `0x0D` | Used (598) | The same for the flag area at $2834. | Set/clear temp flag bit | Not verified | Provisional: `set_temp_flag`; `write_temp_flag`; `assign_temp_flag` |
| `0x22` | Used (589) | Like 0x21 with a map word written to $0ADB first ($90:8E90): enter another map at the tile position. | CHANGE MAP | `load_map()` | Provisional existing label: `change_map`; alternatives need grounded review | 
| `0x6E` | Used (522) | Behavior not yet described in the opcode research. | Make entity walk to coordinates | Not verified | Needs handler research before grounded names can be recommended. |
| `0x05` | Used (514) | Jump backwards: target = opcode address - (256 - byte). The byte is OR-ed with $FF00, so it can only go back. | SKIP (negative branch) | Not verified | Provisional: `jump_back`; `branch_back`; `goto_back` |
| `0x77` | Used (509) | Entity faces direction 4 (EAST): +$22 = 4. Decompiled as face(entity, EAST); | Make entity face EAST | `face()` | Provisional: `face_east`; `turn_east`; `orient_east` |
| `0x76` | Used (505) | Entity faces direction 12 (WEST): +$22 = 12. Decompiled as face(entity, WEST); | Make entity face WEST | `face()` | Provisional: `face_west`; `turn_west`; `orient_west` |
| `0x14` | Used (400) | Same handler as 0x10. | WRITE save-area value | Not verified | Provisional: `write_byte`; `store_byte`; `set_byte` |
| `0x52` | Used (392) | Show a string key through $8C:CD33 and $8C:C521 (after $8C:C4F6 unless $23D3 or bit 15 of $0B2B is set). | Show unwindowed text | `subtext()`; `_subtext()` | Provisional existing label: `message`; alternatives need grounded review | 
| `0x74` | Used (365) | Entity (expression) faces direction 0 (NORTH): its +$22 (FACE_DIRECTION) = 0. Decompiled as face(entity, NORTH); | Make entity face NORTH | `face()` | Provisional: `face_north`; `turn_north`; `orient_north` |
| `0x33` | Used (360) | Music: the byte indexes the word table at $8C:8442 (a negative entry does nothing); driver commands $1A, $2A ($A0), $2C, then $8C:828F with interrupts held off. | PLAY MUSIC | `music()` | Provisional existing label: `music`; alternatives need grounded review | 
| `0x3C` | Used (351) | Place an enemy or NPC: the first word is a byte offset into the ENEMY table at $8E:B55A (ENEMY value * 2), the second its state (bit 15: a spawner, $8F:DE98), then x and y in tiles (each * 8 to $46 / $48); $8F:A933, $8F:B094; the new entity goes to $0341. | Load NPC (flags/state, tile position) | `add_enemy()` | Selected: `add_enemy`; alternatives need grounded review because this also spawns NPCs |
| `0xA9` | Used (345) | Entity expression, an expression that picks one of the routines at $8C:E6F8 (none reads operands). | UNTRACED INSTR (modify entity bits?) | `attribute_bit()` | Needs handler research before grounded names can be recommended. |
| `0xC0` | Used (333) | Freeze bound entity ($8F:CD78). | Boy + Dog = stopped | `control()` | Provisional existing label: `freeze`; alternatives need grounded review | 
| `0x1C` | Used (286) | Same handler as 0x18. | WRITE save-area value | Not verified | Provisional: `write_word`; `store_word`; `set_word` |
| `0x3F` | Used (254) | Expression: an entity address (>= $2000) gets the two words at +$68 / +$66; a small index n gets them at $0EA2 / $0EAC + 2(n-1) (the second word is skipped when the first is 0). | Set NPC script / WRITE script fields | `attach_script()`; `special_script()` | `set_entity_data`; `set_entity_values`; `write_entity_fields` |
| `0xA5` | Used (252) | Call a script that starts before this opcode: packed(opcode) - (256 - byte). | Relative call (8-bit) | Not verified | Provisional: `call_back`; `invoke_back`; `run_back` |
| `0x42` | Used (249) | Entity expression and a word whose two bytes times 8 go to $46 / $48. | Teleport entity to tile coordinates | `teleport()` | `set_entity_tile_position`; `place_entity_at_tile`; `move_entity_to_tile` |
| `0x9B` | Used (247) | Behavior not yet described in the opcode research. | Destroy/deallocate entity | `_destroy()`; `destroy()` | Needs handler research before grounded names can be recommended. |
| `0x2A` | Used (245) | Entity expression ($8C:EC8E), then $8F:CD78 (freeze/immobilize). | Make entity script controlled | `control()`; `entity_script_controlled()` | Provisional: `freeze_entity`; `immobilize_entity`; `lock_entity` |
| `0x07` | Used (228) | Start the script at a packed pointer as a new parallel thread (a free slot from $28FC); this one continues. | CALL (24-bit script) | `call_async()` | Provisional existing label: `start_thread`; alternatives need grounded review | 
| `0x6C` | Used (228) | Behavior not yet described in the opcode research. | UNTRACED INSTR (entity, two values) | Not verified | Needs handler research before grounded names can be recommended. |
| `0x2B` | Used (216) | Entity expression, then $8F:CD4D (unfreeze/mobilize). | Make entity player/AI controlled | `control()` | Provisional: `unfreeze_entity`; `mobilize_entity`; `unlock_entity` |
| `0xC1` | Used (193) | Freeze Dog character ($8F:CD78). | Boy + Dog = player controlled | `available()`; `control()` | Provisional: `freeze_dog`; `immobilize_dog`; `lock_dog` |
| `0x3D` | Used (191) | Entity expression; the word to entity +$66, $40 to entity +$68. | Set NPC talk script | `attach_script()` | Selected: `add_enemy` (user choice; semantic mismatch to investigate); alternatives: `set_entity_data`, `write_entity_fields` |
| `0x89` | Used (177) | Behavior not yet described in the opcode research. | Add item to shop menu | `add_shop_item()` | Needs handler research before grounded names can be recommended. |
| `0xAF` | Used (177) | Arguments (to $0E80), then as 0x29. | Call script with arguments (24-bit) | `heel()`; `_drag()`; `drag()` | Provisional: `call_with_args`; `invoke_with_args`; `run_with_args` |
| `0x20` | Used (175) | Two bytes times 8 to $46/$48 (x, y in pixels), then $8F:B434. | Teleport both characters | `teleport()` | Provisional existing label: `place_camera_tile`; alternatives need grounded review | 
| `0x1D` | Used (159) | Same handler as 0x19. | WRITE temp-area value | `await_answer()` | Provisional: `write_temp_word`; `store_temp_word`; `set_temp_word` |
| `0x73` | Used (155) | Behavior not yet described in the opcode research. | Make entity walk to coordinates (direct) | Not verified | Needs handler research before grounded names can be recommended. |
| `0xA1` | Used (155) | Behavior not yet described in the opcode research. | Hide currency display | `show_currency()` | Needs handler research before grounded names can be recommended. |
| `0xAE` | Used (150) | As 0x1B for the slot's local bytes. | UNTRACED INSTR (modify current script) | `set_args()` | Provisional: `write_local_tile_pair`; `store_local_tile_pair`; `set_local_tile_pair` |
| `0xB4` | Used (140) | Arguments, then as 0x07. | Call script (24-bit) with arguments | `color_filter()`; `color_filter_fade_to()`; `color_filter_fade_from()` | Provisional existing label: `start_thread_with_args`; alternatives need grounded review | 
| `0x7A` | Used (139) | Behavior not yet described in the opcode research. | WRITE *(address) = value | Not verified | Needs handler research before grounded names can be recommended. |
| `0x8D` | Used (134) | Behavior not yet described in the opcode research. | Start/stop screen shaking | `sfx_effect()` | Needs handler research before grounded names can be recommended. |
| `0x80` | Used (119) | Behavior not yet described in the opcode research. | UNHIDE? unwindowed text | `enable_subtext()` | Needs handler research before grounded names can be recommended. |
| `0x27` | Used (117) | Fade screen out to black ($0B83 = $8000). | Fade-out screen | `fade_out()` | Provisional: `fade_out`; `fade_screen_out`; `hide_screen` |
| `0xB3` | Used (106) | Arguments, then as 0xA6. | Relative call (16-bit) with arguments | Not verified | Provisional: `call_back_far_with_args`; `invoke_back_far_with_args`; `run_back_far_with_args` |
| `0x91` | Used (102) | Set INIDISP brightness shadow directly ($0106 = E), centering camera as 0x26. | Set brightness | `brightness()` | Provisional: `set_brightness`; `write_brightness`; `assign_brightness` |
| `0x47` | Used (100) | Same handler as 0x44. | UNTRACED INSTR (open messagebox?) | `open_message_box()` | Provisional: `open_message_box`; `show_message_box`; `open_window` |
| `0x81` | Used (99) | Behavior not yet described in the opcode research. | Hide unwindowed text | `enable_subtext()` | Needs handler research before grounded names can be recommended. |
| `0x6D` | Used (98) | Behavior not yet described in the opcode research. | Make entity walk by coordinates | Not verified | Needs handler research before grounded names can be recommended. |
| `0xA0` | Used (97) | Behavior not yet described in the opcode research. | Show currency amount | `show_currency()` | Needs handler research before grounded names can be recommended. |
| `0xB5` | Used (95) | Behavior not yet described in the opcode research. | UNTRACED INSTR (reveal entity?) | `projectile()`; `shoot_entity_absolute()`; `shoot_entity_relative()`; `shoot_entity_relative_scaled()`; `shoot_entity_entity()`; `shoot_entity_entity_offset()`; `shoot_entity_offset_entity()`; `shoot_entity_offset_entity_offset()`; `shoot_entity_entity_scaled()`; `shoot_entity_absolute_scaled()`; `shoot_entity_offset_relative()`; `bomb_absolute()`; `bomb_relative()`; `bomb_relative_scaled()`; `bomb_entity()`; `bomb_entity_entity()` | Needs handler research before grounded names can be recommended. |
| `0x44` | Used (91) | Five bytes (type, x, y, w, h); sets up message box through $8C:C543 and $8C:D967. | UNTRACED INSTR (open messagebox?) | `open_message_box()` | Provisional: `open_message_box`; `show_message_box`; `open_window` |
| `0x79` | Used (89) | Same as 0x78, then yields. | UNTRACED INSTR (sprite/animation?) | Not verified | Needs handler research before grounded names can be recommended. |
| `0x5A` | Used (87) | Behavior not yet described in the opcode research. | UNTRACED INSTR (checking message timer) | `clear_subtext()` | Needs handler research before grounded names can be recommended. |
| `0xBD` | Used (87) | Unfreeze Dog character ($8F:CD4D). | Boy = player controlled | `available()`; `control()` | Provisional: `unfreeze_dog`; `mobilize_dog`; `unlock_dog` |
| `0x5B` | Used (85) | Behavior not yet described in the opcode research. | UNTRACED INSTR (checking message timer) | Not verified | Needs handler research before grounded names can be recommended. |
| `0xAD` | Used (85) | As 0x1B for $2834. | Write two values to temp area | Not verified | Provisional: `write_temp_tile_pair`; `store_temp_tile_pair`; `set_temp_tile_pair` |
| `0x26` | Used (81) | Fade screen in to full brightness ($0B83 = $800F), clearing $0106 to 0 and centering camera ($90:94AB). | UNTRACED INSTR (writing to VRAM) | `_fade_in()` | Provisional: `fade_in`; `fade_screen_in`; `show_screen` |
| `0x95` | Used (80) | Behavior not yet described in the opcode research. | Heal entity | `heal()` | Needs handler research before grounded names can be recommended. |
| `0xBF` | Used (80) | Freeze Boy character ($8F:CD78). | Dog = player controlled | `available()`; `control()` | Provisional: `freeze_boy`; `immobilize_boy`; `lock_boy` |
| `0xBE` | Used (75) | Unfreeze bound entity ($8F:CD4D). | Stop/disable Dog | `available()`; `control()` | Provisional existing label: `unfreeze`; alternatives need grounded review | 
| `0x2D` | Used (73) | One byte of bits; bit 3 applies $8F:CD4D to the slot's entity. | UNTRACED/UNKNOWN INSTR (script caller) | Not verified | `unfreeze_mask`; `unfreeze_entities`; `unfreeze_by_mask` |
| `0x9A` | Used (71) | Behavior not yet described in the opcode research. | UNTRACED INSTR (change font) | `font()` | Needs handler research before grounded names can be recommended. |
| `0x62` | Used (70) | Behavior not yet described in the opcode research. | UNTRACED INSTR (unknown data copy) | `tile_animate()` | Needs handler research before grounded names can be recommended. |
| `0xBC` | Used (68) | Unfreeze Boy character ($8F:CD4D). | Stop/disable Boy | `available()`; `control()` | Provisional: `unfreeze_boy`; `mobilize_boy`; `unlock_boy` |
| `0x86` | Used (56) | Behavior not yet described in the opcode research. | Set audio volume | `volume()` | Needs handler research before grounded names can be recommended. |
| `0x2C` | Used (52) | One byte of bits; bit 3 applies $8F:CD78 to the slot's entity. | UNTRACED/UNKNOWN INSTR (script caller) | Not verified | `freeze_mask`; `freeze_entities`; `freeze_by_mask` |
| `0x98` | Used (52) | Behavior not yet described in the opcode research. | Switch character | `player_control()` | Needs handler research before grounded names can be recommended. |
| `0x63` | Used (50) | Behavior not yet described in the opcode research. | Show alchemy selection screen | `select_alchemy()` | Needs handler research before grounded names can be recommended. |
| `0x3B` | Used (48) | Same handler as 0x39. | SLEEP ticks | `_sleep()`; `sleep()` | Selected: `sleep`; alternatives: `delay`, `sleep_ticks` |
| `0x9F` | Used (48) | Behavior not yet described in the opcode research. | Prepare currency display | `show_currency()` | Needs handler research before grounded names can be recommended. |
| `0x9D` | Used (45) | Entity expression and two coordinate expressions (x, y); decompiled as teleport(entity, x, y); | Make entity walk to coordinates (barriers ignored) | Not verified | Provisional existing label: `teleport`; alternatives need grounded review | 
| `0xA2` | Used (44) | As 0x3C with x and y as expressions (pixels). | Spawn NPC | `_add_enemy()`; `add_enemy()` | Provisional existing label: `spawn_at`; alternatives need grounded review | 
| `0x0E` | Used (43) | The same for the script slot's local bytes (slot + $0F). | Set/clear script argument bit | Not verified | Provisional: `set_local_flag`; `write_local_flag`; `assign_local_flag` |
| `0x1E` | Used (43) | Same handler as 0x1A. | WRITE SCRIPT argument | Not verified | Provisional: `write_local_word`; `store_local_word`; `set_local_word` |
| `0x97` | Used (42) | Behavior not yet described in the opcode research. | UNTRACED INSTR (7 sub-instructions) | `color_filter()` | Needs handler research before grounded names can be recommended. |
| `0xAC` | Used (39) | Same as 0x9E with the slot at $4F37 checked first. | Cast spell (if Dog alive) | `cast()` | Needs handler research before grounded names can be recommended. |
| `0x92` | Used (37) | Behavior not yet described in the opcode research. | Damage entity (with animation) | `damage()` | Needs handler research before grounded names can be recommended. |
| `0x9C` | Used (34) | Behavior not yet described in the opcode research. | Decrement script counter for entity? | Not verified | Needs handler research before grounded names can be recommended. |
| `0xB2` | Used (34) | Arguments, then as 0xA5. | Relative call (8-bit) with arguments | Not verified | Provisional: `call_back_with_args`; `invoke_back_with_args`; `run_back_with_args` |
| `0x0B` | Used (33) | Jump when the 24-bit amount at $0AC6 + expression is below the immediate. | IF currency < amount; SKIP target | Not verified | Provisional: `jump_if_amount_below`; `branch_if_amount_below`; `goto_if_amount_below` |
| `0x50` | Used (33) | Show text: a window byte (record at $034D + $2C * n, $8C:D967), then the string key, looked up by $8C:CCF5 and shown by $8C:9E03. | Show unwindowed text in window slot | Not verified | Provisional existing label: `text_in_window`; alternatives need grounded review | 
| `0x8C` | Used (33) | Behavior not yet described in the opcode research. | Show save menu | `save()` | Needs handler research before grounded names can be recommended. |
| `0xA4` | Used (30) | Call the script whose packed pointer is at $92:8000 + word[$92:8000] + the word. | Call script by 16-bit offset | Not verified | Provisional: `call_trigger`; `invoke_trigger`; `run_trigger` |
| `0x10` | Used (27) | Byte at $2258 + offset = expression. | WRITE save-area value | Not verified | Provisional: `write_byte`; `store_byte`; `set_byte` |
| `0xA8` | Used (27) | Sleep for the word's number of ticks. | Sleep ticks (16-bit) | `_sleep()` | Provisional: `sleep`; `delay`; `sleep_ticks` |
| `0xB9` | Used (27) | Behavior not yet described in the opcode research. | Teleport entity by coordinates | `teleport_relative()` | Needs handler research before grounded names can be recommended. |
| `0x70` | Used (24) | Behavior not yet described in the opcode research. | Make entity face entity | `face_target()` | Needs handler research before grounded names can be recommended. |
| `0x7D` | Used (24) | Behavior not yet described in the opcode research. | Take currency | `currency_take()` | Needs handler research before grounded names can be recommended. |
| `0x11` | Used (22) | Byte at $2834 + offset = expression. | WRITE temp-area value | Not verified | Provisional: `write_temp_byte`; `store_temp_byte`; `set_temp_byte` |
| `0x93` | Used (22) | Behavior not yet described in the opcode research. | Damage entity | `damage()` | Needs handler research before grounded names can be recommended. |
| `0x54` | Used (19) | Behavior not yet described in the opcode research. | Clear text in window slot | Not verified | Needs handler research before grounded names can be recommended. |
| `0x7C` | Used (18) | Behavior not yet described in the opcode research. | Give currency | `currency_get()` | Needs handler research before grounded names can be recommended. |
| `0xAA` | Used (15) | Behavior not yet described in the opcode research. | Clear Boy and Dog statuses | `clear_status_effects()`; `cure()` | Needs handler research before grounded names can be recommended. |
| `0x85` | Used (14) | Behavior not yet described in the opcode research. | Take currency | `currency_take()` | Needs handler research before grounded names can be recommended. |
| `0x8E` | Used (13) | Two expressions, then a jump offset like 0x08. | If currency >= amount; SKIP target | Not verified | Needs handler research before grounded names can be recommended. |
| `0x0A` | Used (12) | Jump when the 24-bit amount at $0AC6 + expression is at least the 24-bit immediate (u16 low, u8 high). | IF currency >= amount; SKIP target | Not verified | Provisional: `jump_if_amount_at_least`; `branch_if_amount_at_least`; `goto_if_amount_at_least` |
| `0x7E` | Used (12) | Behavior not yet described in the opcode research. | Exchange currency | `currency_convert()` | Needs handler research before grounded names can be recommended. |
| `0x99` | Used (11) | Behavior not yet described in the opcode research. | UNTRACED INSTR (WINDWALK args) | Not verified | Needs handler research before grounded names can be recommended. |
| `0x4E` | Used (10) | The slot's entity (slot + $0D) becomes the entity expression (reference counts at entity +$3E follow). | Attach entity to script | `attach_to_script()` | Provisional existing label: `bind_entity`; alternatives need grounded review | 
| `0x94` | Used (10) | Behavior not yet described in the opcode research. | Heal entity (with animation) | `heal()` | Needs handler research before grounded names can be recommended. |
| `0x59` | Used (8) | Behavior not yet described in the opcode research. | Fade out volume | `music_fade()`; `play_music()` | Needs handler research before grounded names can be recommended. |
| `0x71` | Used (7) | Behavior not yet described in the opcode research. | Make entities face each other | `_face_each()`; `face_each()` | Needs handler research before grounded names can be recommended. |
| `0x84` | Used (6) | Behavior not yet described in the opcode research. | Give currency | `currency_get()` | Needs handler research before grounded names can be recommended. |
| `0x9E` | Used (6) | Entity expression, two expressions, then expressions up to one that is 0 (stored to a free slot from $91:9759). Without a free slot it reads three more expressions and the list from where it stands: the same end only for lists of three or more. | Cast spell | Not verified | Needs handler research before grounded names can be recommended. |
| `0x96` | Used (5) | See knowledge rom/8ce49d. | Teleport player by screen coordinates | `teleport_screen()` | Needs handler research before grounded names can be recommended. |
| `0xB0` | Used (5) | Arguments, then as 0xA3. | Call global script with arguments | Not verified | Provisional: `call_global_with_args`; `invoke_global_with_args`; `run_global_with_args` |
| `0x58` | Used (4) | Behavior not yet described in the opcode research. | Fade in volume | `music_fade()`; `play_music()` | Needs handler research before grounded names can be recommended. |
| `0x83` | Used (3) | Behavior not yet described in the opcode research. | Change visible layers | `update_ui()` | Needs handler research before grounded names can be recommended. |
| `0x88` | Used (3) | Behavior not yet described in the opcode research. | Clear shopping ring | `clear_shop()` | Needs handler research before grounded names can be recommended. |
| `0xB6` | Used (3) | Behavior not yet described in the opcode research. | Start tile flashing | `tile_flashing()` | Needs handler research before grounded names can be recommended. |
| `0x87` | Used (2) | Behavior not yet described in the opcode research. | Set audio speed | Not verified | Needs handler research before grounded names can be recommended. |
| `0xAB` | Used (2) | Jumps to $80:84C9: screen off, interrupts off, stack reset, the reset entry at $80:8034. | Reset game | `reboot()` | Provisional existing label: `reset_game`; alternatives need grounded review | 
| `0xBB` | Used (2) | Behavior not yet described in the opcode research. | Show damage number | Not verified | Needs handler research before grounded names can be recommended. |
| `0x7F` | Used (1) | Behavior not yet described in the opcode research. | Show text/name input | Not verified | Needs handler research before grounded names can be recommended. |
| `0x82` | Used (1) | Behavior not yet described in the opcode research. | UNTRACED (change visible layers?) | `fade_out_black()`; `hide_non_dialog_layers()` | Needs handler research before grounded names can be recommended. |
| `0x8F` | Used (1) | Two expressions, then a jump offset like 0x09. | If currency < amount; SKIP target | Not verified | Needs handler research before grounded names can be recommended. |
| `0x12` | Not found (0) | Byte at slot + $0F + offset = expression. | UNKNOWN INSTR (default) | Not verified | Provisional: `write_local_byte`; `store_local_byte`; `set_local_byte` |
| `0x15` | Not found (0) | Same handler as 0x11. | WRITE temp-area value | Not verified | Provisional: `write_temp_byte`; `store_temp_byte`; `set_temp_byte` |
| `0x16` | Not found (0) | Same handler as 0x12. | UNKNOWN INSTR (default) | Not verified | Provisional: `write_local_byte`; `store_local_byte`; `set_local_byte` |
| `0x21` | Not found (0) | Like 0x20 after stopping the field ($80:85D8, $8C:CEE9, $8F:B38E); then stops the scripts ($8C:CE99) and ends this one. | UNKNOWN INSTR (default) | Not verified | Provisional existing label: `warp_in_room`; alternatives need grounded review | 
| `0x23` | Not found (0) | Word to $0E6E. | UNKNOWN INSTR (default) | Not verified | Provisional: `set_0e6e`; `write_0e6e`; `assign_0e6e` |
| `0x31` | Not found (0) | Same handler as 0x30. | PLAY SOUND EFFECT | Not verified | Provisional existing label: `sound`; alternatives need grounded review | 
| `0x32` | Not found (0) | Same handler as 0x30. | PLAY SOUND EFFECT | Not verified | Provisional existing label: `sound`; alternatives need grounded review | 
| `0x38` | Not found (0) | Yield for one tick. | YIELD | Not verified | Selected: `yield`; alternatives: `pause`, `wait_tick` |
| `0x39` | Not found (0) | Sleep for expression ticks: wake at timer $0B19 + n - 1 (32-bit), state 4; 0 does not yield. | SLEEP ticks | Not verified | Selected: `sleep`; alternatives: `delay`, `sleep_ticks` |
| `0x45` | Not found (0) | Same handler as 0x44. | UNTRACED INSTR (open messagebox?) | Not verified | Provisional: `open_message_box`; `show_message_box`; `open_window` |
| `0x46` | Not found (0) | Same handler as 0x44. | UNTRACED INSTR (open messagebox?) | Not verified | Provisional: `open_message_box`; `show_message_box`; `open_window` |
| `0x48` | Not found (0) | No operands; $8C:C543, then fixed values to $0361-$036B. | UNTRACED INSTR (open default messagebox?) | Not verified | Provisional: `text_start`; `begin_text`; `start_text` |
| `0x49` | Not found (0) | Same handler as 0x48. | UNTRACED INSTR (open default messagebox?) | Not verified | Provisional: `text_start`; `begin_text`; `start_text` |
| `0x4A` | Not found (0) | Same handler as 0x48. | UNTRACED INSTR (open default messagebox?) | Not verified | Provisional: `text_start`; `begin_text`; `start_text` |
| `0x4B` | Not found (0) | Same handler as 0x48. | UNTRACED INSTR (open default messagebox?) | Not verified | Provisional: `text_start`; `begin_text`; `start_text` |
| `0x4C` | Not found (0) | Skips one byte and continues. | UNKNOWN INSTR (default) | Not verified | Provisional existing label: `skip_byte`; alternatives need grounded review | 
| `0x4D` | Not found (0) | Does nothing. | NOP | `nop()` | Provisional existing label: `nop`; alternatives need grounded review | 
| `0x5E` | Not found (0) | The same with the flag's meaning reversed: highest state when it is clear. | UNKNOWN INSTR (default) | Not verified | `object_state_unless_flag`; `set_object_state_if_flag_clear`; `set_object_state_when_flag_clear` |
| `0x5F` | Not found (0) | Map object (expression) goes to its target state ($107E + object) plus the word. | UNKNOWN INSTR (default) | Not verified | Provisional existing label: `add_object_state`; alternatives need grounded review | 
| `0x60` | Not found (0) | Map object (expression) goes to its target state + 1. | UNKNOWN INSTR (default) | Not verified | Provisional existing label: `next_object_state`; alternatives need grounded review | 
| `0x61` | Not found (0) | Map object (expression) goes to its target state - 1. | UNKNOWN INSTR (default) | Not verified | Provisional existing label: `previous_object_state`; alternatives need grounded review | 
| `0x64` | Not found (0) | Behavior not yet described in the opcode research. | UNKNOWN INSTR (default) | Not verified | Needs handler research before grounded names can be recommended. |
| `0x65` | Not found (0) | Behavior not yet described in the opcode research. | UNKNOWN INSTR (default) | Not verified | Needs handler research before grounded names can be recommended. |
| `0x66` | Not found (0) | Behavior not yet described in the opcode research. | UNKNOWN INSTR (default) | Not verified | Needs handler research before grounded names can be recommended. |
| `0x68` | Not found (0) | Behavior not yet described in the opcode research. | UNKNOWN INSTR (default) | Not verified | Needs handler research before grounded names can be recommended. |
| `0x69` | Not found (0) | Behavior not yet described in the opcode research. | UNKNOWN INSTR (default) | Not verified | Needs handler research before grounded names can be recommended. |
| `0x6A` | Not found (0) | Behavior not yet described in the opcode research. | UNKNOWN INSTR (default) | Not verified | Needs handler research before grounded names can be recommended. |
| `0x7B` | Not found (0) | Behavior not yet described in the opcode research. | UNKNOWN INSTR (default) | Not verified | Needs handler research before grounded names can be recommended. |
| `0x8A` | Not found (0) | Behavior not yet described in the opcode research. | Move shop menu to entity | Not verified | Needs handler research before grounded names can be recommended. |
| `0x90` | Not found (0) | Fade screen to expression brightness ($0B83 = $8000 \ | UNKNOWN INSTR (default) | Not verified | Provisional existing label: `fade_to`; alternatives need grounded review | 
| `0xB1` | Not found (0) | Arguments, then as 0xA4. | Call script by offset with arguments | Not verified | Provisional: `call_trigger_with_args`; `invoke_trigger_with_args`; `run_trigger_with_args` |
| `0xB7` | Not found (0) | Behavior not yet described in the opcode research. | Stop tile flashing | Not verified | Needs handler research before grounded names can be recommended. |
## Follow-up Notes

- `0x38` / `0x3A` share the same handler; selected name: `yield`.
- `0x39` / `0x3B` share the same handler; selected name: `sleep`.
- `0x3C` creates an enemy or NPC; selected name: `add_enemy` is narrower than the documented behavior.
- `0x3D` writes a word to entity fields `+$66` and `+$68`; `add_enemy` is the user-selected label, but does not match the documented handler behavior. Its operands are `E u16`, not three parameters, and a bitfield interpretation is not verified by the local notes.
- Opcode semantics and operand details: [opcodes.md](opcodes.md). Verified language examples: sibling compiler integration tests for `init_map(...)`, `load_map(...)`, and `call(...)`.
