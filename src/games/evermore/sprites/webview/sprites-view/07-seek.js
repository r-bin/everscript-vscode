// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the Characters tab's seek bar (in ticks: a segment per frame, as long as it holds; the
// knob moves with time and can be dropped anywhere, the stage shows the frame under it) and the
// current sprite's link to its soe:// page.
  function frameAtTick(t) {
    var i = 0;
    for (var k = 0; k < frameStartTicks.length; k++) if (frameStartTicks[k] <= t) i = k;
    return i;
  }
  function scrubTotal() {
    var n = currentAnimData ? currentAnimData.frames.length : 0;
    if (!n) return 0;
    return frameStartTicks[n - 1] + Math.max(1, currentAnimData.frames[n - 1].ticks) + flightTail;
  }
  /** One segment per frame, aligned with the knob's travel (its centre runs 7px in from each end). */
  function renderScrubTicks() {
    if (!scrubTicks) return;
    var total = scrubTotal();
    var n = currentAnimData ? currentAnimData.frames.length : 0;
    scrubTicks.innerHTML = total ? frameStartTicks.map(function(t, i) {
      var end = i + 1 < n ? frameStartTicks[i + 1] : total;
      return '<i class="sp-seg' + (i % 2 ? ' sp-seg-odd' : '') + '" data-seg="' + i + '" style="left:calc(7px + (100% - 14px) * ' + (t / total) +
        ');width:calc((100% - 14px) * ' + ((end - t) / total) + ')" title="Frame ' + (i + 1) + ' · ticks ' + t + '–' + end + '"></i>';
    }).join('') : '';
  }
  /** The knob at the playing tick, and the frame under it lit. */
  function syncScrub() {
    if (!scrubber || !currentAnimData || !currentAnimData.frames.length) return;
    scrubber.value = String(Math.min(scrubTotal(), (frameStartTicks[currentFrameIdx] || 0) + tickCounter));
    if (scrubTicks) scrubTicks.querySelectorAll('.sp-seg').forEach(function(s) { s.classList.toggle('sp-seg-on', +s.dataset.seg === currentFrameIdx); });
  }
  if (scrubber) {
    scrubber.addEventListener('input', function() {
      var t = parseFloat(scrubber.value) || 0;
      currentFrameIdx = frameAtTick(t);
      tickCounter = t - (frameStartTicks[currentFrameIdx] || 0);
      updateFrameUI();
    });
  }

  /** A sprite opens as its soe:// page (soe://rom/assets/sprites/<address>/). */
  function openSprite(addr) {
    if (addr && vsApi) vsApi.postMessage({ command: 'openVfs', uri: 'soe://rom/assets/sprites/' + addr.toString(16).padStart(6, '0') + '/' });
  }
  if (spriteAddrLink) {
    spriteAddrLink.addEventListener('click', function() {
      var f = currentAnimData && currentAnimData.frames[currentFrameIdx];
      if (f) openSprite(f.spriteAddr);
    });
  }

