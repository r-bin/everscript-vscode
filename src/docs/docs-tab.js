(function(){
  function effectiveMdef(magicDefense) {
    const raw = Math.max(0, Number(magicDefense) || 0);
    return Math.max(0, Math.floor((raw + 20) / 4));
}
  function alchemySpellBonusBaseAtLevel(baseMight, spellLevel) {
    const base = Math.max(0, Number(baseMight) || 0);
    const level = Math.max(0, Math.min(9, Number(spellLevel) || 0));
    const scale = [2, 4, 7, 11, 15, 20, 26, 32, 39, 46][level];
    return Math.max(0, Math.floor((base * scale) / 4));
}
  function alchemyDamageFromPower(power, magicDefense) {
    const rawPower = Math.max(0, Number(power) || 0);
    const rawMdef = Math.max(0, Math.min(0x40, Number(magicDefense) || 0));
    return Math.max(0, Math.floor((rawPower * (0x40 - rawMdef)) / 0x40));
}
  function alchemyDamageSamples(baseMight, spellLevel, magicDefense) {
    const rawMdef = Math.max(0, Math.min(0x40, Number(magicDefense) || 0));
    const key = `${Number(baseMight) || 0}|${Math.max(0, Math.min(9, Number(spellLevel) || 0))}|${rawMdef}`;
    const cache = alchemyDamageSamples._cache || (alchemyDamageSamples._cache = new Map());
    if (cache.has(key)) return cache.get(key);
    const prePower = alchemySpellPowerAtLevel(baseMight, spellLevel);
    const bonusBase = alchemySpellBonusBaseAtLevel(baseMight, spellLevel);
    const samples = new Array(0x10000);
    for (let rng16 = 0; rng16 <= 0xffff; rng16++) {
        const bonus = Math.floor((bonusBase * rng16) / 0x10000);
        samples[rng16] = alchemyDamageFromPower(prePower + bonus, rawMdef);
    }
    cache.set(key, samples);
    return samples;
}
  function alchemyRangeAtLevel(baseMight, spellLevel, magicDefense) {
    const rawMdef = Math.max(0, Math.min(0x40, Number(magicDefense) || 0));
    const key = `${Number(baseMight) || 0}|${Math.max(0, Math.min(9, Number(spellLevel) || 0))}|${rawMdef}`;
    const cache = alchemyRangeAtLevel._cache || (alchemyRangeAtLevel._cache = new Map());
    if (cache.has(key)) return { ...cache.get(key) };
    const prePower = alchemySpellPowerAtLevel(baseMight, spellLevel);
    const bonusBase = alchemySpellBonusBaseAtLevel(baseMight, spellLevel);
    const samples = alchemyDamageSamples(baseMight, spellLevel, rawMdef);
    let min = Infinity;
    let max = 0;
    let count999 = 0;
    for (const damage of samples) {
        if (damage < min) min = damage;
        if (damage > max) max = damage;
        if (damage >= 999) count999++;
    }
    const out = {
        spellPower: prePower,
        bonusBase,
        rawMagicDefense: rawMdef,
        defenseFactor: 0x40 - rawMdef,
        min: Math.min(999, min),
        max: Math.min(999, max),
        count999,
        pct999: count999 / 65536 * 100,
    };
    cache.set(key, out);
    return { ...out };
}
  function alchemySpellPowerAtLevel(baseMight, spellLevel) {
    const base = Math.max(0, Number(baseMight) || 0);
    const level = Math.max(0, Math.min(9, Number(spellLevel) || 0));
    const scale = [2, 4, 7, 11, 15, 20, 26, 32, 39, 46][level];
    return Math.max(1, Math.ceil((base * scale) / 4));
}
  // Sub-tab navigation
  document.querySelectorAll('.doc-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      var sec=btn.dataset.doc;
      document.querySelectorAll('.doc-btn').forEach(function(b){b.classList.remove('doc-btn-active');});
      btn.classList.add('doc-btn-active');
      document.querySelectorAll('.doc-sec').forEach(function(s){s.style.display=s.dataset.doc===sec?'':'none';});
    });
  });
  // Shared formula helpers
  function docFmtPct(pct){
    if(pct===0||pct===100)return String(pct.toFixed(0));
    var digits=pct<0.01?6:4;
    return pct.toFixed(digits).replace(/0+$/,'').replace(/.$/,'');
  }
  function docW(atk,def){var inner=(((def>>2)-atk)&0xffff);var w=(~((inner-1)&0xffff))&0xffff;if(w<1||w>=0x8000)w=1;return w;}
  function docSeedRaw(w,s){return Math.floor((((w+1)&0xffff)*s)/0x10000)&0xffff;}
  function docDamageRaw(w,s){var a=(docSeedRaw(w,s)+w)&0xffff,b=(a<<1)&0xffff,c=(b+w+((a&0x8000)?1:0))&0xffff;return c>>2;}
  function docSeeds(w){var r=[];for(var s=0;s<=0xffff;s++)r.push(docDamageRaw(w,s));return r;}
  function docRangeStats(w){
    var raw=docSeeds(w);
    var capped=raw.map(function(d){return Math.min(999,d);});
    var mn=capped.reduce(function(a,b){return Math.min(a,b);},999);
    var mx=capped.reduce(function(a,b){return Math.max(a,b);},0);
    var cnt999=raw.filter(function(d){return d>=999;}).length;
    return {min:mn,max:mx,count999:cnt999,pct999:cnt999/65536*100};
  }
  // ── Damage section ──────────────────────────────────────────────────────
  function renderDmgChart(atk,def){
    var w=docW(atk,def);
    var raw=docSeeds(w);
    var capped=raw.map(function(d){return Math.min(999,d);});
    var mn=capped.reduce(function(a,b){return Math.min(a,b);},999);
    var mx=capped.reduce(function(a,b){return Math.max(a,b);},0);
    var cnt999=raw.filter(function(d){return d>=999;}).length;
    var N=32,buckets=new Array(N).fill(0),range=mx-mn||1;
    capped.forEach(function(d){var bi=Math.min(N-1,Math.floor((d-mn)/range*N));buckets[bi]++;});
    var bMax=buckets.reduce(function(a,b){return Math.max(a,b);},1);
    var W=320,H=56,bw=W/N,bars='';
    for(var i=0;i<N;i++){
      var bh=buckets[i]/bMax*H;
      var bv=mn+i/N*range;
      bars+='<rect x="'+(i*bw).toFixed(1)+'" y="'+(H-bh).toFixed(1)+'" width="'+(bw-0.5).toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="'+(bv>=999?'#ff7755':'#4488ff')+'"/>';
    }
    var html='<div class="doc-val">w=<b>'+w+'</b>  def÷4=<b>'+(def>>2)+'</b></div>';
    html+='<div class="doc-val">range: <b>'+mn+'–'+mx+'</b>';
    if(cnt999>0)html+='<span class="doc-cap">999-cap: '+cnt999+'/65536 ('+docFmtPct(cnt999/65536*100)+'%)</span>';
    html+='</div>';
    html+='<svg width="'+W+'" height="'+H+'" style="display:block;margin:4px 0">'+bars+'</svg>';
    html+='<div style="width:'+W+'px;display:flex;justify-content:space-between;font-size:9px;opacity:.4"><span>'+mn+'</span><span>'+mx+'</span></div>';
    document.getElementById('doc-dmg-chart').innerHTML=html;
  }
  var dmgAtk=document.getElementById('doc-atk'),dmgDef=document.getElementById('doc-def');
  if(dmgAtk&&dmgDef){
    function udDmg(){document.getElementById('doc-atk-num').textContent=dmgAtk.value;document.getElementById('doc-def-num').textContent=dmgDef.value;renderDmgChart(+dmgAtk.value,+dmgDef.value);}
    dmgAtk.addEventListener('input',udDmg);dmgDef.addEventListener('input',udDmg);udDmg();
  }
  // ── Offensive alchemy section ───────────────────────────────────────────
  var alSpell=document.getElementById('doc-al-spell'),alSpellLevel=document.getElementById('doc-al-spell-lv'),alMdef=document.getElementById('doc-al-mdef');
  if(alSpell&&alSpellLevel&&alMdef){
    SC_SPELLS.forEach(function(sp){
      var o=document.createElement('option');o.value=sp.id;o.textContent=sp.label+' ('+sp.might+')';alSpell.appendChild(o);
    });
    alSpell.value='hardball';
    function renderAlchemy(){
      var spell=SC_SPELLS.find(function(sp){return sp.id===alSpell.value;})||SC_SPELLS[0];
      var spellLevel=+alSpellLevel.value;
      var rawMdef=+alMdef.value;
      var stats=alchemyRangeAtLevel(spell.might,spellLevel,rawMdef);
      var spellPower=stats.spellPower;
      var raw=alchemyDamageSamples(spell.might,spellLevel,rawMdef);
      var capped=raw.map(function(d){return Math.min(999,d);});
      var N=32,buckets=new Array(N).fill(0),range=stats.max-stats.min||1;
      capped.forEach(function(d){var bi=Math.min(N-1,Math.floor((d-stats.min)/range*N));buckets[bi]++;});
      var bMax=buckets.reduce(function(a,b){return Math.max(a,b);},1);
      var W=320,H=56,bw=W/N,bars='';
      for(var i=0;i<N;i++){
        var bh=buckets[i]/bMax*H;
        var bv=stats.min+i/N*range;
        bars+='<rect x="'+(i*bw).toFixed(1)+'" y="'+(H-bh).toFixed(1)+'" width="'+(bw-0.5).toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="'+(bv>=999?'#ff7755':'#4c86d9')+'"/>';
      }
      document.getElementById('doc-al-spell-lv-num').textContent=spellLevel;
      document.getElementById('doc-al-mdef-num').textContent=rawMdef;
      var html='<div class="doc-val">spell: <b>'+spell.label+'</b>  base might: <b>'+spell.might+'</b>  spell level: <b>'+spellLevel+'</b></div>';
      html+='<div class="doc-val">spell_power_at_level: <b>'+spellPower+'</b>  bonus_base: <b>'+stats.bonusBase+'</b>  raw magic_defense: <b>'+rawMdef+'</b>  defense_factor: <b>'+stats.defenseFactor+'/64</b></div>';
      html+='<div class="doc-val">shown range: <b>'+stats.min+'–'+stats.max+'</b>'+(stats.count999?'<span class="doc-cap">999-cap: '+stats.count999+'/65536 ('+docFmtPct(stats.pct999)+'%)</span>':'')+'</div>';
      html+='<svg width="'+W+'" height="'+H+'" style="display:block;margin:4px 0">'+bars+'</svg>';
      html+='<div style="width:'+W+'px;display:flex;justify-content:space-between;font-size:9px;opacity:.4"><span>'+stats.min+'</span><span>'+stats.max+'</span></div>';
      html+='<ul class="doc-bullets">'
        +'<li>Grounded inputs only: <b>base might</b> from ROM offset <b>0x45E6B</b> and enemy <b>magic_defense</b>.</li>'
        +'<li>The <b>spell level</b> slider uses the traced cast-side helper <code>spell_power_at_level = ceil(base_might * [2,4,7,11,15,20,26,32,39,46][level] / 4)</code> with a RNG bonus based on <code>floor(base_might * scale / 4)</code>.</li>'
        +'<li>Hit damage then applies the traced target-side multiplier <code>floor(projectile_power * (0x40 - magic_defense) / 0x40)</code>.</li>'
        +'<li>Target-level growth and 8-cast route modeling are still open.</li>'
        +'</ul>';
      if(spell.id==='hardball'&&spellLevel===0&&rawMdef===32){
        html+='<div class="doc-fact">Example check: Hard Ball L0 with raw magic_defense 32 produces <b>5–10</b>.</div>';
      }
      document.getElementById('doc-al-chart').innerHTML=html;
    }
    alSpell.addEventListener('change',renderAlchemy);
    alSpellLevel.addEventListener('input',renderAlchemy);
    alMdef.addEventListener('input',renderAlchemy);
    renderAlchemy();
  }
  // ── Hit% section ────────────────────────────────────────────────────────
  var hitTbl=document.getElementById('doc-hit-table');
  if(hitTbl){
    if(!SC_HIT_LOOKUP||!Object.keys(SC_HIT_LOOKUP).length){
      hitTbl.innerHTML='<div style="opacity:.35;padding:8px;font-size:10px">ROM not found — place the .smc in workspace root.</div>';
    }else{
      var hrs=Object.keys(SC_HIT_LOOKUP).map(Number).sort(function(a,b){return a-b;});
      var evSet={};hrs.forEach(function(hr){Object.keys(SC_HIT_LOOKUP[hr]).forEach(function(ev){evSet[ev]=1;});});
      var evs=Object.keys(evSet).map(Number).sort(function(a,b){return a-b;});
      var html='<table class="doc-htable"><thead><tr><th>hit_rate</th>';
      evs.forEach(function(ev){html+='<th>ev='+ev+'</th>';});
      html+='</tr></thead><tbody>';
      hrs.forEach(function(hr){
        var nm='';
        if(hr===38)nm='Boy';else if(hr===50)nm='Dog';
        else{var ch=SC_CHARS.find(function(c){return c.hit_rate===hr;});if(ch)nm=ch.name.replace(/[<>]/g,'');}
        html+='<tr><td>'+(nm?'<span class="doc-hr-name">'+escH(nm)+'</span>':'')+hr+'</td>';
        evs.forEach(function(ev){
          var row=SC_HIT_LOOKUP[hr],pct=row&&row[ev]!==undefined?row[ev]:null;
          var bg=pct===null?'':pct>=95?'#226622':pct>=75?'#554422':'#552222';
          html+='<td'+(bg?' style="background:'+bg+'"':'')+'>'+(pct!==null?pct.toFixed(1)+'%':'—')+'</td>';
        });
        html+='</tr>';
      });
      hitTbl.innerHTML=html+'</tbody></table>';
    }
  }
  // ── Atlas glitch section ────────────────────────────────────────────────
  var _docAtlasCache={};
  function docAtlasAttack(atk,sub){return(atk-sub)&0xffff;}
  function docAtlasUnderflows(atk,sub){return sub>atk;}
  function docAtlasW(atk,sub,def){
    var atkEff=docAtlasAttack(atk,sub);
    if(!docAtlasUnderflows(atk,sub))return docW(atkEff,def);
    var inner=(((def>>2)-atkEff)&0xffff);
    return(~((inner-1)&0xffff))&0xffff;
  }
  function docAtlasStats(w){
    if(_docAtlasCache[w])return _docAtlasCache[w];
    var mn=Infinity,mx=0,cnt999=0,counts=new Array(1000).fill(0);
    for(var s=0;s<=0xffff;s++){
      var d=docDamageRaw(w,s);
      var shown=Math.min(999,d);
      if(d<mn)mn=d;
      if(d>mx)mx=d;
      if(d>=999)cnt999++;
      counts[shown]++;
    }
    var minShown=Math.min(999,mn),maxShown=Math.min(999,mx),span=Math.max(1,maxShown-minShown+1);
    var bandSize=Math.max(1,Math.ceil(span/32)),bands=[],maxBand=0;
    for(var from=minShown;from<=maxShown;from+=bandSize){
      var to=Math.min(maxShown,from+bandSize-1),count=0;
      for(var v=from;v<=to;v++)count+=counts[v]||0;
      maxBand=Math.max(maxBand,count);
      bands.push({from:from,to:to,count:count,pct:count/65536*100});
    }
    var top=[];
    counts.forEach(function(count,dmg){if(count>0)top.push({dmg:dmg,count:count,pct:count/65536*100});});
    top.sort(function(a,b){return b.count-a.count||b.dmg-a.dmg;});
    top=top.slice(0,8);
    return(_docAtlasCache[w]={min:minShown,max:maxShown,count999:cnt999,pct999:cnt999/65536*100,counts:counts,bands:bands,maxBand:maxBand,top:top});
  }
  var atAtk=document.getElementById('doc-at-atk'),atSub=document.getElementById('doc-at-sub'),atDef=document.getElementById('doc-at-def'),atRng=document.getElementById('doc-at-rng');
  if(atAtk&&atSub&&atDef&&atRng){
    function udAt(){
      var atk=+atAtk.value,sub=+atSub.value,def=+atDef.value,rng=+atRng.value;
      document.getElementById('doc-at-atk-num').textContent=atk;
      document.getElementById('doc-at-sub-num').textContent=sub;
      document.getElementById('doc-at-def-num').textContent=def;
      document.getElementById('doc-at-rng-num').textContent=rng;
      var atkEff=docAtlasAttack(atk,sub);
      var underflow=docAtlasUnderflows(atk,sub);
      var w=docAtlasW(atk,sub,def);
      var stats=docAtlasStats(w);
      var seed=docSeedRaw(w,rng);
      var uncapped=docDamageRaw(w,rng);
      var capped=Math.min(999,uncapped);
      if(!underflow){
        var info='';
        info+='<ul class="doc-bullets">';
        info+='<li>Base atk: <b>'+atk+'</b>; manual subtract: <b>'+sub+'</b>; effective atk: <b>'+atkEff+'</b>.</li>';
        info+='<li>No underflow occurred, so the atlas glitch is <b>inactive</b>.</li>';
        info+='<li>Target def: <b>'+def+'</b>; def÷4: <b>'+(def>>2)+'</b>; regular signed-clamp w: <b>'+w+'</b>.</li>';
        info+='<li>Expected regular shown damage: <b>'+stats.min+'–'+stats.max+'</b>.</li>';
        info+='<li>This preview does <b>not</b> derive subtract from stamina or setup state yet. It only answers: "if this subtraction has already happened, what damage follows?"</li>';
        info+='<li>Selected rng16: <b>'+rng+'</b>; seed: <b>'+seed+'</b>; uncapped dmg: <b>'+uncapped+'</b>; shown dmg: <b>'+capped+'</b>.</li>';
        info+='</ul>';
        document.getElementById('doc-at-chart').innerHTML=info;
        return;
      }
      var pct=stats.pct999;
      var below=100-pct;
      var W=300,H=18,distW=300,distH=92;
      var bar='<rect x="0" y="0" width="'+W+'" height="'+H+'" fill="#111" rx="3"/>';
      bar+='<rect x="0" y="0" width="'+(pct/100*W).toFixed(1)+'" height="'+H+'" fill="'+(pct>0?'#cc4422':'#1a1a1a')+'" rx="3"/>';
      var dist='';
      stats.bands.forEach(function(band,idx){
        var bw=distW/stats.bands.length;
        var bh=stats.maxBand?band.count/stats.maxBand*(distH-12):0;
        var x=(idx*bw).toFixed(1),y=(distH-bh-10).toFixed(1);
        var fill=band.to>=999?'#ff7755':(band.pct<0.05?'#3d4e6a':'#4f8ee8');
        dist+='<rect x="'+x+'" y="'+y+'" width="'+Math.max(1,bw-1).toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="'+fill+'" rx="1"/>';
      });
      dist+='<line x1="0" y1="'+(distH-10)+'" x2="'+distW+'" y2="'+(distH-10)+'" stroke="#444"/>';
      dist+='<text x="0" y="'+(distH-1)+'" font-size="8" fill="#666">'+stats.min+'</text>';
      dist+='<text x="'+(distW-22)+'" y="'+(distH-1)+'" font-size="8" fill="#666">'+stats.max+'</text>';
      var topList=stats.top.map(function(row){return '<li>shown dmg <b>'+row.dmg+'</b>: <b>'+row.count+'/65536</b> = <b>'+docFmtPct(row.pct)+'%</b></li>';}).join('');
      var info='';
      info+='<ul class="doc-bullets">';
      info+='<li>Base atk: <b>'+atk+'</b>; manual subtract: <b>'+sub+'</b>; underflowed atk: <b>'+atkEff+'</b>.</li>';
      info+='<li>Underflow occurred, so the wrapped atlas-glitch damage helper is active.</li>';
      info+='<li>This preview does <b>not</b> derive subtract from stamina or setup state yet. It only answers: "if this subtraction has already happened, what damage follows?"</li>';
      info+='<li>Target def: <b>'+def+'</b>; def÷4: <b>'+(def>>2)+'</b>; computed w: <b>'+w+'</b>.</li>';
      info+='<li>All shown damage rolls: <b>'+stats.min+'–'+stats.max+'</b>.</li>';
      info+='<li>999-cap: <b>'+stats.count999+'/65536</b> = <b>'+docFmtPct(pct)+'%</b>.</li>';
      info+='<li>&lt;999 damage: <b>'+(65536-stats.count999)+'/65536</b> = <b>'+docFmtPct(below)+'%</b>.</li>';
      info+='<li>Selected rng16: <b>'+rng+'</b>; seed: <b>'+seed+'</b>; uncapped dmg: <b>'+uncapped+'</b>; shown dmg: <b>'+capped+'</b>'+(uncapped>=999?' <span class="doc-cap">caps to 999</span>':'')+'.</li>';
      info+='</ul>';
      info+='<svg width="'+W+'" height="'+H+'" style="display:block;margin:4px 0 2px">'+bar+'</svg>';
      info+='<div class="doc-dist-cap">999 band: '+docFmtPct(pct)+'%  |  below 999: '+docFmtPct(below)+'%</div>';
      info+='<div class="doc-dist"><div class="doc-val">Expected shown-damage distribution (binned when many infrequent rolls exist)</div><svg width="'+distW+'" height="'+distH+'" style="display:block">'+dist+'</svg></div>';
      info+='<div class="doc-val">Most frequent shown values</div><ul class="doc-bullets">'+topList+'</ul>';
      document.getElementById('doc-at-chart').innerHTML=info;
    }
    atAtk.addEventListener('input',udAt);
    atSub.addEventListener('input',udAt);
    atDef.addEventListener('input',udAt);
    atRng.addEventListener('input',udAt);
    udAt();
  }
  // ── Route planner mock ─────────────────────────────────────────────────
  (function(){
    var listEl=document.getElementById('rp-list');
    if(!listEl)return;
    var outEl=document.getElementById('rp-sim-out');
    var rows=[];
    var seq=1;
    var templates={
      heart8:{enemy:"Thraxx's Heart",method:'Alchemy 8-cast',qty:1,expected:'TODO',xp:'boss xp',alchemy:'spell xp',notes:'Act 1 heart burst'},
      skelesnail8:{enemy:'Skelesnail',method:'Alchemy 8-cast',qty:1,expected:'TODO',xp:'enemy xp',alchemy:'spell xp',notes:'Alchemy leveling route step'},
      magmar8:{enemy:'Magmar',method:'Alchemy 8-cast',qty:1,expected:'TODO',xp:'enemy xp',alchemy:'spell xp',notes:'Common any% Act 1 route'},
      sterlingPhys:{enemy:'Sterling',method:'Physical / atlas check',qty:1,expected:'atlas-driven',xp:'boss xp',alchemy:'0',notes:'Depends on miss rate and overflow odds'}
    };
    function renderRoute(){
      if(!rows.length){
        listEl.innerHTML='<div class="rp-empty">No route steps yet. Add a sample kill from the left. This is a mock UI only.</div>';
        outEl.innerHTML='<ul><li>Simulation engine is not implemented yet.</li><li>Physical expected hits need live damage bands and hit% integration.</li><li>Alchemy expected hits still need spell-level scaling, 8-cast modeling, and route-grade batch logic.</li></ul>';
        return;
      }
      var html='<table class="rp-table"><thead><tr><th>#</th><th>Enemy</th><th>Method</th><th>Qty</th><th>Expected hits</th><th>XP</th><th>Alchemy XP</th><th>Notes</th><th></th></tr></thead><tbody>';
      rows.forEach(function(row,idx){
        html+='<tr><td>'+(idx+1)+'</td><td>'+escH(row.enemy)+'</td><td><span class="rp-tag">'+escH(row.method)+'</span></td><td>'+row.qty+'</td><td>'+escH(row.expected)+'</td><td>'+escH(row.xp)+'</td><td>'+escH(row.alchemy)+'</td><td>'+escH(row.notes)+'</td><td><button class="rp-btn-ghost" data-rp-del="'+row.id+'">remove</button></td></tr>';
      });
      html+='</tbody></table>';
      listEl.innerHTML=html;
      listEl.querySelectorAll('[data-rp-del]').forEach(function(btn){
        btn.addEventListener('click',function(){
          rows=rows.filter(function(r){return String(r.id)!==btn.dataset.rpDel;});
          renderRoute();
        });
      });
      outEl.innerHTML='<ul>'
        +'<li>Mock only: simulation is not wired yet, but the future output should report hits, misses, atlas overflow outcomes, and the kill order.</li>'
        +'<li>Level routing assumption: you level immediately after each XP gain, then continue with post-level stats. Max 1 level per XP event.</li>'
        +'<li>Alchemy routing assumption: level-0 per-cast previews exist in Scaling, but 8-casts and spell-XP growth are still placeholders.</li>'
        +'<li>Current route length: <b>'+rows.length+'</b> steps.</li>'
        +'</ul>';
    }
    document.querySelectorAll('[data-rp-add]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var tpl=templates[btn.dataset.rpAdd];
        if(!tpl)return;
        rows.push({id:seq++,enemy:tpl.enemy,method:tpl.method,qty:tpl.qty,expected:tpl.expected,xp:tpl.xp,alchemy:tpl.alchemy,notes:tpl.notes});
        renderRoute();
      });
    });
    var simBtn=document.getElementById('rp-sim-btn');
    if(simBtn)simBtn.addEventListener('click',function(){renderRoute();});
    renderRoute();
  })();
})();
