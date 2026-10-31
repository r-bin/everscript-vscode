---
addr: 8C9BDD
kind: code
category: 🗺️
name: map_tilemap_decompress_markov_node_recursive
title: Markov tree 2D map decompression recursive node decoder ($8C:9BDD)
confidence: confirmed
tags: [compression, lz, markov, tilemap, decompression]
evidence:
  - "disasm: called by decompression_dispatcher_reads_sub_flag ($8C:988D at $8C:9BCE) and recursively calls itself at $8C:9CA0 and $8C:9CCA; size 450 bytes ($8C:9BDD..$8C:9D9E); decodes packed tilemap Markov tree bitstream into $7F:0000 decompressed WRAM buffer; maintains direct page decode pointers in $7E:0006..$7E:0014 and bitstream buffers in $7E:0026..$7E:0038"
---

# map_tilemap_decompress_markov_node_recursive

Recursive node decoder for Evermore 2D Markov grid compressed map tilemaps. Unpacks variable-length bitstream tokens, recurses through tree branches, and outputs uncompressed tile attributes into the bank $7F work buffer.
