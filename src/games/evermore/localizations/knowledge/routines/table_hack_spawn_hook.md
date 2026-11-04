---
addr: BA8040
size: 64
end: BA807F
kind: code
category: 🧠
name: table_hack_spawn_hook
title: Table hack enemy and NPC spawn hook in Bank $BA
confidence: confirmed
tags: [table-hack, hooks, spawn]
evidence: ["tools/table-hack/tables.js places spawn routine hooks at $BA:8040"]
---
Specialized hook routine in Bank `$BA` (`$BA:8040–$BA:807F`) intercepting enemy and NPC entity spawning to look up expanded entity tables.