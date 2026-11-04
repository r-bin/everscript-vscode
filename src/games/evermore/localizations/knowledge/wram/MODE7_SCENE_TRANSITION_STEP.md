---
addr: $7E:14BA
name: MODE7_SCENE_TRANSITION_STEP
type: u16
tags: ["mode7"]
confidence: verified
evidence: ["cdl", "disasm"]
---
Mode 7 Flight: Scene transition progress step counter (increments toward $9F / $7F threshold before room load commit; $80:BCDA, $80:C672, $80:CDF3).
