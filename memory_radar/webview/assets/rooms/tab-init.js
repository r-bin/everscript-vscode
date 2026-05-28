// Ownership: one-time initialization of the Rooms tab UI.
// Runs on page load. Wires tab switching, area collapse, live/vanilla mode toggle,
// and room click handlers. Does not depend on room detail rendering.

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

// ── Area node collapse / expand ───────────────────────────────────────────────
document.querySelectorAll('.rn-area-label').forEach(function(lbl){
  lbl.addEventListener('click',function(){
    var li=lbl.closest('li.rn-area');
    if(li)li.classList.toggle('collapsed');
  });
});

// ── Live / Vanilla mode toggle ────────────────────────────────────────────────
var _vanillaMode=false;
(function(){
  var btnLive    =document.getElementById('rmm-live');
  var btnVanilla =document.getElementById('rmm-vanilla');
  var liveTree   =document.getElementById('rm-live-tree');
  var vanTree    =document.getElementById('rm-vanilla-tree');

  function setMode(vanilla){
    _vanillaMode=vanilla;
    btnLive.classList.toggle('active',!vanilla);
    btnVanilla.classList.toggle('active',vanilla);
    liveTree.style.display=vanilla?'none':'';
    vanTree.style.display=vanilla?'':'none';
    document.getElementById('room-detail').className='rm-detail-placeholder';
    document.getElementById('room-detail').innerHTML='<span>Select a room</span>';
  }

  if(btnLive)   btnLive.addEventListener('click',   function(){setMode(false);});
  if(btnVanilla)btnVanilla.addEventListener('click', function(){setMode(true);});

  // Vanilla room click — show ROM-backed detail
  document.querySelectorAll('.vn-map').forEach(function(li){
    li.addEventListener('click',function(){
      document.querySelectorAll('.rn-map.rsel,.vn-map.rsel').forEach(function(x){x.classList.remove('rsel');});
      li.classList.add('rsel');
      var vid=li.dataset.vid;
      var room=VANILLA_ROOM_DETAILS&&VANILLA_ROOM_DETAILS[vid];
      if(room)renderRoomDetail(room);
    });
  });
})();

// ── Live room click ───────────────────────────────────────────────────────────
document.querySelectorAll('.rn-map').forEach(function(li){
  li.addEventListener('click',function(){
    document.querySelectorAll('.rn-map.rsel').forEach(function(x){x.classList.remove('rsel');});
    li.classList.add('rsel');
    var mapName=li.dataset.map;
    var room=ROOMS[mapName];
    if(!room)return;
    renderRoomDetail(room);
  });
});
