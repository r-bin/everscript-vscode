---
addr: AC
kind: opcode
title: Cast a spell (skip a dead Dog)
confidence: likely
tags: ["opcode.combat"]
everscript: ["cast()"]
evidence: ["disasm: handler at the table entry $8C:D0C3"]
see: ["rom/8cd0c3.md"]
---
As `0x9E`, but first `$3BC1` = the Dog (`$4F37`) when its HP is 0, so a dead Dog is not a target.

## Why it exists

Spells aimed at the party.
