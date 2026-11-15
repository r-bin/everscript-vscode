; The combo's own code: Evermore + Secret of Mana on one SA-1 cartridge, Start switches the game
; (docs/combo/README.md, poc.md). Assembled by tools/combo/convert.mts into $B8:9000+ (block 3, the LoROM view
; that both games' mappings leave in place). Game facts used here are recorded in docs/combo/poc.md with evidence.
;
; Runs on the S-CPU only; the SA-1 CPU stays in reset. Memory it owns:
;   I-RAM  $00:3000-$37FF  NMI/IRQ stubs, variables, the switch's stack, a 1 KB copy buffer
;   BW-RAM $40:0000-$43:FFFF  page 0 Evermore's save, page 1 Mana's save, then the frozen game's snapshot
;
; The converter defines (from the user's ROMs, tables.asm): ev_boot_regs, ev_scene1_regs, ev_scene2_regs
; (register/value pairs, $00 ends a list), ma_title_shadow (register, low, high triples, $00 ends) and fills
; evermore_reset_entry.

; ---- I-RAM (direct page $3000 inside the switch) ----
!NMI_STUB = $3000           ; JML to the active game's NMI
!IRQ_STUB = $3004           ; JML to the active game's IRQ
!MVN_OP   = $3008           ; MVN dst,src ; RTL — the switch patches the banks, then JSL $003008
!ACTIVE   = $3010           ; 0 Evermore, 1 Mana
!HAVE     = $3011           ; non-zero: BW-RAM holds the frozen game
!PREV     = $3012           ; last pad 1 bits seen by a pad hook (16-bit)
!SP_EV    = $3014           ; Evermore's stack pointer while frozen
!SP_MA    = $3016           ; Mana's stack pointer while frozen
!EDGE     = $3018           ; new Start press (16-bit)
!EV_SCENE = $301A           ; Evermore's last scene setup: 0 none, 1 $80:B3B0, 2 $8E:E08B
!SPIN     = $301C           ; wait counter for the sound ports (16-bit)
!TEST     = $301E           ; test harness only (tools/combo/demo.mts): bit 0 Start goes to the game, bit 1 switch now
!MA_LO    = $3100           ; Mana's PPU registers as last written: low byte, high byte, written flag
!MA_HI    = $3140           ; (indexed by register - $2100; Mana keeps no shadow of its own)
!MA_SET   = $3180
!BUF      = $3400           ; 1 KB copy buffer
!STACK    = $33FF

; direct page names (D = $3000 inside the switch)
!dActive = $10
!dHave   = $11
!dSpEv   = $14
!dSpMa   = $16
!dPtr    = $20              ; 24-bit BW-RAM address of the current chunk
!dAddr   = $24              ; 16-bit WRAM/VRAM address of the current chunk (+ $26 WRAM bank bit)
!dCount  = $28              ; chunks left
!dSwap   = $29              ; non-zero: swap; zero: store only
!dDmap   = $30              ; DMA parameters for do_dma
!dBbad   = $31
!dSrc    = $32              ; 24-bit A-bus address
!dSize   = $35              ; 16-bit
!dCtr    = $38              ; sound upload counter

; ---- BW-RAM layout (S-CPU addresses) ----
!SNAP_WRAM = $404000        ; 128 KB
!SNAP_VRAM = $424000        ; 64 KB
!SNAP_CG   = $434000        ; 512 B
!SNAP_OAM  = $434200        ; 544 B
!DMA_EV    = $434500        ; Evermore's DMA registers $4300-$437F
!DMA_MA    = $434580        ; Mana's

; ---- game addresses (docs/combo/poc.md) ----
!EV_NMI       = $80823E     ; Evermore's NMI body (the bank-$00 entry only jumped here)
!EV_IRQ       = $8084EE
!EV_PAD_BACK  = $8084A0     ; Evermore's NMI after its pad-1 read
!EV_SCENE1    = $80B3B4     ; after the 4 bytes the scene-1 hook replaces
!EV_SCENE2    = $8EE091     ; after the 6 bytes the scene-2 hook replaces
!EV_SOUND_INIT = $8C8000    ; uploads Evermore's sound loader through the IPL
!EV_SOUND_BASE = $8C801F    ; then the driver, command $0E and the first package (power-on does both)
!EV_NMITIMEN  = $7E0E6B     ; Evermore's $4200 mirror
!EV_SPC_CTR   = $7E009F     ; Evermore's sound command counter (direct page $9F, D = 0)
!EV_SHADOW_TM = $7E0F80     ; $212C, $212D, $2131, $2130 shadows, applied by $8C:E247
!MA_RESET     = $008004     ; Mana's reset entry
!MA_NMI       = $000100     ; Mana's NMI and IRQ jumps, kept in its WRAM
!MA_IRQ       = $000104
!MA_SOUND_INIT = $C30000    ; uploads Mana's driver when the IPL answers
!MA_PAD_LDA   = $7EA6F1     ; LDA $004218,X inside Mana's WRAM pad routine
!MA_LIST_WR1  = $7EC133     ; LDA $0002,Y / SEP #$20 in the two loops of Mana's PPU register writer
!MA_LIST_WR2  = $7EC166     ; ($7E:C0FD: X = register - $2100, the value is about to be written)
!MA_NMITIMEN  = $7F0090     ; Mana's $4200 shadow
!MA_IRQ_LINE  = $00C0       ; Mana's V-IRQ line ($7E:A1EF)
!MA_TITLE_BACK = $C027E5    ; Mana's title set-up after the 5 bytes its hook replaces
!MA_RESET_BACK = $02B5EB    ; after SEP #$30 / LDA #$8F in Mana's PPU reset
!MA_BG_BACK   = $01FD56     ; after SEP #$30 / LDA #$09 in Mana's BG set-up
!MA_SCREEN_BACK = $02AAB5   ; after SEP #$30 / LDA $20 in Mana's screen set-up

; =====================================================================================================
; Reset: entered from the vector table's spare slot $00:FFE0 (JML here), emulation mode, DB = 0.
combo_reset:
    sei
    lda #$FF : sta $2229                        ; SIWP: let the S-CPU write all of I-RAM
    lda #$5C : sta !NMI_STUB : sta !IRQ_STUB
    lda.b #!EV_NMI : sta !NMI_STUB+1 : lda.b #!EV_NMI>>8 : sta !NMI_STUB+2 : lda.b #!EV_NMI>>16 : sta !NMI_STUB+3
    lda.b #!EV_IRQ : sta !IRQ_STUB+1 : lda.b #!EV_IRQ>>8 : sta !IRQ_STUB+2 : lda.b #!EV_IRQ>>16 : sta !IRQ_STUB+3
    lda #$54 : sta !MVN_OP : lda #$6B : sta !MVN_OP+3
    stz !ACTIVE : stz !HAVE : stz !EV_SCENE : stz !TEST
    ldx #$33
-   stz !MA_SET,x : dex : bpl -                 ; (emulation mode: X 8-bit)
    lda #$FF : sta !PREV : sta !PREV+1
evermore_reset_entry:                           ; Evermore's own 13-byte reset entry, copied by the converter
    fillbyte $DB : fill 13                      ; (ends JML $80:802D, into the SA-1 boot block)

; =====================================================================================================
; Pad hooks. Start is hidden from the game unless Select is held; a new Start press switches.

; Evermore's NMI, $80:848F: LDA $4218 / BRA $84A0 is replaced by JML here. A, X, Y 16-bit.
evermore_pad:
    lda.l $004218
    jsl pad_filter
    jml !EV_PAD_BACK

; Mana's WRAM pad routine: LDA $004218,X becomes JSL here (installed by mana_nmi). A, X 16-bit; X = pad * 2.
mana_pad:
    lda.l $004218,x
    cpx.w #$0000
    bne +
    jsl pad_filter
+   rtl

; Mana's field pad read, $CF:FE34: LDA $4218 / STA $0042 becomes JSL here / NOP / NOP. A 16-bit; the store
; goes through the caller's DB, as the replaced one did.
mana_field_pad:
    lda.l $004218
    jsl pad_filter
    sta.w $0042
    rtl

; A (16-bit) = pad bits in, pad bits for the game out. Keeps X, Y, D, DB.
pad_filter:
    php
    rep #$20
    pha
    lda.l !PREV : eor #$FFFF : and 1,s : and #$1000 : sta.l !EDGE
    lda 1,s : sta.l !PREV
    lda.l !TEST : bit #$0002 : bne .switch      ; the test harness asks for a switch
    bit #$0001 : bne .pass                      ; the test harness replays a game's own Start presses
    lda 1,s
    bit #$2000 : bne .pass                      ; Select held: the game gets its Start
    and #$EFFF : sta 1,s
    lda.l !EDGE : beq .pass
.switch:
    lda.l !TEST : and #$FFFD : sta.l !TEST
    jsl combo_switch                            ; comes back when this game is resumed
.pass:
    pla
    plp
    rtl

; =====================================================================================================
; Mana's NMI passes here (I-RAM stub) so the pad hook is put into its WRAM once Mana has unpacked that code.
mana_nmi:
    php
    sep #$20
    pha
    lda.l !MA_PAD_LDA : cmp #$BF : bne .done
    lda.l !MA_PAD_LDA+1 : cmp #$18 : bne .done
    lda.l !MA_PAD_LDA+2 : cmp #$42 : bne .done
    lda.l !MA_PAD_LDA+3 : bne .done
    lda.b #mana_pad : sta.l !MA_PAD_LDA+1
    lda.b #mana_pad>>8 : sta.l !MA_PAD_LDA+2
    lda.b #mana_pad>>16 : sta.l !MA_PAD_LDA+3
    lda #$22 : sta.l !MA_PAD_LDA                ; JSL
.done:
    lda.l !MA_LIST_WR1 : cmp #$B9 : bne +       ; the PPU register writer's two loops: JSL ma_list_hook / NOP
    lda.l !MA_LIST_WR1+3 : cmp #$E2 : bne +
    lda.b #ma_list_hook : sta.l !MA_LIST_WR1+1 : lda.b #ma_list_hook>>8 : sta.l !MA_LIST_WR1+2
    lda.b #ma_list_hook>>16 : sta.l !MA_LIST_WR1+3 : lda #$EA : sta.l !MA_LIST_WR1+4
    lda #$22 : sta.l !MA_LIST_WR1
+   lda.l !MA_LIST_WR2 : cmp #$B9 : bne +
    lda.l !MA_LIST_WR2+3 : cmp #$E2 : bne +
    lda.b #ma_list_hook : sta.l !MA_LIST_WR2+1 : lda.b #ma_list_hook>>8 : sta.l !MA_LIST_WR2+2
    lda.b #ma_list_hook>>16 : sta.l !MA_LIST_WR2+3 : lda #$EA : sta.l !MA_LIST_WR2+4
    lda #$22 : sta.l !MA_LIST_WR2
+   pla
    plp
    jml !MA_NMI

; In Mana's register writer: do the replaced LDA $0002,Y / SEP #$20 (DB = $7F there), and remember the value
; for register X. A 16-bit in, 8-bit out with the high byte in B, as the replaced code leaves it.
ma_list_hook:
    lda $0002,y
    sep #$20
    sta.l !MA_LO,x
    xba : sta.l !MA_HI,x : xba
    pha : lda #$01 : sta.l !MA_SET,x : pla
    rtl

; Evermore's two scene set-ups: remember which ran, then run the replaced instructions.
ev_scene1_hook:                                 ; at $80:B3B0: SEP #$20 / LDA #$03
    php : sep #$20 : pha : lda #$01 : sta.l !EV_SCENE : pla : plp
    sep #$20 : lda #$03
    jml !EV_SCENE1
ev_scene2_hook:                                 ; at $8E:E08B: LDA #$008F / STA $2100, A 16-bit
    php : sep #$20 : pha : lda #$02 : sta.l !EV_SCENE : pla : plp
    lda.w #$008F : sta.w $2100
    jml !EV_SCENE2

; Mana's title set-up ($C0:27E0: PHB / LDA #$00 / PHA / PLB, A 8-bit) writes constants straight to the PPU:
; put the same values into the shadow, then run the replaced instructions.
ma_title_hook:
    php
    phb : phk : plb                             ; DB = this bank: the table, and I-RAM at $3100
    sep #$20 : rep #$10
    phx : phy : pha
    ldx.w #$0000
-   rep #$20 : lda ma_title_shadow,x : and #$00FF : beq + : tay : sep #$20
    lda ma_title_shadow+1,x : sta !MA_LO,y
    lda ma_title_shadow+2,x : sta !MA_HI,y
    lda #$01 : sta !MA_SET,y
    inx #3
    bra -
+   sep #$20
    pla : ply : plx
    plb
    plp
    phb
    lda #$00 : pha : plb
    jml !MA_TITLE_BACK

; Mana's field display set-ups, in ROM (each hook replaces SEP #$30 and the next 2-byte instruction):
; record what the routine is about to write, then run it.
macro ma_set(reg, value)
    lda.b <value> : sta.l !MA_LO+<reg> : sta.l !MA_HI+<reg>
    lda #$01 : sta.l !MA_SET+<reg>
endmacro

ma_reset_hook:                                  ; $02:B5E7, every PPU register to its default
    sep #$30
    phx
    ldx #$33
-   lda #$00 : sta.l !MA_LO,x : sta.l !MA_HI,x
    lda #$01 : sta.l !MA_SET,x
    dex : bpl -
    plx
    %ma_set($30, #$30)
    %ma_set($32, #$E0)
    lda #$01 : sta.l !MA_LO+$1B : sta.l !MA_LO+$1E   ; mode-7 matrix A and D = 1.0
    lda #$8F
    jml !MA_RESET_BACK

ma_bg_hook:                                     ; $01:FD52, BG mode and bases (not its mode-7 branch)
    sep #$30
    %ma_set($05, #$09)
    %ma_set($07, #$51)
    %ma_set($08, #$39)
    lda $E8 : lsr : lda #$58 : bcc + : lda #$5C
+   sta.l !MA_LO+$09 : sta.l !MA_HI+$09 : lda #$01 : sta.l !MA_SET+$09
    %ma_set($0A, #$00)
    %ma_set($0B, #$00)
    %ma_set($0C, #$04)
    lda #$09
    jml !MA_BG_BACK

ma_screen_hook:                                 ; $02:AAB1, mosaic, windows, screens, colour math, OBSEL
    sep #$30
    lda $20 : sta.l !MA_LO+$06 : lda $21 : sta.l !MA_LO+$2C
    lda $22 : sta.l !MA_LO+$2D : lda $23 : sta.l !MA_LO+$31
    lda #$01 : sta.l !MA_SET+$06 : sta.l !MA_SET+$2C : sta.l !MA_SET+$2D : sta.l !MA_SET+$31
    %ma_set($23, #$00)
    %ma_set($24, #$00)
    %ma_set($25, #$00)
    %ma_set($2A, #$00)
    %ma_set($2B, #$00)
    %ma_set($2E, #$00)
    %ma_set($2F, #$00)
    %ma_set($30, #$02)
    %ma_set($32, #$00)
    %ma_set($26, #$00)
    %ma_set($28, #$00)
    %ma_set($27, #$FF)
    %ma_set($29, #$FF)
    %ma_set($01, #$63)
    lda $20
    jml !MA_SCREEN_BACK

; =====================================================================================================
; The switch. Called from a pad hook in the active game's context; returns into the other game's hook.
combo_switch:
    php
    rep #$30
    pha : phx : phy : phb : phd
    sei
    sep #$20
    lda #$00 : pha : plb                        ; DB = 0: I/O, I-RAM
    rep #$20
    lda #$3000 : tcd                            ; D = I-RAM
    sep #$20
    stz $4200                                   ; no NMI, IRQ or joypad reads while the machine is swapped
    lda #$80 : sta $2100
    stz $420C
    lda !dActive : bne +
    rep #$20 : tsc : sta !dSpEv : bra ++
+   rep #$20 : tsc : sta !dSpMa
++  lda.w #!STACK : tcs
    sep #$20
    lda !dActive : bne +
    jsr ev_to_ipl : bra ++
+   jsr ma_to_ipl
++  jsr spc_silence
    jsr save_dma
    lda !dHave : bne .swap

    ; first switch: Evermore goes to BW-RAM, Mana starts from its reset
    stz !dSwap
    jsr mem_all
    jsr clear_wram
    lda #$01 : sta !dHave
    jsr map_mana
    jsr prev_held
    ldx.w #$0033                                ; Mana's first register writes come before its first NMI
-   stz !MA_LO,x : stz !MA_HI,x                 ; puts the shadow hook in: start from zeros, as Mana writes
    lda #$01 : sta !MA_SET,x
    dex : bpl -
    rep #$30
    lda #$0000 : tcd
    ldx #$01FF : txs
    sep #$30
    lda #$00 : pha : plb
    jml !MA_RESET

.swap:
    lda #$01 : sta !dSwap
    jsr mem_all
    lda !dActive : bne .toEvermore
    jsr map_mana
    jsr load_dma
    rep #$20 : lda !dSpMa : tcs
    jsr resume_mana
    bra .out
.toEvermore:
    jsr map_evermore
    jsr load_dma
    rep #$20 : lda !dSpEv : tcs
    jsr resume_evermore
.out:
    jsr prev_held
    rep #$30
    pld : plb : ply : plx : pla
    plp
    rtl

prev_held:                                      ; the button that switched is still down: no second switch
    rep #$20 : lda #$FFFF : sta.l !PREV : sep #$20
    rts

; ---- resuming each game ----
resume_mana:                                    ; Mana's mapping is set; WRAM, VRAM, CGRAM, OAM are Mana's
    jsl !MA_SOUND_INIT                          ; the SPC waits in its IPL: Mana uploads its driver
    sep #$20 : rep #$10
    phb : phk : plb                             ; DB = this bank: I-RAM and the PPU both answer here
    ldx.w #$0001                                ; Mana's registers as it last wrote them ($2100 below)
-   lda !MA_SET,x : beq .next
    lda ma_skip,x : bne .next
    lda !MA_LO,x : sta $2100,x
    lda ma_double,x : beq .next
    lda !MA_HI,x : sta $2100,x                  ; scroll and mode-7 registers take two writes
.next:
    inx
    cpx.w #$0034 : bne -
    plb
    lda #$0F : sta.l $002100                    ; full brightness (Mana keeps no brightness shadow)
    rep #$20
    lda.w #!MA_IRQ_LINE : sta.l $004209
    sep #$20
    lda.l $004210                               ; clear a pending NMI flag
    lda.l !MA_NMITIMEN : sta.l $004200
    rts

ma_double:                                      ; $210D-$2114 and $211B-$2120 are written twice
    db 0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1
    db 1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1
    db 1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
    db 0,0,0,0

ma_skip:                                        ; registers not to write again: brightness, OAM/VRAM/CGRAM ports
    db 1,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0          ; $2100-$210F
    db 0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0          ; $2110-$211F
    db 0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0          ; $2120-$212F
    db 0,0,0,0                                  ; $2130-$2133

resume_evermore:                                ; Evermore's mapping is set
    rep #$20 : lda #$0000 : tcd
    sep #$20 : lda #$80 : pha : plb
    jsl !EV_SOUND_INIT                          ; the SPC waits in its IPL: Evermore uploads its loader,
    jsl !EV_SOUND_BASE                          ; then its driver and first package, as at power-on
    sep #$20 : rep #$10
    ldx.w #ev_boot_regs : jsr write_regs
    lda.l !EV_SCENE : cmp #$01 : bne +
    ldx.w #ev_scene1_regs : jsr write_regs
+   lda.l !EV_SCENE : cmp #$02 : bne +
    ldx.w #ev_scene2_regs : jsr write_regs
    lda.l !EV_SHADOW_TM : sta.l $00212C         ; the room's own screen and colour-math settings
    lda.l !EV_SHADOW_TM+1 : sta.l $00212D
    lda.l !EV_SHADOW_TM+2 : sta.l $002131
    lda.l !EV_SHADOW_TM+3 : sta.l $002130
+   lda.l $004210
    lda.l !EV_NMITIMEN : sta.l $004200          ; brightness, scrolls, HDMA: Evermore's next NMI writes them
    rts

; X = list in this bank (register low byte, value; $00 ends). DB = this bank, whose $2100 is the PPU too.
write_regs:
    phb : phk : plb
-   rep #$20 : lda $0000,x : and #$00FF : beq +
    tay
    sep #$20
    lda $0001,x : sta $2100,y
    inx : inx
    bra -
+   sep #$20
    plb
    rts

; ---- sound: send the active driver back to the IPL, then silence the DSP ----
ev_to_ipl:                                      ; Evermore's command $0E (driver → IPL), as $8C:81FD sends it
    rep #$30
    ldx #$2800
-   sep #$20 : lda.l !EV_SPC_CTR : cmp $2142 : beq + : rep #$20 : dex : bne -
+   sep #$20
    lda.l !EV_SPC_CTR : inc : bne + : inc
+   sta.l !EV_SPC_CTR
    xba : lda #$0E : xba                        ; A = $0E << 8 | counter
    rep #$20
    stz $2140
    sta $2142
    jmp wait_ipl

ma_to_ipl:                                      ; Mana's driver upload ($FE, mode 3) writes ma_stub to ARAM $027C,
    sep #$20                                    ; where its main loop resumes when the upload ends
    lda #$FE : sta $2140 : jsr wait_echo
    lda #$03 : sta $2141
    lda #$7C : sta $2142 : lda #$02 : sta $2143
    lda #$00 : sta $2140 : jsr wait_echo
    ldx.w #0
    lda #$01 : sta !dCtr
-   lda.l ma_stub,x : sta $2141
    lda.l ma_stub+1,x : sta $2142
    lda.l ma_stub+2,x : sta $2143
    lda !dCtr : sta $2140 : jsr wait_echo
    jsr settle
    inc !dCtr
    inx : inx : inx
    cpx.w #ma_stub_end-ma_stub : bne -
    stz $2141 : stz $2140                       ; mode 0: the driver returns into the stub
    jmp wait_ipl

ma_stub:                                        ; SPC700, 18 bytes = 6 transfers of 3
    db $8F,$6C,$F2, $8F,$E0,$F3                 ; DSP FLG = $E0: soft reset, mute, no echo writes
    db $8F,$5C,$F2, $8F,$FF,$F3                 ; DSP KOF = all voices off
    db $8F,$B0,$F1, $5F,$C0,$FF                 ; CONTROL: IPL ROM on, input ports cleared; JMP $FFC0
ma_stub_end:

spc_silence:                                    ; through the IPL: write FLG = $E0 into the DSP, restart the IPL
    rep #$20
    lda #$00F2 : sta $2142
    sep #$20
    lda #$01 : sta $2141
    lda #$CC : sta $2140 : jsr wait_echo
    lda #$6C : sta $2141 : lda #$00 : sta $2140 : jsr wait_echo
    lda #$E0 : sta $2141 : lda #$01 : sta $2140 : jsr wait_echo
    rep #$20
    lda #$FFC0 : sta $2142
    sep #$20
    stz $2141
    lda #$03 : sta $2140 : jsr wait_echo
    jmp wait_ipl

wait_echo:                                      ; until port 0 reads what we wrote (A, 8-bit); gives up after a while
    rep #$10
    ldy #$0000
-   cmp $2140 : beq +
    dey : bne -
+   rts

settle:                                         ; a few microseconds for the SPC to read ports 2 and 3
    rep #$10
    ldy #$0010
-   dey : bne -
    rts

wait_ipl:                                       ; until the IPL shows $BBAA (gives up after ~1 s)
    rep #$30
    lda #$0020 : sta !SPIN
-   ldy #$0000
--  lda $2140 : cmp #$BBAA : beq +
    dey : bne --
    dec !SPIN : bne -
+   sep #$20
    rts

; ---- mappings ----
map_evermore:
    sep #$20
    lda #$04 : sta $2220 : lda #$05 : sta $2221 : lda #$06 : sta $2222 : lda #$07 : sta $2223
    stz $2224                                   ; BMAPS: BW-RAM page 0, Evermore's save
    lda #$01 : sta $420D                        ; FastROM
    lda.b #!EV_NMI : sta !NMI_STUB+1 : lda.b #!EV_NMI>>8 : sta !NMI_STUB+2 : lda.b #!EV_NMI>>16 : sta !NMI_STUB+3
    lda.b #!EV_IRQ : sta !IRQ_STUB+1 : lda.b #!EV_IRQ>>8 : sta !IRQ_STUB+2 : lda.b #!EV_IRQ>>16 : sta !IRQ_STUB+3
    stz !ACTIVE
    rts

map_mana:
    sep #$20
    lda #$01 : sta $2220 : lda #$07 : sta $2221 : lda #$01 : sta $2222 : lda #$07 : sta $2223
    lda #$01 : sta $2224                        ; BMAPS: BW-RAM page 1, Mana's save
    stz $420D                                   ; SlowROM, as Mana leaves it
    lda.b #mana_nmi : sta !NMI_STUB+1 : lda.b #mana_nmi>>8 : sta !NMI_STUB+2 : lda.b #mana_nmi>>16 : sta !NMI_STUB+3
    lda.b #!MA_IRQ : sta !IRQ_STUB+1 : lda.b #!MA_IRQ>>8 : sta !IRQ_STUB+2 : lda.b #!MA_IRQ>>16 : sta !IRQ_STUB+3
    lda #$01 : sta !ACTIVE
    rts

; ---- DMA registers ($4300-$437F are readable) ----
save_dma:
    sep #$20 : rep #$10
    ldx.w #$007F
-   lda $4300,x
    pha : lda !dActive : bne + : pla : sta.l !DMA_EV,x : bra ++
+   pla : sta.l !DMA_MA,x
++  dex : bpl -
    rts

load_dma:                                       ; for the game now active
    sep #$20 : rep #$10
    ldx.w #$007F
-   lda !dActive : bne + : lda.l !DMA_EV,x : bra ++
+   lda.l !DMA_MA,x
++  sta $4300,x
    dex : bpl -
    rts

; ---- the machine's memories <-> BW-RAM, 1 KB at a time ----
; dSwap = 0: copy to BW-RAM. dSwap = 1: exchange with BW-RAM (chunk -> buffer, BW-RAM -> chunk, buffer -> BW-RAM).
mem_all:
    jsr wram_all
    jsr vram_all
    jsr cgram_all
    jsr oam_all
    rts

wram_all:
    rep #$20
    lda.w #!SNAP_WRAM : sta !dPtr : sep #$20 : lda.b #!SNAP_WRAM>>16 : sta !dPtr+2
    rep #$20 : stz !dAddr : sep #$20 : stz !dAddr+2
    lda #128 : sta !dCount
-   jsr wmadd
    lda #$80 : sta !dDmap : lda #$80 : sta !dBbad   ; B -> A from $2180
    jsr chunk_out
    lda !dSwap : beq +
    jsr wmadd
    lda #$00 : sta !dDmap                       ; A -> B to $2180
    jsr chunk_in
+   rep #$20 : lda !dAddr : clc : adc #$0400 : sta !dAddr : sep #$20
    lda !dAddr+2 : adc #$00 : sta !dAddr+2
    jsr next_ptr
    dec !dCount : bne -
    rts

wmadd:
    rep #$20 : lda !dAddr : sta $2181 : sep #$20 : lda !dAddr+2 : sta $2183
    rts

vram_all:
    rep #$20
    lda.w #!SNAP_VRAM : sta !dPtr : sep #$20 : lda.b #!SNAP_VRAM>>16 : sta !dPtr+2
    rep #$20 : stz !dAddr : sep #$20
    lda #64 : sta !dCount
    lda #$80 : sta $2115
-   rep #$20 : lda !dAddr : sta $2116 : sep #$20
    lda $2139 : lda $213A                       ; the read latch is refilled before the address moves on, so
                                                ; the first word read after setting the address comes twice
    lda #$81 : sta !dDmap : lda #$39 : sta !dBbad   ; B -> A from $2139/$213A
    jsr chunk_out
    lda !dSwap : beq +
    rep #$20 : lda !dAddr : sta $2116 : sep #$20
    lda #$01 : sta !dDmap : lda #$18 : sta !dBbad   ; A -> B to $2118/$2119
    jsr chunk_in
+   rep #$20 : lda !dAddr : clc : adc #$0200 : sta !dAddr : sep #$20
    jsr next_ptr
    dec !dCount : bne -
    rts

cgram_all:
    rep #$20
    lda.w #!SNAP_CG : sta !dPtr : sep #$20 : lda.b #!SNAP_CG>>16 : sta !dPtr+2
    stz $2121
    lda #$80 : sta !dDmap : lda #$3B : sta !dBbad
    rep #$20 : lda #$0200 : sta !dSize : sep #$20
    jsr chunk_out_sized
    lda !dSwap : beq +
    stz $2121
    lda #$00 : sta !dDmap : lda #$22 : sta !dBbad
    jsr chunk_in_sized
+   rts

oam_all:
    rep #$20
    lda.w #!SNAP_OAM : sta !dPtr : sep #$20 : lda.b #!SNAP_OAM>>16 : sta !dPtr+2
    rep #$20 : stz $2102 : sep #$20
    lda #$80 : sta !dDmap : lda #$38 : sta !dBbad
    rep #$20 : lda #$0220 : sta !dSize : sep #$20
    jsr chunk_out_sized
    lda !dSwap : beq +
    rep #$20 : stz $2102 : sep #$20
    lda #$00 : sta !dDmap : lda #$04 : sta !dBbad
    jsr chunk_in_sized
+   rts

chunk_out:                                      ; B-bus -> buffer (swap) or -> BW-RAM (store), 1 KB
    rep #$20 : lda #$0400 : sta !dSize : sep #$20
chunk_out_sized:
    lda !dSwap : beq +
    rep #$20 : lda.w #!BUF : sta !dSrc : sep #$20 : stz !dSrc+2
    bra ++
+   rep #$20 : lda !dPtr : sta !dSrc : sep #$20 : lda !dPtr+2 : sta !dSrc+2
++  jmp do_dma

chunk_in:                                       ; BW-RAM -> B-bus, then buffer -> BW-RAM (MVN through I-RAM)
    rep #$20 : lda #$0400 : sta !dSize : sep #$20
chunk_in_sized:
    rep #$20 : lda !dPtr : sta !dSrc : sep #$20 : lda !dPtr+2 : sta !dSrc+2
    jsr do_dma
    lda !dPtr+2 : sta !MVN_OP+1                 ; destination bank
    stz !MVN_OP+2                               ; source bank $00 (I-RAM)
    rep #$30
    lda !dSize : dec
    ldx.w #!BUF
    ldy !dPtr
    phb
    jsl !MVN_OP
    plb
    sep #$20
    rts

next_ptr:
    rep #$20 : lda !dPtr : clc : adc #$0400 : sta !dPtr : sep #$20
    lda !dPtr+2 : adc #$00 : sta !dPtr+2
    rts

do_dma:                                         ; channel 7 from the direct-page parameters
    sep #$20
    lda !dDmap : sta $4370
    lda !dBbad : sta $4371
    rep #$20 : lda !dSrc : sta $4372 : sep #$20
    lda !dSrc+2 : sta $4374
    rep #$20 : lda !dSize : sta $4375 : sep #$20
    lda #$80 : sta $420B
    rts

clear_wram:                                     ; WRAM = 0 before Mana's first boot (as at power-on in the proofs)
    sep #$20
    rep #$20 : stz $2181 : sep #$20 : stz $2183
    lda #$08 : sta !dDmap : lda #$80 : sta !dBbad   ; fixed A-bus source
    rep #$20 : lda.w #zero : sta !dSrc : stz !dSize : sep #$20
    lda.b #zero>>16 : sta !dSrc+2
    jsr do_dma
    jsr do_dma
    rts

zero:
    db $00
