; ==============================================================================
; Secret of Evermore MSU-1 Audio Enhancement Patch
; ==============================================================================
; Replaces SPC700 background music playback with streaming CD-quality MSU-1 PCM
; audio while keeping original SPC700 sound effects fully operational.
;
; Target: Secret of Evermore (US 1.0)
; Mapper: HiROM (expanded from 3.0 MB to 4.0 MB)
;
; Hardware Registers (MSU-1):
;   $00:2000 - Status (read)
;              Bit 7: Data busy
;              Bit 6: Audio busy
;              Bit 5: Audio looping
;              Bit 4: Audio playing
;              Bit 3: Track missing
;              Bits 2-0: Revision
;   $00:2001 - Data read
;   $00:2002..$002007 - ID string "S-MSU1" (read)
;   $00:2004 - Audio track low byte (write)
;   $00:2005 - Audio track high byte (write - initiates track seek)
;   $00:2006 - Audio volume $00..$FF (write)
;   $00:2007 - Audio control (write)
;              Bit 0: Play
;              Bit 1: Repeat / Loop
;              Bit 2: Resume
; ==============================================================================

lorom ; Asar mode for addressing, or hirom
hirom

!MSU1_STATUS   = $002000
!MSU1_DATA     = $002001
!MSU1_ID_0     = $002002
!MSU1_ID_1     = $002004
!MSU1_ID_2     = $002006
!MSU1_TRACK_LO = $002004
!MSU1_TRACK_HI = $002005
!MSU1_VOLUME   = $002006
!MSU1_CONTROL  = $002007

!ACTIVE_MUSIC_TRACK_ID = $7E0E4D
!ACTIVE_BGM_TRACK      = $7E0E44

; ------------------------------------------------------------------------------
; Hook in Bank $8C: play_music_track ($8C:828F)
; Overwrites the initial 5 bytes:
;   $8C828F: REP #$30      (2 bytes)
;   $8C8291: STA $0E4D     (3 bytes)
; With:
;   JML msu1_music_dispatcher (4 bytes)
;   NOP                       (1 byte)
; ------------------------------------------------------------------------------
org $8C828F
    jml msu1_music_dispatcher
    nop

; ------------------------------------------------------------------------------
; Expanded Kernel in Bank $FE ($FE:6000 / File offset 0x3E6000)
; ------------------------------------------------------------------------------
org $FE6000

msu1_music_dispatcher:
    rep #$30                ; 16-bit A, X, Y
    sta !ACTIVE_MUSIC_TRACK_ID
    sta !ACTIVE_BGM_TRACK

    ; 1. Check for MSU-1 hardware presence
    ; Read string "S-MSU1" ($2D53, $534D, $3155)
    lda !MSU1_ID_0
    cmp #$2D53              ; 'S' (0x53) | ('-' (0x2D) << 8)
    beq +
    jml $8C8294             ; Fallback to vanilla $8C:8294
+
    lda !MSU1_ID_1
    cmp #$534D              ; 'M' (0x4D) | ('S' (0x53) << 8)
    beq +
    jml $8C8294             ; Fallback to vanilla $8C:8294
+
    lda !MSU1_ID_2
    cmp #$3155              ; 'U' (0x55) | ('1' (0x31) << 8)
    beq +
    jml $8C8294             ; Fallback to vanilla $8C:8294
+

    ; 2. MSU-1 hardware is verified.
    ; Check if track request is a stop command or negative
    lda !ACTIVE_MUSIC_TRACK_ID
    bmi .stop_playback
    cmp #$0046              ; 70 tracks ($00..$45)
    bcs .stop_playback

    ; 3. Stop currently playing MSU-1 track before initiating new track
    sep #$20                ; 8-bit A
    stz !MSU1_CONTROL       ; Stop MSU-1 audio

    ; 4. Select MSU-1 track: 1-based (track = song_id + 1)
    rep #$20                ; 16-bit A
    lda !ACTIVE_MUSIC_TRACK_ID
    inc a                   ; track_num = song_id + 1 (1..70)
    sep #$20                ; 8-bit A
    sta !MSU1_TRACK_LO      ; write track low
    xba
    sta !MSU1_TRACK_HI      ; write track high (triggers seek)

    ; 5. Wait for MSU-1 audio controller to finish seeking (Status bit 6)
.wait_busy:
    lda !MSU1_STATUS
    and #$40                ; Audio busy bit
    bne .wait_busy

    ; 6. Verify if track is present (Status bit 3)
    lda !MSU1_STATUS
    and #$08                ; Track missing bit
    beq +
    jml $8C8294             ; If missing, fall back to vanilla SPC700 music!
