# options_menu_controller_cursor_icon_draw

Renders the button selection cursor sprite in the Options Menu controller configuration screen.

## Metadata
- **Address:** `$8D:C2BF`
- **Type:** `routine`
- **Bank:** `$8D`
- **Size:** 98 bytes

## Functionality
Draws the flashing highlight cursor indicating the currently selected controller button in the Options Menu.
The routine indexes controller button configuration table `$7E:22FF,X`, derives on-screen button layout coordinates in `$02` and `$04`, and emits cursor sprite entries into the OAM buffer via `$80:9033` (`direct_sprite_draw_oam`).

## Callers
- `$8D:C233` (`FUN_8dc233`)

## Callees
- `$80:9033` (`direct_sprite_draw_oam`)

## Variables and Memory
- `$7E:22FF` (Player button mapping configuration array)
- `$0D0D`, `$0D17` (Cursor screen position coordinates)
