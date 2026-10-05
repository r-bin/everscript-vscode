---
name: sprites-subsystem
description: Sprites decoding, animation frames, palette slot assignments, and sprite rendering in src/sprites/.
applyTo: "src/sprites/**"
---

# Skill: Sprites Subsystem

Use this skill when modifying sprite decoding, character animations, or sprite rendering pipelines in `src/sprites/`.

---

## 1. Responsibilities

- Decoding SNES OBJ graphics (4bpp planar format).
- Managing entity sprite frames and hitboxes.
- Handling OBJ palette slots ($7E1278) and character palette mappings.
- Rendering entity thumbnails and animations in the webview views.
