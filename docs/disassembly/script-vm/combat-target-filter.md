# Select Handler: Pending Switch Branch

**Routine:** `$8C:F184`–`$8C:F196`, part of the Select handler `$8C:F17C` (`select_switch_character`)\
**Confidence:** direct control flow confirmed

Previously titled "Combat Target Filter". The code is reached only through the joypad matcher's
Select entry (`$8C:F121`); X is the pending switch script id `$0EB2`, Y the active character
`$0F42`.

The routine reads the entity status word at `Y + $10` and tests bit `$0020`. If
the bit is set, it returns immediately. Otherwise it calls `$8C:CE5C`, then
writes `$FFFF` to `$0EB2` and returns.

The call to `$8C:CE5C` consumes the incoming X value as its selector. This model
passes that value through without assigning it a higher-level meaning. The
effects inside `$8C:CE5C` remain represented by the existing trigger-script
helper boundary.

Source: [`reconstructed-c/8C/8CF184_combat_target_filter.c`](../../../reconstructed-c/8C/8CF184_combat_target_filter.c).