---
addr: $7E:0E4B
name: RESIDENT_SOUNDBANK_ID
type: u16
tags: [audio]
confidence: verified
evidence: ["cdl", "disasm: load_song_soundbank $8C:8236 compares the low byte with the wanted package, stores id << 8 | id at $8C:8266 before the IPL stream and masks it back to the low byte at $8C:828B"]
---
The soundbank package resident in SPC700 RAM, low byte; `$8C:8236` skips the upload when it already matches. While a
new package streams (from `$8C:8266` to `$8C:828B`) the high byte `$0E4C` holds its id too, so `$0E4C != 0` means
"music upload in progress": the game sits in the port handshake and nothing on screen moves.
