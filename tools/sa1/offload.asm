; The pathfinding offload experiment (docs/sa1/offload.md): the SA-1 runs Evermore's spare-time pathfinding steps
; instead of the S-CPU. Assembled by tools/sa1/offload.mts at $20:8000 (block 1, LoROM view; both CPUs see it).
;
; The game's spare-time loop field_spare_time_loop ($8F:9817) runs pathfinding steps until the next NMI. Here:
;   S-CPU  copies the steps' inputs from WRAM into a mirror in BW-RAM, starts the SA-1, waits until STOP_LINE,
;          stops the SA-1 after its current step, copies the steps' results back into WRAM, then waits for the NMI
;          as the original did.
;   SA-1   runs a copy of the original loop and steps (banks $21-$24, made by offload.mts), whose WRAM operands
;          point at the mirror: $7E:xxxx → $42:xxxx, $7F:xxxx → $43:xxxx, direct page → I-RAM.
; Nothing else of the game changes. The S-CPU still owns the game; the two CPUs never run game code at once, so
; copying whole ranges back is safe: nothing but the SA-1 changes them in between.
;
; Memory:
;   BW-RAM $40:0000-$41:FFFF  the save (first 8 KB) and free
;          $42:0000-$43:FFFF  the WRAM mirror (only the ranges below are copied)
;          $42:F000           STOP: 0 while the SA-1 may start another step (its loop reads it where the
;                             original read the frame counter $0100)
;   I-RAM  $0000-$00FF (SA-1) / $3000-$30FF (S-CPU)  the SA-1's direct page: a copy of WRAM $0000-$00FF
;          $0600-$060F                               mailbox, below
;          $0700-$07FF                               the SA-1's stack

asar 1.90                   ; Asar 1.9 rules: operator precedence (older Asar evaluates left to right). Immediates take their width
                            ; from how they are written: a define or a short number in 16-bit code needs .w

!JOB      = $003600         ; S-CPU sets 1: run the loop; the SA-1 clears it when it starts
!DONE     = $003602         ; SA-1 sets 1 when its loop has stopped
!STARTED  = $003606         ; $A55A once the S-CPU has released the SA-1
!LASTROOM = $003608         ; room of the last full grid copy
!GRIDPOS  = $00360A         ; next 2 KB of the grid to refresh
!RUNS     = $00360C         ; jobs started (debug)
!SKIPS    = $00360E         ; frames in a row without a job
!FORCE    = $003610         ; this job runs until the NMI
!SA1_JOB  = $000600         ; the same mailbox as the SA-1 sees it
!SA1_DONE = $000602
!STOP     = $42F000
; !SA1_VECTOR (bank $00 address of a JML sa1_main) is defined by offload.mts.

!SLOTS    = 6               ; field_spare_time_loop's task slots: $59 bytes each, flags at $3C12, parent at $3C14
!SLOT     = $59
!GRID_PART = $0800
!SNAP_LINE = 110            ; start a job only if the copies (~55 + ~32 lines) still fit before STOP_LINE
!STOP_LINE = 185            ; stop the SA-1 here, so the copy back ends before the NMI (line 225)
!MAX_SKIPS = 3

