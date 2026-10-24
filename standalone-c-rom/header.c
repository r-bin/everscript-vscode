/*
 * SNES Cartridge Header for FastROM Mode 21 HiROM (1 MB / 8 Mbit)
 * Placed in section "snesheader" at $00FFC0 (scattered to $C0FFC0 in HiROM-c0).
 */
__attribute__((section("snesheader"))) const unsigned char snes_header[32] = {
    'S', 'E', 'C', 'R', 'E', 'T', ' ', 'O', 'F', ' ', 'E', 'V', 'E', 'R', 'M', 'O', 'R', 'E', ' ', ' ', ' ', // 21 bytes title
    0x31, // ROM makeup: FastROM + Mode 21 HiROM (3.58 MHz)
    0x00, // ROM type: ROM only
    0x0A, // ROM size: 1 MB (8 Mbit)
    0x00, // SRAM size: 0
    0x01, // Destination: North America
    0x33, // Fixed licensee
    0x00, // Version 1.0
    0x00, 0x00, // Checksum complement (calculated at build time)
    0x00, 0x00  // Checksum (calculated at build time)
};
