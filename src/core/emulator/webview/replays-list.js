// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';

/**
 * emulator/webview/replays-list.js
 *
 * The rows of the REPLAYS pause-menu tab (the tab's other half, recording and replay, is
 * ../tas-view.js). Loaded as a file before the panel's inline script; its functions run later.
 *
 * Every row is a .menu-row of the pause menu, so Up / Down jumps from row to row like in any
 * other tab (menu/menu-view.js). Rows, top to bottom:
 *   - "Take over" (only while a replay runs) and "Open recordings folder": B does it;
 *   - one row per recording of this ROM (pinned first): when it was recorded, how long it is,
 *     and whether it replays in sync. The file name is only in the tooltip.
 * On a recording row Left / Right choose favourite, play or delete; B does it. Favourite
 * toggles at once; play and delete ask first (B again does it, A or moving away cancels).
 * A click on an action is the same as choosing it and pressing B.
 *
 * Whether a recording syncs is written into the recording by the host (tas/host.ts): the first
 * desync of a replay ("# desync:") stays for good, a full replay without one adds "# synced:".
 */

const REPLAY_ACTS = ['pin', 'play', 'delete'];
const replayChoice = new Map();   // recording id -> index into REPLAY_ACTS (default play)
let replayPending = null;         // { id, act } waiting for a second B

function replayEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** 12345 frames -> "3:25", over an hour "1:02:05". */
function replayLength(frames) {
  const total = Math.round((frames || 0) / 60.0988);
  const h = Math.floor(total / 3600), m = Math.floor(total / 60) % 60, s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h ? h + ':' + String(m).padStart(2, '0') + ':' + ss : m + ':' + ss;
}

