---
addr: $7E:1445
name: DOG_FORM_ANIM_10
type: u16
tags: [dog, animation]
confidence: verified
evidence: ["cdl", "disasm: dog_load_form ($8F:94E5) copies form entry +$1E here; the pair partner of DOG_FORM_ANIM_9 ($90:8260 picks it when the Dog's +$64 byte is set); idle state $0D starts it after turning to a random facing ($8F:D18A; pair reads $8F:D011, $8F:D04D, $8F:D12C)"]
---
Companion Mechanics: the form's animation record slot 10 ($8F:9471): the other half of the sniff pair, and
the "look around" pose of the idle cycle (state `$0D`).
