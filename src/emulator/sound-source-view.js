'use strict';

/**
 * emulator/sound-source-view.js
 *
 * Page side: who sent each sound effect, for the radar's Music tab, and the
 * marks on the screen that point at it.
 *
 * Every command reaches the sound driver through $8C:81FD (A = command, Y =
 * parameter; the only routine that writes the ports outside the IPL upload).
 * While the Music tab streams the sound chip, a non-pausing exec breakpoint
 * there records each $04 (sound effect): the effect (Y) and who called. Sound
 * effects go $8C:82DC -> $8C:831D -> JSL $8C:81FD, so the JSL return address at
 * S+1 is $8C:8327 and the real caller's is at S+4. Verified on the vanilla
 * intro (the Boy's swing $07, the Dog's bark $10):
 *   bank $90   the animation command `sound n` ($90:8921 / $90:894E). It pushed
 *              its entity (PHY) before the JSL: S+7..8 = entity pointer.
 *   $8C:D6D3   the script opcode 0x30 ($8C:D6BD): $82-$84 points past its operand.
 *   anything else: engine code (the ring menu, ...), named by its address.
 * They ride along with the next apuFrame as `src`.
 *
 *   page -> apuFrame { ..., src: [{ sfx, kind: 'anim'|'script'|'engine', entity, name, x, y, script, slot, caller }] }
 *   host -> { command: 'apuPoint', entity, label }   mark an entity until pointed elsewhere (entity 0 = none)
 *
 * Needs the custom core's debugger API (addExecBreakpoint, getCPUState);
 * without it nothing is recorded. Invariant: ASCII only and no backslashes
 * (embedded in a template literal, see panel-webview.js).
 */

const SOUND_SEND = 0x8C81FD;
const SFX_TAIL = 0x8C8327;     // return address of $8C:831D's JSL $8C:81FD

