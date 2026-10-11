'use strict';

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
  return `
    function playMenuSound(id) {
      try {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(function() {});
        }
        const t = audioCtx.currentTime;
        if (id === 'wheel_turn') {
          // SFX 0x02: Menu wheel turn - ratchet double click
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1760, t);
          osc.frequency.exponentialRampToValueAtTime(880, t + 0.025);
          gain.gain.setValueAtTime(0.22, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(t);
          osc.stop(t + 0.03);
        } else if (id === 'wheel_open') {
          // SFX 0x04: Menu wheel open - resonant rising chime
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, t);
          osc.frequency.exponentialRampToValueAtTime(1760, t + 0.07);
          gain.gain.setValueAtTime(0.28, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(t);
          osc.stop(t + 0.12);
        } else if (id === 'wheel_close') {
          // SFX 0x06: Menu wheel close - downward latch click
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(920, t);
          osc.frequency.exponentialRampToValueAtTime(240, t + 0.038);
          gain.gain.setValueAtTime(0.22, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.042);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(t);
          osc.stop(t + 0.045);
        } else if (id === 'click_nav') {
          // SFX 0x38: Click 1 - crisp cursor tick
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(2400, t);
          gain.gain.setValueAtTime(0.12, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(t);
          osc.stop(t + 0.015);
        } else if (id === 'click_toggle') {
          // SFX 0x3A: Click 2 - soft value toggle
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1400, t);
          gain.gain.setValueAtTime(0.18, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(t);
          osc.stop(t + 0.025);
        } else if (id === 'click_confirm') {
          // SFX 0x44: Click 3 / Loot - 3-note arpeggiated confirm ping
          [587, 880, 1174].forEach(function(freq, i) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            const start = t + i * 0.028;
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.2, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.06);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(start);
            osc.stop(start + 0.065);
          });
        }
      } catch (err) {
        // audioCtx suspended or not supported
      }
    }
  `;
}

module.exports = { getMenuSoundScript };
