/*
 * Routine: $849A12 (incremental_decomp_guide)
 * Bank: $84 (ROM Offset: $049A12)
 * Source: docs/reverse-engineering/incremental-decomp-guide.md
 */

// Generated file: out/recomp/project/src/game/bank_84.c (DO NOT EDIT DIRECTLY)
void func_849A12_M0X0(CpuState *cpu) {
    // REP #$20
    cpu->p &= ~FLAG_M;

    // PHA
    cpu_push16(cpu, cpu->a);

    // TXA ; math ...
    uint16_t ent_idx = cpu->x;
    uint16_t offset = ent_idx * 0x70;
    cpu->y = offset;

    // PLA ; STA $00
    uint16_t damage = cpu_pop16(cpu);
    wram_write16(0x0000, damage);

    // LDA $4E45+0x14, Y ; SBC $00
    uint16_t hp = wram_read16(0x4E45 + 0x14 + cpu->y);
    uint32_t diff = (uint32_t)hp - damage;

    if (diff & 0x10000) {   // Underflow borrow
        hp = 0;
    } else {
        hp = (uint16_t)diff;
    }

    // STA $4E45+0x14, Y
    wram_write16(0x4E45 + 0x14 + cpu->y, hp);

    if (hp == 0) {
        // LDA $4E45+0x22,Y ; ORA #$0004 ; STA $4E45+0x22,Y
        uint16_t flags = wram_read16(0x4E45 + 0x22 + cpu->y);
        flags |= 0x0004;
        wram_write16(0x4E45 + 0x22 + cpu->y, flags);
    }
}
