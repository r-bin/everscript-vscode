# dialogue_window_border_tilemap_clear

Clears dialogue window interior tiles and draws ornamental border and corner tiles in the UI tilemap buffer.

## Metadata
- **Address:** `$8C:BAAB`
- **Type:** `routine`
- **Bank:** `$8C`
- **Size:** 199 bytes

## Functionality
Prepares the visual frame for dialogue text boxes, menus, and shop windows.
The routine clears the window interior tile area to empty/transparent tiles and writes border pattern indices into the UI tilemap staging memory.

It places corner brackets and edge borders, preparing the window surface for subsequent character rendering.

## Callers
- `$8C:BA86` (`FUN_8cba86`)

## Callees
- `$80:8650` (`FUN_808650`)

## Variables and Memory
- `$22`, `$24` (Pointer to window tilemap buffer)
- `$26` (Window dimensions and coordinate offsets)
- `$2E` (Tile attribute and palette index for window borders)
