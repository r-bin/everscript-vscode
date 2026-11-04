---
addr: $7E:2000
name: AUDIO_CHAN_VOL_ATTEN
type: u8[10]
tags: [audio, entity]
confidence: verified
evidence: ["cdl", "disasm: $8C:9DEE"]
---
Master volume attenuation factors array for 10 audio channels ($7E:2000..$7E:2009, 10 bytes). Initialized and modulated by sound driver interface routines.
