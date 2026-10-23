/*
 * Routine: $8C805C (spc_block_uploader)
 * Bank: $8C (ROM Offset: $0C805C)
 * Source: docs/disassembly/audio/spc-block-uploader.md
 */

/**
 * @file spc-block-uploader.c
 * @brief Secret of Evermore SPC700 IPL Bootloader Handshake & Block Streaming Protocol
 * 
 * Reconstructed from 65816 assembly ($8C:805C – $8C:81FC).
 */

#include <stdint.h>
#include <stdbool.h>

#define SPC700_IPL_READY_SIG    0xBBAA
#define SPC700_BLOCK_TOKEN_INIT 0xCC
#define SPC700_EXEC_ENTRY_POINT 0x0700
#define SPC700_TIMEOUT_CYCLES   65536

typedef struct {
    uint8_t  port0; /* $2140: Handshake counter / echo */
    uint8_t  port1; /* $2141: Payload byte / write trigger */
    uint8_t  port2; /* $2142: Dest addr low / Command */
    uint8_t  port3; /* $2143: Dest addr high / Sequence */
} SnesApuPorts;

typedef struct {
    uint16_t length;
    uint32_t src_rom_addr;
    uint16_t dest_spc_addr;
} AudioBlockDescriptor;

/* Hardware port mirrors and WRAM state */
extern SnesApuPorts g_apu_ports;
extern uint8_t      g_apu_seq_counter; /* DP $9F */
extern uint16_t     g_apu_lock;        /* $7E:0E65 */

extern uint8_t snes_read_rom_byte_far(uint32_t far_addr);

/**
 * @brief Synchronously streams a block of bytes into SPC700 RAM ($8C:819E).
 * 
 * @param src_addr Far ROM source address of the audio data
 * @param length   Number of bytes to transfer
 * @param token    Current handshake protocol token
 * @return uint8_t Updated handshake token for next block
 */
uint8_t spc700_stream_block_bytes(uint32_t src_addr, uint16_t length, uint8_t token) {
    uint8_t counter = 0;
    uint32_t read_ptr = src_addr;

    for (uint16_t i = 0; i < length; i++) {
        uint8_t payload_byte = snes_read_rom_byte_far(read_ptr++);

        /* Handle 32KB HiROM bank boundary wrap */
        if ((read_ptr & 0xFFFF) == 0x0000) {
            read_ptr = (read_ptr & 0xFF0000) + 0x8000;
        }

        /* 16-bit atomic write: port 0 = counter, port 1 = payload */
        g_apu_ports.port0 = counter;
        g_apu_ports.port1 = payload_byte;

        /* Wait for SPC700 to echo counter on port 0 */
        while (g_apu_ports.port0 != counter) {
            /* Spinwait */
        }

        counter++;
    }

    /* Advance protocol token by 4 and avoid zero */
    counter += 4;
    if (counter == 0) {
        counter += 4;
    }
    return counter;
}

/**
 * @brief Waits for SPC700 ready acknowledgment with timeout recovery ($8C:81D4).
 */
void apu_wait_ready_timeout(void) {
    uint16_t saved_lock = g_apu_lock;
    g_apu_lock = 0;

    uint32_t timeout = SPC700_TIMEOUT_CYCLES;
    while (g_apu_ports.port2 != g_apu_seq_counter) {
        if (--timeout == 0) {
            /* Timeout recovery: re-synchronize to current port value */
            g_apu_seq_counter = g_apu_ports.port2;
            break;
        }
    }

    g_apu_lock = saved_lock;
}

/**
 * @brief Executes SPC700 IPL Bootloader handshake and block upload ($8C:805C).
 * 
 * @param descriptors Array of audio block descriptors
 * @param block_count Total number of blocks to transfer
 */
void spc700_ipl_bootloader_handshake_block(const AudioBlockDescriptor *descriptors, uint16_t block_count) {
    uint16_t saved_lock = g_apu_lock;
    g_apu_lock = 0;

    /* 1. Wait for SPC700 IPL bootloader ready signal (0xBBAA) */
    while ((g_apu_ports.port0 | ((uint16_t)g_apu_ports.port1 << 8)) != SPC700_IPL_READY_SIG) {
        /* Spinwait */
    }

    uint8_t token = SPC700_BLOCK_TOKEN_INIT;

    /* 2. Upload all blocks sequentially */
    for (uint16_t b = 0; b < block_count; b++) {
        const AudioBlockDescriptor *block = &descriptors[b];

        /* Configure destination address in SPC700 RAM */
        g_apu_ports.port2 = (uint8_t)(block->dest_spc_addr & 0xFF);
        g_apu_ports.port3 = (uint8_t)((block->dest_spc_addr >> 8) & 0xFF);

        /* Trigger block write mode */
        g_apu_ports.port1 = 0x01;
        g_apu_ports.port0 = token;

        /* Wait for block write mode acknowledgment */
        while (g_apu_ports.port0 != token) {
            /* Spinwait */
        }

        /* Stream block data */
        token = spc700_stream_block_bytes(block->src_rom_addr, block->length, token);
    }

    /* 3. Launch execution at address 0x0700 */
    g_apu_ports.port2 = (uint8_t)(SPC700_EXEC_ENTRY_POINT & 0xFF);
    g_apu_ports.port3 = (uint8_t)((SPC700_EXEC_ENTRY_POINT >> 8) & 0xFF);
    g_apu_ports.port1 = 0x00; /* 0 signals execution jump */
    g_apu_ports.port0 = token;

    /* Wait for execution launch acknowledgment */
    while (g_apu_ports.port0 != token) {
        /* Spinwait */
    }

    /* Initialize sequence counter */
    g_apu_seq_counter = 1;
    g_apu_lock = saved_lock;
}
