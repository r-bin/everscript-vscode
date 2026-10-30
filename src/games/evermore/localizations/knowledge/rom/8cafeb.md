# dialogue_window_arrow_cursor_draw

Renders the animated bouncing prompt arrow at the bottom of dialogue boxes awaiting button input.

## Metadata
- **Address:** `$8C:AFEB`
- **Type:** `routine`
- **Bank:** `$8C`
- **Size:** 100 bytes

## Functionality
Displays the animated down-pointing arrow cursor in dialogue text windows.
When typewriter text reaches a pause point or concludes a message, the routine computes corner coordinates of the dialogue window and writes the flashing prompt arrow sprite tile into OAM staging memory, signaling to the player that pressing the action button will advance the text.

## Callers
- `$8C:A7C6` (`dialogue_typewriter_step_and_button_wait`)
- `$8C:B05F` (`dialogue_bubble_pointer_tail_vram_stream`)
- `$8C:B2B4` (`dialogue_window_close_and_restore`)

## Callees
- None

## Variables and Memory
- `$22`, `$24` (Dialogue window boundary coordinates)
- `$26` (OAM staging offset for prompt arrow sprite)
