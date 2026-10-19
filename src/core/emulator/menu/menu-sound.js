// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';

const { pageFile } = require('../page-file');

/**
 * emulator/menu/menu-sound.js
 *
 * Owns: sound synthesis for Secret of Evermore menu audio effects.
 * Uses Web Audio API AudioContext to produce authentic clicks, chimes,
 * and latch sounds matching Evermore SFX IDs 0x02, 0x04, 0x06, 0x38, 0x3A, 0x44.
 *
 * Strictly ASCII-only.
 */

function getMenuSoundScript() {
  return pageFile('menu-sound.js');
}

module.exports = { getMenuSoundScript };

