// Ownership: play the Section 2 tile animation over the rendered map.
// Owns the animation DOM layer and its timer.
//
// The host sends one small transparent PNG per frame per block of animated
// cells (src/maps/animation.ts). Channels run on independent schedules — the
// hardware gives each its own frame delay and there is no common period — so
// each group keeps its own clock rather than everything ticking together.
//
// One rAF loop drives every group instead of a timer each: a room can have a
// few hundred groups, and that many independent setIntervals is how you get a
// webview that stutters when you pan.

var _animGroups=[];
var _animRaf=0;
var _animLast=0;

/** Stop playback and drop the overlay. Safe to call when nothing is running. */
function stopRoomAnimation(){
  if(_animRaf&&typeof cancelAnimationFrame==='function'){cancelAnimationFrame(_animRaf);}
  _animRaf=0;
  _animGroups=[];
  var layer=document.getElementById('rg-animlayer');
  if(layer&&layer.parentNode)layer.parentNode.removeChild(layer);
}

/**
 * Build the overlay and start playing.
 *
 * Images go into the SVG so they share the map's coordinate system and follow
 * pan and zoom for free. They sit above the map image, which means a baked
 * collision marking on an animated tile is covered while this is on — switch
 * animation off to see it.
 */
function applyRoomAnimation(anim){
  stopRoomAnimation();
  if(!anim||!anim.groups||!anim.groups.length)return;
  var svg=document.getElementById('rg-svg');
  if(!svg)return;

  var ns='http://www.w3.org/2000/svg';
  var layer=document.createElementNS(ns,'g');
  layer.setAttribute('id','rg-animlayer');
  layer.setAttribute('pointer-events','none');

  anim.groups.forEach(function(g){
    if(!g.frames||!g.frames.length)return;
    var img=document.createElementNS(ns,'image');
    img.setAttribute('class','rg-anim');
    // Metatile units are 2 SVG units; the map image uses the same scale.
    img.setAttribute('x',g.x*2);
    img.setAttribute('y',g.y*2);
    img.setAttribute('width',g.w*2);
    img.setAttribute('height',g.h*2);
    img.setAttribute('preserveAspectRatio','none');
    img.setAttribute('href',g.frames[0]);
    layer.appendChild(img);
    // Start each group at a different point in its cycle. Real channels carry
    // their own phase, and without this every torch in a room flickers in
    // lockstep, which reads as one animation rather than many.
    _animGroups.push({el:img,frames:g.frames,delays:g.delays,
                      i:0,due:(g.delays[0]||120)*Math.random()});
  });

  // The image layer is inserted right after the map image so the interactive
  // overlays (triggers, entities, object boxes) still draw on top of it.
  var mapImg=svg.querySelector('#rg-img');
  if(mapImg&&mapImg.nextSibling)svg.insertBefore(layer,mapImg.nextSibling);
  else svg.appendChild(layer);

  // Without rAF (a test harness, say) the overlay still renders its first
  // frame; it just does not advance.
  if(typeof requestAnimationFrame!=='function')return;
  _animLast=0;
  _animRaf=requestAnimationFrame(tickRoomAnimation);
}

/**
 * Advance whichever groups are due.
 *
 * Driven by rAF rather than a fixed interval so playback pauses with the tab
 * and never queues up work nobody is looking at. Frame delays come from the
 * ROM in 60Hz ticks, already converted to milliseconds by the host.
 */
function tickRoomAnimation(now){
  _animRaf=0;
  if(!_animGroups.length)return;
  var dt=_animLast?Math.min(now-_animLast,250):0;
  _animLast=now;

  for(var k=0;k<_animGroups.length;k++){
    var g=_animGroups[k];
    g.due-=dt;
    if(g.due>0)continue;
    g.i=(g.i+1)%g.frames.length;
    g.el.setAttribute('href',g.frames[g.i]);
    // Add rather than assign, so a slow frame does not drift the whole cycle.
    g.due+=(g.delays[g.i]||120);
    if(g.due<0)g.due=g.delays[g.i]||120;
  }
  _animRaf=requestAnimationFrame(tickRoomAnimation);
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
