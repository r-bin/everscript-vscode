'use strict';

function sub1bIsVal(subinstr) {
    const cmd = subinstr & 0x70;
    return cmd === 0x30 || cmd === 0x40 || cmd === 0x60;
}

function sub1b2val(subinstr) {
    const cmd = subinstr & 0x70;
    if (cmd === 0x30) return subinstr & 0x0f;
    if (cmd === 0x40) return 0xfff0 | (subinstr & 0x0f);
    if (cmd === 0x60) return 0x10 + (subinstr & 0x0f);
    return 0;
}

function subinstrIsEntityOnly(subinstr) {
    switch (subinstr) {
        case 0xd0:
        case 0xd1:
        case 0xd2:
        case 0xd3:
        case 0xad:
        case 0xae:
            return true;
        default:
            return false;
    }
}

function subinstrIsEntity(subinstr) {
    return subinstrIsEntityOnly(subinstr | 0x80);
}

function subinstr2name(subinstr) {
    switch (subinstr & 0x7f) {
        case 0x50: return 'boy';
        case 0x51: return 'dog';
        case 0x52: return 'controlled char';
        case 0x53: return 'non-controlled char';
        case 0x2d: return 'last entity ($0341)';
        case 0x2e: return 'entity attached to script?';
        default: return '???';
    }
}

function parseSubExpression(romBuf, startRom, readU8, readU16) {
    let ok = true;
    let done = false;
    let addr = startRom;
    let res = '';
    let exprlen = 0;
    const stack = [];

    while (ok && !done) {
        let instr = readU8(romBuf, addr++);
        done = Boolean(instr & 0x80);
        if (subinstrIsEntity(instr)) {
            exprlen++;
            if (res) res += ' ';
            res += subinstr2name(instr);
            continue;
        }
        if (sub1bIsVal(instr)) {
            exprlen++;
            if (res) res += ' ';
            const value = sub1b2val(instr);
            const signed = (value & 0x8000) ? value - 0x10000 : value;
            res += String(signed);
            continue;
        }

        instr &= 0x7f;
        switch (instr) {
            case 0x00:
                break;
            case 0x01:
            case 0x02:
                exprlen++;
                addr += 1;
                break;
            case 0x03:
            case 0x04:
                exprlen++;
                addr += 2;
                break;
            case 0x05:
            case 0x0a:
                addr += 2;
                exprlen = 2;
                break;
            case 0x06:
            case 0x07:
            case 0x08:
            case 0x09:
            case 0x0b:
            case 0x0c:
            case 0x0d:
            case 0x0e:
                addr += 2;
                exprlen++;
                break;
            case 0x0f:
                addr += 1;
                exprlen = 2;
                break;
            case 0x10:
            case 0x11:
            case 0x12:
            case 0x13:
                addr += 1;
                exprlen++;
                break;
            case 0x14:
            case 0x15:
            case 0x16:
                exprlen = 2;
                break;
            case 0x17:
            case 0x18:
            case 0x1a:
            case 0x1b:
            case 0x1c:
            case 0x1d:
            case 0x1e:
            case 0x1f:
            case 0x20:
            case 0x21:
            case 0x22:
            case 0x23:
            case 0x24:
            case 0x25:
            case 0x26:
            case 0x27:
            case 0x28:
                if (!stack.length) {
                    ok = false;
                    break;
                }
                stack.pop();
                exprlen = 2;
                break;
            case 0x29:
                stack.push(exprlen);
                exprlen = 0;
                break;
            case 0x2a:
            case 0x2c:
            case 0x54:
            case 0x57:
            case 0x5a:
            case 0x5b:
                exprlen++;
                break;
            case 0x2b:
            case 0x55:
            case 0x56:
            case 0x5c:
            case 0x58:
            case 0x59:
                exprlen = 2;
                break;
            case 0x19:
            case 0x2f:
            case 0x51:
            case 0x5d:
            case 0x5e:
            case 0x5f:
                ok = false;
                break;
            default:
                ok = false;
                break;
        }
    }

    return { ok, nextRom: addr, text: res, exprlen };
}

function parseNumberLiteral(text) {
    if (!text) return NaN;
    const t = String(text).trim();
    if (/^[-+]?0x[0-9a-f]+$/i.test(t)) return Number.parseInt(t, 16);
    if (/^[-+]?\d+$/.test(t)) return Number.parseInt(t, 10);
    return NaN;
}

