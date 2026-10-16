// Ownership: one-time initialization of the radar panel's top-level tab strip.
//
// The Rooms tab's left rail — group collapse, area collapse, search, room
// selection, the `+ New Map` footer and exit-link navigation — moved to
// rooms-rail.js in Phase 7b. This file owns the tab strip and nothing else.

// ── Tab switching ─────────────────────────────────────────────────────────────
// Posts tabChange so the host can preserve the active tab across re-renders.
document.querySelectorAll('.tab').forEach(function(btn){
  btn.addEventListener('click',function(){
    document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('tab-active');});
    btn.classList.add('tab-active');
    var tab=btn.dataset.tab;
    document.querySelectorAll('.tab-pane').forEach(function(p){
      p.style.display=p.dataset.tab===tab?'flex':'none';
    });
    if(vs)vs.postMessage({command:'tabChange',tab:tab});
  });
});
