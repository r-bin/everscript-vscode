# Secret of Evermore — Map Foreground & Parallax Analysis

This document details layer architecture, foreground (canopy) usage, and parallax/layer scrolling behavior across all **127 vanilla maps** in *Secret of Evermore* (SNES).

## 1. Architectural Summary

### SNES Mode 1 Layer Allocation
- **BG1 (Layer 1)**: Canopy / Foreground layer. Metatiles with the priority bit set render in front of sprites (player, companions, enemies) according to SNES priority rules (`OBJ.3 > BG1.1 > BG2.1 > OBJ.2 > BG1.0 > BG2.0`).
- **BG2 (Layer 2)**: Terrain / Ground layer.
- **BG3 (Layer 3)**: HUD / Status bar.
- **OBJ**: Entities & sprites.

### Foreground Layer Findings
- **124 of 127 maps (97.6%)** feature an active foreground layer (ranging from minor roof trims at ~1% to dense forest canopies over 50%).
- **Exactly 3 maps (2.4%)** have **NO** foreground layer (0 foreground pixels rendered):
  1. `0x15` (**Room 0x15**): Unused engine test/dummy room.
  2. `0x4B` (**Antiqua - Oglin cave**): Main-screen BG1 is explicitly disabled (`visibleLayers = 0x16 = 22`). Layer 1 is repurposed as a subscreen subtractive lantern mask.
  3. `0x50` (**Prehistoria - Sky above Volcano**): Pure background sky cutscene flight sequence (0% canopy).

### Parallax Scrolling Findings
- **Traditional Multi-Rate Parallax**: **None**. In stock *Secret of Evermore*, the SNES engine routines (`$909A81` baseline and `$909B3B` variant 2) clear layer scroll offsets (`$7E2417` / `$7E2419`), locking BG1 and BG2 scroll rates 1:1 with camera movement.
- **Header Signature `17 00 00 02 02` ("Layered / Pseudo-Parallax")**: 6 maps (`0x22`, `0x31`, `0x38`, `0x41`, `0x5B`, `0x6A`) share room effect `0x02`. While historically designated *"parallax / layered-background"* in disassembly notes due to their dense multi-tier canopy presentation (e.g. Prehistoria Jungles, Dark Forest), in the engine this triggers camera-distance sprite depth-sorting rather than differential layer scrolling.
- **Independent Layer Offset (`roomEffect = 1`)**: Map `0x4B` (**Oglin Cave**) dynamically offsets Layer 1 by `(-352, -336)` from the camera so the lantern light-hole tracks the player.
- **HDMA Wave Ripple Displacement (`roomEffect = 5`)**: Map `0x52` (**Top of Volcano**) drives per-scanline horizontal displacement on BG1/BG2 to simulate atmospheric heat shimmer.
- **Engine Scripted Auto-Scroll**: Map `0x61` (**Opening - Scrolling over Machine**).

## 2. Complete 127-Map Reference Table