const OPCODE_REGISTRY = (() => {
    const r = {};
    const add = (id, name, operands, flow) => {
        r[id] = { id, name, operands, flow: flow || 'next' };
    };

    add(0x00, 'SCRIPT_END', [], 'return');
    add(0x04, 'BRANCH', ['s16']);
    add(0x05, 'BRANCH_NEG', ['s8']);
    add(0x07, 'CALL_24BIT', ['u24'], 'call');
    add(0x08, 'BRANCH_IF', ['subexpr', 's16'], 'branch');
    add(0x09, 'BRANCH_IF_NOT', ['subexpr', 's16'], 'branch');
    add(0x0a, 'BRANCH_IF_MONEY_GE', ['subexpr', 'u24', 's16'], 'branch');
    add(0x0b, 'BRANCH_IF_MONEY_LT', ['subexpr', 'u24', 's16'], 'branch');
    add(0x0c, 'WRITE_BIT_BASE_2258', ['u16', 'subexpr']);
    add(0x0d, 'WRITE_BIT_BASE_2834', ['u16', 'subexpr']);
    add(0x0e, 'WRITE_SCRIPT_ARG_BIT', ['u8', 'subexpr']);
    add(0x17, 'WRITE_WORD_FAST', ['u16', 'u16']);
    [0x10, 0x11, 0x14, 0x15, 0x18, 0x19, 0x1c, 0x1d].forEach((id) => add(id, 'WRITE_VALUE', ['u16', 'subexpr']));
    add(0x1a, 'WRITE_SCRIPT_ARG', ['u8', 'subexpr']);
    add(0x1b, 'WRITE_TWO_WORDS_FAST', ['u16', 'u16', 'u8', 'u8']);
    add(0x1e, 'WRITE_SCRIPT_ARG_ALT', ['u8', 'subexpr']);
    add(0x20, 'TELEPORT_BOTH', ['u8', 'u8']);
    add(0x22, 'CHANGE_MAP', ['u8', 'u8', 'u16']);
    add(0x26, 'WRITE_VRAM', []);
    add(0x27, 'FADE_OUT_SCREEN', []);
    add(0x29, 'CALL_24BIT_N', ['u24'], 'call');
    add(0x2a, 'FREEZE_ENTITY', ['subexpr']);
    add(0x2b, 'UNFREEZE_ENTITY', ['subexpr']);
    add(0x2c, 'SCRIPT_CALLER_CHECK', ['u8']);
    add(0x2d, 'SCRIPT_CALLER_CHECK_INVERSE', ['u8']);
    add(0x2e, 'WAIT_FOR_ENTITY_DEST', ['variant']);
    [0x30, 0x31, 0x32].forEach((id) => add(id, 'PLAY_SOUND_EFFECT', ['u8']));
    add(0x33, 'PLAY_MUSIC', ['u8']);
    add(0x38, 'YIELD', []);
    add(0x39, 'SLEEP_SUB', ['subexpr']);
    add(0x3a, 'YIELD_ALT', []);
    add(0x3b, 'SLEEP_SUB_ALT', ['subexpr']);
    add(0x3c, 'LOAD_NPC', ['u16', 'u16', 'u8', 'u8']);
    add(0x3d, 'SET_NPC_TALK_SCRIPT', ['subexpr', 'u16']);
    add(0x3f, 'SET_NPC_SCRIPT', ['variant']);
    add(0x42, 'TELEPORT_ENTITY_BYTE_COORDS', ['subexpr', 'u16']);
    add(0x43, 'TELEPORT_ENTITY_SUB_COORDS', ['subexpr', 'subexpr', 'subexpr']);
    [0x44, 0x45, 0x46, 0x47].forEach((id) => add(id, 'OPEN_MESSAGEBOX', ['u8', 'u8', 'u8', 'u8', 'u8']));
    [0x48, 0x49, 0x4a, 0x4b].forEach((id) => add(id, 'OPEN_DEFAULT_MESSAGEBOX', []));
    add(0x4d, 'NOP', []);
    add(0x4e, 'ATTACH_ENTITY_TO_SCRIPT', ['subexpr']);
    add(0x50, 'SHOW_TEXT_SLOT', ['u8', 'u16']);
    add(0x51, 'SHOW_TEXT_WINDOWED', ['u16']);
    add(0x52, 'SHOW_TEXT_UNWINDOWED', ['u16']);
    add(0x54, 'CLEAR_TEXT_SLOT', ['u8']);
    add(0x55, 'CLEAR_TEXT', []);
    add(0x58, 'FADE_IN_VOLUME', []);
    add(0x59, 'FADE_OUT_VOLUME', []);
    add(0x5a, 'CHECK_MESSAGE_TIMER', []);
    add(0x5b, 'CHECK_MESSAGE_TIMER_ALT', []);
    add(0x5c, 'SET_OBJECT_STATE', ['subexpr', 'subexpr']);
    add(0x5d, 'UNLOAD_OBJ_IF_FLAG', ['subexpr', 'u16']);
    add(0x62, 'COPY_UNKNOWN_DATA', ['u8', 'u16', 'u16']);
    add(0x63, 'SHOW_ALCHEMY_SELECTION', []);
    add(0x6c, 'UNTRACED_ENTITY_OP', ['subexpr', 'u8', 'u8']);
    add(0x6d, 'WALK_ENTITY_SUB', ['subexpr', 'subexpr', 'subexpr']);
    add(0x6e, 'WALK_ENTITY_BYTE', ['subexpr', 'u8', 'u8']);
    add(0x6f, 'WALK_ENTITY_SUB_DIRECT', ['subexpr', 'subexpr', 'subexpr']);
    add(0x70, 'ENTITY_FACE_ENTITY', ['subexpr', 'subexpr']);
    add(0x71, 'ENTITY_FACE_EACH_OTHER', ['subexpr', 'subexpr']);
    add(0x73, 'WALK_ENTITY_TO_SUB', ['subexpr', 'subexpr', 'subexpr']);
    [0x74, 0x75, 0x76, 0x77].forEach((id) => add(id, 'ENTITY_FACE_DIR', ['subexpr']));
    add(0x78, 'CHANGE_ENTITY_ANIM', ['subexpr', 'u16', 'subexpr']);
    add(0x79, 'CHANGE_ENTITY_ANIM_ALT', ['subexpr', 'u16', 'subexpr']);
    add(0x7a, 'WRITE_INDIRECT', ['subexpr', 'subexpr']);
    add(0x7c, 'GIVE_MONEY', ['subexpr', 'u24']);
    add(0x7d, 'TAKE_MONEY', ['subexpr', 'u24']);
    add(0x7e, 'EXCHANGE_MONEY', ['subexpr', 'subexpr', 'subexpr', 'subexpr']);
    add(0x7f, 'SHOW_TEXT_INPUT', ['u16']);
    add(0x80, 'UNHIDE_UNWINDOWED_TEXT', []);
    add(0x81, 'HIDE_UNWINDOWED_TEXT', []);
    add(0x82, 'SET_COLORS_OR_LAYERS', []);
    add(0x83, 'APPLY_VISIBLE_LAYERS', []);
    add(0x84, 'GIVE_MONEY_SUB', ['subexpr', 'subexpr']);
    add(0x85, 'TAKE_MONEY_SUB', ['subexpr', 'subexpr']);
    add(0x86, 'SET_AUDIO_VOLUME_SUB', ['subexpr']);
    add(0x87, 'SET_AUDIO_SPEED_SUB', ['subexpr']);
    add(0x88, 'CLEAR_SHOP_RING', []);
    add(0x89, 'ADD_SHOP_ITEM', ['subexpr', 'subexpr']);
    add(0x8a, 'MOVE_SHOP_MENU_TO_ENTITY', ['subexpr']);
    add(0x8c, 'SHOW_SAVE_MENU', ['u16']);
    add(0x8d, 'SCREEN_SHAKE', ['u8']);
    add(0x8e, 'BRANCH_IF_MONEY_GE_SUB', ['subexpr', 'subexpr', 's16'], 'branch');
    add(0x8f, 'BRANCH_IF_MONEY_LT_SUB', ['subexpr', 'subexpr', 's16'], 'branch');
    add(0x91, 'SET_BRIGHTNESS', ['subexpr']);
    [0x92, 0x93, 0x94, 0x95, 0xbb].forEach((id) => add(id, 'DAMAGE_OR_HEAL', ['subexpr', 'subexpr']));
    add(0x96, 'TELEPORT_PLAYER_SCREENS', ['subexpr', 'subexpr']);
    add(0x97, 'UNKNOWN_97', ['subexpr', 'subexpr', 'subexpr', 'subexpr', 'subexpr', 'subexpr', 'subexpr']);
    add(0x98, 'SWITCH_CHARACTER', ['subexpr']);
    add(0x99, 'WINDWALK', ['subexpr', 'subexpr', 'subexpr', 'subexpr', 'subexpr', 'subexpr']);
    add(0x9a, 'CHANGE_FONT', ['subexpr']);
    add(0x9b, 'DESTROY_ENTITY', ['subexpr']);
    add(0x9c, 'DECREMENT_ENTITY_SCRIPT_COUNTER', ['subexpr']);
    add(0x9d, 'WALK_ENTITY_TO_SUB_IGNORE_BARRIERS', ['subexpr', 'subexpr', 'subexpr']);
    add(0x9e, 'ALCHEMY_ATTACK', ['subexpr', 'subexpr', 'subexpr', 'targets']);
    add(0x9f, 'PREPARE_CURRENCY_DISPLAY', []);
    add(0xa0, 'SHOW_CURRENCY_AMOUNT', []);
    add(0xa1, 'HIDE_CURRENCY_AMOUNT', []);
    add(0xa2, 'SPAWN_NPC', ['u16', 'u16', 'subexpr', 'subexpr']);
    add(0xa3, 'CALL_SUB', ['u8'], 'call');
    add(0xa4, 'CALL_16BIT', ['u16'], 'call');
    add(0xa5, 'CALL_8BIT_NEG', ['s8'], 'call');
    add(0xa6, 'CALL_16BIT_REL', ['s16'], 'call');
    add(0xa7, 'SLEEP_8BIT', ['u8']);
    add(0xa8, 'SLEEP_16BIT', ['u16']);
    add(0xa9, 'UNKNOWN_A9', ['subexpr', 'subexpr']);
    add(0xaa, 'CLEAR_BOY_DOG_STATUS', []);
    add(0xab, 'RESET_GAME', [], 'reset');
    add(0xac, 'ALCHEMY_ATTACK_IF_DOG_ALIVE', ['subexpr', 'subexpr', 'subexpr', 'targets']);
    add(0xad, 'WRITE_TWO_TEMP_WORDS_FAST', ['u16', 'u16', 'u8', 'u8']);
    add(0xae, 'MODIFY_CURRENT_SCRIPT', ['u8', 'u8', 'u8', 'u8']);
    [0xaf, 0xb0, 0xb1, 0xb2, 0xb3, 0xb4].forEach((id) => add(id, 'CALL_WITH_ARGS', ['u8', 'subexpr*', 'target'], 'call'));
    add(0xb5, 'REVEAL_ENTITY', ['subexpr', 'subexpr', 'subexpr', 'subexpr', 'subexpr', 'subexpr', 'subexpr', 'subexpr']);
    add(0xb6, 'START_TILE_FLASH', ['subexpr', 'subexpr', 'subexpr', 'subexpr']);
    add(0xb7, 'STOP_TILE_FLASH', ['subexpr']);
    add(0xb9, 'TELEPORT_ENTITY_RELATIVE', ['subexpr', 'subexpr', 'subexpr']);
    add(0xba, 'LOAD_NPC_SHORT', ['u8', 'u8', 'u8']);
    add(0xbc, 'DISABLE_BOY', []);
    add(0xbd, 'ENABLE_BOY_PLAYER_CONTROL', []);
    add(0xbe, 'DISABLE_DOG', []);
    add(0xbf, 'ENABLE_DOG_PLAYER_CONTROL', []);
    add(0xc0, 'DISABLE_BOY_DOG', []);
    add(0xc1, 'ENABLE_BOY_DOG_PLAYER_CONTROL', []);
    add(0xc2, 'ADD_NPC_SPAWNER', ['u8', 'u8', 'u8']);

    return Object.freeze(r);
})();

