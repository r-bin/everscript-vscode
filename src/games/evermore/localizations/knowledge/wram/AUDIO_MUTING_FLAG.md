---
addr: $7E:15D2
name: AUDIO_MUTING_FLAG
type: u16
tags: [audio, script]
confidence: verified
evidence: ["cdl", "disasm: $80:8A40, $8C:D172"]
---
Set non-zero to silence background music during dramatic cutscenes.
