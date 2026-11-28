; The cheat menu demo (docs/open-evermore/cheat-menu.md): a full-screen menu in the style of the alchemy screen.
; Hold L and R in the field to open it. Our own code: every string, icon and table below is read from the ROM at
; runtime, by address or by routine name; no byte of the game is repeated here.
;
;   L / R        previous / next category (the strip of icons under the title)
;   Up / Down    choose a row
;   Left / Right change the amount or level (on / off where there is none)
;   B or A       owned on / off; where nothing is owned: all (max) / none
;   X            every row of the category to its maximum
;   Y or Start   leave
;
; One file: everything stays in one bank, so `jsr` and the handler tables work wherever implode places it.
; Registers: A, X, Y 16 bits and D = 0 everywhere; DB = $80 (low WRAM and the upper half of ROM). WRAM from $2000 up
; is read and written with `.l`. Game routines clobber A, X, Y and direct page $02-$48, so state lives in !cm_*.

; --- our WRAM: the shop / save prompt's menu variables, unused while this screen runs ($7E:0D0D-$0D60). Raw numbers: a
; build that moves those variables and puts something else here would not know ---
!cm_row = $0D0D         ; selected row of the category
!cm_top = $0D0F         ; first row on screen
!cm_page = $0D11        ; category 0-9
!cm_k = $0D13           ; the row the category handlers work on
!cm_n = $0D15           ; screen row 0-7 of cm_k
!cm_val = $0D17         ; the row's value, 32 bits
!cm_valhi = $0D19
!cm_min = $0D1B
!cm_max = $0D1D         ; 32 bits
!cm_maxhi = $0D1F
!cm_step = $0D21
!cm_own = $0D23         ; the row's owned / known / on flag, 0 or 1
!cm_t0 = $0D25
!cm_t1 = $0D27
!cm_t2 = $0D29
!cm_t3 = $0D2B
!cm_addr = $0D2D        ; the row's flag: WRAM address and bit mask, from the game's tables
!cm_mask = $0D2F
!cm_keys = $0D31
!cm_icon_type = $0D35   ; 8 words (7 used): 0 none, 1 ring item animation, 2 still sprite record in bank $CC
!cm_icon_ptr = $0D45    ; 8 words: the still record's address
!cm_i = $0D55
!cm_col = $0D57
!cm_t4 = $0D59
!cm_t5 = $0D5B
!cm_t6 = $0D5D
!cm_pending = $0D5F     ; buttons pressed while the list was being drawn
!cm_line = $0D33        ; the screen row a list loop is at
!cm_dst = $0D61         ; the tile-pair slot being printed into
; The list window has one slot (a pair of tile rows) more than the screen shows. A row is printed into the spare slot,
; out of sight, and the frame layer's map is then pointed at it in the same vertical blank as the sprites: nothing is
; ever seen half drawn.
!cm_slot = $0F60        ; 7 words: the slot each screen row shows; bit 15: the row is blank
!cm_spare = $0F6E
!cm_slot_last = $0F6C  ; !cm_slot of the last screen row (written out: Asar would not multiply first)
!cm_map_base = $0F70    ; the map word of the window's first tile
!cm_scratch = $0400     ; unused VRAM (the stone layer's map is 32 × 32): text is printed here, then uploaded whole
; kept between openings: the tail of the debug ring's item buffer, which nothing fills (RING_DEBUG_ITEMS + $1E)
!cm_saved_page = $0F7C
!cm_combo_held = $0F7E

!cm_title_window = $034D
!cm_list_window = $0379
!cm_desc_window = $03A5
!cm_records = $06A3     ; 16-byte animation records: 0-6 the rows, 7-16 the category strip

!PAGES = 10
!ROWS = 7

; category flags
!F_OWN = 1              ; the row has an owned flag (grey when off, B toggles it)
!F_VALUE = 2            ; the row has a number
!F_LEVEL = 4            ; printed as "Lv n"
!F_REBUILD = 8          ; a change recomputes the Boy's and the Dog's stats
!F_SHOW_MAX = 16        ; printed as "n/max"

; --- game tables (facts: knowledge routines and WRAM entries; all read in place by the game too) ---
ring_item_table = $8E8000       ; by ring item id (even): entry address in bank $8E
ring_item_name = $8E0000        ; entry +0 name (bank $C4), +2 icon animation, +4 palette, +6 index
ring_item_anim = $8E0002
ring_item_palette = $8E0004
ring_item_index = $8E0006
weapon_flag_addr = $C459A4      ; by 2·weapon: WRAM word of the owned bit, and the bit
weapon_flag_mask = $C459C0
weapon_school = $C459DC
weapon_desc = $C459F8
formula_known_addr = $C45C3B    ; by 2·formula
formula_known_mask = $C45C81
formula_ring_item = $C45BAF
formula_desc = $C45D51
armor_record = $C43896          ; by 2·armour: record in bank $C4, +2 the defence shown
charm_flag_addr = $8CBBB0       ; by 2·charm (14 charms, then 6 key items)
charm_flag_mask = $8CBBD8
charm_name = $8CBC1A
charm_desc = $8CC3D0
charm_icon = $C45A12            ; by 3·charm: sprite record
trade_name = $8CBC00            ; by 2·good
trade_icon = $C45A4E            ; by 3·good: sprite record
currency_name = $8F8704         ; by 3·currency: long pointer
currency_icon = $CC3C56         ; 7-byte sprite records
boy_xp_table = $8C8BD0          ; 24-bit totals by level
dog_xp_table = $8C8CFC

; --- opening: replaces the field loop's `jsl per_frame_field_tick` ---
cheat_menu_hook:
    rep #$30
    lda.l COPY_INPUT_P1                 ; the pad as read, not yet acknowledged by anyone
    and.w #$0030                        ; L and R
    cmp.w #$0030
    bne cm_hook_released
    lda.l !cm_combo_held
    bne cm_hook_tick
    lda.w #$0001
    sta.l !cm_combo_held
    lda.l JOYPAD1_TRIGGERED             ; the screen brightness the NMI writes: open only on a fully lit screen
    and.w #$00FF
    cmp.w #$000F
    bne cm_hook_tick
    lda.l RING_MENU_STATUS_FLAGS
    and.w #$0001
    bne cm_hook_tick
    jsl cheat_menu_screen
    bra cm_hook_tick
cm_hook_released:
    lda.w #$0000
    sta.l !cm_combo_held
cm_hook_tick:
    jml per_frame_field_tick            ; its rtl returns to the field loop

; The enter / leave sequence of the game's own full-screen option screens (ring_option_alchemy, without the ring).
cheat_menu_screen:
    phb
    pea $8080
    plb
    plb
    jsl cutscene_pause_activate
    lda.w #$4E89
    sta.w RING_MENU_CALLER_ACTOR
    lda.w #$0010
    sta.b $02
    lda.w #$00E0
    sta.b $04
    jsl menu_open_delay_frames_and_input_flush
    jsl oam_finalize_and_blank_unused
    jsl wait_for_nmi
    jsl dialogue_window_flush_to_vram
    jsl video_subsystem_hardware_registers_and_ppu_reset
    rep #$30
    jsr.w cm_init
    stz.w JOYPAD1_TRIGGERED
    lda.w #$800F
    sta.w AUDIO_TARGET_VOLUME           ; fade in
    jsr.w cm_loop
    stz.w ALCHEMY_RING_BROWSE_MODE
    jsl menu_open_delay_frames_and_input_flush
    jsl oam_finalize_and_blank_unused
    jsl wait_for_nmi
    jsl dialogue_window_flush_to_vram
    jsl field_screen_ppu_layers_and_hud_vram_init
    jsl ui_dialog_decompression_bootstrap
    jsl wait_for_nmi
    jsl window_system_reset_and_buffers_clear
    rep #$30
    stz.w CAMERA_SECONDARY_ACTOR_PTR
    ldx.w ENTITY_PTR_BOY
    jsl field_hud_meters_refresh_and_reactivate
    rep #$30
    ldx.w #$4E89
    jsl hud_render_entity_hp_string
    rep #$30
    ldx.w #$4F37
    jsl hud_render_entity_hp_string
    rep #$30
    stz.w JOYPAD1_TRIGGERED
    lda.w #$800F
    sta.w AUDIO_TARGET_VOLUME
    jsl cutscene_dialogue_activate
    rep #$30
    plb
    rtl

; --- screen setup (forced blank) ---
cm_init:
    inc.w ALCHEMY_RING_BROWSE_MODE      ; formula icons keep their colours with too few ingredients (else their
    lda.w #$1EE4                        ; animation greys a palette slot another icon uses); then text colours with grey
    sta.b $26
    lda.w #$00C4
    sta.b $28
    stz.b $2E
    ldx.w #$0008
    jsl cgram_palette_dma_enqueue_or_immediate
    rep #$30
    stz.w !cm_i
cm_init_palette:
    ldx.w !cm_i
    lda.l cm_obj_palettes,x
    jsl sprite_tile_vram_dma_enqueue    ; A palette in bank $90, X slot·2
    rep #$30
    inc.w !cm_i
    inc.w !cm_i
    lda.w !cm_i
    cmp.w #$000E
    bcc cm_init_palette
    jsl dialogue_window_arrow_cursor_draw       ; blank the frame layer's map
    rep #$30
    ldx.w #cm_list_layout-cm_title_layout
    ldy.w #!cm_list_window
    jsr.w cm_open_window
    lda.l $7FC800+$01C6                 ; row 7, column 3: the window's first tile
    sta.w !cm_map_base
    ldx.w #$0000
    lda.w #$0FFF                        ; blank the window's rows again; the boxes and cm_write_map fill them
cm_init_map:
    sta.l $7FC800+$01C0,x
    inx
    inx
    cpx.w #$0400                        ; 16 rows
    bcc cm_init_map
    ldx.w #$0000
    lda.w #$8000
cm_init_slot:
    sta.w !cm_slot,x
    inc a
    inx
    inx
    cpx.w #!ROWS*2
    bcc cm_init_slot
    lda.w #!ROWS
    sta.w !cm_spare
    lda.w #$0001                        ; list box: column 1, row 6, 30 × 16
    sta.b $02
    lda.w #$0006
    sta.b $04
    lda.w #$001E
    sta.b $06
    lda.w #$0010
    sta.b $08
    jsl window_box_frame_render
    rep #$30
    lda.w #$0001                        ; description box: column 1, row 22, 30 × 6 (two lines)
    sta.b $02
    lda.w #$0016
    sta.b $04
    lda.w #$001E
    sta.b $06
    lda.w #$0006
    sta.b $08
    jsl window_box_frame_render
    jsl dialogue_window_vram_blit_fullscreen
    rep #$30
    ldx.w #$0000
    ldy.w #!cm_title_window
    jsr.w cm_open_window
    ldx.w #cm_desc_layout-cm_title_layout
    ldy.w #!cm_desc_window
    jsr.w cm_open_window
    stz.w !cm_i
cm_init_tab:
    lda.w !cm_i
    asl a
    tax
    lda.l cm_tab_items,x
    sta.w !cm_t0
    lda.w !cm_i
    clc
    adc.w #!ROWS
    jsr.w cm_record_init
    inc.w !cm_i
    lda.w !cm_i
    cmp.w #!PAGES
    bcc cm_init_tab
    lda.l !cm_saved_page
    cmp.w #!PAGES
    bcc cm_init_page
    lda.w #$0000
cm_init_page:
    sta.w !cm_page
    jsr.w cm_page_enter
    rts

; Y = window descriptor, X = offset of its layout: 7 words (left, top, row, column, buffer, VRAM, width | height·256)
cm_open_window:
    lda.l cm_title_layout,x
    sta.w $000A,y                       ; left margin
    lda.l cm_title_layout+2,x
    sta.w $000C,y                       ; top margin
    lda.l cm_title_layout+4,x
    sta.w $0014,y                       ; tile row
    lda.l cm_title_layout+6,x
    sta.w $0016,y                       ; tile column
    lda.l cm_title_layout+8,x
    sta.w $0018,y                       ; pixel buffer (bank $7F)
    lda.l cm_title_layout+10,x
    sta.w $001A,y                       ; VRAM word address
    lda.l cm_title_layout+12,x
    and.w #$00FF
    sta.w $001C,y                       ; width in tiles
    lda.l cm_title_layout+13,x
    and.w #$00FF
    sta.w $001E,y                       ; height in tiles
    asl a
    asl a
    asl a
    sta.w $0020,y
    lda.w #$0004
    sta.w $0004,y                       ; space width
    lda.w #$0001
    sta.w $0006,y
    sta.w $0008,y
    sta.w $002A,y                       ; opens at once
    lda.w #$0400                        ; never wrap: a wrap past the last line waits for a button
    sta.w $0012,y
    lda.w #$0000
    sta.w $0024,y
    sta.w $0028,y
    lda.w #$1924                        ; the transparent fill
    sta.w $0026,y
    jsl window_open_setup
    rep #$30
    rts

; --- the frame loop ---
cm_loop:
    stz.w !cm_pending
    lda.w #$000F
    sta.w JOYPAD_REPEAT_DELAY
    lda.w #$0005
    sta.w JOYPAD_REPEAT_RATE
    lda.w #$FFFF                        ; forget the buttons that opened the screen
    jsl joypad_acknowledge_or_clear_buttons
    rep #$30
cm_loop_frame:
    jsr.w cm_draw
    jsl oam_finalize_and_blank_unused
    jsl wait_for_vblank_with_engine_tick
    rep #$30
    lda.w JOYPAD1_HELD
    and.w #$D0F0                        ; B, Y, Start, A, X, L, R: once a press
    ora.w !cm_pending
    stz.w !cm_pending
    ora.w #$0000                        ; flags of A
    sta.w !cm_keys
    beq cm_loop_directions
    jsl joypad_acknowledge_or_clear_buttons
    rep #$30
    lda.w !cm_keys
    bit.w #$5000
    beq cm_loop_not_leave
    rts
cm_loop_not_leave:
    bit.w #$0020
    beq cm_loop_not_l
    lda.w !cm_page
    dec a
    bpl cm_loop_set_page
    lda.w #!PAGES-1
    bra cm_loop_set_page
cm_loop_not_l:
    bit.w #$0010
    beq cm_loop_not_r
    lda.w !cm_page
    inc a
    cmp.w #!PAGES
    bcc cm_loop_set_page
    lda.w #$0000
cm_loop_set_page:
    sta.w !cm_page
    jsr.w cm_sound_move
    jsr.w cm_page_enter
    jmp.w cm_loop_frame
cm_loop_not_r:
    bit.w #$8080
    beq cm_loop_not_b
    jsr.w cm_toggle
    jmp.w cm_loop_frame
cm_loop_not_b:
    bit.w #$0040
    beq cm_loop_directions
    jsr.w cm_all
    jmp.w cm_loop_frame
cm_loop_directions:
    lda.w JOYPAD1_HELD
    and.w #$0F00
    jsl joypad_button_typematic_repeat  ; every frame, also with nothing held
    rep #$30
    bit.w #$0800
    beq cm_loop_not_up
    jsr.w cm_up
    jmp.w cm_loop_frame
cm_loop_not_up:
    bit.w #$0400
    beq cm_loop_not_down
    jsr.w cm_down
    jmp.w cm_loop_frame
cm_loop_not_down:
    bit.w #$0200
    beq cm_loop_not_left
    jsr.w cm_less
    jmp.w cm_loop_frame
cm_loop_not_left:
    bit.w #$0100
    beq cm_loop_not_right
    jsr.w cm_more
cm_loop_not_right:
    jmp.w cm_loop_frame

; Remember a press made while the screen is busy drawing, for the loop.
cm_poll:
    lda.w JOYPAD1_HELD
    and.w #$D0F0
    beq cm_poll_done
    tsb.w !cm_pending
    jsl joypad_acknowledge_or_clear_buttons
    rep #$30
cm_poll_done:
    rts

cm_sound_move:
    lda.w #$0003
    jsl sub_8C82DC
    rep #$30
    rts
cm_sound_set:
    lda.w #$0012
    jsl sub_8C82DC
    rep #$30
    rts

; --- moving ---
cm_count:
    lda.w !cm_page
    asl a
    tax
    lda.l cm_t_count,x
    rts
cm_up:
    lda.w !cm_row
    dec a
    bpl cm_move
    jsr.w cm_count
    dec a
    bra cm_move
cm_down:
    jsr.w cm_count
    sta.w !cm_t0
    lda.w !cm_row
    inc a
    cmp.w !cm_t0
    bcc cm_move
    lda.w #$0000
cm_move:
    sta.w !cm_row
    jsr.w cm_sound_move
    lda.w !cm_row
    cmp.w !cm_top
    bcs cm_move_not_above
    inc a
    cmp.w !cm_top
    bne cm_move_jump_above
    dec.w !cm_top
    jsr.w cm_scroll_back
    bra cm_move_desc
cm_move_jump_above:
    lda.w !cm_row
    sta.w !cm_top
    jsr.w cm_list_rebuild
    bra cm_move_desc
cm_move_not_above:
    sec
    sbc.w #!ROWS-1
    bmi cm_move_desc
    cmp.w !cm_top
    beq cm_move_desc
    bcc cm_move_desc
    sta.w !cm_t0
    dec a
    cmp.w !cm_top
    bne cm_move_jump_below
    inc.w !cm_top
    jsr.w cm_scroll_on
    bra cm_move_desc
cm_move_jump_below:
    lda.w !cm_t0
    sta.w !cm_top
    jsr.w cm_list_rebuild
cm_move_desc:
    jsr.w cm_desc_redraw
    rts

; The list one row further (the rows move up): rotate the slots and the icons, then draw the last row.
cm_scroll_on:
    lda.w !cm_slot
    sta.w !cm_dst
    phb
    ldx.w #!cm_slot+2
    ldy.w #!cm_slot
    lda.w #$000B
    mvn $7E,$7E
    ldx.w #!cm_records+$10
    ldy.w #!cm_records
    lda.w #$005F                        ; 6 records
    mvn $7E,$7E
    ldx.w #!cm_icon_type+2
    ldy.w #!cm_icon_type
    lda.w #$000B
    mvn $7E,$7E
    ldx.w #!cm_icon_ptr+2
    ldy.w #!cm_icon_ptr
    lda.w #$000B
    mvn $7E,$7E
    plb
    lda.w !cm_dst
    sta.w !cm_slot_last
    lda.w #!ROWS-1
    jsr.w cm_row_enter
    rts

; The list one row back (the rows move down): the same from the other end, then draw the first row.
cm_scroll_back:
    lda.w !cm_slot_last
    sta.w !cm_dst
    phb
    ldx.w #!cm_slot+11
    ldy.w #!cm_slot+13
    lda.w #$000B
    mvp $7E,$7E
    ldx.w #!cm_records+$5F
    ldy.w #!cm_records+$6F
    lda.w #$005F
    mvp $7E,$7E
    ldx.w #!cm_icon_type+11
    ldy.w #!cm_icon_type+13
    lda.w #$000B
    mvp $7E,$7E
    ldx.w #!cm_icon_ptr+11
    ldy.w #!cm_icon_ptr+13
    lda.w #$000B
    mvp $7E,$7E
    plb
    lda.w !cm_dst
    sta.w !cm_slot
    lda.w #$0000
    jsr.w cm_row_enter
    rts

; A = a screen row that holds a new entry: start its icon, then print and show it.
cm_row_enter:
    pha
    jsr.w cm_row_icon
    pla
    jsr.w cm_put_row
    rts
; A = a screen row: start the icon of the entry it holds.
cm_row_icon:
    sta.w !cm_n
    clc
    adc.w !cm_top
    sta.w !cm_k
    lda.w !cm_n
    asl a
    tax
    stz.w !cm_icon_type,x
    lda.w !cm_page
    asl a
    tax
    jsr.w (cm_t_icon,x)
    rep #$30
    rts

; --- changing ---
cm_load_selected:
    lda.w !cm_row
    sta.w !cm_k
; falls through
cm_load:
    stz.w !cm_val
    stz.w !cm_valhi
    stz.w !cm_min
    stz.w !cm_max
    stz.w !cm_maxhi
    stz.w !cm_own
    lda.w #$0001
    sta.w !cm_step
    lda.w !cm_page
    asl a
    tax
    jsr.w (cm_t_load,x)
    rep #$30
    rts
cm_store:
    lda.w !cm_page
    asl a
    tax
    jsr.w (cm_t_store,x)
    rep #$30
    jsr.w cm_flags
    and.w #!F_REBUILD
    beq cm_store_done
    jsr.w cm_rebuild
cm_store_done:
    rts
; The flags of row !cm_k: the category's, but the bazooka (the weapons' last row) has no level.
cm_flags:
    lda.w !cm_page
    bne cm_flags_category
    lda.w !cm_k
    cmp.w #$000C
    bne cm_flags_category_zero
    lda.w #!F_OWN|!F_REBUILD
    rts
cm_flags_category_zero:
    lda.w !cm_page
cm_flags_category:
    asl a
    tax
    lda.l cm_t_flags,x
    rts
cm_rebuild:
    phb
    jsl character_defense_and_buff_rebuild
    rep #$30
    jsl companion_stats_scaling_and_form_rebuild
    rep #$30
    plb
    rts

cm_toggle:
    jsr.w cm_load_selected
    jsr.w cm_flags
    and.w #!F_OWN
    beq cm_toggle_amount
    lda.w !cm_own
    eor.w #$0001
    sta.w !cm_own
    bra cm_changed
cm_toggle_amount:
    lda.w !cm_page
    cmp.w #$0009                        ; the party: to the maximum only, a level does not fall back to 1
    beq cm_toggle_to_max
    lda.w !cm_val
    cmp.w !cm_max
    bne cm_toggle_to_max
    lda.w !cm_valhi
    cmp.w !cm_maxhi
    bne cm_toggle_to_max
    lda.w !cm_min
    sta.w !cm_val
    stz.w !cm_valhi
    bra cm_changed
cm_toggle_to_max:
    jsr.w cm_to_max
cm_changed:
    jsr.w cm_store
    jsr.w cm_sound_set
    jsr.w cm_after_change
    rts
cm_to_max:
    lda.w !cm_max
    sta.w !cm_val
    lda.w !cm_maxhi
    sta.w !cm_valhi
    rts
; One row redrawn (the description stays: it does not depend on the value); the party page redraws all, as a level
; changes the HP rows too.
cm_after_change:
    lda.w !cm_page
    cmp.w #$0009
    bne cm_after_one
    jsr.w cm_list_refresh
    rts
cm_after_one:
    lda.w !cm_row
    sec
    sbc.w !cm_top
    jsr.w cm_put_row
    rts

cm_less:
    jsr.w cm_load_selected
    jsr.w cm_flags
    and.w #!F_VALUE
    bne cm_less_value
    lda.w !cm_own
    beq cm_nothing
    stz.w !cm_own
    bra cm_changed
cm_less_value:
    lda.w !cm_val
    sec
    sbc.w !cm_step
    sta.w !cm_t0
    lda.w !cm_valhi
    sbc.w #$0000
    bcc cm_less_floor
    sta.w !cm_t1
    bne cm_less_take
    lda.w !cm_t0
    cmp.w !cm_min
    bcc cm_less_floor
cm_less_take:
    lda.w !cm_t0
    sta.w !cm_t2
    lda.w !cm_t1
    bra cm_less_set
cm_less_floor:
    lda.w !cm_min
    sta.w !cm_t2
    lda.w #$0000
cm_less_set:
    cmp.w !cm_valhi
    bne cm_less_write
    ldx.w !cm_t2
    cpx.w !cm_val
    beq cm_nothing
cm_less_write:
    sta.w !cm_valhi
    lda.w !cm_t2
    sta.w !cm_val
    jmp.w cm_changed
cm_nothing:
    rts

cm_more:
    jsr.w cm_load_selected
    jsr.w cm_flags
    and.w #!F_VALUE
    bne cm_more_value
    lda.w !cm_own
    bne cm_nothing
    inc.w !cm_own
    jmp.w cm_changed
cm_more_value:
    lda.w !cm_val
    cmp.w !cm_max
    bne cm_more_add
    lda.w !cm_valhi
    cmp.w !cm_maxhi
    beq cm_nothing
cm_more_add:
    lda.w !cm_val
    clc
    adc.w !cm_step
    sta.w !cm_val
    lda.w !cm_valhi
    adc.w #$0000
    sta.w !cm_valhi
    cmp.w !cm_maxhi
    bcc cm_more_done
    bne cm_more_ceiling
    lda.w !cm_val
    cmp.w !cm_max
    bcc cm_more_done
cm_more_ceiling:
    jsr.w cm_to_max
cm_more_done:
    jmp.w cm_changed

cm_all:
    jsr.w cm_sound_set
    stz.w !cm_k
cm_all_row:
    jsr.w cm_load
    lda.w #$0001
    sta.w !cm_own
    jsr.w cm_to_max
    jsr.w cm_store
    inc.w !cm_k
    jsr.w cm_count
    sta.w !cm_t0
    lda.w !cm_k
    cmp.w !cm_t0
    bcc cm_all_row
    jsr.w cm_list_refresh
    rts

; --- drawing the text ---
; A new category: first the title with an empty list and description, all in one vertical blank, then row by row.
cm_page_enter:
    lda.w !cm_page
    sta.l !cm_saved_page
    stz.w !cm_row
    stz.w !cm_top
    jsl wait_for_nmi
    rep #$30
    jsr.w cm_list_hide
    ldx.w #$A000                        ; the title's buffer: 13 × 3 tiles
    ldy.w #$0138
    jsr.w cm_zero
    lda.w #$0000
    sta.w !cm_title_window
    lda.w #$0007
    sta.w !cm_title_window+$02
    lda.w #!cm_scratch
    sta.w !cm_title_window+$1A
    lda.w !cm_page
    asl a
    clc
    adc.w !cm_page
    tax
    lda.l cm_t_title,x
    sta.b $22
    lda.l cm_t_title+2,x
    and.w #$00FF
    sta.b $24
    ldy.w #!cm_title_window
    jsl dialogue_format_and_append_line
    rep #$30
    ldx.w #$BF00                        ; the description's buffer: 28 × 4 tiles
    ldy.w #$0380
    jsr.w cm_zero
    jsl wait_for_nmi
    rep #$30
    lda.w #$0C00
    sta.w !cm_title_window+$1A
    jsr.w cm_compose
    lda.w #$A000
    sta.b $26
    lda.w #$007F
    sta.b $28
    lda.w #$0C00
    sta.b $2E
    ldx.w #$0270
    jsl vram_dma_upload_tile_block
    rep #$30
    jsr.w cm_desc_upload
    lda.w !cm_page
    asl a
    tax
    lda.l cm_t_palette7,x               ; the sprite palette this category's still icons need
    beq cm_page_shown
    ldx.w #$000E
    jsl sprite_tile_vram_dma_enqueue
    rep #$30
cm_page_shown:
    jsr.w cm_present
    jsr.w cm_list_reveal
    jsr.w cm_desc_redraw
    rts

; Blank every row and take the icons away (shown by the next cm_present).
cm_list_hide:
    ldx.w #$0000
cm_list_hide_row:
    stz.w !cm_icon_type,x
    lda.w !cm_slot,x
    ora.w #$8000
    sta.w !cm_slot,x
    inx
    inx
    cpx.w #!ROWS*2
    bcc cm_list_hide_row
    rts
; The list from another place: empty it, then row by row.
cm_list_rebuild:
    jsl wait_for_nmi
    rep #$30
    jsr.w cm_list_hide
    jsr.w cm_compose
    jsr.w cm_present
; falls through
; Print every row out of sight, then show them all in one frame.
cm_list_reveal:
    stz.w !cm_line
cm_list_reveal_row:
    lda.w !cm_line
    clc
    adc.w !cm_top
    sta.w !cm_t0
    jsr.w cm_count
    cmp.w !cm_t0
    beq cm_list_reveal_done
    bcc cm_list_reveal_done
    lda.w !cm_line
    jsr.w cm_row_icon
    lda.w !cm_line
    jsr.w cm_print_row
    inc.w !cm_line
    lda.w !cm_line
    cmp.w #!ROWS
    bcc cm_list_reveal_row
cm_list_reveal_done:
    jsl wait_for_nmi
    rep #$30
    jsr.w cm_compose
    jsr.w cm_present
    rts
; The same rows with new values: each is replaced as a whole.
cm_list_refresh:
    stz.w !cm_line
cm_list_refresh_row:
    lda.w !cm_line
    clc
    adc.w !cm_top
    sta.w !cm_t0
    jsr.w cm_count
    cmp.w !cm_t0
    beq cm_list_refresh_done
    bcc cm_list_refresh_done
    lda.w !cm_line
    jsr.w cm_put_row
    inc.w !cm_line
    lda.w !cm_line
    cmp.w #!ROWS
    bcc cm_list_refresh_row
cm_list_refresh_done:
    rts

; A = a screen row: replace it on screen by its entry, as a whole.
cm_put_row:
    jsr.w cm_print_row
    jsr.w cm_compose
    jsr.w cm_present
    rts
; A = a screen row: print its entry into the spare slot, which the next cm_present shows there.
cm_print_row:
    sta.w !cm_n
    clc
    adc.w !cm_top
    sta.w !cm_k
    lda.w !cm_spare
    sta.w !cm_dst
    stz.w !cm_col
cm_put_row_clear:
    jsr.w cm_tile_offset
    clc
    adc.w #$A300
    tax
    ldy.w #$0010
    jsr.w cm_zero
    inc.w !cm_col
    lda.w !cm_col
    cmp.w #$001A
    bcc cm_put_row_clear
    jsr.w cm_row_print
    jsl wait_for_nmi                    ; the printer's own uploads reach the hidden slot
    rep #$30
    stz.w !cm_col
cm_put_row_upload:
    jsr.w cm_tile_offset
    pha
    clc
    adc.w #$A300
    sta.b $26
    lda.w #$007F
    sta.b $28
    pla
    lsr a                               ; VRAM words
    clc
    adc.w #$0D80
    sta.b $2E
    ldx.w #$0020
    jsl vram_dma_upload_tile_block
    rep #$30
    inc.w !cm_col
    lda.w !cm_col
    cmp.w #$001A
    bcc cm_put_row_upload
    lda.w !cm_n
    asl a
    tax
    lda.w !cm_slot,x
    and.w #$7FFF
    sta.w !cm_spare
    lda.w !cm_dst
    and.w #$7FFF
    sta.w !cm_slot,x
    jsr.w cm_poll
    rts
; A = the offset of slot !cm_dst in column !cm_col of the list window's buffer: 256 bytes a column, 32 a slot
cm_tile_offset:
    lda.w !cm_dst
    and.w #$000F
    asl a
    asl a
    asl a
    asl a
    asl a
    sta.w !cm_t1
    lda.w !cm_col
    xba
    ora.w !cm_t1
    rts
; X = address in bank $7F, Y = words: zero them
cm_zero:
    lda.w #$0000
cm_zero_word:
    sta.l $7F0000,x
    inx
    inx
    dey
    bne cm_zero_word
    rts

; One frame's picture: build the sprites, then (after the caller queued its uploads) the map, and wait for the blank.
cm_compose:
    jsr.w cm_draw
    jsl oam_finalize_and_blank_unused
    rep #$30
    rts
cm_present:
    jsr.w cm_write_map
    lda.w #$C9C0                        ; map rows 7-20
    sta.b $26
    lda.w #$007F
    sta.b $28
    lda.w #$08E0
    sta.b $2E
    ldx.w #$0380
    jsl vram_dma_upload_tile_block
    rep #$30
    jsl wait_for_vblank_with_engine_tick
    rep #$30
    jsr.w cm_poll
    rts
; The shadow map's list rows from !cm_slot: tiles run down each column, 16 a column, two a slot.
cm_write_map:
    stz.w !cm_t5                        ; screen row
cm_map_row:
    lda.w !cm_t5
    asl a
    tax
    lda.w !cm_slot,x
    bmi cm_map_blank
    asl a
    clc
    adc.w !cm_map_base
    sta.w !cm_t4
    bra cm_map_place
cm_map_blank:
    stz.w !cm_t4
cm_map_place:
    lda.w !cm_t5
    xba
    lsr a                               ; two map rows a screen row: 128 bytes
    tax
    ldy.w #$001A
cm_map_column:
    lda.w !cm_t4
    beq cm_map_empty
    sta.l $7FC9C6,x
    inc a
    sta.l $7FC9C6+$40,x
    clc
    adc.w #$000F                        ; the next column's tile
    sta.w !cm_t4
    bra cm_map_next
cm_map_empty:
    lda.w #$0FFF
    sta.l $7FC9C6,x
    sta.l $7FC9C6+$40,x
cm_map_next:
    inx
    inx
    dey
    bne cm_map_column
    inc.w !cm_t5
    lda.w !cm_t5
    cmp.w #!ROWS
    bcc cm_map_row
    rts

; Row !cm_k into slot !cm_dst: name, then its value; grey when it is off or none.
cm_row_print:
    jsr.w cm_load
    lda.w #$0008
    trb.w !cm_list_window+$12
    jsr.w cm_flags
    sta.w !cm_t4
    and.w #!F_OWN
    beq cm_row_grey_by_value
    lda.w !cm_own
    beq cm_row_grey
    bra cm_row_name
cm_row_grey_by_value:
    lda.w !cm_val
    ora.w !cm_valhi
    bne cm_row_name
cm_row_grey:
    lda.w #$0008
    tsb.w !cm_list_window+$12
cm_row_name:
    lda.w !cm_dst
    and.w #$000F
    asl a
    asl a
    asl a
    asl a
    sta.w !cm_list_window+$02
    lda.w #$0014
    sta.w !cm_list_window+$00
    lda.w !cm_page
    asl a
    tax
    jsr.w (cm_t_name,x)
    rep #$30
    jsr.w cm_list_string
    lda.w #$0096
    sta.w !cm_list_window+$00
    lda.w !cm_t4
    and.w #!F_VALUE
    bne cm_row_number
    lda.w #cm_s_on
    ldx.w !cm_own
    bne cm_row_switch
    lda.w #cm_s_off
cm_row_switch:
    jsr.w cm_list_own_string
    bra cm_row_done
cm_row_number:
    lda.w !cm_t4
    and.w #!F_LEVEL
    beq cm_row_plain
    lda.w #cm_s_lv
    jsr.w cm_list_own_string
cm_row_plain:
    lda.w !cm_val
    sta.b $02
    lda.w !cm_valhi
    sta.b $04
    ldy.w #!cm_list_window
    jsr.w cm_print_number
    lda.w !cm_t4
    and.w #!F_SHOW_MAX
    beq cm_row_done
    lda.w #cm_s_slash
    jsr.w cm_list_own_string
    lda.w !cm_max
    sta.b $02
    lda.w !cm_maxhi
    sta.b $04
    ldy.w #!cm_list_window
    jsr.w cm_print_number
cm_row_done:
    lda.w #$0008
    trb.w !cm_list_window+$12
    rts

; $22/$24 = string
cm_list_string:
    ldy.w #!cm_list_window
    jsl dialogue_format_and_append_line
    rep #$30
    rts
; A = a string of this file
cm_list_own_string:
    sta.b $22
    lda.w #cm_s_on>>16
    sta.b $24
    bra cm_list_string
cm_desc_own_string:
    sta.b $22
    lda.w #cm_s_on>>16
    sta.b $24
cm_desc_string:
    ldy.w #!cm_desc_window
    jsl dialogue_format_and_append_line
    rep #$30
    rts
; A = text offset in bank $C4
cm_desc_c4:
    sta.b $22
    lda.w #$00C4
    sta.b $24
    bra cm_desc_string

; $02/$04 = number, Y = window
cm_print_number:
    phy
    phb
    lda.w #$2FF4
    sta.b $22
    lda.w #$007E
    sta.b $24
    jsl format_32bit_integer_to_decimal_ascii
    rep #$30
    plb
    ply
    jsl dialogue_format_and_append_line
    rep #$30
    rts

; The selected row's description, printed out of sight and shown whole.
cm_desc_redraw:
    ldx.w #$BF00
    ldy.w #$0380
    jsr.w cm_zero
    stz.w !cm_desc_window
    lda.w #$0002
    sta.w !cm_desc_window+$02
    lda.w #!cm_scratch
    sta.w !cm_desc_window+$1A
    lda.w !cm_row
    sta.w !cm_k
    lda.w !cm_page
    asl a
    tax
    jsr.w (cm_t_desc,x)
    rep #$30
    jsl wait_for_nmi
    rep #$30
    lda.w #$1B80
    sta.w !cm_desc_window+$1A
    jsr.w cm_desc_upload
    rts
cm_desc_upload:
    lda.w #$BF00
    sta.b $26
    lda.w #$007F
    sta.b $28
    lda.w #$1B80
    sta.b $2E
    ldx.w #$0700
    jsl vram_dma_upload_tile_block
    rep #$30
    rts

; --- sprites, every frame ---
; $26 = record address, A = bank, X = x, Y = y, $06 = attributes set by the caller
cm_sprite:
    sta.b $28
    stx.b $02
    sty.b $04
    jsl direct_sprite_draw_oam
    rep #$30
    rts

cm_draw:
    lda.w #$0030                        ; cursor: palette slot 0
    sta.b $06
    lda.w #$36B9
    sta.b $26
    lda.w !cm_row
    sec
    sbc.w !cm_top
    asl a
    asl a
    asl a
    asl a
    clc
    adc.w #$003C
    tay
    ldx.w #$000F
    lda.w #$00CC
    jsr.w cm_sprite
    lda.w #$0038                        ; button hints: palette slot 4
    sta.b $06
    lda.w #cm_hint_set
    sta.b $26
    ldx.w #$0084
    ldy.w #$000C
    lda.w #cm_hint_set>>16
    jsr.w cm_sprite
    lda.w #$0038
    sta.b $06
    lda.w #cm_hint_all
    sta.b $26
    ldx.w #$00AC
    ldy.w #$000C
    lda.w #cm_hint_set>>16
    jsr.w cm_sprite
    lda.w #$0038
    sta.b $06
    lda.w #$3995                        ; the game's "Y EXIT"
    sta.b $26
    ldx.w #$00D2
    ldy.w #$000C
    lda.w #$00CC
    jsr.w cm_sprite
    lda.w #$0038
    sta.b $06
    lda.w #cm_pill_l
    sta.b $26
    ldx.w #$0006
    ldy.w #$001D
    lda.w #cm_hint_set>>16
    jsr.w cm_sprite
    lda.w #$0038
    sta.b $06
    lda.w #cm_pill_r
    sta.b $26
    ldx.w #$00DA
    ldy.w #$001D
    lda.w #cm_hint_set>>16
    jsr.w cm_sprite
    lda.w #$0030                        ; the marker under the open category
    sta.b $06
    lda.w #$36C5
    sta.b $26
    lda.w !cm_page
    asl a
    asl a
    asl a
    asl a
    clc
    adc.w !cm_page                      ; 17 pixels a category
    clc
    adc.w #$002E
    tax
    ldy.w #$002D
    lda.w #$00CC
    jsr.w cm_sprite
    lda.w !cm_top
    beq cm_draw_no_up
    lda.w #$0030
    sta.b $06
    lda.w #$36C5
    sta.b $26
    ldx.w #$00E4
    ldy.w #$0032
    lda.w #$00CC
    jsr.w cm_sprite
cm_draw_no_up:
    jsr.w cm_count
    sec
    sbc.w !cm_top
    cmp.w #!ROWS+1
    bcc cm_draw_no_down
    lda.w #$0030
    sta.b $06
    lda.w #$36CC
    sta.b $26
    ldx.w #$00E4
    ldy.w #$00A8
    lda.w #$00CC
    jsr.w cm_sprite
cm_draw_no_down:
    stz.w !cm_i
cm_draw_tab:
    lda.w !cm_i
    asl a
    asl a
    asl a
    asl a
    clc
    adc.w !cm_i
    clc
    adc.w #$0032
    sta.w !cm_t1
    lda.w #$0024
    sta.w !cm_t2
    lda.w !cm_i
    cmp.w !cm_page
    bne cm_draw_tab_still
    lda.l FRAME_COUNTER_1               ; the open category's icon hops
    and.w #$0010
    beq cm_draw_tab_still
    lda.w #$0022
    sta.w !cm_t2
cm_draw_tab_still:
    lda.w !cm_i
    asl a
    tax
    lda.w !cm_t1
    clc
    adc.l cm_tab_dx,x
    sta.w !cm_t1
    lda.w !cm_t2
    clc
    adc.l cm_tab_dy,x
    sta.w !cm_t2
    lda.w !cm_i
    clc
    adc.w #!ROWS
    jsr.w cm_record_draw
    inc.w !cm_i
    lda.w !cm_i
    cmp.w #!PAGES
    bcc cm_draw_tab
    stz.w !cm_i
cm_draw_icon:
    lda.w !cm_i
    asl a
    tax
    lda.w !cm_icon_type,x
    beq cm_draw_icon_next
    cmp.w #$0001
    bne cm_draw_still
    lda.w #$0020
    sta.w !cm_t1
    lda.w !cm_i
    asl a
    asl a
    asl a
    asl a
    clc
    adc.w #$003E
    sta.w !cm_t2
    lda.w !cm_page
    asl a
    tax
    lda.w !cm_t1
    clc
    adc.l cm_t_icon_dx,x
    sta.w !cm_t1
    lda.w !cm_t2
    clc
    adc.l cm_t_icon_dy,x
    sta.w !cm_t2
    lda.w !cm_i
    jsr.w cm_record_draw
    bra cm_draw_icon_next
cm_draw_still:
    lda.w !cm_icon_ptr,x
    sta.b $26
    lda.w #$003E                        ; palette slot 7
    sta.b $06
    lda.w !cm_i
    asl a
    asl a
    asl a
    asl a
    clc
    adc.w #$003E
    sta.w !cm_t2
    lda.w !cm_page
    cmp.w #$0008                        ; the currency pictures sit differently in their boxes
    bne cm_draw_still_placed
    lda.w !cm_i
    asl a
    tax
    lda.w !cm_t2
    clc
    adc.l cm_money_dy,x
    sta.w !cm_t2
    lda.w !cm_icon_ptr,x
    sta.b $26
cm_draw_still_placed:
    ldy.w !cm_t2
    ldx.w #$0020
    lda.w #$00CC
    jsr.w cm_sprite
cm_draw_icon_next:
    inc.w !cm_i
    lda.w !cm_i
    cmp.w #!ROWS
    bcs cm_draw_icons_done
    jmp.w cm_draw_icon
cm_draw_icons_done:
    rts

; A = record number, !cm_t0 = ring item id: start its icon animation and give it its palette's attributes.
cm_record_init:
    asl a
    asl a
    asl a
    asl a
    clc
    adc.w #!cm_records
    sta.w !cm_t3
    ldx.w !cm_t0
    lda.l ring_item_table,x
    tax
    lda.l ring_item_palette,x
    sta.w !cm_t5
    lda.l ring_item_anim,x
    sta.w !cm_t6
    ldx.w #$000C
cm_record_palette:
    lda.l cm_obj_palettes,x
    cmp.w !cm_t5
    beq cm_record_found
    dex
    dex
    bpl cm_record_palette
    ldx.w #$000E
cm_record_found:
    txa
    sta.w !cm_t5                        ; slot·2, the record's palette attributes
    ldx.w !cm_t6
    ldy.w !cm_t3
    jsl anim_vm_tick
    rep #$30
    ldy.w !cm_t3
    lda.w !cm_t5
    sta.w $000C,y
    rts

; A = record number, !cm_t1 = x, !cm_t2 = y
cm_record_draw:
    asl a
    asl a
    asl a
    asl a
    clc
    adc.w #!cm_records
    sta.w !cm_t3
    tay
    lda.w !cm_t1
    sta.b $02
    lda.w !cm_t2
    sta.b $04
    lda.w #$0030
    sta.b $06
    jsl entity_anim_frame_advance_step
    rep #$30
    jsl anim_record_draw_sprite_to_oam
    rep #$30
    rts

; --- helpers of the category handlers ---
; A = ring item id: row !cm_n shows it.
cm_icon_ring:
    sta.w !cm_t0
    lda.w !cm_n
    asl a
    tax
    lda.w #$0001
    sta.w !cm_icon_type,x
    lda.w !cm_n
    jsr.w cm_record_init
    rts
; A = still record's address in bank $CC
cm_icon_still:
    sta.w !cm_t0
    lda.w !cm_n
    asl a
    tax
    lda.w #$0002
    sta.w !cm_icon_type,x
    lda.w !cm_t0
    sta.w !cm_icon_ptr,x
    rts
; A = ring item id → $22/$24 = its name
cm_ring_name:
    tax
    lda.l ring_item_table,x
    tax
    lda.l ring_item_name,x
    sta.b $22
    lda.w #$00C4
    sta.b $24
    rts
; The owned flag at !cm_addr / !cm_mask → !cm_own
cm_flag_load:
    ldx.w !cm_addr
    lda.l $7E0000,x
    and.w !cm_mask
    beq cm_flag_off
    lda.w #$0001
    sta.w !cm_own
cm_flag_off:
    rts
cm_flag_store:
    ldx.w !cm_addr
    lda.w !cm_own
    beq cm_flag_clear
    lda.l $7E0000,x
    ora.w !cm_mask
    sta.l $7E0000,x
    rts
cm_flag_clear:
    lda.w !cm_mask
    eor.w #$FFFF
    and.l $7E0000,x
    sta.l $7E0000,x
    rts
; ===================== weapons: row k is weapon j = k + 1 (13 = the bazooka) =====================
cm_weapon_x:
    lda.w !cm_k
    inc a
    asl a
    tax
    rts
cm_weapon_load:
    jsr.w cm_weapon_x
    lda.l weapon_flag_addr,x
    sta.w !cm_addr
    lda.l weapon_flag_mask,x
    sta.w !cm_mask
    lda.l LEVEL_FIST,x                  ; level in the high byte, progress in the low one
    xba
    and.w #$00FF
    sta.w !cm_val
    cpx.w #$001A                        ; the bazooka gains no level
    bne cm_weapon_levels
    sta.w !cm_min
    sta.w !cm_max
    bra cm_weapon_flag
cm_weapon_levels:
    lda.w #$0001
    sta.w !cm_min
    lda.w #$0003
    sta.w !cm_max
cm_weapon_flag:
    jsr.w cm_flag_load
    rts
cm_weapon_store:
    jsr.w cm_flag_store
    jsr.w cm_weapon_x
    lda.w !cm_own
    bne cm_weapon_level
    txa
    cmp.l EQUIPPED_WEAPON
    bne cm_weapon_level
    ; the held one goes: hold another (weapon 0 is no record, loading it crashes the game)
    ldx.w #$001A
cm_weapon_other:
    phx
    lda.l weapon_flag_mask,x
    sta.w !cm_t0
    lda.l weapon_flag_addr,x
    tax
    lda.l $7E0000,x
    plx
    and.w !cm_t0
    bne cm_weapon_equip
    dex
    dex
    bne cm_weapon_other
    lda.w #$0001                        ; the last weapon stays
    sta.w !cm_own
    jsr.w cm_flag_store
    bra cm_weapon_level
cm_weapon_equip:
    txa
    sta.l EQUIPPED_WEAPON
    sep #$20
    sta.l CURRENT_WEAPON
    lda.l weapon_school,x
    sta.l CURRENT_WEAPON_TYPE
    rep #$20
    jsr.w cm_weapon_reload
cm_weapon_level:
    jsr.w cm_weapon_x
    cpx.w #$001A
    beq cm_weapon_stored
    lda.l LEVEL_FIST,x
    xba
    and.w #$00FF
    cmp.w !cm_val
    beq cm_weapon_stored
    lda.w !cm_val
    xba
    sta.l LEVEL_FIST,x
    txa
    cmp.l EQUIPPED_WEAPON
    bne cm_weapon_stored
    jsr.w cm_weapon_reload
cm_weapon_stored:
    rts
; The field reloads the Boy's weapon when the one it has loaded does not match.
cm_weapon_reload:
    lda.w #$FFFF
    sta.l PENDING_TALK_TARGET_PTR
    rts
cm_weapon_item:
    lda.w !cm_k
    cmp.w #$000C
    bcs cm_weapon_item_bazooka
    asl a
    clc
    adc.w #$0028
    rts
cm_weapon_item_bazooka:
    lda.w #$0040
    rts
cm_weapon_name:
    jsr.w cm_weapon_item
    jsr.w cm_ring_name
    rts
cm_weapon_icon:
    jsr.w cm_weapon_item
    jsr.w cm_icon_ring
    rts
cm_weapon_text:
    lda.w !cm_k
    cmp.w #$000C
    bcs cm_weapon_text_help
    jsr.w cm_weapon_x
    lda.l weapon_desc,x
    jsr.w cm_desc_c4
    rts
cm_weapon_text_help:
    jmp.w cm_help_owned

; ===================== bazooka ammunition =====================
cm_ammo_load:
    ldx.w !cm_k
    lda.l AMMO_1,x
    and.w #$00FF
    sta.w !cm_val
    lda.w #99
    sta.w !cm_max
    rts
cm_ammo_store:
    ldx.w !cm_k
    sep #$20
    lda.w !cm_val
    sta.l AMMO_1,x
    rep #$20
    lda.l EQUIPPED_WEAPON
    cmp.w #$001A
    bne cm_ammo_stored
    jsr.w cm_weapon_reload
cm_ammo_stored:
    rts
cm_ammo_item:
    lda.w !cm_k
    asl a
    clc
    adc.w #$0042
    rts
cm_ammo_name:
    jsr.w cm_ammo_item
    jsr.w cm_ring_name
    rts
cm_ammo_icon:
    jsr.w cm_ammo_item
    jsr.w cm_icon_ring
    rts

; ===================== alchemy: known flag and level =====================
cm_formula_x:
    lda.w !cm_k
    asl a
    tax
    rts
cm_formula_load:
    jsr.w cm_formula_x
    lda.l formula_known_addr,x
    sta.w !cm_addr
    lda.l formula_known_mask,x
    sta.w !cm_mask
    lda.l LEVEL_HIGH_ACID_RAIN,x
    sta.w !cm_val
    lda.w #$0009
    sta.w !cm_max
    jsr.w cm_flag_load
    rts
cm_formula_store:
    jsr.w cm_flag_store
    lda.w !cm_own
    bne cm_formula_level
    jsr.w cm_formula_x                  ; forgotten: take it out of the selected nine
    phb
    jsl alchemy_inventory_find_ingredient_slot
    bcs cm_formula_not_selected
    jsl alchemy_inventory_shift_slots_down
cm_formula_not_selected:
    rep #$30
    plb
cm_formula_level:
    jsr.w cm_formula_x
    lda.l LEVEL_HIGH_ACID_RAIN,x
    cmp.w !cm_val
    beq cm_formula_stored
    lda.w !cm_val
    sta.l LEVEL_HIGH_ACID_RAIN,x
    lda.w #$0000
    sta.l LEVEL_LOW_ACID_RAIN,x
cm_formula_stored:
    rts
cm_formula_item:
    jsr.w cm_formula_x
    lda.l formula_ring_item,x
    rts
cm_formula_name:
    jsr.w cm_formula_item
    jsr.w cm_ring_name
    rts
cm_formula_icon:
    jsr.w cm_formula_item
    jsr.w cm_icon_ring
    rts
cm_formula_text:
    jsr.w cm_formula_x
    lda.l formula_desc,x
    jsr.w cm_desc_c4
    rts

; ===================== ingredients =====================
; Row k is ingredient 21 - k: the game numbers them backwards through the alphabet, Wax first.
cm_ingredient_x:
    lda.w #$0015
    sec
    sbc.w !cm_k
    tax
    rts
cm_ingredient_load:
    jsr.w cm_ingredient_x
    lda.l WAX,x
    and.w #$00FF
    sta.w !cm_val
    lda.w #99
    sta.w !cm_max
    rts
cm_ingredient_store:
    jsr.w cm_ingredient_x
    sep #$20
    lda.w !cm_val
    sta.l WAX,x
    rep #$20
    rts
; The ring items of the ingredients are not in id order: find the one whose index is the ingredient.
cm_ingredient_item:
    jsr.w cm_ingredient_x
    stx.w !cm_t0
    ldy.w #$0118
cm_ingredient_search:
    tyx
    lda.l ring_item_table,x
    tax
    lda.l ring_item_index,x
    cmp.w !cm_t0
    beq cm_ingredient_found
    iny
    iny
    cpy.w #$0142
    bcc cm_ingredient_search
cm_ingredient_found:
    tya
    rts
cm_ingredient_name:
    jsr.w cm_ingredient_item
    jsr.w cm_ring_name
    rts
cm_ingredient_icon:
    jsr.w cm_ingredient_item
    jsr.w cm_icon_ring
    rts

; ===================== consumables =====================
cm_consumable_load:
    ldx.w !cm_k
    lda.l PETAL,x
    and.w #$00FF
    sta.w !cm_val
    lda.w #$0006
    sta.w !cm_max
    cpx.w #$0007                        ; Call Beads have a capacity of their own
    bne cm_consumable_loaded
    lda.l CALL_BEADS_CAPACITY
    and.w #$00FF
    bne cm_consumable_capacity
    lda.w #99
cm_consumable_capacity:
    sta.w !cm_max
cm_consumable_loaded:
    rts
; A Call Bead capacity of 0 (the scripts set 99) becomes 99: a count above the capacity would not do.
cm_consumable_store:
    ldx.w !cm_k
    sep #$20
    lda.w !cm_val
    sta.l PETAL,x
    cpx.w #$0007
    bne cm_consumable_stored
    lda.w !cm_max
    sta.l CALL_BEADS_CAPACITY
cm_consumable_stored:
    rep #$20
    rts
cm_consumable_item:
    lda.w !cm_k
    asl a
    clc
    adc.w #$008E
    rts
cm_consumable_name:
    jsr.w cm_consumable_item
    jsr.w cm_ring_name
    rts
cm_consumable_icon:
    jsr.w cm_consumable_item
    jsr.w cm_icon_ring
    rts

; ===================== armour =====================
cm_armor_load:
    ldx.w !cm_k
    lda.l CHEST_1_1,x
    and.w #$00FF
    sta.w !cm_val
    lda.w #$0006
    sta.w !cm_max
    rts
cm_armor_store:
    ldx.w !cm_k
    sep #$20
    lda.w !cm_val
    sta.l CHEST_1_1,x
    rep #$20
    lda.w !cm_val
    bne cm_armor_stored
    lda.w !cm_k                         ; none left: take it off
    asl a
    tax
    lda.l armor_record,x
    cmp.l CURRENT_ARMOR_COLLAR
    bne cm_armor_not_collar
    lda.w #$0000
    sta.l CURRENT_ARMOR_COLLAR
    rts
cm_armor_not_collar:
    cmp.l CURRENT_ARMOR_CHEST
    bne cm_armor_not_chest
    lda.w #$0000
    sta.l CURRENT_ARMOR_CHEST
    rts
cm_armor_not_chest:
    cmp.l CURRENT_ARMOR_HELM
    bne cm_armor_not_helm
    lda.w #$0000
    sta.l CURRENT_ARMOR_HELM
    rts
cm_armor_not_helm:
    cmp.l CURRENT_ARMOR_GLOVE
    bne cm_armor_stored
    lda.w #$0000
    sta.l CURRENT_ARMOR_GLOVE
cm_armor_stored:
    rts
cm_armor_item:
    lda.w !cm_k
    asl a
    clc
    adc.w #$00A0
    rts
cm_armor_name:
    jsr.w cm_armor_item
    jsr.w cm_ring_name
    rts
cm_armor_icon:
    jsr.w cm_armor_item
    jsr.w cm_icon_ring
    rts
cm_armor_text:
    lda.w #cm_s_defence
    jsr.w cm_desc_own_string
    lda.w !cm_k
    asl a
    tax
    lda.l armor_record,x
    tax
    lda.l $C40002,x
    sta.b $02
    stz.b $04
    ldy.w #!cm_desc_window
    jsr.w cm_print_number
    rts

; ===================== charms and key items =====================
cm_charm_load:
    lda.w !cm_k
    asl a
    tax
    lda.l charm_flag_addr,x
    sta.w !cm_addr
    lda.l charm_flag_mask,x
    sta.w !cm_mask
    jsr.w cm_flag_load
    rts
cm_charm_store:
    jsr.w cm_flag_store
    rts
cm_charm_name:
    lda.w !cm_k
    asl a
    tax
    lda.l charm_name,x
    sta.b $22
    lda.w #$00C4
    sta.b $24
    rts
cm_charm_picture:
    lda.w !cm_k
    asl a
    clc
    adc.w !cm_k
    tax
    lda.l charm_icon,x
    jsr.w cm_icon_still
    rts
cm_charm_text:
    lda.w !cm_k
    asl a
    tax
    lda.l charm_desc,x
    jsr.w cm_desc_c4
    rts

; ===================== trade goods =====================
cm_trade_load:
    lda.w !cm_k
    asl a
    tax
    lda.l ANNIHILATION_AMULET,x
    sta.w !cm_val
    lda.w #99
    sta.w !cm_max
    rts
cm_trade_store:
    lda.w !cm_k
    asl a
    tax
    lda.w !cm_val
    sta.l ANNIHILATION_AMULET,x
    rts
cm_trade_name:
    lda.w !cm_k
    asl a
    tax
    lda.l trade_name,x
    sta.b $22
    lda.w #$00C4
    sta.b $24
    rts
cm_trade_icon:
    lda.w !cm_k
    asl a
    clc
    adc.w !cm_k
    tax
    lda.l trade_icon,x
    jsr.w cm_icon_still
    rts

; ===================== money: 24 bits a purse =====================
cm_money_x:
    lda.w !cm_k
    asl a
    clc
    adc.w !cm_k
    tax
    rts
cm_money_load:
    jsr.w cm_money_x
    lda.l TALONS,x
    sta.w !cm_val
    lda.l TALONS+2,x
    and.w #$00FF
    sta.w !cm_valhi
    lda.w #999999&$FFFF
    sta.w !cm_max
    lda.w #999999>>16
    sta.w !cm_maxhi
    lda.w #100
    sta.w !cm_step
    rts
cm_money_store:
    jsr.w cm_money_x
    lda.w !cm_val
    sta.l TALONS,x
    sep #$20
    lda.w !cm_valhi
    sta.l TALONS+2,x
    rep #$20
    rts
cm_money_name:
    jsr.w cm_money_x
    lda.l currency_name,x
    sta.b $22
    lda.l currency_name+2,x
    and.w #$00FF
    sta.b $24
    rts
cm_money_icon:
    lda.w !cm_k
    asl a
    asl a
    asl a
    sec
    sbc.w !cm_k                         ; 7 bytes a record
    clc
    adc.w #currency_icon&$FFFF
    jsr.w cm_icon_still
    rts

; ===================== the party: level and HP =====================
cm_party_load:
    lda.w #$0001
    sta.w !cm_min
    lda.w !cm_k
    asl a
    tax
    jmp.w (cm_party_loads,x)
cm_boy_level_load:
    lda.l BOY_LEVEL
    bra cm_level_loaded
cm_dog_level_load:
    lda.l DOG_LEVEL
cm_level_loaded:
    sta.w !cm_val
    lda.w #99
    sta.w !cm_max
    rts
cm_boy_hp_load:
    lda.l BOY_MAX_HP
    sta.w !cm_max
    lda.l BOY_CURRENT_HP
    bra cm_hp_loaded
cm_dog_hp_load:
    lda.l DOG_MAX_HP
    sta.w !cm_max
    lda.l ENTITY_COMPANION_DOG+$2A
cm_hp_loaded:
    sta.w !cm_val
    lda.w #10
    sta.w !cm_step
    rts
cm_party_store:
    lda.w !cm_k
    asl a
    tax
    jmp.w (cm_party_stores,x)
cm_boy_hp_store:
    lda.w !cm_val
    sta.l BOY_CURRENT_HP
    rts
cm_dog_hp_store:
    lda.w !cm_val
    sta.l ENTITY_COMPANION_DOG+$2A
    rts
; A level: its experience, the experience for the next one, the stats it gives, and full HP.
cm_boy_level_store:
    lda.w !cm_val
    cmp.l BOY_LEVEL
    beq cm_party_stored
    sta.l BOY_LEVEL
    dec a
    jsr.w cm_triple
    lda.l boy_xp_table,x
    sta.l BOY_XP
    lda.l boy_xp_table+2,x
    and.w #$00FF
    sta.l BOY_XP+2
    lda.l boy_xp_table+3,x
    sta.l BOY_XP_REQUIRED
    sep #$20
    lda.l boy_xp_table+5,x
    sta.l BOY_XP_REQUIRED+2
    rep #$20
    jsr.w cm_rebuild
    lda.l BOY_MAX_HP
    sta.l BOY_CURRENT_HP
cm_party_stored:
    rts
cm_dog_level_store:
    lda.w !cm_val
    cmp.l DOG_LEVEL
    beq cm_party_stored
    sta.l DOG_LEVEL
    dec a
    jsr.w cm_triple
    lda.l dog_xp_table,x
    sta.l DOG_MAX_HP+$14                ; the Dog's experience, 20 bytes into its stats
    lda.l dog_xp_table+2,x
    and.w #$00FF
    sta.l DOG_MAX_HP+$16
    lda.l dog_xp_table+3,x
    sta.l DOG_XP_REQUIRED
    sep #$20
    lda.l dog_xp_table+5,x
    sta.l DOG_XP_REQUIRED+2
    lda.w !cm_val
    cmp.b #99                           ; the Dog's table has no entry past 99
    bne cm_dog_level_next
    lda.b #$FF
    sta.l DOG_XP_REQUIRED
    sta.l DOG_XP_REQUIRED+1
    sta.l DOG_XP_REQUIRED+2
cm_dog_level_next:
    rep #$20
    jsr.w cm_rebuild
    lda.l DOG_MAX_HP
    sta.l ENTITY_COMPANION_DOG+$2A
    rts
cm_triple:
    sta.w !cm_t0
    asl a
    clc
    adc.w !cm_t0
    tax
    rts
cm_party_name:
    lda.w !cm_k
    asl a
    tax
    lda.l cm_party_names,x
    sta.b $22
    lda.w #cm_s_on>>16
    sta.b $24
    rts
cm_party_icon:
    lda.w #$00A0                        ; a vest for the Boy, a collar for the Dog
    ldx.w !cm_k
    cpx.w #$0002
    bcc cm_party_icon_set
    lda.w #$00E8
cm_party_icon_set:
    jsr.w cm_icon_ring
    rts

; --- help lines ---
cm_help_owned:
    lda.w #cm_s_help_owned
    jsr.w cm_desc_own_string
    rts
cm_help_amount:
    lda.w #cm_s_help_amount
    jsr.w cm_desc_own_string
    rts
cm_help_money:
    lda.w #cm_s_help_money
    jsr.w cm_desc_own_string
    rts
cm_help_party:
    lda.w #cm_s_help_party
    jsr.w cm_desc_own_string
    rts

; ===================== tables: one entry a category =====================
; weapons, bazooka, alchemy, ingredients, items, armour, charms, trade goods, money, party
cm_t_count:
    dw 13, 3, 35, 22, 8, 40, 20, 13, 4, 4
cm_t_flags:
    dw !F_OWN|!F_VALUE|!F_LEVEL|!F_REBUILD, !F_VALUE|!F_REBUILD|!F_SHOW_MAX, !F_OWN|!F_VALUE|!F_LEVEL, !F_VALUE|!F_SHOW_MAX, !F_VALUE|!F_SHOW_MAX
    dw !F_VALUE|!F_REBUILD|!F_SHOW_MAX, !F_OWN|!F_REBUILD, !F_VALUE|!F_SHOW_MAX, !F_VALUE, !F_VALUE|!F_SHOW_MAX
cm_t_load:
    dw cm_weapon_load, cm_ammo_load, cm_formula_load, cm_ingredient_load, cm_consumable_load
    dw cm_armor_load, cm_charm_load, cm_trade_load, cm_money_load, cm_party_load
cm_t_store:
    dw cm_weapon_store, cm_ammo_store, cm_formula_store, cm_ingredient_store, cm_consumable_store
    dw cm_armor_store, cm_charm_store, cm_trade_store, cm_money_store, cm_party_store
cm_t_name:
    dw cm_weapon_name, cm_ammo_name, cm_formula_name, cm_ingredient_name, cm_consumable_name
    dw cm_armor_name, cm_charm_name, cm_trade_name, cm_money_name, cm_party_name
cm_t_icon:
    dw cm_weapon_icon, cm_ammo_icon, cm_formula_icon, cm_ingredient_icon, cm_consumable_icon
    dw cm_armor_icon, cm_charm_picture, cm_trade_icon, cm_money_icon, cm_party_icon
cm_t_desc:
    dw cm_weapon_text, cm_help_amount, cm_formula_text, cm_help_amount, cm_help_amount
    dw cm_armor_text, cm_charm_text, cm_help_amount, cm_help_money, cm_help_party
cm_party_loads:
    dw cm_boy_level_load, cm_boy_hp_load, cm_dog_level_load, cm_dog_hp_load
cm_party_stores:
    dw cm_boy_level_store, cm_boy_hp_store, cm_dog_level_store, cm_dog_hp_store
; Every icon is centred on one point; added to an icon's anchor, by category and by tab. The ingredient animations
; (the ingredients, and the Atlas Amulet that stands for money) are anchored 6 right of and 5 below the others.
cm_t_icon_dx:
    dw 0, 0, 0, $FFFA, 0, 0, 0, 0, 0, 0
cm_t_icon_dy:
    dw 0, 0, 0, $FFFB, 0, 0, 0, 0, 0, 0
cm_tab_dx:
    dw 0, 0, 0, $FFFA, 0, 0, 0, 0, $FFFA, 0
cm_tab_dy:
    dw 0, 0, 0, $FFFB, 0, 0, 0, 0, $FFFB, 0
; added to a currency picture's y, to centre it: talons, jewels, gold pieces, credits
cm_money_dy:
    dw $FFFD, $FFFC, $FFFF, $FFFF
; the palette each category loads into sprite slot 7 (0: none): the pause screen's for charms and trade goods, the
; money window's for the currencies
cm_t_palette7:
    dw 0, 0, 0, 0, 0, 0, $AB0B, $AB0B, $AACB, 0
; sprite palettes (bank $90) of slots 0-6: cursor and formulas, weapons, consumables, ingredients, buttons, armour,
; formulas (second)
cm_obj_palettes:
    dw $C30B, $AA8B, $AA0B, $AA4B, $A98B, $C3AB, $C32B
; the ring item whose icon stands for each category
cm_tab_items:
    dw $0028, $0042, $0056, $0140, $008E, $00A0, $009E, $009C, $012C, $00E8
; windows: left margin, top margin, tile row, tile column, buffer, VRAM, width (low byte) | height (high byte)
cm_title_layout:
    dw 0, 7, 1, 3, $A000, $0C00, $030D
cm_list_layout:
    dw 0, 0, 7, 3, $A300, $0D80, $101A
cm_desc_layout:
    dw 0, 2, 23, 2, $BF00, $1B80, $041C
; the titles: the game's own strings where it has one
cm_t_title:
    dl cm_s_weapons
    dl $C4618E                  ; Bazooka
    dl $C467E1                  ; Alchemy
    dl $8DC21F                  ; Ingredients
    dl $8CC162                  ; Items (the end of "Charms/Rare Items")
    dl cm_s_armor
    dl cm_s_charms              ; the game's "Charms/Rare Items" is wider than the title
    dl $8CBE1C                  ; Trade Goods
    dl cm_s_money
    dl $C46783                  ; Player Status

; --- sprite records: count, offset of the chunks, (box when 3 or more), chunks {size, x, y, block} ---
; the game's button and small letter blocks, by block id
cm_hint_set:
    db 4, 6, 0, 0, 32, 16
    db $11, 0, 0
    dw $079A                    ; B button
    db $10, 15, 3
    dw $0B44                    ; S
    db $10, 20, 3
    dw $0B39                    ; E
    db $10, 25, 3
    dw $0B41                    ; T
cm_hint_all:
    db 4, 6, 0, 0, 32, 16
    db $11, 0, 0
    dw $079D                    ; X button
    db $10, 15, 3
    dw $0B40                    ; A
    db $10, 21, 3
    dw $0B6C                    ; L
    db $10, 26, 3
    dw $0B6C
cm_pill_l:
    db 2, 2
    db $11, 0, 0
    dw $07A1
    db $11, 16, 0
    dw $07A0
cm_pill_r:
    db 2, 2
    db $11, 0, 0
    dw $079F
    db $11, 16, 0
    dw $079E

; --- our words ($81 / $82: the Boy's and the Dog's name) ---
cm_party_names:
    dw cm_s_boy_level, cm_s_boy_hp, cm_s_dog_level, cm_s_dog_hp
cm_s_boy_level:
    db $81, " level", 0
cm_s_boy_hp:
    db $81, " HP", 0
cm_s_dog_level:
    db $82, " level", 0
cm_s_dog_hp:
    db $82, " HP", 0
cm_s_weapons:
    db "Weapons", 0
cm_s_money:
    db "Money", 0
cm_s_armor:
    db "Armor", 0
cm_s_charms:
    db "Charms", 0
cm_s_on:
    db "ON", 0
cm_s_off:
    db "OFF", 0
cm_s_lv:
    db "Lv ", 0
cm_s_slash:
    db "/", 0
cm_s_defence:
    db "Defense: ", 0
cm_s_help_owned:
    db "B: own   Left, Right: level", 0
cm_s_help_amount:
    db "Left, Right: amount   B: max or none", 0
cm_s_help_money:
    db "Left, Right: 100   B: max or none", 0
cm_s_help_party:
    db "Left, Right: change   B: max", 0
