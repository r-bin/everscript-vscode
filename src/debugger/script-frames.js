'use strict';

/**
 * debugger/script-frames.js
 *
 * Turns an emulator stop snapshot into DAP threads and stack frames, and a
 * step request into the stop predicate the emulator evaluates. Pure.
 *
 * Engine model (Secret of Evermore script interpreter, verified headless):
 *  - Scripts run in slots at $7E28FC (20 x 0x4F bytes): +0x00 address (24
 *    bit), +0x03 state (2 run, 4 wait, 0 free), +0x0B parent slot pointer,
 *    +0x0D entity, +0x0F arguments (16 words).
 *  - A script call (opcode 0x29 and friends) starts the callee in a new slot
 *    whose +0x0B points back at the caller, and suspends the caller; the
 *    callee's end (0x00) resumes the slot in +0x0B. So call depth is the
 *    +0x0B chain, and "step over a call" is "run until this slot runs again".
 *  - The interpreter fetches every opcode at $8C:D0A6 with the instruction's
 *    address in $82-$84 and the running slot's pointer in $7E.
 *
 * Snapshot (from the emulator):
 *   { reason, slot: running slot pointer | null, address: SNES address | null,
 *     slots: [{ index, ptr, loc, state, parent, entity, timer, args: [16 words] }] }
 */

const { romOffset } = require('./source-map');

const STATE_RUN = 2;
const STATE_WAIT = 4;

function hex(value, width) {
    return (value >>> 0).toString(16).toUpperCase().padStart(width, '0');
}

function isLive(slot) {
    return slot.state === STATE_RUN || slot.state === STATE_WAIT;
}

/** Leaf slots (a running or waiting script nobody is waiting on), plus the stopped one. */
function liveThreads(snapshot) {
    const live = snapshot.slots.filter(slot => isLive(slot) || slot.ptr === snapshot.slot);
    const parents = new Set(live.map(slot => slot.parent).filter(Boolean));
    return live.filter(slot => !parents.has(slot.ptr) || slot.ptr === snapshot.slot);
}

function threadId(slot) {
    return slot.index + 1;
}

/** Where a slot is: the running slot at the live address, others at their saved one. */
function slotAddress(snapshot, slot) {
    return slot.ptr === snapshot.slot && snapshot.address != null ? snapshot.address : slot.loc;
}

function scriptName(map, address) {
    const fn = map && map.functionAt(romOffset(address));
    return fn ? fn.name : 'script $' + hex(address, 6);
}

function threadName(map, snapshot, slot) {
    const state = slot.ptr === snapshot.slot ? '' : slot.state === STATE_WAIT ? ' (waiting)' : '';
    return 'slot ' + slot.index + ': ' + scriptName(map, slotAddress(snapshot, slot)) + state;
}

/**
 * Stack frames of a thread, innermost first: { name, file, line, address, slot }.
 * `level` is how deep into the inline chain the stopped slot is shown;
 * suspended callers show their whole chain at the call (saved address - 1).
 */
function threadFrames(map, snapshot, leaf, level) {
    const frames = [];
    const byPtr = new Map(snapshot.slots.map(slot => [slot.ptr, slot]));
    const seen = new Set();
    let slot = leaf;
    let first = true;
    while (slot && !seen.has(slot.ptr) && frames.length < 64) {
        seen.add(slot.ptr);
        const address = slotAddress(snapshot, slot);
        const lookup = first ? address : address - 1;
        const chain = map ? map.chainAt(romOffset(lookup)) : null;
        if (chain) {
            const depth = first && level != null ? Math.min(level, chain.length - 1) : chain.length - 1;
            for (let i = depth; i >= 0; i--) {
                frames.push({ name: chain[i].function, file: chain[i].file, line: chain[i].line, address, slot });
            }
        } else {
            frames.push({ name: 'script $' + hex(address, 6), file: null, line: 0, address, slot });
        }
        first = false;
        slot = slot.parent ? byPtr.get(slot.parent) : null;
    }
    return frames;
}

