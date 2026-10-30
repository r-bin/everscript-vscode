# dog_foraging_ingredient_node_spawn_dice_roll

Evaluates dog companion foraging cycles and rolls probability dice against hidden ingredient nodes.

## Metadata
- **Address:** `$8F:DDBB`
- **Type:** `routine`
- **Bank:** `$8F`
- **Size:** 221 bytes

## Functionality
Manages the dog companion\'s ambient sniffing behavior and hidden ingredient node detection.
The routine increments foraging cycle counter `$6185` and checks proximity to hidden alchemy ingredient discovery points (starting at `$5DC3`).

It invokes the pseudo-random number generator (`$80:859B`) to compare against the ingredient node\'s spawn probability. When successful, it triggers the dog\'s alert bark and points towards the discovery location.

## Callers
- `$8F:AFAE` (`FUN_8fafae`)

## Callees
- `$80:859B` (`FUN_80859b`)
- `$8F:B094` (`FUN_8fb094`)

## Variables and Memory
- `$6185` (Dog foraging inspection cycle counter)
- `$6183` (Foraging interval trigger threshold)
- `$5DC3` (Room hidden ingredient node table pointer in WRAM)
- `$0EBE` (Active target discovery node index)