function getSoundSourceClientScript() {
  return `
    const SND_SEND = ${SOUND_SEND};
    const SND_SFX_TAIL = ${SFX_TAIL};
    const SND_PING_FRAMES = 75;
    let sndArmed = false;
    let sndEvents = [];
    let sndPings = [];
    let sndPoint = null;
    let sndFrame = 0;

    // Without onBreakpointHit (the debugger bridge) a breakpoint would pause the game.
    function sndCanHook(m) {
      return !!m && typeof m.addExecBreakpoint === 'function' && typeof m.removeExecBreakpoint === 'function' &&
        typeof m.getCPUState === 'function' && typeof m.onBreakpointHit === 'function';
    }

    // Armed exactly while the Music tab streams (apuStreamTick calls this every frame).
    function sndSync(m, want) {
      if (!sndCanHook(m) || want === sndArmed) return;
      if (want) m.addExecBreakpoint(SND_SEND); else m.removeExecBreakpoint(SND_SEND);
      sndArmed = want;
      if (!want) { sndEvents = []; sndPings = []; }
    }

    function sndWord(m, a) { return m.readMemory(a) | (m.readMemory(a + 1) << 8); }

    function sndEntityName(m, addr) {
      if (addr === 0x4E89) return 'Boy';
      if (addr === 0x4F37) return 'Dog';
      try {
        const type = sndWord(m, 0x7E0000 + addr + 0x60);
        const rom = loadedRomData && ((loadedRomData.length % 1024 === 512) ? loadedRomData.subarray(512) : loadedRomData);
        if (rom && type >= 0x8000 && typeof decodeEntityName === 'function') {
          const name = decodeEntityName(rom, readRom24(rom, snesToRom(0x8E0000 | type)), type);
          if (name) return name;
        }
      } catch (e) { /* fall through */ }
      return 'entity $' + addr.toString(16).toUpperCase();
    }

    function sndSigned(v) { return v >= 0x8000 ? v - 0x10000 : v; }

    // onBreakpointHit for SND_SEND: record a sound effect and keep running.
    function sndOnHit(m) {
      try {
        const cpu = m.getCPUState();
        if ((cpu.a & 0xFF) !== 0x04) return false;
        const sp = cpu.sp & 0xFFFF;
        const stack = k => m.readMemory(0x7E0000 + ((sp + k) & 0xFFFF));
        const ret = k => ((stack(k + 2) << 16) | (stack(k + 1) << 8) | stack(k)) + 1;
        let at = 1, caller = ret(1);
        if (caller === SND_SFX_TAIL) { at = 4; caller = ret(4); }
        const ev = { sfx: cpu.y & 0xFF, kind: 'engine', caller: caller };
        const ent = stack(at + 3) | (stack(at + 4) << 8);
        if ((caller >> 16) === 0x90 && ent >= 0x3000 && ent < 0x6000) {
          ev.kind = 'anim';
          ev.entity = ent;
          ev.name = sndEntityName(m, ent);
          ev.x = sndSigned(sndWord(m, 0x7E0000 + ent + 0x1A));
          ev.y = sndSigned(sndWord(m, 0x7E0000 + ent + 0x1C));
          sndPings.push({ entity: ent, sfx: ev.sfx, birth: sndFrame });
        } else if (caller >= 0x8CD6B0 && caller < 0x8CD6E0) {
          ev.kind = 'script';
          ev.script = ((m.readMemory(0x7E0084) << 16) | sndWord(m, 0x7E0082)) - 2;
          ev.slot = sndWord(m, 0x7E007E);
        }
        if (sndEvents.length < 32) sndEvents.push(ev);
      } catch (e) { /* never stop the game for this */ }
      return false;
    }

    // Called once per emulated frame by apuStreamTick: the events since the last frame.
    function sndTake(paused) {
      if (!paused) sndFrame++;
      const out = sndEvents;
      sndEvents = [];
      return out;
    }

    window.addEventListener('message', evt => {
      const d = evt.data;
      if (!d || d.command !== 'apuPoint') return;
      sndPoint = d.entity ? { entity: d.entity, label: String(d.label || '') } : null;
    });

    // Drawn with the triggers overlay: a ring that fades around an entity that just
    // made a sound, and a steady one around the entity the Music tab points at.
    function sndDraw(ctx, layout, preState) {
      sndPings = sndPings.filter(p => sndFrame - p.birth < SND_PING_FRAMES);
      if ((!sndPings.length && !sndPoint) || !preState || !preState.entBuf || !layout) return;
      const buf = preState.entBuf;
      const at = addr => {
        const rel = addr - 0x3DDF;
        if (rel < 0 || rel + 0x20 > buf.length) return null;
        const x = sndSigned(buf[rel + 0x1A] | (buf[rel + 0x1B] << 8));
        const y = sndSigned(buf[rel + 0x1C] | (buf[rel + 0x1D] << 8));
        return { x: layout.emuX + (x - layout.camX) * layout.scaleSnes, y: layout.emuY + (y - layout.camY - 12) * layout.scaleSnes };
      };
      const s = layout.scaleSnes;
      ctx.save();
      ctx.lineWidth = Math.max(1, Math.round(2 * s));
      ctx.font = 'bold ' + Math.round(9 * s) + 'px sans-serif';
      for (const p of sndPings) {
        const pos = at(p.entity);
        if (!pos) continue;
        const k = (sndFrame - p.birth) / SND_PING_FRAMES;
        ctx.strokeStyle = 'rgba(245, 158, 11, ' + (1 - k).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(pos.x, pos.y, (10 + k * 10) * s, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(253, 230, 138, ' + (1 - k).toFixed(2) + ')';
        ctx.fillText('sfx $' + p.sfx.toString(16).toUpperCase().padStart(2, '0'), pos.x + 12 * s, pos.y - 10 * s);
      }
      if (sndPoint) {
        const pos = at(sndPoint.entity);
        if (pos) {
          ctx.strokeStyle = '#3794ff';
          ctx.setLineDash([4 * s, 3 * s]);
          ctx.beginPath(); ctx.arc(pos.x, pos.y, 14 * s, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#9cdcfe';
          ctx.fillText(sndPoint.label, pos.x + 16 * s, pos.y - 12 * s);
        }
      }
      ctx.restore();
    }
  `;
}

module.exports = { getSoundSourceClientScript, SOUND_SEND };
