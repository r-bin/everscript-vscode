; The C-to-ROM runtime (Calypsi as65816 syntax): calls from C into routines that are still asm.
;
;   void soe_call_rtl(uint32_t target, soe_regs r);   target in X:C (bank in X), r in _Dp[0..2]
;   void soe_call_rts(uint32_t target, soe_regs r);
;
; Loads A, X, Y, D, DB and P from the record, enters the routine as JSL would, and writes what it
; leaves back into the record. An RTS routine runs in its own bank, so its 16-bit return lands on an
; RTL byte of that bank (soe_rtl_gadgets, generated per ROM by build.mts), which returns here.
; Only the stack below S changes besides what the routine itself writes.

            .section farcode,text
            .extern _Dp
            .extern soe_rtl_gadgets
            .public soe_call_rtl, soe_call_rts, soe_stp, soe_mvn_7e, soe_mvp_7e

soe_call_rts:
            ldy     ##1
            bra     common
soe_call_rtl:
            ldy     ##0
common:
            phb                         ; the C side's DB and D, restored at the end
            phd
            phk                         ; the routine's return comes back to call_return
            per     call_return-1
            cpy     ##0
            beq     dispatch
            pha                         ; RTS routine: first its return, an RTL byte in its bank
            phx
            txa
            and     ##0xff
            asl     a
            tax
            lda     long:soe_rtl_gadgets,x
            dec     a
            plx
            ply
            pha
            tya
dispatch:
            dec     a                   ; RTL to the routine: bank, then address - 1
            sep     #0x10
            phx
            rep     #0x10
            pha
            ldy     ##8                 ; the registers in pull order: db|p, d, y, x, a
            lda     [.tiny _Dp],y
            pha
            ldy     ##6
            lda     [.tiny _Dp],y
            pha
            ldy     ##4
            lda     [.tiny _Dp],y
            pha
            ldy     ##2
            lda     [.tiny _Dp],y
            pha
            lda     [.tiny _Dp]
            pha
            pla
            plx
            ply
            pld
            plb
            plp
            rtl

call_return:
            php
            rep     #0x38
            phb
            phd
            phy
            phx
            pha
            lda     11,s                ; the C side's D: the record pointer is in its _Dp
            tcd
            lda     1,s
            sta     [.tiny _Dp]
            ldy     ##2
            lda     3,s
            sta     [.tiny _Dp],y
            ldy     ##4
            lda     5,s
            sta     [.tiny _Dp],y
            ldy     ##6
            lda     7,s
            sta     [.tiny _Dp],y
            ldy     ##8
            lda     9,s
            sta     [.tiny _Dp],y
            tsc
            clc
            adc     ##10
            tcs
            pld
            plb
            rtl

; void soe_stp(void): BRK, COP and STP all end in STP in this game (knowledge/rom/80885e.md)
soe_stp:
            stp

; void soe_mvn_7e(soe_regs r) / soe_mvp_7e(soe_regs r): the CPU's own MVN/MVP $7E,$7E on the
; record's A (count - 1), X (source) and Y (destination); A X Y written back, record DB = $7E.
; The C side's DB is restored (16-bit index registers assumed, as in the callers).
soe_mvn_7e:
            ldx     ##0
            bra     block
soe_mvp_7e:
            ldx     ##1
block:
            phb
            phx                         ; 0 = MVN
            ldy     ##2
            lda     [.tiny _Dp],y       ; X
            tax
            ldy     ##4
            lda     [.tiny _Dp],y       ; Y
            pha
            lda     [.tiny _Dp]         ; A
            ply
            pha
            lda     3,s                 ; the direction flag (under the count)
            bne     up_mvp
            pla
            mvn     #0x7e,#0x7e
            bra     moved
up_mvp:
            pla
            mvp     #0x7e,#0x7e
moved:
            phy                         ; the new Y, before Y indexes the record
            sta     [.tiny _Dp]
            txa
            ldy     ##2
            sta     [.tiny _Dp],y
            pla
            ldy     ##4
            sta     [.tiny _Dp],y
            sep     #0x20
            lda     #0x7e
            ldy     ##8
            sta     [.tiny _Dp],y
            rep     #0x20
            plx
            plb
            rtl
