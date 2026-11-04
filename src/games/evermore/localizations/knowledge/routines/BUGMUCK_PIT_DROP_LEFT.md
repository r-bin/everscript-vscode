---
addr: 93BC6A
end: 93BCDB
size: 114
kind: sub
name: BUGMUCK_PIT_DROP_LEFT
title: Bugmuck shaft diagonal left fall transition
confidence: confirmed
tags: [movement, transition, bugmuck]
evidence: ["scripts: Room 22 ($93:bb70, $93:bb80, etc.) calls $93:bc6a; walks to entry waypoint (arg[4], arg[6]), plays fall animation, and shifts X leftwards (- (arg[8] << 1)) while dropping to destination"]
see: [routines/BUGMUCK_PIT_DROP_VERTICAL.md, routines/BUGMUCK_PIT_DROP_RIGHT.md, knowledge/wram/TARGET_WAYPOINT_X.md, knowledge/wram/TARGET_WAYPOINT_Y.md]
---
Shaft drop routine for diagonal left-curving drops in Bugmuck (Room 22).

Commands the character to walk to `(TARGET_WAYPOINT_X, TARGET_WAYPOINT_Y)`, triggers the free-fall loop animation, and teleports diagonally down and to the left by shifting `X -= (arg[8] << 1)` each frame until reaching the destination.
