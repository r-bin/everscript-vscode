# Map Elevation Ramp Stepper & Stair Shear Vector Mathematics

**Addresses**:
- `elevation_ramp_plane_project`: `$8F:A93B` – `$8F:A945`
- `elevation_vector_shear_step`: `$8F:A963` – `$8F:A97C`
- `elevation_manhattan_distance_eval`: `$8F:A97D` – `$8F:A998`
- `elevation_compass_direction_resolve`: `$8F:A999` – `$8F:A9C8`

**ROM Source**: Bank `$8F` (US 1.0)  
**Subsystem**: Map Metatiles & Collision Grid / Elevation Mathematics

---

## 1. Overview & Architectural Role

Navigating isometric 2.5D terrain with multiple elevation planes (ground floor, bridge overpass, underground tunnels, and diagonal stairways) requires specialized fixed-point geometry and projection algorithms:
1. **Ramp Layer Projector (`elevation_ramp_plane_project`)**:
   Inspects metatile collision word bit 13 (`0x2000`). If clear, extracts bits 5..4 (`attr & 0x0030`) into Direct Page `$44` as the active traversable plane. If bit 13 is set, the tile represents a ramp or staircase connecting two layers, enabling seamless vertical transition.
2. **Chebyshev Chebyshev & Shear Metric (`elevation_vector_shear_step`)**:
   Calculates $\min(|\Delta X|, |\Delta Y|)$ between origin and destination coordinates. Used to govern diagonal movement speed throttling across 45-degree slope terrain.
3. **Manhattan Diagonal Distance Evaluator (`elevation_manhattan_distance_eval`)**:
   Evaluates diagonal distance $|\Delta X \pm \Delta Y|$ depending on quadrant sign parity:
   $$\text{Metric} = |\Delta X + \Delta Y| \quad (\text{opposite signs}), \quad |\Delta X - \Delta Y| \quad (\text{same signs})$$
4. **Compass Heading Direction Resolver (`elevation_compass_direction_resolve`)**:
   Maps signed horizontal ($\Delta X$) and vertical ($\Delta Y$) pixel displacements into 4-way cardinal compass codes:
   - `0x0A`: North ($\Delta X < 0, \Delta Y \ge 0$)
   - `0x0E`: West ($\Delta X < 0, \Delta Y < 0$)
   - `0x06`: East ($\Delta X \ge 0, \Delta Y \ge 0$)
   - `0x02`: South ($\Delta X \ge 0, \Delta Y < 0$)

---

## 2. Data Structures & Memory Layout

> **Reconstructed C Decompilation**:
> Source, exact to the ROM (gate G1): [`8FA93B_elevation_ramp_plane_project.c`](../../../reconstructed-c/8F/8FA93B_elevation_ramp_plane_project.c), [`8FA963_elevation_vector_shear_step.c`](../../../reconstructed-c/8F/8FA963_elevation_vector_shear_step.c), [`8FA97D_elevation_manhattan_distance_eval.c`](../../../reconstructed-c/8F/8FA97D_elevation_manhattan_distance_eval.c), [`8FA999_elevation_compass_direction_resolve.c`](../../../reconstructed-c/8F/8FA999_elevation_compass_direction_resolve.c).
> [View in VFS: soe://rom/code/8FA93B](soe://rom/code/8FA93B?c=1&asm=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source, exact to the ROM (gate G1): [`8FA93B_elevation_ramp_plane_project.c`](../../../reconstructed-c/8F/8FA93B_elevation_ramp_plane_project.c), [`8FA963_elevation_vector_shear_step.c`](../../../reconstructed-c/8F/8FA963_elevation_vector_shear_step.c), [`8FA97D_elevation_manhattan_distance_eval.c`](../../../reconstructed-c/8F/8FA97D_elevation_manhattan_distance_eval.c), [`8FA999_elevation_compass_direction_resolve.c`](../../../reconstructed-c/8F/8FA999_elevation_compass_direction_resolve.c).
> [View in VFS: soe://rom/code/8FA93B](soe://rom/code/8FA93B?c=1&asm=0)

