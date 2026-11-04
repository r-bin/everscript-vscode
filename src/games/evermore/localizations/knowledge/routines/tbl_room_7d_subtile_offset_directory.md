---
addr: A1FE95
end: A1FF93
size: 255
kind: table
category: 🗺️
name: tbl_room_7d_subtile_offset_directory
title: Room 0x7D Gothica Ebon Keep subtile stream partition and offset directory
confidence: confirmed
tags: [map, directory, gothica, offsets, table]
evidence: ["disasm: 255 bytes at $A1:FE95..$A1:FF93 containing partition count and 16-bit offset index table for Room 0x7D compressed graphics and collision streams"]
see: [routines/ROOM_BLOB_7D_GOTHICA_EBON_KEEP_AND_IVOR_TOWER_INTERIOR.md, routines/asset_a1ff94_map_graphics_16_16_chr.md]
---
Partition index and offset directory table for Room 0x7D (Gothica - Ebon Keep and Ivor Tower Interior). Holds stream entry counts and 16-bit partition pointer offsets into the decompressed room tilemap and collision buffers.
