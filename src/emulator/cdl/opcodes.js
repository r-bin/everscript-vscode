'use strict';

/**
 * emulator/cdl/opcodes.js
 *
 * The 65816 opcode matrix: mnemonic + addressing mode for all 256 opcodes.
 * Single source of truth for the disassembler and for the instruction-length
 * table compiled into the core (tools/gen-cdl-optable.js writes cdl-optable.h
 * from this file, so the two can never disagree).
 */

// mode -> operand byte count; 'M'/'X' = 1 byte, +1 when that flag is 16-bit.
const MODE_SIZE = {
    imp: 0, acc: 0, imm8: 1, immM: 'M', immX: 'X',
    dp: 1, dpx: 1, dpy: 1, idp: 1, idpx: 1, idpy: 1, ildp: 1, ildpy: 1,
    abs: 2, absx: 2, absy: 2, long: 3, longx: 3,
    sr: 1, isry: 1, rel8: 1, rel16: 2,
    iabs: 2, iabsx: 2, ilabs: 2, bm: 2, pea: 2, pei: 1,
};

const ROWS = [
    // x0          x1           x2           x3          x4          x5          x6          x7
    // x8          x9           xA           xB          xC          xD          xE          xF
    'BRK imm8,ORA idpx,COP imm8,ORA sr,TSB dp,ORA dp,ASL dp,ORA ildp,PHP imp,ORA immM,ASL acc,PHD imp,TSB abs,ORA abs,ASL abs,ORA long',
    'BPL rel8,ORA idpy,ORA idp,ORA isry,TRB dp,ORA dpx,ASL dpx,ORA ildpy,CLC imp,ORA absy,INC acc,TCS imp,TRB abs,ORA absx,ASL absx,ORA longx',
    'JSR abs,AND idpx,JSL long,AND sr,BIT dp,AND dp,ROL dp,AND ildp,PLP imp,AND immM,ROL acc,PLD imp,BIT abs,AND abs,ROL abs,AND long',
    'BMI rel8,AND idpy,AND idp,AND isry,BIT dpx,AND dpx,ROL dpx,AND ildpy,SEC imp,AND absy,DEC acc,TSC imp,BIT absx,AND absx,ROL absx,AND longx',
    'RTI imp,EOR idpx,WDM imm8,EOR sr,MVP bm,EOR dp,LSR dp,EOR ildp,PHA imp,EOR immM,LSR acc,PHK imp,JMP abs,EOR abs,LSR abs,EOR long',
    'BVC rel8,EOR idpy,EOR idp,EOR isry,MVN bm,EOR dpx,LSR dpx,EOR ildpy,CLI imp,EOR absy,PHY imp,TCD imp,JML long,EOR absx,LSR absx,EOR longx',
    'RTS imp,ADC idpx,PER rel16,ADC sr,STZ dp,ADC dp,ROR dp,ADC ildp,PLA imp,ADC immM,ROR acc,RTL imp,JMP iabs,ADC abs,ROR abs,ADC long',
    'BVS rel8,ADC idpy,ADC idp,ADC isry,STZ dpx,ADC dpx,ROR dpx,ADC ildpy,SEI imp,ADC absy,PLY imp,TDC imp,JMP iabsx,ADC absx,ROR absx,ADC longx',
    'BRA rel8,STA idpx,BRL rel16,STA sr,STY dp,STA dp,STX dp,STA ildp,DEY imp,BIT immM,TXA imp,PHB imp,STY abs,STA abs,STX abs,STA long',
    'BCC rel8,STA idpy,STA idp,STA isry,STY dpx,STA dpx,STX dpy,STA ildpy,TYA imp,STA absy,TXS imp,TXY imp,STZ abs,STA absx,STZ absx,STA longx',
    'LDY immX,LDA idpx,LDX immX,LDA sr,LDY dp,LDA dp,LDX dp,LDA ildp,TAY imp,LDA immM,TAX imp,PLB imp,LDY abs,LDA abs,LDX abs,LDA long',
    'BCS rel8,LDA idpy,LDA idp,LDA isry,LDY dpx,LDA dpx,LDX dpy,LDA ildpy,CLV imp,LDA absy,TSX imp,TYX imp,LDY absx,LDA absx,LDX absy,LDA longx',
    'CPY immX,CMP idpx,REP imm8,CMP sr,CPY dp,CMP dp,DEC dp,CMP ildp,INY imp,CMP immM,DEX imp,WAI imp,CPY abs,CMP abs,DEC abs,CMP long',
    'BNE rel8,CMP idpy,CMP idp,CMP isry,PEI pei,CMP dpx,DEC dpx,CMP ildpy,CLD imp,CMP absy,PHX imp,STP imp,JML ilabs,CMP absx,DEC absx,CMP longx',
    'CPX immX,SBC idpx,SEP imm8,SBC sr,CPX dp,SBC dp,INC dp,SBC ildp,INX imp,SBC immM,NOP imp,XBA imp,CPX abs,SBC abs,INC abs,SBC long',
    'BEQ rel8,SBC idpy,SBC idp,SBC isry,PEA pea,SBC dpx,INC dpx,SBC ildpy,SED imp,SBC absy,PLX imp,XCE imp,JSR iabsx,SBC absx,INC absx,SBC longx',
];

