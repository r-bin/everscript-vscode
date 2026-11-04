---
addr: B0E653
size: 127
end: B0E6D1
kind: table
category: 🗺️
name: mode7_row_table_4th_mb_read
title: Mode 7 perspective scaling row-table in 4th MB Bank $B0
confidence: confirmed
tags: [mode7, rendering, 4th-mb]
evidence: ["tools/c-to-rom/build.mts identifies $80:D113 reading Mode 7 row perspective table at $B0:E653"]
---
Mode 7 perspective scaling row-table located in the 4th megabyte at `$B0:E653` (`$B0:E653–$B0:E6D1`). Read by the Mode 7 perspective initialization routine at `$80:D113`.