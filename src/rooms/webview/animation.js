// Ownership: play the Section 2 tile animation over the rendered map, through the
// shared player. Owns the room's player handle and the enemy idle animations.
//
// The host sends one small transparent PNG per frame per block of animated
// cells (src/games/evermore/maps/animation.ts). Channels run on independent schedules — the
// hardware gives each its own frame delay and there is no common period — so
// each group keeps its own clock rather than everything ticking together.
//
// One rAF loop drives every group instead of a timer each: a room can have a
// few hundred groups, and that many independent setIntervals is how you get a
// webview that stutters when you pan.

// The player itself is shared with the Secret of Mana Maps panel
// (src/shared/webview/map-view/tile-animation.js: mapAnimPlay).
var _animPlayer=null;

/** Stop playback and drop the overlay. Safe to call when nothing is running. */
function stopRoomAnimation(){
  if(_animPlayer)_animPlayer.stop();
  _animPlayer=null;
  var layer=document.getElementById('rg-animlayer');
  if(layer&&layer.parentNode)layer.parentNode.removeChild(layer);
}

/**
 * Build the overlay and start playing.
 *
 * Images go into the SVG so they share the map's coordinate system and follow
 * pan and zoom for free. They sit above the map image, which means a baked
 * collision marking on an animated tile is covered while this is on — switch
 * animation off to see it. Each group starts at a different point in its cycle:
 * real channels carry their own phase, and without this every torch in a room
 * flickers in lockstep, which reads as one animation rather than many.
 */
function applyRoomAnimation(anim){
  stopRoomAnimation();
  if(!anim||!anim.groups||!anim.groups.length)return;
  var svg=document.getElementById('rg-svg');
  if(!svg)return;
  // Metatile units are 2 SVG units; the map image uses the same scale.
  var groups=anim.groups.map(function(g){
    return {frames:g.frames,delays:g.delays,at:[{x:g.x*2,y:g.y*2,w:g.w*2,h:g.h*2}]};
  });
  _animPlayer=mapAnimPlay(svg,groups,{id:'rg-animlayer',imageClass:'rg-anim',randomPhase:true,
    after:svg.querySelector('#rg-img')});
}

// ── Enemy idle animations ────────────────────────────────────────────────────
// Spawned NPCs carry their idle frames as `data-frames` on the SVG <image>:
// a list of {uri, ms} read out of the ROM's animation script. Each enemy
// keeps its own clock, for the same reason the tile channels do — the hold
// durations differ per frame and there is no shared period.

var _spawnAnims=[];
var _spawnRaf=0;
var _spawnLast=0;

/** Stop enemy playback. Safe when nothing is running. */
function stopSpawnAnimation(){
  if(_spawnRaf&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(_spawnRaf);
  _spawnRaf=0;
  _spawnAnims=[];
}

/** Start every enemy whose sprite has more than one frame. */
function startSpawnAnimation(svg){
  stopSpawnAnimation();
  if(!svg||!svg.querySelectorAll)return;
  svg.querySelectorAll('image[data-frames]').forEach(function(el){
    var frames;
    try{frames=JSON.parse(el.getAttribute('data-frames'));}catch(e){return;}
    if(!frames||frames.length<2)return;
    // A random starting phase, so a field of the same enemy does not pulse
    // in lockstep — the same reason the tile channels get one.
    _spawnAnims.push({el:el,frames:frames,i:0,due:frames[0].ms*Math.random()});
  });
  if(!_spawnAnims.length)return;
  if(typeof requestAnimationFrame!=='function')return;
  _spawnLast=0;
  _spawnRaf=requestAnimationFrame(tickSpawnAnimation);
}

function tickSpawnAnimation(now){
  _spawnRaf=0;
  if(!_spawnAnims.length)return;
  var dt=_spawnLast?Math.min(now-_spawnLast,250):0;
  _spawnLast=now;
  for(var k=0;k<_spawnAnims.length;k++){
    var a=_spawnAnims[k];
    a.due-=dt;
    if(a.due>0)continue;
    a.i=(a.i+1)%a.frames.length;
    a.el.setAttribute('href',a.frames[a.i].uri);
    a.due+=a.frames[a.i].ms;
    if(a.due<0)a.due=a.frames[a.i].ms;
  }
  _spawnRaf=requestAnimationFrame(tickSpawnAnimation);
}