/** [start, end) of the compiled function at an address: a slot never leaves it (calls get a new slot). */
function functionScope(map, address) {
    const fn = map ? map.functionAt(romOffset(address)) : null;
    return fn ? [fn.address, fn.address + fn.size] : null;
}

/**
 * The stop predicate for a step, evaluated by the emulator at every opcode
 * fetch: stop when `slot` runs outside `ranges`, when `parent` runs again
 * (the script returned), or - stepping in - when a script called by `slot`
 * starts. Outside compiled code the step runs to the slot's next instruction.
 *
 * A slot is reused once its script ends (or a room change drops it): `scope`
 * and `parentScope` are the functions those slots were running, and a slot
 * running anywhere else is somebody else's script, not the end of the step.
 *
 * @param kind 'over' | 'in' | 'out'
 */
function stepPredicate(map, snapshot, slot, level, kind) {
    const address = romOffset(slotAddress(snapshot, slot));
    const chain = map ? map.chainAt(address) : null;
    const parent = slot.parent ? snapshot.slots.find(s => s.ptr === slot.parent) : null;
    let ranges = [];
    if (chain) {
        const depth = Math.min(level, chain.length - 1);
        if (kind === 'out') ranges = depth > 0 ? map.rangesAt(address, depth - 1) : null;
        else ranges = map.rangesAt(address, depth);
    } else if (kind !== 'out') {
        ranges = [[address, address + 1]];
    }
    return {
        slot: slot.ptr,
        scope: functionScope(map, address),
        parent: slot.parent || 0,
        parentScope: parent ? functionScope(map, parent.loc - 1) : null,
        ranges: ranges || [],
        into: kind === 'in',
        // stepping out of the outermost level only stops in the caller
        callerOnly: ranges === null,
    };
}

/**
 * Stepping into an inlined call needs no execution: the same address shows
 * one level deeper. Returns that level, or null when the step must run.
 */
function inlineStepInLevel(map, snapshot, slot, level) {
    const chain = map ? map.chainAt(romOffset(slotAddress(snapshot, slot))) : null;
    return chain && level < chain.length - 1 ? level + 1 : null;
}

/** The level a stop is shown at: a breakpoint's own line, else where the statement starts. */
function stopLevel(map, snapshot, breakpointLines) {
    if (!map || snapshot.address == null) return 0;
    const offset = romOffset(snapshot.address);
    const chain = map.chainAt(offset);
    if (!chain) return 0;
    if (snapshot.reason === 'breakpoint' && breakpointLines) {
        const level = chain.findIndex(loc => breakpointLines.has(loc.file + ':' + loc.line));
        if (level >= 0) return level;
    }
    return map.entryLevel(offset);
}

/** Variables describing a script slot. */
function slotVariables(slot, byPtr) {
    const parent = slot.parent ? byPtr.get(slot.parent) : null;
    const state = slot.state === STATE_RUN ? 'running' : slot.state === STATE_WAIT ? 'waiting' : 'free';
    return [
        { name: 'slot', value: String(slot.index) + '  ($7E' + hex(slot.ptr, 4) + ')' },
        { name: 'state', value: state },
        { name: 'address', value: '$' + hex(slot.loc, 6) },
        { name: 'entity', value: '0x' + hex(slot.entity, 4) },
        { name: 'caller', value: parent ? 'slot ' + parent.index : 'none' },
        { name: 'timer', value: String(slot.timer) },
    ];
}

/** arg[0x00]..arg[0x1E] as words, the way scripts address them. */
function argVariables(slot) {
    return slot.args.map((word, i) => ({
        name: 'arg[0x' + hex(i * 2, 2) + ']',
        value: '0x' + hex(word, 4) + '  (' + word + ')',
    }));
}

module.exports = {
    liveThreads,
    threadId,
    threadName,
    threadFrames,
    slotAddress,
    stepPredicate,
    inlineStepInLevel,
    stopLevel,
    slotVariables,
    argVariables,
};