function decodeFallbackOpcode(romBuf, addressSnes, addressRom, opcode, readU8, readU16, readU24, readS16, hex) {
    let size = 1;
    let summary = OPCODE_REGISTRY[opcode] ? OPCODE_REGISTRY[opcode].name : `OP 0x${hex(opcode, 2)}`;

    const consumeSub = (rom) => parseSubExpression(romBuf, rom, readU8, readU16);

    switch (opcode) {
        case 0x05: {
            size = 2;
            const jmp = readU8(romBuf, addressRom + 1) - 0x100;
            const target = addressSnes + jmp;
            summary = `SKIP ${jmp} (to 0x${hex(target, 6)})`;
            break;
        }
        case 0x08:
        case 0x09: {
            let next = addressRom + 1;
            const cond = consumeSub(next); next = cond.nextRom;
            const jump = readS16(romBuf, next); next += 2;
            size = next - addressRom;
            const target = addressSnes + size + jump;
            const condText = cond.text ? cond.text : 'cond';
            summary = `IF ${opcode === 0x09 ? 'NOT ' : ''}(${condText}) SKIP ${jump} (to 0x${hex(target, 6)})`;
            break;
        }
        case 0x07:
            size = 4;
            summary = `CALL 0x${hex(readU24(romBuf, addressRom + 1), 6)}`;
            break;
        case 0x0a:
        case 0x0b: {
            let next = addressRom + 1;
            const cond = consumeSub(next); next = cond.nextRom;
            const amount = readU24(romBuf, next); next += 3;
            const jump = readS16(romBuf, next); next += 2;
            size = next - addressRom;
            const target = addressSnes + size + jump;
            summary = `IF MONEY ${opcode === 0x0a ? '>=' : '<'} ${amount} SKIP ${jump} (to 0x${hex(target, 6)})`;
            break;
        }
        case 0x0d:
        case 0x0e:
        case 0x10:
        case 0x11:
        case 0x14:
        case 0x15:
        case 0x17:
        case 0x19:
        case 0x1a:
        case 0x1c:
        case 0x1d:
        case 0x1e:
        case 0x2a:
        case 0x2b:
        case 0x39:
        case 0x3b:
        case 0x4e:
        case 0x5c:
        case 0x5d:
        case 0x6c:
        case 0x6d:
        case 0x6e:
        case 0x6f:
        case 0x70:
        case 0x71:
        case 0x73:
        case 0x74:
        case 0x75:
        case 0x76:
        case 0x77:
        case 0x78:
        case 0x79:
        case 0x7a:
        case 0x7c:
        case 0x7d:
        case 0x7e:
        case 0x84:
        case 0x85:
        case 0x87:
        case 0x89:
        case 0x8a:
        case 0x8e:
        case 0x8f:
        case 0x91:
        case 0x92:
        case 0x93:
        case 0x94:
        case 0x95:
        case 0x96:
        case 0x97:
        case 0x98:
        case 0x99:
        case 0x9a:
        case 0x9b:
        case 0x9c:
        case 0x9d:
        case 0x9e:
        case 0xac:
        case 0xa2:
        case 0xa9:
        case 0x43:
        case 0xaf:
        case 0xb0:
        case 0xb1:
        case 0xb2:
        case 0xb3:
        case 0xb4:
        case 0xb5:
        case 0xb6:
        case 0xb7:
        case 0xb9: {
            let next = addressRom + 1;
            const subCountByOpcode = {
                0x2a: 1, 0x2b: 1, 0x39: 1, 0x3b: 1, 0x4e: 1,
                0x5c: 2, 0x5d: 1,
                0x6c: 1, 0x6e: 1,
                0x6d: 3, 0x6f: 3, 0x70: 2, 0x71: 2, 0x73: 3, 0x9d: 3,
                0x43: 3,
                0x74: 1, 0x75: 1, 0x76: 1, 0x77: 1,
                0x78: 2, 0x79: 2, 0x7a: 2,
                0x7c: 1, 0x7d: 1, 0x7e: 4,
                0x84: 2, 0x85: 2, 0x87: 1, 0x89: 2, 0x8a: 1,
                0x8e: 2, 0x8f: 2,
                0x91: 1,
                0x92: 2, 0x93: 2, 0x94: 2, 0x95: 2, 0xbb: 2,
                0x96: 2, 0x97: 7, 0x98: 1, 0x99: 6, 0x9a: 1, 0x9b: 1, 0x9c: 1,
                0x9e: 3, 0xac: 3,
                0xa2: 2, 0xa9: 2,
                0xb5: 8, 0xb6: 4, 0xb7: 1, 0xb9: 3,
            };

            if (opcode === 0x0d || opcode === 0x10 || opcode === 0x11 || opcode === 0x14 || opcode === 0x15 || opcode === 0x18 || opcode === 0x19 || opcode === 0x1c || opcode === 0x1d) {
                next += 2;
                const sub = consumeSub(next); next = sub.nextRom;
            } else if (opcode === 0x0e || opcode === 0x1a || opcode === 0x1e) {
                next += 1;
                const sub = consumeSub(next); next = sub.nextRom;
            } else if (opcode === 0x5d) {
                const a = consumeSub(next); next = a.nextRom;
                next += 2;
            } else if (opcode === 0x6c || opcode === 0x6e) {
                const a = consumeSub(next); next = a.nextRom;
                next += 2;
            } else if (opcode === 0x78 || opcode === 0x79) {
                const a = consumeSub(next); next = a.nextRom;
                next += 2;
                const b = consumeSub(next); next = b.nextRom;
            } else if (opcode === 0x7c || opcode === 0x7d) {
                const a = consumeSub(next); next = a.nextRom;
                next += 3;
            } else if (opcode === 0x8e || opcode === 0x8f) {
                const a = consumeSub(next); next = a.nextRom;
                const b = consumeSub(next); next = b.nextRom;
                next += 2;
            } else if (opcode === 0x97) {
                for (let i = 0; i < 7; i++) {
                    const a = consumeSub(next); next = a.nextRom;
                }
            } else if (opcode === 0x9e || opcode === 0xac) {
                for (let i = 0; i < 3; i++) {
                    const a = consumeSub(next); next = a.nextRom;
                }
                for (let i = 0; i < 32; i++) {
                    const target = consumeSub(next); next = target.nextRom;
                    const num = parseNumberLiteral(target.text);
                    if (!Number.isNaN(num) && num === 0) break;
                }
            } else if (opcode === 0xa2) {
                next += 4;
                const x = consumeSub(next); next = x.nextRom;
                const y = consumeSub(next); next = y.nextRom;
            } else if (opcode === 0xaf || opcode === 0xb0 || opcode === 0xb1 || opcode === 0xb2 || opcode === 0xb3 || opcode === 0xb4) {
                const argc = readU8(romBuf, next); next += 1;
                for (let i = 0; i < argc; i++) {
                    const a = consumeSub(next); next = a.nextRom;
                }
                if (opcode === 0xb0 || opcode === 0xb2) next += 1;
                else if (opcode === 0xb1 || opcode === 0xb3) next += 2;
                else next += 3;
            } else {
                const n = subCountByOpcode[opcode] || 1;
                for (let i = 0; i < n; i++) {
                    const a = consumeSub(next); next = a.nextRom;
                }
            }

            size = next - addressRom;
            summary = OPCODE_REGISTRY[opcode] ? OPCODE_REGISTRY[opcode].name : summary;
            break;
        }
        case 0x2e: {
            const type = readU8(romBuf, addressRom + 1);
            if (type === 0x8d || type === 0x88) size = 4;
            else if (subinstrIsEntityOnly(type) || sub1bIsVal(type)) size = 2;
            else if (type === 0x84) size = 4;
            else if (type === 0x92) size = 3;
            else if (type === 0x04 && readU8(romBuf, addressRom + 4) === 0x29 && (readU8(romBuf, addressRom + 5) === 0x08 || readU8(romBuf, addressRom + 5) === 0x0d) && readU8(romBuf, addressRom + 8) === 0x9a) size = 9;
            else {
                const sub = consumeSub(addressRom + 1);
                size = sub.nextRom - addressRom;
            }
            break;
        }
        case 0x3c:
            size = 7;
            break;
        case 0x3d: {
            const a = consumeSub(addressRom + 1);
            size = (a.nextRom - addressRom) + 2;
            break;
        }
        case 0x3f: {
            const type = readU8(romBuf, addressRom + 1);
            if (sub1bIsVal(type)) size = 6;
            else {
                const a = consumeSub(addressRom + 1);
                size = (a.nextRom - addressRom) + 4;
            }
            break;
        }
        case 0x42: {
            const a = consumeSub(addressRom + 1);
            size = (a.nextRom - addressRom) + 2;
            break;
        }
        case 0x86:
            size = 2;
            summary = `SET AUDIO volume to 0x${hex(readU8(romBuf, addressRom + 1), 2)}`;
            break;
        case 0xba:
            size = 4;
            break;
        case 0xbc:
        case 0xbd:
        case 0xbe:
        case 0xbf:
        case 0xc0:
        case 0xc1:
            size = 1;
            break;
        case 0xc2:
            size = 4;
            break;
        default:
            return null;
    }

    return { size, summary, supported: true };
}

module.exports = {
    OPCODE_REGISTRY,
    decodeFallbackOpcode,
};
