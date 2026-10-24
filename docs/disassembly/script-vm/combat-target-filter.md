# Combat Target Filter Script Hook

**Routine:** `$8C:F184`–`$8C:F196`\
**Confidence:** direct control flow confirmed; incoming selector meaning unresolved

The routine reads the entity status word at `Y + $10` and tests bit `$0020`. If
the bit is set, it returns immediately. Otherwise it calls `$8C:CE5C`, then
writes `$FFFF` to `$0EB2` and returns.

The call to `$8C:CE5C` consumes the incoming X value as its selector. This model
passes that value through without assigning it a higher-level meaning. The
effects inside `$8C:CE5C` remain represented by the existing trigger-script
helper boundary.

Source: [`reconstructed-c/8C/8CF184_combat_target_filter.c`](../../../reconstructed-c/8C/8CF184_combat_target_filter.c).