/*
 * Routine: $FFFFFF (c_compilation_hirom_memory_map)
 * Bank: $FF (ROM Offset: $3FFFFF)
 * Source: docs/reverse-engineering/c-compilation-hirom-memory-map.md
 */

// src/variables.h
#define main_module_index           (*(uint8*)(g_ram + 0x10))
#define submodule_index             (*(uint8*)(g_ram + 0x11))
#define link_y_coord                (*(uint16*)(g_ram + 0x20))
#define link_x_coord                (*(uint16*)(g_ram + 0x22))
#define link_z_coord                (*(uint16*)(g_ram + 0x24))
#define link_direction_facing       (*(uint8*)(g_ram + 0x2F))
#define dung_bg2_attr_table         ((uint8*)(g_ram + 0x2000))