function replayWhen(it) {
  const d = new Date(it.meta && it.meta.started ? it.meta.started : it.mtime);
  if (isNaN(d.getTime())) return '?';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** { cls, text } for the sync column. */
function replaySync(it) {
  if (it.recording) return { cls: 'rec', text: 'recording now' };
  const desync = it.meta && it.meta.desync;
  if (desync) {
    const frame = parseInt(desync, 10);
    return { cls: 'bad', text: 'desync' + (frame >= 0 ? ' at ' + replayLength(frame) : '') };
  }
  if (it.meta && it.meta.synced) return { cls: 'ok', text: 'synced' };
  return { cls: 'dim', text: 'not replayed yet' };
}

function replayFlags(it) {
  const flags = [];
  if (it.coreMatch === false) flags.push('other core');
  if ((it.warnings || []).length || (it.meta && it.meta.cheats === 'yes')) flags.push('cheats');
  if (it.meta && it.meta.source) flags.push('branch');
  return flags;
}

function replayRowHtml(it, playingId) {
  const id = it.id;
  const playing = playingId === id;
  const choice = replayChoice.has(id) ? replayChoice.get(id) : 1;
  const pending = replayPending && replayPending.id === id ? replayPending.act : '';
  const sync = replaySync(it);
  const flags = replayFlags(it);
  const tip = [it.name, it.meta && it.meta.desync ? 'desync: frame ' + it.meta.desync : '', it.meta && it.meta.source ? 'branch of ' + it.meta.source : '']
    .concat(it.warnings || []).filter(Boolean).join('\n');
  const act = (i, label, extra) => {
    const name = REPLAY_ACTS[i];
    const asking = pending === name;
    return '<button type="button" class="rp-act rp-' + name + (choice === i ? ' focus' : '') + (asking ? ' asking' : '') + '" data-act="' + name + '"' + (extra || '') + '>'
      + (asking ? name + '? B' : label) + '</button>';
  };
  return '<div class="menu-row rp-row' + (playing ? ' playing' : '') + '" data-kind="replay" data-id="' + replayEsc(id) + '"'
    + (it.recording ? ' data-recording="1"' : '') + ' title="' + replayEsc(tip) + '">'
    + act(0, it.pinned ? '&#9733;' : '&#9734;', it.pinned ? ' data-on="1"' : '')
    + '<span class="rp-when">' + replayEsc(replayWhen(it)) + '</span>'
    + '<span class="rp-len">' + replayLength(it.frames) + '</span>'
    + '<span class="rp-sync"><span class="' + sync.cls + '">' + (pending ? 'B: ' + pending + ', A: cancel' : sync.text) + '</span>'
    + (flags.length && !pending ? ' &middot; <span class="rp-flags">' + flags.join(' &middot; ') + '</span>' : '') + '</span>'
    + act(1, playing ? 'restart' : 'play')
    + act(2, 'delete', it.recording ? ' disabled' : '')
    + '</div>';
}

function replayCommandRow(kind, label, pill) {
  return '<div class="menu-row" data-kind="' + kind + '">'
    + '<div class="menu-row-label"><span class="menu-row-cursor">&gt;</span> ' + label + '</div>'
    + '<div class="menu-row-value"><span class="menu-action-pill">[B] ' + pill + '</span></div></div>';
}

/**
 * The tab's rows. items: the host's list (tas/host.ts list()); playingId: the recording being
 * replayed, or null.
 */
function replaysListHtml(items, playingId) {
  const mine = items.filter(it => it.romMatch === true || it.recording);
  const others = items.length - mine.length;
  const pinned = mine.filter(it => it.pinned), rest = mine.filter(it => !it.pinned);
  let html = '';
  if (playingId) html += replayCommandRow('takeover', 'Take over (keyboard plays on, still recording)', 'Take over');
  html += replayCommandRow('reveal', 'Open recordings folder', 'Open');
  if (pinned.length) html += '<div class="rp-group">FAVOURITES</div>' + pinned.map(it => replayRowHtml(it, playingId)).join('');
  html += '<div class="rp-group">RECORDINGS</div>' + (rest.length ? rest.map(it => replayRowHtml(it, playingId)).join('')
    : '<div id="tas-empty">No recordings of this ROM yet: play and press some buttons.</div>');
  if (others) html += '<div class="rp-group">' + others + ' recording' + (others === 1 ? '' : 's') + ' of other ROMs not listed</div>';
  return html;
}

function replayRows() {
  const list = document.getElementById('tas-list');
  return list ? Array.from(list.querySelectorAll('.menu-row')) : [];
}

/** Left / Right on a row: choose the action (clamped). Returns true when something changed. */
function replaysStep(rowIdx, delta) {
  const row = replayRows()[rowIdx];
  if (!row || row.getAttribute('data-kind') !== 'replay') return false;
  const id = row.getAttribute('data-id');
  const max = row.hasAttribute('data-recording') ? 1 : REPLAY_ACTS.length - 1;
  const at = replayChoice.has(id) ? replayChoice.get(id) : 1;
  const next = Math.max(0, Math.min(max, at + delta));
  replayPending = null;
  if (next === at) return false;
  replayChoice.set(id, next);
  return true;
}

/**
 * B on a row. Returns { act, id } to carry out now, { ask: act } when it waits for a second B,
 * or null. Acts: 'takeover', 'reveal', 'pin', 'play', 'delete'.
 */
function replaysActivate(rowIdx, actOverride) {
  const row = replayRows()[rowIdx];
  if (!row) return null;
  const kind = row.getAttribute('data-kind');
  if (kind !== 'replay') { replayPending = null; return { act: kind }; }
  const id = row.getAttribute('data-id');
  if (actOverride) replayChoice.set(id, REPLAY_ACTS.indexOf(actOverride));
  const act = REPLAY_ACTS[replayChoice.has(id) ? replayChoice.get(id) : 1];
  if (act === 'delete' && row.hasAttribute('data-recording')) return null;
  if (act === 'pin') { replayPending = null; return { act, id, on: !row.querySelector('.rp-pin[data-on]') }; }
  if (replayPending && replayPending.id === id && replayPending.act === act) { replayPending = null; return { act, id, recording: row.hasAttribute('data-recording') }; }
  replayPending = { id, act };
  return { ask: act };
}

/** A (or moving to another row): drop a pending question. Returns true when there was one. */
function replaysCancel() {
  if (!replayPending) return false;
  replayPending = null;
  return true;
}

/** Index of the row an element is in, or -1. */
function replaysRowIndex(el) {
  const row = el && el.closest ? el.closest('.menu-row') : null;
  return row ? replayRows().indexOf(row) : -1;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { replaysListHtml, replaysStep, replaysActivate, replaysCancel, replayLength, replaySync };
}
