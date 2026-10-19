// TODO port to TS (docs/todo/port-to-ts.md)
// Save states taken while a movie replays headless (tools/cdl/replay.js --states), and loading one to resume.
//
// A state is the core's whole saveState() buffer (about 530 KB, mostly zeros, so ~100 KB gzipped). It holds ROM-derived
// memory, so states live next to the movie, outside git (.gitignore: *.states/). One is taken at a frame boundary
// BEFORE that boundary's events apply, so resuming at frame K just continues the loop at K.
//   f<frame, 9 digits>-r<room hex>.state.gz     the state
//   index.json                                  { core, rom, states: [{ frame, room, file }] }
// Determinism was checked at v0.215.0 (state at frame 1200 + the movie's rest = the uninterrupted run, in all memory spaces,
// in place and on a freshly booted core); tests/debugger/tas-states.test.js repeats it on every run.
'use strict';
/* global HEAPU8 -- the core's heap view, a global once replay.js has loaded the core */
const fs = require('fs'), path = require('path'), zlib = require('zlib');

// Restoring a state taken while the game is still booting (frame 1) does not reproduce the run (WRAM and ARAM differ:
// part of the SPC700 start-up is not in the saved state); from frame 30 on every tested state does. Be safe: none before 600.
const MIN_FRAME = 600;
const ROOM_ADDR = 0x7E0ADB;   // CURRENT_MAP_ID (knowledge/ram/7e0adb.md)
const stateName = (frame, room) => 'f' + String(frame).padStart(9, '0') + '-r' + (room & 0xFF).toString(16).padStart(2, '0') + '.state.gz';

/** The frame a state file was taken at, from its name. */
function frameOfStateFile(file) {
    const m = /^f(\d{9})-r[0-9a-f]{2}\.state\.gz$/.exec(path.basename(file));
    if (!m) throw new Error('not a state file name: ' + file);
    return parseInt(m[1], 10);
}

function takeState(M) {
    const size = M._getStateSaveSize();
    const ptr = M._saveState();
    if (!ptr) throw new Error('saveState failed');
    return Buffer.from(HEAPU8.slice(ptr, ptr + size));
}

/** Loads a state file into the (booted) core; returns the frame it was taken at. */
function loadStateFile(M, file) {
    const raw = zlib.gunzipSync(fs.readFileSync(file));
    if (raw.length !== M._getStateSaveSize()) throw new Error('state size ' + raw.length + ' does not fit this core');
    const ptr = M._my_malloc(raw.length);
    HEAPU8.set(raw, ptr);
    const ok = M._loadState(ptr, raw.length);
    M._my_free(ptr);
    if (!ok) throw new Error('loadState refused ' + file);
    return frameOfStateFile(file);
}

class StateWriter {
    /**
     * @param {string} dir
     * @param {{ spacing?: number, every?: number, core?: string, rom?: string }} opts
     *   spacing  minimum frames between two states taken at a room change (default 3600 = 60 s of game time)
     *   every    also take one every N frames (0 = only on room changes)
     */
    constructor(dir, opts = {}) {
        this.dir = dir;
        this.spacing = opts.spacing == null ? 3600 : opts.spacing;
        this.every = opts.every || 0;
        this.index = { core: opts.core || '', rom: opts.rom || '', states: [] };
        this.lastFrame = -Infinity;
        this.lastRoom = -1;
        fs.mkdirSync(dir, { recursive: true });
    }

    /** Call at every frame boundary, before its events apply. */
    consider(M, frame) {
        if (frame < MIN_FRAME) return;
        const room = M.readMemory(ROOM_ADDR);
        const roomChanged = room !== this.lastRoom && frame - this.lastFrame >= this.spacing;
        const due = this.every > 0 && frame % this.every === 0;
        if (!roomChanged && !due) return;
        const file = stateName(frame, room);
        fs.writeFileSync(path.join(this.dir, file), zlib.gzipSync(takeState(M), { level: 6 }));
        this.index.states.push({ frame, room, file });
        this.lastFrame = frame;
        this.lastRoom = room;
    }

    finish() {
        fs.writeFileSync(path.join(this.dir, 'index.json'), JSON.stringify(this.index, null, 1));
        return this.index.states.length;
    }
}

module.exports = { MIN_FRAME, StateWriter, loadStateFile, frameOfStateFile, takeState, ROOM_ADDR };
