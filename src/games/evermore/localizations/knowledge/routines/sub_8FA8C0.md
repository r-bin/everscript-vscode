---
addr: 8FA8C0
end: 8FA8E1
size: 34
kind: code
category: 🧠
name: sub_8FA8C0
evidence: ["disasm: `tya : cmp $006C,x : bne $8FA8CA : jml $8FA8E2 ... rtl` at $8F:A8C0", "c: G1 passed 100% parity"]
---

Companion dog waypoint navigation update helper that compares current waypoint against target node at $006C,x. If arrived, jumps to $8F:A8E2 to release waypoint; otherwise advances node pointer by 3 and updates coordinates at $3BC9 and $3BCA.
