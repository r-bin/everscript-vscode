// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the Characters tab's seek bar (in ticks, a mark per frame spaced by its hold, snapping
// to frame starts) and the current sprite's link to its soe:// page.

  // The seek bar runs in ticks: each frame takes as much of it as it holds, and dragging snaps
  // to the start of the frame under the knob.
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
  function renderScrubTicks() {
    if (!scrubTicks) return;
    var total = scrubTotal();
    scrubTicks.innerHTML = total ? frameStartTicks.map(function(t, i) {
      return '<i style="left:calc(7px + (100% - 14px) * ' + (t / total) + ')" title="Frame ' + (i + 1) + ' · tick ' + t + '"></i>';
    }).join('') : '';
  }
  if (scrubber) {
    scrubber.addEventListener('input', function() {
      currentFrameIdx = frameAtTick(parseInt(scrubber.value, 10) || 0);
      tickCounter = 0;
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

