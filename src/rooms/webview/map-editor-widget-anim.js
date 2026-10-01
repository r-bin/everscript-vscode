// Ownership: animation timeline and playback for Widget Editor Mode.
// Owns playback rAF timer, seek bar scrubbing, frame addition/removal,
// and delay settings. Consumes map-editor-widget-edit.js.

var _widgetPlaying = false;
var _widgetPlayTimer = null;

function widgetTogglePlay() {
  if (_widgetPlaying) widgetStopPlay();
  else widgetStartPlay();
}

function widgetStartPlay() {
  var w = _widgetEdit && widgetFind(_widgetEdit.widget);
  if (!w) return;
  var v = widgetCurrentVar(w);
  if (!v || v.frames.length < 2) {
    if (typeof editNote === 'function') editNote('add more frames to play an animation');
    return;
  }
  widgetCommitCanvas();
  _widgetPlaying = true;
  var lastNow = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  var elapsed = 0;

  function loop(now) {
    if (!_widgetPlaying) return;
    var dt = Math.min(now - lastNow, 250);
    lastNow = now;
    elapsed += dt;
    var curF = v.frames[_widgetFrameIdx] || v.frames[0];
    var delayMs = Math.max(16, (curF.delay || 8) * (1000 / 60));
    if (elapsed >= delayMs) {
      elapsed = 0;
      _widgetFrameIdx = (_widgetFrameIdx + 1) % v.frames.length;
      widgetApplyFrameToCanvas(v.frames[_widgetFrameIdx]);
      widgetSyncTimelineScrubber();
    }
    _widgetPlayTimer = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame(loop)
      : setTimeout(function () { loop(Date.now()); }, 16);
  }

  _widgetPlayTimer = (typeof requestAnimationFrame === 'function')
    ? requestAnimationFrame(loop)
    : setTimeout(function () { loop(Date.now()); }, 16);
  widgetSyncTimeline();
}

function widgetStopPlay() {
  if (!_widgetPlaying) return;
  _widgetPlaying = false;
  if (_widgetPlayTimer) {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(_widgetPlayTimer);
    else clearTimeout(_widgetPlayTimer);
    _widgetPlayTimer = null;
  }
  widgetSyncTimeline();
}

/** Scrub or step to a frame. */
function widgetSelectFrame(idx) {
  var w = _widgetEdit && widgetFind(_widgetEdit.widget);
  if (!w) return;
  var v = widgetCurrentVar(w);
  if (!v || !v.frames.length) return;
  widgetStopPlay();
  widgetCommitCanvas();
  _widgetFrameIdx = Math.max(0, Math.min(idx, v.frames.length - 1));
  widgetApplyFrameToCanvas(v.frames[_widgetFrameIdx]);
  widgetSyncTimeline();
  if (typeof renderEditChrome === 'function') renderEditChrome();
  if (typeof editNote === 'function') editNote('frame ' + (_widgetFrameIdx + 1) + ' of ' + v.frames.length);
}

function widgetAddFrame(cloneCurrent) {
  var w = _widgetEdit && widgetFind(_widgetEdit.widget);
  if (!w) return;
  var v = widgetCurrentVar(w);
  if (!v) return;
  widgetStopPlay();
  widgetCommitCanvas();
  var curF = widgetCurrentFrame(w);
  var newCells = (cloneCurrent && curF && curF.cells) ? JSON.parse(JSON.stringify(curF.cells)) : [];
  var newDelay = (curF && curF.delay) || 8;
  v.frames.push({ cells: newCells, delay: newDelay });
  _widgetFrameIdx = v.frames.length - 1;
  widgetApplyFrameToCanvas(v.frames[_widgetFrameIdx]);
  widgetSyncTimeline();
  if (typeof renderEditChrome === 'function') renderEditChrome();
  widgetStore(w);
  if (typeof editNote === 'function') editNote('added frame ' + (_widgetFrameIdx + 1) + ' of ' + v.frames.length);
}

function widgetRemoveFrame(idx) {
  var w = _widgetEdit && widgetFind(_widgetEdit.widget);
  if (!w) return;
  var v = widgetCurrentVar(w);
  if (!v || v.frames.length <= 1) return;
  widgetStopPlay();
  v.frames.splice(idx, 1);
  if (_widgetFrameIdx >= v.frames.length) _widgetFrameIdx = v.frames.length - 1;
  widgetApplyFrameToCanvas(v.frames[_widgetFrameIdx]);
  widgetSyncTimeline();
  if (typeof renderEditChrome === 'function') renderEditChrome();
  widgetStore(w);
  if (typeof editNote === 'function') editNote('removed frame; ' + v.frames.length + ' frame' + (v.frames.length === 1 ? '' : 's') + ' left');
}

function widgetSetDelay(ticks) {
  var w = _widgetEdit && widgetFind(_widgetEdit.widget);
  if (!w) return;
  var f = widgetCurrentFrame(w);
  if (!f) return;
  f.delay = Math.max(1, Math.min(255, Number(ticks) | 0));
  var msEl = document.getElementById('rg-seek-ms');
  if (msEl) msEl.textContent = '(' + Math.round(f.delay * (1000 / 60)) + 'ms)';
  widgetStore(w);
}

function widgetSeekTo(val) {
  widgetSelectFrame(val);
}

