# Tag ids as names in Everscript (`<boy.hp>`)

> Status: **idea, nothing built.** Depends on [soe-tags.md](soe-tags.md) items 1–2.
> Spec: [soe-tags-spec.md](../soe-tags-spec.md) §5.

## The idea

Once tags are declared in the enums, a script could use a tag id where it now spells
out an address or a base + offset:

```
// today
<0x4EB3> = 0d01;                       // in/test/crowd_control.evs
MEMORY.BOY_CURRENT_HP = 0d01;          // via 02_ram.evs
<BOY>[ATTRIBUTE.HP] = 0d01;            // entity + offset, as in <BOY>[ATTRIBUTE.X] (36 uses in in/)

// with tag names
<boy.hp> = 0d01;
<dog.max_hp>
```

The compiler resolves `<boy.hp>` the same way the tag provider does: `_BOY` (tagged
`boy`, layout `ATTRIBUTE`) + `ATTRIBUTE.HP` (tagged `hp`, scope `character`) =
`<0x4EB3>`. So `<boy.hp>` is shorthand for the existing `<BOY>[ATTRIBUTE.HP]`, and
the new part is the stats block: `<boy.attack>` = `POINTER_BOY + ATTRIBUTE_GENERAL.ATTACK`
= `<0x0A3F>`, which has no short spelling today.

## Questions to settle first

1. **Syntax.** `<boy.hp>` sits inside the memory-address brackets, where today only
   numbers and enum values go. Lowercase dotted ids would not collide with
   `ENUM.MEMBER` (always uppercase), but check the lexer and the TextMate
   `#memory-address` rule.
2. **Width.** A tag knows its size only if the entry says so (`[Word]`, `(Byte)` in
   comments today). Either tags carry a size, or `<boy.hp>` defaults to word as other
   addresses do.
3. **Several facts.** `boy.max_hp` has two addresses (entity record `$4E98`, stats
   block `$0A35`). The name must resolve to one: e.g. a `@tag(..., primary)` marker,
   or a compile error that asks for `<boy.entity.max_hp>` / `<boy.stats.max_hp>`.
4. **Dynamic bases.** Enemies have no fixed address (`ENTITY_*` slots, or a pointer
   at run time). `<enemy.hp>` only makes sense relative to an entity value, like
   today's `ID[ATTRIBUTE.Y]`. Decide whether `<id.hp>` should be sugar for that.
5. **Value.** Is this more readable than `MEMORY.BOY_CURRENT_HP`, or only shorter?
   The main gain is one name shared by scripts, hovers and `soe://tags/`.

## Extension side

- Hover on `<boy.hp>` shows the tag summary with a link to `soe://tags/boy/hp.md`.
- Completion after `<` offers tag ids. Go-to-definition jumps to the `@tag` line.