| Map ID | Area | Map Name | Dimensions | Foreground Layer | Parallax / Layer Scrolling |
|:---:|:---|:---|:---:|:---|:---|
| `0x00` | Omnitopia | Alarm room | 37×68 | **Yes** (22.3% coverage) | None (1:1 lockstep) |
| `0x01` | Prehistoria | Exterior of Blimp's Hut | 33×49 | **Yes** (25.4% coverage) | None (1:1 lockstep) |
| `0x02` | Intro / Misc | Intro - Mansion Exterior 1965 | 28×56 | **Yes** (35.6% coverage) | None (1:1 lockstep) |
| `0x03` | Intro / Misc | Intro - Mansion Exterior 1995 | 20×56 | **Yes** (31.1% coverage) | None (1:1 lockstep) |
| `0x04` | Antiqua | Crustacia fire pit | 23×25 | **Yes** (33.0% coverage) | None (1:1 lockstep) |
| `0x05` | Antiqua | Between 'mids and halls | 48×63 | **Yes** (19.1% coverage) | None (1:1 lockstep) |
| `0x06` | Antiqua | Outside of 'mids | 80×82 | **Yes** (32.0% coverage) | None (1:1 lockstep) |
| `0x07` | Antiqua | West of Crustacia | 37×42 | **Yes** (32.7% coverage) | None (1:1 lockstep) |
| `0x08` | Antiqua | Nobilia, Square | 48×59 | **Yes** (21.5% coverage) | None (1:1 lockstep) |
| `0x09` | Antiqua | Nobilia, Square during Aegis fight | 32×44 | **Yes** (4.7% coverage) | None (1:1 lockstep) |
| `0x0A` | Antiqua | Nobilia, Market | 48×76 | **Yes** (32.6% coverage) | None (1:1 lockstep) |
| `0x0B` | Antiqua | Nobilia, Palace grounds | 86×42 | **Yes** (36.1% coverage) | None (1:1 lockstep) |
| `0x0C` | Antiqua | Nobilia, Inn | 45×33 | **Yes** (25.2% coverage) | None (1:1 lockstep) |
| `0x0D` | Gothica | Ebon Keep Hall (Stairs, behind Verm) | 41×61 | **Yes** (36.8% coverage) | None (1:1 lockstep) |
| `0x0E` | Gothica | Ebon Keep Dining Room | 32×32 | **Yes** (57.6% coverage) | None (1:1 lockstep) |
| `0x0F` | Gothica | Ebon Keep West Room (Naris) | 63×43 | **Yes** (54.3% coverage) | None (1:1 lockstep) |
| `0x10` | Gothica | Ebon Keep Stained Glass Hallway | 24×15 | **Yes** (22.3% coverage) | None (1:1 lockstep) |
| `0x11` | Gothica | Ebon Keep Queen's Room | 31×45 | **Yes** (39.5% coverage) | None (1:1 lockstep) |
| `0x12` | Gothica | Ebon Keep sewers | 112×90 | **Yes** (62.4% coverage) | None (1:1 lockstep) |
| `0x13` | Gothica | Between Ebon Keep sewers, Dark Forest and Swamp | 23×24 | **Yes** (36.1% coverage) | None (1:1 lockstep) |
| `0x14` | Gothica | Ebon Keep Tinker's Room | 32×46 | **Yes** (36.7% coverage) | None (1:1 lockstep) |
| `0x15` | Unknown | Room 0x15 | 24×24 | **No** (0% coverage) | None (1:1 lockstep) |
| `0x16` | Prehistoria | BBM | 52×85 | **Yes** (20.7% coverage) | None (1:1 lockstep) |
| `0x17` | Prehistoria | Bug room 2 | 29×46 | **Yes** (20.4% coverage) | None (1:1 lockstep) |
| `0x18` | Prehistoria | Thraxx' room | 24×32 | **Yes** (13.7% coverage) | None (1:1 lockstep) |
| `0x19` | Gothica | Chessboard | 74×66 | **Yes** (6.7% coverage) | None (1:1 lockstep) |
| `0x1A` | Gothica | Below chessboard | 67×82 | **Yes** (24.7% coverage) | None (1:1 lockstep) |
| `0x1B` | Antiqua | Desert of Doom | 97×113 | **Yes** (4.2% coverage) | None (1:1 lockstep) |
| `0x1C` | Antiqua | Nobilia, North of Market | 64×28 | **Yes** (31.5% coverage) | None (1:1 lockstep) |
| `0x1D` | Antiqua | Nobilia, Arena (Vigor Fight) | 69×56 | **Yes** (17.6% coverage) | None (1:1 lockstep) |
| `0x1E` | Antiqua | Nobilia, Arena Holding Room | 45×24 | **Yes** (68.5% coverage) | None (1:1 lockstep) |
| `0x1F` | Gothica | Doubles room in forest | 50×25 | **Yes** (17.3% coverage) | None (1:1 lockstep) |
| `0x20` | Gothica | Timberdrake room in forest | 24×22 | **Yes** (15.9% coverage) | None (1:1 lockstep) |
| `0x21` | Gothica | Dark Forest entrance (save point) | 17×19 | **Yes** (33.6% coverage) | None (1:1 lockstep) |
| `0x22` | Gothica | Dark Forest | 75×79 | **Yes** (23.3% coverage) | Pseudo-parallax (effect 2: depth-sorted dense canopy) |
| `0x23` | Antiqua | Halls SW | 31×42 | **Yes** (25.2% coverage) | None (1:1 lockstep) |
| `0x24` | Antiqua | Halls NW | 71×100 | **Yes** (32.4% coverage) | None (1:1 lockstep) |
| `0x25` | Prehistoria | Fire Eyes' Village | 63×58 | **Yes** (52.0% coverage) | None (1:1 lockstep) |
| `0x26` | Prehistoria | West area with Defend | 19×18 | **Yes** (75.6% coverage) | None (1:1 lockstep) |
| `0x27` | Prehistoria | Mammoth Graveyard | 50×48 | **Yes** (20.2% coverage) | None (1:1 lockstep) |
| `0x28` | Antiqua | Halls Collapsing Bridge | 83×82 | **Yes** (27.2% coverage) | None (1:1 lockstep) |
| `0x29` | Antiqua | Halls main room | 42×70 | **Yes** (50.4% coverage) | None (1:1 lockstep) |
| `0x2A` | Antiqua | Halls Boss Room | 64×42 | **Yes** (34.8% coverage) | None (1:1 lockstep) |
| `0x2B` | Antiqua | Outside of halls | 69×33 | **Yes** (20.9% coverage) | None (1:1 lockstep) |
| `0x2C` | Antiqua | Halls SE | 21×28 | **Yes** (38.9% coverage) | None (1:1 lockstep) |
| `0x2D` | Antiqua | Halls NE | 105×96 | **Yes** (39.4% coverage) | None (1:1 lockstep) |
| `0x2E` | Antiqua | Blimp's Cave | 20×15 | **Yes** (33.1% coverage) | None (1:1 lockstep) |
| `0x2F` | Antiqua | Horace's camp | 65×57 | **Yes** (44.7% coverage) | None (1:1 lockstep) |
| `0x30` | Antiqua | Crustacia inside pirate ship | 67×46 | **Yes** (14.3% coverage) | None (1:1 lockstep) |
| `0x31` | Intro / Misc | Intro - Podunk 1965 | 98×20 | **Yes** (35.0% coverage) | Pseudo-parallax (effect 2: depth-sorted dense canopy) |
| `0x32` | Intro / Misc | Intro - Podunk 1995 | 43×16 | **Yes** (7.0% coverage) | None (1:1 lockstep) |
| `0x33` | Prehistoria | Strong Heart's Exterior | 20×16 | **Yes** (67.4% coverage) | None (1:1 lockstep) |
| `0x34` | Prehistoria | Strong Heart's Hut | 18×18 | **Yes** (43.2% coverage) | None (1:1 lockstep) |
| `0x35` | Antiqua | Quicksand/Bugmuck/Volcano caves + West Alchemy Cave | 109×23 | **Yes** (38.9% coverage) | None (1:1 lockstep) |
| `0x36` | Prehistoria | Both fire pits (one room) | 25×25 | **Yes** (44.6% coverage) | None (1:1 lockstep) |
| `0x37` | Gothica | Gomi's Tower | 56×125 | **Yes** (7.6% coverage) | None (1:1 lockstep) |
| `0x38` | Prehistoria | South jungle / Start | 83×91 | **Yes** (44.0% coverage) | Pseudo-parallax (effect 2: depth-sorted dense canopy) |
| `0x39` | Gothica | Ebon Keep Fire pit | 44×38 | **Yes** (17.5% coverage) | None (1:1 lockstep) |
| `0x3A` | Antiqua | Nobilia, Fire pit | 28×22 | **Yes** (13.4% coverage) | None (1:1 lockstep) |
| `0x3B` | Prehistoria | Volcano Room 2 | 80×89 | **Yes** (25.9% coverage) | None (1:1 lockstep) |
| `0x3C` | Prehistoria | Volcano Room 1 | 127×96 | **Yes** (21.1% coverage) | None (1:1 lockstep) |
| `0x3D` | Prehistoria | Pipe maze | 88×75 | **Yes** (33.5% coverage) | None (1:1 lockstep) |
| `0x3E` | Prehistoria | Side rooms of pipe maze | 100×24 | **Yes** (34.5% coverage) | None (1:1 lockstep) |
| `0x3F` | Prehistoria | Volcano Boss Room | 24×37 | **Yes** (33.7% coverage) | None (1:1 lockstep) |
| `0x40` | Gothica | Swamp south of Gomi's Tower | 24×42 | **Yes** (26.9% coverage) | None (1:1 lockstep) |
| `0x41` | Prehistoria | North jungle | 61×47 | **Yes** (55.7% coverage) | Pseudo-parallax (effect 2: depth-sorted dense canopy) |
| `0x42` | Omnitopia | Reactor room and Reactor control | 45×36 | **Yes** (31.3% coverage) | None (1:1 lockstep) |
| `0x43` | Omnitopia | Control room | 48×18 | **Yes** (28.5% coverage) | None (1:1 lockstep) |
| `0x44` | Omnitopia | Greenhouse | 45×59 | **Yes** (14.6% coverage) | None (1:1 lockstep) |
| `0x45` | Omnitopia | Secret boss room | 34×48 | **Yes** (25.6% coverage) | None (1:1 lockstep) |
| `0x46` | Omnitopia | Professor's lab and ship area | 49×51 | **Yes** (18.2% coverage) | None (1:1 lockstep) |
| `0x47` | Omnitopia | Storage room | 56×38 | **Yes** (24.5% coverage) | None (1:1 lockstep) |
| `0x48` | Omnitopia | Metroplex tunnels (rimsalas, spheres) | 114×82 | **Yes** (26.4% coverage) | None (1:1 lockstep) |
| `0x49` | Omnitopia | Junkyard (Landing spot) | 60×46 | **Yes** (31.5% coverage) | None (1:1 lockstep) |
| `0x4A` | Omnitopia | Final Boss Room | 20×28 | **Yes** (31.2% coverage) | None (1:1 lockstep) |
| `0x4B` | Antiqua | Oglin cave | 106×125 | **No** (BG1 repurposed as subscreen light mask) | Offset mask (effect 1: sliding lantern disc) |
| `0x4C` | Antiqua | Nobilia, Fountain and snake statues | 22×36 | **Yes** (17.7% coverage) | None (1:1 lockstep) |
| `0x4D` | Antiqua | Nobilia, Inside palace (Horace cutscene) | 38×17 | **Yes** (70.0% coverage) | None (1:1 lockstep) |
| `0x4E` | Gothica | Ivor Tower, west alley (market) | 31×102 | **Yes** (25.4% coverage) | None (1:1 lockstep) |
| `0x4F` | Antiqua | East of Crustacia | 33×45 | **Yes** (30.2% coverage) | None (1:1 lockstep) |
| `0x50` | Prehistoria | Sky above Volcano | 17×15 | **No** (0% coverage) | None (1:1 lockstep) |
| `0x51` | Prehistoria | Village Huts and Blimp's Hut | 50×56 | **Yes** (22.6% coverage) | None (1:1 lockstep) |
| `0x52` | Prehistoria | Top of Volcano | 32×15 | **Yes** (45.3% coverage) | HDMA wave scroll (effect 5: heat ripple displacement) |
| `0x53` | Antiqua | Act 2 Start Cutscene | 49×15 | **Yes** (41.8% coverage) | None (1:1 lockstep) |
| `0x54` | Omnitopia | Shops | 60×47 | **Yes** (20.3% coverage) | None (1:1 lockstep) |
| `0x55` | Antiqua | 'mids bottom level (Dog start) | 120×73 | **Yes** (20.3% coverage) | None (1:1 lockstep) |
| `0x56` | Antiqua | 'mids top level (Boy start) | 94×58 | **Yes** (20.0% coverage) | None (1:1 lockstep) |
| `0x57` | Antiqua | 'mids basement level (Tiny) | 104×60 | **Yes** (17.3% coverage) | None (1:1 lockstep) |
| `0x58` | Antiqua | 'mids boss room (Rimsala) | 34×34 | **Yes** (14.9% coverage) | None (1:1 lockstep) |
| `0x59` | Prehistoria | Quick sand desert | 58×79 | **Yes** (22.1% coverage) | None (1:1 lockstep) |
| `0x5A` | Prehistoria | Acid rain guy | 27×24 | **Yes** (16.7% coverage) | None (1:1 lockstep) |
| `0x5B` | Prehistoria | East jungle | 72×48 | **Yes** (26.1% coverage) | Pseudo-parallax (effect 2: depth-sorted dense canopy) |
| `0x5C` | Prehistoria | Raptors | 31×26 | **Yes** (27.9% coverage) | None (1:1 lockstep) |
| `0x5D` | Gothica | Ebon Keep Courtyard (South of Verm) | 20×40 | **Yes** (36.5% coverage) | None (1:1 lockstep) |
| `0x5E` | Gothica | Ebon Keep Front Room (Verm) | 22×52 | **Yes** (41.8% coverage) | None (1:1 lockstep) |
| `0x5F` | Gothica | Ebon Keep Verm side rooms | 53×56 | **Yes** (32.0% coverage) | None (1:1 lockstep) |
| `0x60` | Gothica | Ebon Keep Storage Room | 22×17 | **Yes** (46.9% coverage) | None (1:1 lockstep) |
| `0x61` | Intro / Misc | Opening - Scrolling over Machine | 48×47 | **Yes** (37.2% coverage) | Scripted cutscene auto-scroll |
| `0x62` | Gothica | Ivor Tower, west square (trailers) | 50×38 | **Yes** (21.8% coverage) | None (1:1 lockstep) |
| `0x63` | Gothica | Ivor Tower, inside trailers | 47×20 | **Yes** (19.4% coverage) | None (1:1 lockstep) |
| `0x64` | Antiqua | Cave entrance under 'mids | 21×18 | **Yes** (30.1% coverage) | None (1:1 lockstep) |
| `0x65` | Prehistoria | Swamp (main area) | 80×99 | **Yes** (29.3% coverage) | None (1:1 lockstep) |
| `0x66` | Prehistoria | West of swamp | 48×38 | **Yes** (29.9% coverage) | None (1:1 lockstep) |
| `0x67` | Prehistoria | Bugmuck exterior | 86×73 | **Yes** (24.0% coverage) | None (1:1 lockstep) |
| `0x68` | Antiqua | Crustacia exterior | 48×50 | **Yes** (30.7% coverage) | None (1:1 lockstep) |
| `0x69` | Prehistoria | Volcano path | 54×79 | **Yes** (14.7% coverage) | None (1:1 lockstep) |
| `0x6A` | Antiqua | Act 2 Start Cutscene - waterfall | 17×82 | **Yes** (26.0% coverage) | Pseudo-parallax (effect 2: depth-sorted dense canopy) |
| `0x6B` | Antiqua | Waterfall | 48×34 | **Yes** (25.1% coverage) | None (1:1 lockstep) |
| `0x6C` | Gothica | SE of Ivor Tower (Well) | 32×34 | **Yes** (17.3% coverage) | None (1:1 lockstep) |
| `0x6D` | Antiqua | Aquagoth Room | 26×41 | **Yes** (19.3% coverage) | None (1:1 lockstep) |
| `0x6E` | Gothica | Ivor Tower Hall | 38×61 | **Yes** (36.8% coverage) | None (1:1 lockstep) |
| `0x6F` | Gothica | Ivor Tower Dining Room | 31×29 | **Yes** (53.4% coverage) | None (1:1 lockstep) |
| `0x70` | Gothica | Ivor Tower Exterior Bridges and Balconies | 71×28 | **Yes** (53.6% coverage) | None (1:1 lockstep) |
| `0x71` | Gothica | Ivor Tower East Room + Kitchen | 118×98 | **Yes** (58.6% coverage) | None (1:1 lockstep) |
| `0x72` | Gothica | Ivor Tower East Upper Floor | 61×58 | **Yes** (54.9% coverage) | None (1:1 lockstep) |
| `0x73` | Gothica | Ivor Tower Dog Maze Underground | 128×70 | **Yes** (77.7% coverage) | None (1:1 lockstep) |
| `0x74` | Gothica | Ebon Keep and Ivor Tower dungeon + pipe room | 52×70 | **Yes** (42.4% coverage) | None (1:1 lockstep) |
| `0x75` | Gothica | Ivor Tower Stairwell to dungeon | 29×37 | **Yes** (39.1% coverage) | None (1:1 lockstep) |
| `0x76` | Gothica | South of Ivor Tower (Gate) | 52×70 | **Yes** (46.9% coverage) | None (1:1 lockstep) |
| `0x77` | Gothica | Ivor Tower Puppet Show / Mungola | 30×25 | **Yes** (42.0% coverage) | None (1:1 lockstep) |
| `0x78` | Gothica | Ivor Tower Queen's Room | 31×45 | **Yes** (35.4% coverage) | None (1:1 lockstep) |
| `0x79` | Gothica | Ivor Tower Sewers | 112×90 | **Yes** (50.8% coverage) | None (1:1 lockstep) |
| `0x7A` | Gothica | Ivor Tower Sewers Exterior (landing spot) | 17×22 | **Yes** (29.4% coverage) | None (1:1 lockstep) |
| `0x7B` | Gothica | Ebon Keep and Ivor Tower Exterior Bottom Half | 101×48 | **Yes** (25.1% coverage) | None (1:1 lockstep) |
| `0x7C` | Gothica | Ebon Keep and Ivor Tower Exterior Top Half | 101×60 | **Yes** (30.3% coverage) | None (1:1 lockstep) |
| `0x7D` | Gothica | Ebon Keep and Ivor Tower Interior | 109×70 | **Yes** (18.8% coverage) | None (1:1 lockstep) |
| `0x7E` | Omnitopia | Jail | 103×31 | **Yes** (24.2% coverage) | None (1:1 lockstep) |