/** The floating bottom timeline / seek bar for animation frames. */
function widgetEditTimelineHtml() {
  if (!_widgetEdit) return '';
  var w = widgetFind(_widgetEdit.widget);
  var v = widgetCurrentVar(w);
  var frames = (v && v.frames) || [{ delay: 8 }];
  var count = frames.length;
  var idx = Math.min(_widgetFrameIdx, count - 1);
  var curF = frames[idx] || { delay: 8 };
  var delay = curF.delay || 8;
  var ms = Math.round(delay * (1000 / 60));

  return '<div class="rg-widget-timeline" id="rg-widget-timeline">'
    + '<button class="rg-seek-btn rg-seek-play' + (_widgetPlaying ? ' on' : '') + '" data-widget-seek="play"'
    + ' title="' + (_widgetPlaying ? 'Pause animation (Space)' : 'Play animation (Space)') + '">'
    + (_widgetPlaying
      ? '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>'
      : '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M4 2.5v11l9-5.5z"/></svg>')
    + '</button>'
    + '<button class="rg-seek-btn" data-widget-seek="prev" title="Previous frame (◀)"' + (idx <= 0 ? ' disabled' : '') + '>◀</button>'
    + '<span class="rg-seek-count" id="rg-seek-count">' + (idx + 1) + ' / ' + count + '</span>'
    + '<button class="rg-seek-btn" data-widget-seek="next" title="Next frame (▶)"' + (idx >= count - 1 ? ' disabled' : '') + '>▶</button>'
    + '<input type="range" class="rg-seek-slider" id="rg-seek-slider" min="0" max="' + (count - 1) + '" value="' + idx
    + '" title="Scrub through animation frames" ' + (count <= 1 ? 'disabled' : '') + '/>'
    + '<div class="rg-seek-delay-wrap" title="Delay before showing next tile (in 60Hz ticks; 60 ticks = 1 second)">'
    + '<label for="rg-seek-delay">Delay:</label>'
    + '<input type="number" id="rg-seek-delay" class="rg-seek-delay" min="1" max="255" value="' + delay + '"/>'
    + '<span class="rg-seek-ticks">ticks</span>'
    + '<span class="rg-seek-ms" id="rg-seek-ms">(' + ms + 'ms)</span>'
    + '</div>'
    + '<div class="rg-seek-divider"></div>'
    + '<button class="rg-seek-btn rg-seek-act" data-widget-seek="add" title="Add blank animation frame">+ Frame</button>'
    + '<button class="rg-seek-btn rg-seek-act" data-widget-seek="clone" title="Clone current frame into new frame">⧉ Clone</button>'
    + (count > 1 ? '<button class="rg-seek-btn rg-seek-act rg-seek-del" data-widget-seek="del" title="Delete this frame">✕</button>' : '')
    + '</div>';
}

function widgetSyncTimeline() {
  var el = document.getElementById('rg-widget-timeline');
  if (!el) return;
  var w = _widgetEdit && widgetFind(_widgetEdit.widget);
  var v = widgetCurrentVar(w);
  var frames = (v && v.frames) || [{ delay: 8 }];
  var count = frames.length;
  var idx = Math.min(_widgetFrameIdx, count - 1);
  var curF = frames[idx] || { delay: 8 };
  var delay = curF.delay || 8;
  var ms = Math.round(delay * (1000 / 60));

  var cntEl = document.getElementById('rg-seek-count');
  if (cntEl) cntEl.textContent = (idx + 1) + ' / ' + count;
  var slider = document.getElementById('rg-seek-slider');
  if (slider) {
    slider.max = String(count - 1);
    slider.value = String(idx);
    slider.disabled = (count <= 1);
  }
  var delayInp = document.getElementById('rg-seek-delay');
  if (delayInp) delayInp.value = String(delay);
  var msEl = document.getElementById('rg-seek-ms');
  if (msEl) msEl.textContent = '(' + ms + 'ms)';
  var playBtn = el.querySelector('.rg-seek-play');
  if (playBtn) {
    playBtn.className = 'rg-seek-btn rg-seek-play' + (_widgetPlaying ? ' on' : '');
    playBtn.title = _widgetPlaying ? 'Pause animation (Space)' : 'Play animation (Space)';
    playBtn.innerHTML = _widgetPlaying
      ? '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>'
      : '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M4 2.5v11l9-5.5z"/></svg>';
  }
}

function widgetSyncTimelineScrubber() {
  var w = _widgetEdit && widgetFind(_widgetEdit.widget);
  var v = widgetCurrentVar(w);
  var count = (v && v.frames && v.frames.length) || 1;
  var cntEl = document.getElementById('rg-seek-count');
  if (cntEl) cntEl.textContent = (_widgetFrameIdx + 1) + ' / ' + count;
  var slider = document.getElementById('rg-seek-slider');
  if (slider) slider.value = String(_widgetFrameIdx);
}

function widgetInputHandler(e) {
  if (!e || !e.target) return false;
  if (e.target.id === 'rg-seek-slider') {
    widgetSeekTo(Number(e.target.value));
    return true;
  }
  if (e.target.id === 'rg-seek-delay') {
    widgetSetDelay(Number(e.target.value));
    return true;
  }
  return false;
}

function widgetAnimKey(e) {
  if (typeof widgetEditing !== 'function' || !widgetEditing() || !e) return false;
  if (e.key === ' ') {
    widgetTogglePlay();
    return true;
  }
  if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
    if (e.key === 'ArrowLeft') { widgetSelectFrame(_widgetFrameIdx - 1); return true; }
    if (e.key === 'ArrowRight') { widgetSelectFrame(_widgetFrameIdx + 1); return true; }
  }
  return false;
}
