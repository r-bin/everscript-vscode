'use strict';
// Ownership: a music track played silently in the tab's own engine (blargg's
// SPC700 + S-DSP, engine/spc-engine.js) on the host, for the Scripts tab's
// player: which notes each of the 8 voices plays, and when. No audio: the
// samples the engine makes are dropped.
//
// The driver is booted as $8C:801F does (driver, then package 0), the track
// started as $8C:828F does (webview/music-engine.js), and the chip sampled
// once per frame (1/60 s). A note starts where a voice's envelope rises from
// near silence or its pitch or sample changes while it sounds; it ends where
// the envelope falls silent. Notes are cut at `seconds`.
//
// The engine's view has no key-on bit (its "keyed" byte is envelope > 0), so a
// retriggered note that never falls silent is seen only by its envelope
// jumping up. A pitch change under half a semitone is vibrato, not a new note.
//
// Also: the sequence the package carries, read from its records. Package P
// writes the sequence's ARAM address into `$2EB6 + 2P` (2 bytes; measured over
// every music package) and uploads the sequence there: a header (track count, then one 2-byte pointer per track)
// and one record per track (everscript docs/audio_music_sound_formats.md;
// docs/todo/audio-and-music.md §1.1). The track bytes' opcodes are not
// decoded yet, so the bytes are returned as they are.

const createSpcEngine = require('../engine/spc-engine.js');
const { MusicSpc } = require('../webview/music-engine.js');
const { buildMusicModel, packageData } = require('./catalog');

const CLOCKS_PER_FRAME = Math.round(1024000 / 60);
const DSP = 32;
const SILENT = 4;          // ENVX at or below this is not a sounding note
const VIBRATO = 0.5;       // semitones a sounding voice may wander and stay one note
const POINTER_TABLE = 0x2EB6;
const MAX_SECONDS = 180;

/** Per-voice { srcn, pitch, envx } from the engine's 224-byte view. */
function voicesOf(view) {
    const out = [];
    for (let v = 0; v < 8; v++) {
        const b = DSP + v * 16;
        out.push({ srcn: view[b + 4], pitch: (view[b + 2] | view[b + 3] << 8) & 0x3FFF, envx: view[b + 8] & 0x7F });
    }
    return out;
}

/** Semitones from the sample's own rate (pitch $1000), one decimal. */
const semitones = (pitch) => pitch ? Math.round(120 * Math.log2(pitch / 0x1000)) / 10 : null;

/**
 * Plays music `id` for `seconds` with no sound.
 * @returns Promise<{ id, name, package, seconds, frames, notes: [{ v, f0, f1, srcn, pitch, semi, peak }], error? }>
 *   f0/f1 are frame numbers (60 per second), f1 exclusive.
 */
async function trackTimeline(rom, id, seconds = 60) {
    const model = buildMusicModel(rom);
    if (model.error) return { id, error: model.error };
    const track = model.music[id];
    if (!track) return { id, error: 'No music $' + Number(id).toString(16) };
    const frames = Math.round(Math.max(1, Math.min(MAX_SECONDS, Number(seconds) || 60)) * 60);
    const spc = new MusicSpc(await createSpcEngine());
    spc.boot(model.driver, packageData(rom, 0));
    spc.playMusic(id, packageData(rom, track.package));

    const notes = [];
    const open = new Array(8).fill(null);
    let prev = null;
    for (let f = 0; f < frames; f++) {
        spc.run(CLOCKS_PER_FRAME);
        const vs = voicesOf(spc.view());
        for (let v = 0; v < 8; v++) {
            const cur = vs[v];
            const was = prev ? prev[v] : null;
            const sounding = cur.envx > SILENT;
            let n = open[v];
            const restart = n && sounding && (cur.srcn !== n.srcn
                || Math.abs(12 * Math.log2((cur.pitch || 1) / (n.pitch || 1))) >= VIBRATO
                || (was && cur.envx > was.envx + 16 && was.envx < 48));
            if (n && (!sounding || restart)) { n.f1 = f; notes.push(n); open[v] = n = null; }
            if (!n && sounding) open[v] = n = { v, f0: f, f1: f + 1, srcn: cur.srcn, pitch: cur.pitch, semi: semitones(cur.pitch), peak: cur.envx };
            if (n) { n.f1 = f + 1; if (cur.envx > n.peak) n.peak = cur.envx; }
        }
        prev = vs;
    }
    for (const n of open) if (n) notes.push(n);
    notes.sort((a, b) => a.f0 - b.f0 || a.v - b.v);
    return { id, name: track.name, package: track.package, seconds: frames / 60, frames, notes };
}

/**
 * The sequence a music package uploads: { pointerAt, start, header, tracks: [{ index, aram, bytes }] }
 * or null when the package has no pointer record.
 */
function trackSequence(rom, id) {
    const model = buildMusicModel(rom);
    if (model.error || !model.music[id]) return null;
    const recs = packageData(rom, model.music[id].package);
    const pointerAt = POINTER_TABLE + 2 * model.music[id].package;
    const ptr = recs.find((r) => r.dest === pointerAt && r.bytes.length === 2);
    if (!ptr) return null;
    const start = ptr.bytes[0] | ptr.bytes[1] << 8;
    const header = recs.find((r) => r.dest === start);
    if (!header || !header.bytes.length) return null;
    const count = header.bytes[0];
    const pointers = [];
    for (let i = 0; i < count; i++) pointers.push(header.bytes[1 + 2 * i] | header.bytes[2 + 2 * i] << 8);
    const tracks = pointers.map((aram, index) => {
        const rec = recs.find((r) => r.dest === aram);
        return { index, aram, bytes: rec ? rec.bytes : [] };
    });
    return { pointerAt, start, header: header.bytes, tracks };
}

module.exports = { trackTimeline, trackSequence };
