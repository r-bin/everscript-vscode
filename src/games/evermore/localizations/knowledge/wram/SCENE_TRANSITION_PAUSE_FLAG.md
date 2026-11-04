---
addr: $7E:0E7C
name: SCENE_TRANSITION_PAUSE_FLAG
type: u16
tags: [system]
confidence: verified
evidence: ["cdl", "disasm"]
---
Scene transition timer hold/pause flag, clamps counter $7E:14BA at ceiling $7F until fade/scene transition completes ($80:C681, $80:CDF3).
