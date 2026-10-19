import { pageFile } from './page-file';

/**
 * emulator/sound-source-view.ts
 *
 * Page side: who sent each sound effect, for the radar's Music tab, and the
 * marks on the screen that show it (the SOUNDS chip switches them).
 *
 * Every command reaches the sound driver through $8C:81FD (A = command, Y =
 * parameter; the only routine that writes the ports outside the IPL upload).
 * While sounds are shown or the Music tab streams, a non-pausing exec
 * breakpoint there records each $04 (sound effect): the effect (Y) and who
 * called. Sound effects go $8C:82DC -> $8C:831D -> JSL $8C:81FD, so the JSL
 * return address at S+1 is $8C:8327 and the real caller's is at S+4. Verified
 * on the vanilla intro (the Boy's swing $07, the Dog's bark $10):
 *   bank $90   the animation command `sound n` ($90:8921 / $90:894E). It pushed
 *              its entity (PHY) before the JSL: S+7..8 = entity pointer. [$5D] is
 *              the animation script past the operand: the command is at [$5D] - 2.
 *   $8C:D6D3   the script opcode 0x30 ($8C:D6BD): $82-$84 points past its operand.
 *   anything else: engine code (the ring menu, ...), named by its address.
 * A $30 (pitch offset for the next effect, 1/20 semitone; animation commands
 * 0x3F / 0x40 send it) is kept and attached to the effect that follows.
 * They ride along with the next apuFrame as `src`.
 *
 *   page -> apuFrame { ..., src: [{ sfx, kind: 'anim'|'script'|'engine', entity, type, name, at, sprite, pal, script, slot, caller, pitch }] }
 *   host -> { command: 'apuPoint', entity, label }   mark an entity until pointed elsewhere (entity 0 = none)
 *   host -> { command: 'apuSfxNames', names }        sound-effect names by driver id (for the marks)
 *
 * Needs the custom core's debugger API (addExecBreakpoint, getCPUState);
 * without it nothing is recorded. Invariant: ASCII only and no backslashes
 * (embedded in a template literal, see panel-webview.ts).
 */

const SOUND_SEND = 0x8C81FD;
const SFX_TAIL = 0x8C8327;     // return address of $8C:831D's JSL $8C:81FD

/** The overlay bar's chip. */
function getSoundChipHtml() {
  return '<button id="screen-sound-toggle" class="screen-chip" data-needs="game" type="button" title="Show which entity makes each sound (and record who sent it for the Music tab)">SOUNDS OFF</button>';
}

function getSoundSourceClientScript() {
  return pageFile('sound-source.js', { SND_SEND: SOUND_SEND, SND_SFX_TAIL: SFX_TAIL });
}

export { getSoundSourceClientScript, getSoundChipHtml, SOUND_SEND };