+

    ; 7. Track is present: Silence SPC700 background music
    rep #$20
    lda #$001A              ; Command 0x1A: Fade-out / silence active track
    ldy #$0000              ; Parameter 0
    jsl $8C81FD             ; apu_command_handshake

    ; 8. Set maximum MSU-1 playback volume ($FF)
    sep #$20
    lda #$FF
    sta !MSU1_VOLUME

    ; 9. Determine if track loops from ROM table
    rep #$20
    lda !ACTIVE_MUSIC_TRACK_ID
    and #$007F
    tax
    sep #$20
    lda.l msu1_loop_table,x ; $03 = Play | Repeat, $01 = Play only
    sta !MSU1_CONTROL       ; Start MSU-1 playback!

    ; Track is streaming. Return to caller.
    rep #$30
    rtl

.stop_playback:
    ; Stop MSU-1 track
    sep #$20
    stz !MSU1_CONTROL
    ; Silence SPC music
    rep #$20
    lda #$001A
    ldy #$0000
    jsl $8C81FD
    rep #$30
    rtl

; ------------------------------------------------------------------------------
; Track Loop Configuration Table (70 entries, 1 byte each)
; $03 = Play with seamless loop (bits 0 and 1)
; $01 = Play once without loop  (bit 0)
; ------------------------------------------------------------------------------
msu1_loop_table:
    db $03 ; 0x00: Main Title
    db $03 ; 0x01: Battle with Thraxx
    db $03 ; 0x02: In the Arena
    db $03 ; 0x03: Escape from Evermore
    db $03 ; 0x04: Return to Podunk
    db $03 ; 0x05: Village on the Plateau
    db $03 ; 0x06: Within the Volcano
    db $03 ; 0x07: Swamplands
    db $03 ; 0x08: Southern Jungle
    db $03 ; 0x09: Bugmuck Tar Pits
    db $03 ; 0x0A: Desert of Doom
    db $03 ; 0x0B: Queen Bluegarden
    db $03 ; 0x0C: High in the Sky
    db $03 ; 0x0D: Control Room
    db $03 ; 0x0E: Hall of Collosia
    db $03 ; 0x0F: Horace Highwater
    db $03 ; 0x10: Major Enemy
    db $03 ; 0x11: Merchant in the Cave
    db $03 ; 0x12: Elephant Graveyard
    db $03 ; 0x13: Pirates of Crustacia
    db $03 ; 0x14: Lively Nobilia Marketplace
    db $03 ; 0x15: Menu
    db $03 ; 0x16: Machinery
    db $01 ; 0x17: Game Over (one-shot)
    db $03 ; 0x18: Raptor Attack!
    db $01 ; 0x19: Victory Fanfare (one-shot)
    db $01 ; 0x1A: Good Night (one-shot)
    db $03 ; 0x1B: The Seashore
    db $03 ; 0x1C: Many Years Ago...
    db $03 ; 0x1D: The Professor's Room
    db $03 ; 0x1E: Quiet Plaza
    db $03 ; 0x1F: Omnitopia Surface
    db $03 ; 0x20: Storekeepers
    db $03 ; 0x21: Great Pyramid
    db $03 ; 0x22: Underground Path
    db $03 ; 0x23: Hidden River
    db $01 ; 0x24: Staff Roll (one-shot)
    db $03 ; 0x25: A Boy and His Dog
    db $03 ; 0x26: Engine Rumble
    db $01 ; 0x27: Empty / Unused
    db $01 ; 0x28: Unused 0x28
    db $03 ; 0x29: Palace Fountains
    db $03 ; 0x2A: Fire Eyes
    db $03 ; 0x2B: Puppet Show
    db $03 ; 0x2C: Minor Minion
    db $03 ; 0x2D: Distant Wind
    db $03 ; 0x2E: Death of a Minotaur
    db $03 ; 0x2F: Fields of Gothica
    db $03 ; 0x30: City of Ebony
    db $03 ; 0x31: Over the Waterfall
    db $03 ; 0x32: Darkness of the Temple
    db $03 ; 0x33: Dark Forest
    db $03 ; 0x34: City of Ivory
    db $03 ; 0x35: Omnitopia Hallways
    db $03 ; 0x36: Quicksand Fields
    db $03 ; 0x37: Tinker Tinderbox
    db $03 ; 0x38: Deserted Castle
    db $03 ; 0x39: Dank Dungeon
    db $03 ; 0x3A: Regal Castle
    db $03 ; 0x3B: Freak Show!!!
    db $01 ; 0x3C: Item Fanfare (one-shot)
    db $03 ; 0x3D: Northern Jungle
    db $03 ; 0x3E: Lonely Halls
    db $03 ; 0x3F: Dark Greenhouse
    db $03 ; 0x40: Vigor the Indestructible!
    db $03 ; 0x41: Racing Pigs!
    db $03 ; 0x42: Collapse of Ivor Tower
    db $03 ; 0x43: Volcano Pipes
    db $03 ; 0x44: Final Battle ~ Carltron
    db $03 ; 0x45: Intruder Alarm
