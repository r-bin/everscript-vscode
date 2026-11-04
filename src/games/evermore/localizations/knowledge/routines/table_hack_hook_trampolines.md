---
addr: BA8000
size: 64
end: BA803F
kind: code
category: 🧠
name: table_hack_hook_trampolines
title: Table hack JML hook trampolines in Bank $BA
confidence: confirmed
tags: [table-hack, hooks, trampoline]
evidence: ["tools/table-hack/tables.js places hook trampolines at $BA:8000 for vanilla ROM redirection"]
---
Hook trampoline code block in Bank `$BA` (`$BA:8000–$BA:803F`) hosting long jumps (`JML`) and dispatcher stubs that redirect vanilla ROM routines to expanded table-hack handlers.