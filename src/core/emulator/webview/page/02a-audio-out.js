// TODO port to TS (docs/todo/port-to-ts.md)

    // -- Audio -----------------------------------------------------------------
    // The fork core mixes one frame of sound per _mainLoop(): AUDIO_FREQ / 60 samples
    // (exports.c S9xSoundCallback). audioTakeFrame() moves them into audioRing right after
    // the frame, and a ScriptProcessorNode plays the ring a block at a time. The ring keeps
    // AUDIO_TARGET samples in reserve and plays up to AUDIO_MAX_SKEW faster or slower to stay
    // there: the frame loop runs on the display's clock and the sound card on its own, and the
    // two never agree exactly (a 59.94 Hz screen makes 0.1% too few samples). When it runs dry
    // anyway, it fades out and waits for a full reserve again instead of playing every frame
    // that trickles in. Before this the node read the core's buffer directly with no reserve,
    // so every few blocks it ran short and played a gap: choppy sound on Windows.
    // The vanilla core fills its buffer its own way (2048-sample halves), so it keeps the direct read.
    const AUDIO_FREQ       = 44100;
    const AUDIO_BLOCK_SIZE = 2048;                      // the core's getSoundBuffer() block, and the node's
    const AUDIO_FRAME_SAMPLES = Math.floor(AUDIO_FREQ / 60);
    const AUDIO_RING_SIZE  = 16384;
    const AUDIO_TARGET     = 2 * AUDIO_BLOCK_SIZE;      // samples in reserve when a block starts (~93 ms)
    const AUDIO_MAX_SKEW   = 0.005;                     // 0.5%: too little to hear as pitch
    const AUDIO_FADE       = 64;                        // samples to fade out over when the ring runs dry

    let audioCtx  = null;
    let audioNode = null;
    let audioResumeHandlersInstalled = false;
    const audioRing = audioRingNew(AUDIO_RING_SIZE);

    // A stereo ring. w and r count samples since the start; r is fractional (the rate stretch).
    // fade: samples left of the fade-out from lastL / lastR after running dry.
    function audioRingNew(size) {
      return { L: new Float32Array(size), R: new Float32Array(size), size: size, w: 0, r: 0, priming: true, lastL: 0, lastR: 0, fade: 0 };
    }

    function audioRingClear(ring) {
      ring.r = ring.w;
      ring.priming = true;
      ring.fade = 0;
    }

    // outL/outR from index `from` on: the rest of the fade-out, then silence.
    function audioRingFade(ring, outL, outR, from) {
      for (let j = from; j < outL.length; j++) {
        const g = ring.fade > 0 ? --ring.fade / AUDIO_FADE : 0;
        outL[j] = ring.lastL * g;
        outR[j] = ring.lastR * g;
      }
    }

    // n samples of planar L/R in; when full, the oldest are dropped (fast forward).
    function audioRingPush(ring, srcL, srcR, n) {
      for (let i = 0; i < n; i++) {
        const k = (ring.w + i) % ring.size;
        ring.L[k] = srcL[i];
        ring.R[k] = srcR[i];
      }
      ring.w += n;
      if (ring.w - ring.r > ring.size - 1) ring.r = ring.w - (ring.size - 1);
    }

    // Fills outL/outR (one block); returns how many samples came from the ring.
    function audioRingPull(ring, outL, outR, target, maxSkew) {
      const n = outL.length;
      const fill = ring.w - ring.r;
      if (ring.priming && fill < target) {
        audioRingFade(ring, outL, outR, 0);
        return 0;
      }
      ring.priming = false;
      const skew = Math.max(-maxSkew, Math.min(maxSkew, maxSkew * (fill - target) / target));
      const step = 1 + skew;
      let pos = ring.r;
      let i = 0;
      for (; i < n; i++) {
        const k = Math.floor(pos);
        if (k + 1 >= ring.w) break;
        const f = pos - k;
        const a = k % ring.size, b = (k + 1) % ring.size;
        outL[i] = ring.L[a] + (ring.L[b] - ring.L[a]) * f;
        outR[i] = ring.R[a] + (ring.R[b] - ring.R[a]) * f;
        pos += step;
      }
      ring.r = Math.min(pos, ring.w);
      if (i > 0) { ring.lastL = outL[i - 1]; ring.lastR = outR[i - 1]; }
      if (i < n) {
        ring.priming = true;
        ring.fade = AUDIO_FADE;
        audioRingFade(ring, outL, outR, i);
      }
      return i;
    }

    // The fork core: its getSoundBuffer() hands out what is buffered (zero-padded), so taking it
    // after every frame leaves the core empty and yields exactly that frame's samples.
    function audioFromFrames(m) {
      return !!m && typeof m._getSoundBuffer === 'function' && typeof m._takeInputPolled === 'function';
    }

    // After every _mainLoop() that emulated a frame.
    function audioTakeFrame(m) {
      if (!audioFromFrames(m)) return;
      const ptr = m._getSoundBuffer();
      if (!ptr) return;
      const n = AUDIO_FRAME_SAMPLES;
      const src = new Float32Array(HEAPF32.buffer, ptr, AUDIO_BLOCK_SIZE * 2);
      audioRingPush(audioRing, src.subarray(0, n), src.subarray(AUDIO_BLOCK_SIZE, AUDIO_BLOCK_SIZE + n), n);
    }

    // After a frame that must stay silent (a continue catching up): empty the core's buffer.
    function audioDropFrame(m) {
      if (audioFromFrames(m)) m._getSoundBuffer();
    }

    function audioReset() {
      audioRingClear(audioRing);
    }

    function ensureAudioRunning() {
      if (!audioCtx || audioCtx.state === 'running') return;
      audioCtx.resume().catch(err => {
        vscodeApi.postMessage({ command: 'ejsError', error: 'Audio resume failed: ' + err.message });
      });
    }

    function installAudioResumeHandlers() {
      if (audioResumeHandlersInstalled) return;
      audioResumeHandlersInstalled = true;
      const wakeAudio = () => ensureAudioRunning();
      window.addEventListener('pointerdown', wakeAudio, { passive: true });
      window.addEventListener('keydown', wakeAudio, true);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') wakeAudio();
      });
    }

    // The vanilla core: one 2048-sample block straight from its buffer.
    function audioPullDirect(m, L, R) {
      const ptr = m._getSoundBuffer();
      if (!ptr) { L.fill(0); R.fill(0); return; }
      const samples = new Float32Array(HEAPF32.buffer, ptr, AUDIO_BLOCK_SIZE * 2);
      for (let i = 0; i < AUDIO_BLOCK_SIZE; i++) {
        L[i] = samples[i];
        R[i] = samples[i + AUDIO_BLOCK_SIZE];
      }
    }

    function initAudio() {
      if (audioCtx) {
        ensureAudioRunning();
        return;
      }
      try {
        audioCtx  = new AudioContext({ sampleRate: AUDIO_FREQ });
        installAudioResumeHandlers();
        // ScriptProcessorNode is deprecated but reliable in VS Code WebViews
        // (AudioWorklet requires a Worker context that can be blocked by CSP).
        audioNode = audioCtx.createScriptProcessor(AUDIO_BLOCK_SIZE, 0, 2);
        audioNode.onaudioprocess = function(e) {
          const L = e.outputBuffer.getChannelData(0);
          const R = e.outputBuffer.getChannelData(1);
          const m = getModule();
          try {
            if (!romLoaded || emuMuted || !m || typeof m._getSoundBuffer !== 'function') {
              L.fill(0);
              R.fill(0);
              audioRingClear(audioRing);
            } else if (audioFromFrames(m)) {
              audioRingPull(audioRing, L, R, AUDIO_TARGET, AUDIO_MAX_SKEW);
            } else {
              audioPullDirect(m, L, R);
            }
          } catch (_) {
            L.fill(0);
            R.fill(0);
          }
        };
        audioNode.connect(audioCtx.destination);
        ensureAudioRunning();
      } catch (err) {
        vscodeApi.postMessage({ command: 'ejsError', error: 'Audio init failed: ' + err.message });
      }
    }