const OPCODES = [];
for (const row of ROWS) {
    for (const cell of row.split(',')) {
        const [mnemonic, mode] = cell.split(' ');
        OPCODES.push({ mnemonic, mode });
    }
}
if (OPCODES.length !== 256) throw new Error('opcode matrix must have 256 entries');

// Control flow kinds, recorded on edges. Bit flags so merged edges can carry several.
const FLOW = { CALL: 1, JUMP: 2, BRANCH: 4, INDIRECT: 8 };

const COND_BRANCH = new Set([0x10, 0x30, 0x50, 0x70, 0x90, 0xB0, 0xD0, 0xF0]);

function flowKind(op) {
    if (op === 0x20 || op === 0x22) return FLOW.CALL;
    if (op === 0xFC) return FLOW.CALL | FLOW.INDIRECT;
    if (op === 0x4C || op === 0x5C || op === 0x80 || op === 0x82) return FLOW.JUMP;
    if (op === 0x6C || op === 0x7C || op === 0xDC) return FLOW.JUMP | FLOW.INDIRECT;
    if (COND_BRANCH.has(op)) return FLOW.BRANCH;
    return 0;
}

// Opcodes whose own memory traffic is the stack (pushes, pulls, calls, returns).
const STACK_MNEMONICS = new Set([
    'PHA', 'PHX', 'PHY', 'PHP', 'PHB', 'PHD', 'PHK', 'PLA', 'PLX', 'PLY', 'PLP', 'PLB', 'PLD',
    'PEA', 'PEI', 'PER', 'JSR', 'JSL', 'RTS', 'RTL', 'RTI', 'BRK', 'COP',
]);

function isStackOp(op) {
    const o = OPCODES[op];
    return STACK_MNEMONICS.has(o.mnemonic) || o.mode === 'sr' || o.mode === 'isry';
}

/** Instruction length in bytes for opcode `op` with accumulator/index 8-bit flags. */
function instructionLength(op, m8, x8) {
    const size = MODE_SIZE[OPCODES[op].mode];
    if (size === 'M') return m8 ? 2 : 3;
    if (size === 'X') return x8 ? 2 : 3;
    return 1 + size;
}

/** Does the instruction never fall through to the next byte? */
function endsFlow(op) {
    const m = OPCODES[op].mnemonic;
    return m === 'RTS' || m === 'RTL' || m === 'RTI' || m === 'JMP' || m === 'JML'
        || m === 'BRA' || m === 'BRL' || m === 'STP';
}

module.exports = {
    OPCODES, MODE_SIZE, FLOW, flowKind, isStackOp, instructionLength, endsFlow,
};