; ---------------------------------------------------------------------------------------------------------------
; S-CPU. Entered by JML from $8F:9817 (the original loop's entry, called by JSL with 16-bit A and X). Leaves by the
; original loop's tail at $8F:9861 (PLA, PLB, JML $80:8F85), so it pushes what the original pushed.
offload_spare:
    phb
    pea $7E7E
    plb
    plb
    lda $0100
    pha
    lda.l !STARTED
    cmp #$A55A
    beq +
    jsr start_sa1
+   jsr any_task
    bcs +
    jmp .idle               ; no live task slot: nothing to run, as in the original
+
    lda #$0000
    sta.l !FORCE
    jsr vline
    cmp.w #!SNAP_LINE
    bcc .go
    lda.l !SKIPS            ; too late in the frame for the copies: no steps this frame, unless that happened
    inc                     ; MAX_SKIPS times in a row (scripts wait for actors to arrive; with no steps they
    sta.l !SKIPS            ; would wait forever). Then run until the NMI and copy back in the next frame.
    cmp.w #!MAX_SKIPS+1
    bcs +
    jmp .idle
+   lda #$0001
    sta.l !FORCE
.go
    lda #$0000
    sta.l !SKIPS
    lda $0ADB
    cmp.l !LASTROOM
    beq +
    sta.l !LASTROOM
    jsr grid_all
    bra .snap
+   jsr grid_part
.snap
    jsr snapshot
    lda #$0000
    sta.l !DONE
    sta.l !STOP
    lda.l !RUNS
    inc
    sta.l !RUNS
    lda #$0001
    sta.l !JOB
.wait                       ; the SA-1 runs steps until STOP_LINE (or the NMI: late or forced job)
    lda $0100
    cmp $01,s
    bne .stop
    lda.l !FORCE
    bne .wait
    jsr vline
    cmp.w #!STOP_LINE
    bcc .wait
.stop
    lda #$0001
    sta.l !STOP
.done
    lda.l !DONE
    beq .done
    jsr copy_back
.idle                       ; as the original: return only once the NMI has come
    lda $0100
    cmp $01,s
    beq .idle
    jml $8F9861

; A = the scanline the PPU is drawing (16-bit A in and out).
vline:
    sep #$20
    lda.l $002137           ; SLHV: latch the counters
    lda.l $00213F           ; STAT78: reset the counters' read flip-flops
    lda.l $00213D           ; OPVCT low, then bit 8
    xba
    lda.l $00213D
    and #$01
    xba
    rep #$20
    rts

; Carry set if a task slot is live (the original loop's own test: parent set, flag $0200 clear).
any_task:
    ldx #$0000
-   lda $3C14,x
    beq +
    lda $3C12,x
    bit #$0200
    beq .yes
+   txa
    clc
    adc.w #!SLOT
    tax
    cpx #!SLOTS*!SLOT
    bcc -
    clc
    rts
.yes
    sec
    rts

start_sa1:
    sep #$20
    lda #$FF
    sta.l $002229           ; SIWP: the S-CPU may write all of I-RAM (write-protected at reset)
    rep #$20
    lda #$0000
    sta.l !JOB
    sta.l !DONE
    sta.l !RUNS
    sta.l !SKIPS
    lda #$FFFF
    sta.l !LASTROOM
    lda.w #!SA1_VECTOR
    sta.l $002203           ; CRV: the SA-1's reset vector (bank $00)
    sep #$20
    lda #$00
    sta.l $002200           ; CCNT: release the SA-1 from reset
    rep #$20
    lda #$A55A
    sta.l !STARTED
    rts

; DMA channel 3 (the game uses 0, 1 and 5-7) between WRAM ($2180) and the A bus.
; In: A = byte count, X = WRAM address (low 16 bits), Y = A-bus address (low 16 bits); $00 = WRAM bank (0 or 1),
; $01 = A-bus bank, $02 = direction ($80 WRAM → A bus, $00 A bus → WRAM). 16-bit A, X, Y.
; The scratch is the S-CPU's own direct page $00-$02, saved around the call (the NMI handler leaves it alone).
dma:
    pha
    txa
    sta.l $002181
    sep #$20
    lda $00
    sta.l $002183
    lda $02
    sta.l $004330
    lda #$80
    sta.l $004331
    lda $01
    sta.l $004334
    rep #$20
    tya
    sta.l $004332
    pla
    sta.l $004335
    sep #$20
    lda #$08
    sta.l $00420B
    rep #$20
    rts

macro dma(count, wram, abus, dir)
    lda.w #(<wram>>>16)&1|((<abus>>>16)<<8)
    sta $00
    lda.w #<dir>
    sta $02
    lda.w #<count>
    ldx.w #<wram>&$FFFF
    ldy.w #<abus>&$FFFF
    jsr dma
endmacro

; The inputs of a frame's steps: direct page (to I-RAM and the mirror), the engine words $0100-$01FF (RNG $0133),
; script thread slots $2900-$2C1F, task slots and entity records $3BC0-$50FF, and two room words.
snapshot:
    lda $00
    pha
    lda $02
    pha
    %dma($0100, $7E0000, $003000, $80)
    %dma($0200, $7E0000, $420000, $80)
    %dma($0320, $7E2900, $422900, $80)
    %dma($1540, $7E3BC0, $423BC0, $80)
    pla
    sta $02
    pla
    sta $00
    lda $08EE               ; room width in metatiles (the raycast's multiplier)
    sta.l $4208EE
    lda $0F46
    sta.l $420F46
    rts

; The room grid $7F:0000-$7FFF (metatiles, collision, terrain staging): all of it after a room change, then 2 KB a
; frame, so a change the room makes reaches the SA-1 within 16 jobs.
grid_all:
    lda #$0000
    sta.l !GRIDPOS
    lda $00
    pha
    lda $02
    pha
    %dma($8000, $7F0000, $430000, $80)
    pla
    sta $02
    pla
    sta $00
    rts

grid_part:
    lda $00
    pha
    lda $02
    pha
    lda #$0001|($43<<8)
    sta $00
    lda #$0080
    sta $02
    lda.l !GRIDPOS
    tax
    tay
    clc
    adc #!GRID_PART
    and #$7FFF
    sta.l !GRIDPOS
    lda #!GRID_PART
    jsr dma
    pla
    sta $02
    pla
    sta $00
    rts

; What the steps write (every store in the offloaded code, checked by offload.mts; docs/sa1/offload.md §3): task
; slots and entity records $3BC3-$50FF (one DMA), the RNG, one word per script thread. Runs before the NMI, so it
; costs spare time, not the next frame.
copy_back:
    lda $00
    pha
    lda $02
    pha
    %dma($153D, $7E3BC3, $423BC3, $00)
    pla
    sta $02
    pla
    sta $00
    ldx #$0006
-   lda.l $420133,x
    sta $0133,x
    dex
    dex
    bpl -
    ldx #$0000
-   lda.l $422905,x
    sta $2905,x
    txa
    clc
    adc #$004F
    tax
    cpx #$004F*11
    bcc -
    rts

; SA-1 multiply for the two raycast sites that used the S-CPU's $4202/$4203 → $4216 (8 × 8 bits, unsigned): the
; product lands in $2306 (the steps' ADC $4216 reads it there). MCNT ($2250) is 0, multiply, from sa1_main.
mul_ab16:                   ; 16-bit A = $4203:$4202 as one word store
    pha
    and #$00FF
    sta.l $002251
    pla
    xba
    and #$00FF
    sta.l $002253           ; writing $2254 starts the multiply
    rtl

mul_a8:                     ; 8-bit A → $4202
    sta.l $002251
    pha
    lda #$00
    sta.l $002252
    pla
    rtl

mul_b8:                     ; 8-bit A → $4203
    sta.l $002253
    pha
    lda #$00
    sta.l $002254
    pla
    rtl

; ---------------------------------------------------------------------------------------------------------------
; SA-1. Starts at its reset vector (bank $00, a JML there written by offload.mts) and waits for jobs.
sa1_main:
    sei
    clc
    xce
    rep #$30
    lda #$07FF
    tcs
    lda #$0000
    tcd
    sep #$20
    lda #$FF
    sta.l $00222A           ; CIWP: the SA-1 may write all of I-RAM
    lda #$80
    sta.l $002227           ; CBWE: the SA-1 may write BW-RAM
    lda #$00
    sta.l $002250           ; MCNT: multiply
    rep #$30
.idle
    lda.l !SA1_JOB
    beq .idle
    lda #$0000
    sta.l !SA1_JOB
    sep #$20                ; the raycast reads the grid through [$56]; its bank byte $58 comes from WRAM ($7F)
    lda $58
    cmp #$7E
    bcc +
    cmp #$80
    bcs +
    sbc #$3C-1              ; carry clear here (A < $80): A - $3B - 1, so $7E → $42, $7F → $43
    sta $58
+   rep #$20
    jml $219817             ; the copy of field_spare_time_loop; its exit comes back to sa1_done

sa1_done:
    rep #$30
    lda #$0001
    sta.l !SA1_DONE
    jmp sa1_main_idle
