
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
  function alchemyMagicDefenseAtLevel(baseMagicDefense, defenseGrowth, targetLevel) {
    const raw = Math.max(0, Number(baseMagicDefense) || 0);
    const growth = Math.max(0, Number(defenseGrowth) || 0);
    const level = Math.max(1, Math.min(37, Number(targetLevel) || 1));
    return raw + (level - 1) * growth;
}
  function alchemyTargetHpAtLevel(baseHp, hpGrowth, targetLevel) {
    const raw = Math.max(1, Number(baseHp) || 1);
    const growth = Math.max(0, Number(hpGrowth) || 0);
    const level = Math.max(1, Math.min(37, Number(targetLevel) || 1));
    return raw + (level - 1) * growth;
}
  function alchemyProjectedRange(baseMight, spellLevel, magicDefense, defenseGrowth, targetLevel) {
    const scaledMagicDefense = alchemyMagicDefenseAtLevel(magicDefense, defenseGrowth, targetLevel);
    const out = alchemyRangeAtLevel(baseMight, spellLevel, scaledMagicDefense);
    out.scaledMagicDefense = scaledMagicDefense;
    out.spellLevel = Math.max(0, Math.min(9, Number(spellLevel) || 0));
    out.targetLevel = Math.max(1, Math.min(37, Number(targetLevel) || 1));
    return out;
}
  if(!SC_CHARS.length){
    var ce=document.getElementById('sc-chart');
    if(ce)ce.innerHTML='<div style="padding:16px;opacity:.4;font-size:11px">ROM not found — place the .smc in workspace root.</div>';
    return;
  }
  var srcId=0,srcLv=0,charge=100;
  var attackMode='physical';
  var selWid=null;
  var crosshairLv=null;
  var scaleEnemies=false,atlasMode=false;
  var alSpellLevel=0,alTargetLevel=1;

  var srcSel=document.getElementById('sc-src-sel');
  var tgtSel=document.getElementById('sc-tgt-sel');
  var modeSel=document.getElementById('sc-mode-sel');
  SC_CHARS.forEach(function(c){
    var scalable=SC_SCALABLE.hasOwnProperty(c.id);
    var label='#'+String(c.id).padStart(3,'0')+' '+c.name+(scalable?' ★':'');
    [srcSel,tgtSel].forEach(function(sel){
      var o=document.createElement('option');o.value=c.id;o.textContent=label;sel.appendChild(o);
    });
  });
  srcSel.value=0;
  tgtSel.value=SC_CHARS.some(function(c){return c.id===109;})?109:0;
  if(modeSel)modeSel.value=attackMode;

  ['sc-src-lv','sc-tgt-lv'].forEach(function(id){
    var sel=document.getElementById(id);
    for(var lv=1;lv<=SC_MAX_LEVEL;lv++){var o=document.createElement('option');o.value=lv;o.textContent='L'+lv;sel.appendChild(o);}
  });

  function isScalable(id){return SC_SCALABLE.hasOwnProperty(+id);}
  function getWeapons(){
    if(+srcId===1)return[{id:'paws',label:'Dog Claws',type:'dog',bonus:0}];
    if(!isScalable(srcId))return[{id:'raw',label:'Raw atk',type:'dog',bonus:0}];
    return SC_WEAPONS;
  }
  function getAttackItems(){
    return attackMode==='alchemy'?SC_SPELLS:getWeapons();
  }
  function targetMagicDefense(target){
    if(!target)return 0;
    if(typeof target.magic_defense==='number')return target.magic_defense;
    if(typeof target.magicDefense==='number')return target.magicDefense;
    return 0;
  }
  function targetGrowth(target){return target&&SC_SCALABLE[+target.id]?SC_SCALABLE[+target.id]:null;}
  function targetHpAtLevel(target,level){
    var growth=targetGrowth(target);
    return growth?alchemyTargetHpAtLevel(target.hp,growth.hpG,level):((target&&target.hp)||1);
  }
  function targetMagicDefenseAtLevel(target,level){
    var growth=targetGrowth(target);
    return growth?alchemyMagicDefenseAtLevel(targetMagicDefense(target),growth.defG,level):targetMagicDefense(target);
  }
  function updateAlchemySliderLabels(){
    var spellNum=document.getElementById('sc-al-spell-lv-num');
    if(spellNum)spellNum.textContent=String(alSpellLevel);
    var targetNum=document.getElementById('sc-al-tgt-lv-num');
    if(targetNum)targetNum.textContent=String(alTargetLevel);
  }
  function syncAlchemyTargetSlider(){
    var tgt=SC_CHARS.find(function(c){return c.id===+tgtSel.value;})||SC_CHARS[0];
    var slider=document.getElementById('sc-al-tgt-lv');
    if(!slider)return;
    if(!isScalable(tgt&&tgt.id)){
      alTargetLevel=1;
      slider.value='1';
      slider.disabled=true;
    }else{
      slider.disabled=false;
      slider.value=String(alTargetLevel);
    }
    updateAlchemySliderLabels();
  }
  function updateLevelFields(){
    var isAlchemy=attackMode==='alchemy';
    document.getElementById('sc-src-field').style.display=isAlchemy?'none':'flex';
    document.getElementById('sc-charge-field').style.display=isAlchemy?'none':'flex';
    document.getElementById('sc-atlas-field').style.display=isAlchemy?'none':'flex';
    document.getElementById('sc-scale-field').style.display=isAlchemy?'none':'flex';
    document.getElementById('sc-src-lv-field').style.display=(!isAlchemy&&isScalable(srcId))?'flex':'none';
    document.getElementById('sc-tgt-lv-field').style.display=(!isAlchemy&&scaleEnemies&&isScalable(+tgtSel.value))?'flex':'none';
    document.getElementById('sc-al-spell-lv-field').style.display=isAlchemy?'flex':'none';
    document.getElementById('sc-al-tgt-lv-field').style.display=isAlchemy?'flex':'none';
    document.getElementById('sc-hit-chart').style.display='block';
    if(isAlchemy)syncAlchemyTargetSlider();
    var noteEl=document.getElementById('sc-note');
    if(noteEl){
      noteEl.textContent=isAlchemy
        ? 'Offensive alchemy now uses the traced projectile path: cast-side spell power scales by the ROM level table, then hit damage is multiplied by (0x40 - magic_defense) / 0x40. Target-level preview still reuses defense growth because no separate magic-defense growth table is wired yet.'
        : '★ = scalable (level grows). Scaling uses one physical damage helper for all cases: stamina first adjusts attack, Atlas optionally subtracts 480 before damage, then the same RNG-based physical formula computes min/max/999-cap odds.';
    }
  }

  srcSel.addEventListener('change',function(){
    srcId=+srcSel.value;
    var items=getAttackItems();selWid=items.length?items[0].id:null;
    updateLevelFields();redraw();
  });
  tgtSel.addEventListener('change',function(){syncAlchemyTargetSlider();updateLevelFields();redraw();});
  if(modeSel)modeSel.addEventListener('change',function(){
    attackMode=modeSel.value||'physical';
    atlasMode=false;
    var atBtnReset=document.getElementById('sc-atlas-toggle');
    atBtnReset.textContent='OFF';
    atBtnReset.classList.remove('sc-active');
    var items=getAttackItems();selWid=items.length?items[0].id:null;
    updateLevelFields();redraw();
  });
  document.getElementById('sc-src-lv').addEventListener('change',function(){srcLv=+this.value||0;redraw();});
  document.getElementById('sc-tgt-lv').addEventListener('change',function(){redraw();});
  document.getElementById('sc-al-spell-lv').addEventListener('input',function(){alSpellLevel=+this.value||0;updateAlchemySliderLabels();redraw();});
  document.getElementById('sc-al-tgt-lv').addEventListener('input',function(){alTargetLevel=Math.max(1,+this.value||1);updateAlchemySliderLabels();redraw();});
  document.querySelectorAll('[data-chg]').forEach(function(btn){
    btn.addEventListener('click',function(){
      charge=+btn.dataset.chg;
      document.querySelectorAll('[data-chg]').forEach(function(b){b.classList.remove('sc-active');});
      btn.classList.add('sc-active');redraw();
    });
  });

  var scBtn=document.getElementById('sc-scale-toggle');
  scBtn.addEventListener('click',function(){
    scaleEnemies=!scaleEnemies;
    scBtn.textContent=scaleEnemies?'ON':'OFF';
    scBtn.classList.toggle('sc-active',scaleEnemies);
    updateLevelFields();redraw();
  });

  var atBtn=document.getElementById('sc-atlas-toggle');
  atBtn.addEventListener('click',function(){
    atlasMode=!atlasMode;
    atBtn.textContent=atlasMode?'ON':'OFF';
    atBtn.classList.toggle('sc-active',atlasMode);
    _dmgCache={};redraw();
  });

  var _dmgCache={};
  function fmtPct(pct){
    if(pct===0||pct===100)return String(pct.toFixed(0));
    var digits=pct<0.01?6:3;
    return pct.toFixed(digits).replace(/0+$/,'').replace(/.$/,'');
  }
  function atlasSeed(w2,rng16){
    return Math.floor(w2*rng16/0x10000)&0xffff;
  }
  function atlasRawDamage(w,rng16){
    var seed=atlasSeed((w+1)&0xffff,rng16);
    var sum1=(seed+w)&0xffff;
    var carry=(sum1&0x8000)?1:0;
    var sum2=(sum1<<1)&0xffff;
    var sum3=(sum2+w+carry)&0xffff;
    return sum3>>>2;
  }
  function dmgRangeFull(w){
    if(_dmgCache[w]!==undefined)return _dmgCache[w];
    var mn=Infinity,mx=0,cnt999=0;
    for(var i=0;i<=0xffff;i++){
      var d=atlasRawDamage(w,i);
      if(d<mn)mn=d; if(d>mx)mx=d;
      if(d>=999)cnt999++;
    }
    return(_dmgCache[w]={min:Math.min(999,mn),max:Math.min(999,mx),pct999:cnt999/65536*100,count999:cnt999});
  }
  function atlasSubtractApplies(){return atlasMode;}
  function atlasOverflowBypassesClamp(){return atlasMode&&charge<100;}
  function chargedPhysicalAttack(atk){if(charge<=25)return atk>>2;if(charge<=50)return atk>>1;return atk;}
  function dmgRange(atk,def){
    var chargedAtk=chargedPhysicalAttack(atk);
    var atkEff=atlasSubtractApplies()?((chargedAtk-480)&0xffff):chargedAtk;
    var inner=(((def>>2)-atkEff)&0xffff);
    var w=(~((inner-1)&0xffff))&0xffff;
    if(w<1||(!atlasOverflowBypassesClamp()&&w>=0x8000))w=1;
    return dmgRangeFull(w);
  }
  function fmtDmgRange(min,max,pct999,htmlPct){
    if(pct999>0){
      var pctText='['+fmtPct(pct999)+'%]';
      if(htmlPct)pctText='<span style="color:#ff9966">'+pctText+'</span>';
      return (pct999>=100?'999':(min+'–999'))+' '+pctText;
    }
    return min+'–'+max;
  }
  function srcAtkAtLv(id,lv,bonus){
    var s=SC_SCALABLE[id];
    var base=s?(s.atk1+(lv-1)*s.atkG):((SC_CHARS.find(function(c){return c.id===+id;})||{attack:0}).attack);
    return base+bonus;
  }
  function srcHitRateAtLv(id,lv){
    var s=SC_SCALABLE[id];
    if(s)return s.hitRate1+(lv-1)*s.hitRateG;
    return(SC_CHARS.find(function(c){return c.id===+id;})||{hit_rate:0}).hit_rate;
  }

  var _CW=400,_CH=200,_ml=40,_mt=12,_mr=8,_mb=28;
  function renderTrendChart(containerId, series, xValues, xLabel){
    var W=_CW,H=_CH,ml=_ml,mt=_mt,mr=_mr,mb=_mb,pw=W-ml-mr,ph=H-mt-mb;
    function xp(index){return xValues.length<=1?ml+pw/2:ml+(index/(xValues.length-1))*pw;}
    var yMax=0;
    series.forEach(function(s){s.maxs.forEach(function(v){if(v>yMax)yMax=v;});});
    yMax=Math.max(10,Math.ceil(yMax*1.1/10)*10);
    function yp(v){return mt+ph-Math.min(v,yMax)/yMax*ph;}
    function linePts(arr){return arr.map(function(v,i){return xp(i).toFixed(1)+' '+yp(v).toFixed(1);}).join(' L ');}
    function bandPath(mins,maxs){
      var fwd=maxs.map(function(v,i){return xp(i).toFixed(1)+' '+yp(v).toFixed(1);}).join(' L ');
      var rev=mins.slice().reverse().map(function(v,i,a){var idx=a.length-1-i;return xp(idx).toFixed(1)+' '+yp(a[i]).toFixed(1);}).join(' L ');
      return 'M '+fwd+' L '+rev+' Z';
    }
    var grid='';
    var xstep=Math.max(1,Math.round(xValues.length/9));
    for(var xi=0;xi<xValues.length;xi+=xstep){grid+='<line x1="'+xp(xi).toFixed(1)+'" y1="'+mt+'" x2="'+xp(xi).toFixed(1)+'" y2="'+(mt+ph)+'" stroke="#1c1c1c"/>';}
    if((xValues.length-1)%xstep!==0)grid+='<line x1="'+xp(xValues.length-1).toFixed(1)+'" y1="'+mt+'" x2="'+xp(xValues.length-1).toFixed(1)+'" y2="'+(mt+ph)+'" stroke="#1c1c1c"/>';
    var ystep=Math.max(5,Math.ceil(yMax/6/5)*5);
    for(var yi=0;yi<=yMax;yi+=ystep){grid+='<line x1="'+ml+'" y1="'+yp(yi).toFixed(1)+'" x2="'+(ml+pw)+'" y2="'+yp(yi).toFixed(1)+'" stroke="#1c1c1c"/>';}
    var axes='';
    for(var xi2=0;xi2<xValues.length;xi2+=xstep){
      axes+='<line x1="'+xp(xi2).toFixed(1)+'" y1="'+(mt+ph)+'" x2="'+xp(xi2).toFixed(1)+'" y2="'+(mt+ph+4)+'" stroke="#444"/>';
      axes+='<text x="'+xp(xi2).toFixed(1)+'" y="'+(mt+ph+14)+'" text-anchor="middle" font-size="9">'+xValues[xi2]+'</text>';
    }
    if((xValues.length-1)%xstep!==0){axes+='<line x1="'+xp(xValues.length-1).toFixed(1)+'" y1="'+(mt+ph)+'" x2="'+xp(xValues.length-1).toFixed(1)+'" y2="'+(mt+ph+4)+'" stroke="#444"/><text x="'+xp(xValues.length-1).toFixed(1)+'" y="'+(mt+ph+14)+'" text-anchor="middle" font-size="9">'+xValues[xValues.length-1]+'</text>';}
    for(var yi2=0;yi2<=yMax;yi2+=ystep){
      axes+='<line x1="'+(ml-4)+'" y1="'+yp(yi2).toFixed(1)+'" x2="'+ml+'" y2="'+yp(yi2).toFixed(1)+'" stroke="#444"/>';
      axes+='<text x="'+(ml-6)+'" y="'+(yp(yi2)+3).toFixed(1)+'" text-anchor="end" font-size="9">'+yi2+'</text>';
    }
    var bands='';
    series.forEach(function(wd,wi){
      var col=wd.color||SC_COLORS[wd.type]||'#888';
      var opac=SC_TIER_OPAC[wi%4];
      var isAct=selWid===wd.id,isOther=!!(selWid&&!isAct);
      bands+='<g class="sc-band" data-wid="'+wd.id+'" style="cursor:pointer">'
        +'<path d="'+bandPath(wd.mins,wd.maxs)+'" fill="'+col+'" fill-opacity="'+(isOther?(opac*0.1).toFixed(2):opac.toFixed(2))+'" stroke="none"/>'
        +'<path d="M '+linePts(wd.maxs)+'" fill="none" stroke="'+col+'" stroke-opacity="'+(isOther?'0.12':(isAct?'1.0':'0.55'))+'" stroke-width="'+(isAct?2:1)+'"/>'
        +'</g>';
    });
    var svg='<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" style="display:block">'
      +'<rect x="'+ml+'" y="'+mt+'" width="'+pw+'" height="'+ph+'" fill="#111"/>'
      +grid+bands+axes
      +'<text x="'+(ml+pw/2)+'" y="'+(H-2)+'" text-anchor="middle" font-size="9" fill="#555">'+xLabel+'</text>'
      +'<text x="10" y="'+(mt+ph/2)+'" text-anchor="middle" font-size="9" fill="#555" transform="rotate(-90,10,'+(mt+ph/2)+')">dmg</text>'
      +'</svg>';
    var root=document.getElementById(containerId);
    if(root)root.innerHTML=svg;
    document.querySelectorAll('#'+containerId+' .sc-band').forEach(function(el){
      var wid=el.dataset.wid;
      el.addEventListener('click',function(e){selWid=(selWid===wid)?null:wid;e.stopPropagation();redraw();});
    });
  }
  function attachSvgEvents(svgEl){
    var pw=_CW-_ml-_mr;
    function lvFromX(clientX){
      var r=svgEl.getBoundingClientRect();
      var t=(clientX-r.left-_ml)/pw*(SC_MAX_LEVEL-1)+1;
      return Math.max(1,Math.min(SC_MAX_LEVEL,Math.round(t)));
    }
    function onMove(e){crosshairLv=lvFromX(e.clientX);redraw();}
    function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);}
    svgEl.addEventListener('mousedown',function(e){
      if(e.target.closest&&e.target.closest('[data-wid]'))return;
      e.preventDefault();
      crosshairLv=lvFromX(e.clientX);
      redraw();
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
    });
  }

  function redraw(){
    var tgtId=+tgtSel.value;
    var tgt=SC_CHARS.find(function(c){return c.id===tgtId;})||SC_CHARS[0];if(!tgt)return;
    var def=scaleEnemies?Math.max(1,tgt.defense*2):tgt.defense;
    var attacks=getAttackItems();
    if(attackMode==='alchemy'){
      crosshairLv=null;
      var growth=targetGrowth(tgt);
      var spellLevels=[];
      for(var sl=0;sl<=9;sl++)spellLevels.push(sl);
      var spellSeries=attacks.map(function(w){
        var mins=[],maxs=[],p999s=[];
        spellLevels.forEach(function(level){
          var ad=alchemyProjectedRange(w.might,level,targetMagicDefense(tgt),growth?growth.defG:0,alTargetLevel);
          mins.push(ad.min);maxs.push(ad.max);p999s.push(ad.pct999||0);
        });
        return{id:w.id,label:w.label,type:w.type,color:w.color,might:w.might,mins:mins,maxs:maxs,p999s:p999s};
      });
      renderTrendChart('sc-chart',spellSeries,spellLevels,'spell level');

      var targetLevels=[];
      for(var tl=1;tl<=SC_MAX_LEVEL;tl++)targetLevels.push(tl);
      var targetSeries=attacks.map(function(w){
        var mins=[],maxs=[],p999s=[];
        targetLevels.forEach(function(level){
          var usedLevel=growth?level:1;
          var ad=alchemyProjectedRange(w.might,alSpellLevel,targetMagicDefense(tgt),growth?growth.defG:0,usedLevel);
          mins.push(ad.min);maxs.push(ad.max);p999s.push(ad.pct999||0);
        });
        return{id:w.id,label:w.label,type:w.type,color:w.color,might:w.might,mins:mins,maxs:maxs,p999s:p999s};
      });
      renderTrendChart('sc-hit-chart',targetSeries,targetLevels,'target level');

      document.getElementById('sc-xinfo').innerHTML='';
      var leg='';
      attacks.forEach(function(wd){
        var col=wd.color||SC_COLORS[wd.type]||'#888';
        var isAct=selWid===wd.id,isOther=!!(selWid&&!isAct);
        var d1=alchemyProjectedRange(wd.might,alSpellLevel,targetMagicDefense(tgt),growth?growth.defG:0,alTargetLevel);
        var d9=alchemyProjectedRange(wd.might,9,targetMagicDefense(tgt),growth?growth.defG:0,growth?SC_MAX_LEVEL:1);
        var r1=fmtDmgRange(d1.min,d1.max,d1.pct999,false);
        var r9=fmtDmgRange(d9.min,d9.max,d9.pct999,false);
        leg+='<div class="sc-leg-row'+(isAct?' sc-leg-sel':'')+(isOther?' sc-leg-dim':'')+'" data-wid="'+wd.id+'">'
          +'<span class="sc-leg-dot" style="background:'+col+'"></span>'
          +'<span class="sc-leg-name">'+wd.label+'</span>'
          +'<span class="sc-leg-range">S'+alSpellLevel+':'+r1+' → S9/T'+(growth?SC_MAX_LEVEL:1)+':'+r9+'</span>'
          +'</div>';
      });
      document.getElementById('sc-legend').innerHTML=leg;
      document.querySelectorAll('#sc-legend .sc-leg-row').forEach(function(el){
        var wid=el.dataset.wid;
        el.addEventListener('click',function(){selWid=(selWid===wid)?null:wid;redraw();});
      });

      var rawMdef=targetMagicDefenseAtLevel(tgt,alTargetLevel);
      var stats='<div class="sc-stat-box"><div class="sc-stat-name">Offensive Alchemy</div>'
        +'<div class="sc-stat-row"><span>spell level</span><span class="sc-stat-val">'+alSpellLevel+'</span></div>'
        +'<div class="sc-stat-row"><span>target level</span><span class="sc-stat-val">'+alTargetLevel+(growth?'':' (locked)')+'</span></div>'
        +'</div>'
        +'<div class="sc-stat-box"><div class="sc-stat-name">'+tgt.name+'</div>'
        +'<div class="sc-stat-row"><span>hp</span><span class="sc-stat-val">'+targetHpAtLevel(tgt,alTargetLevel)+'</span></div>'
        +'<div class="sc-stat-row"><span>mdef raw</span><span class="sc-stat-val">'+rawMdef+'</span></div>'
        +'<div class="sc-stat-row"><span>effective</span><span class="sc-stat-val">'+effectiveMdef(rawMdef)+'</span></div>'
        +'</div>';
      if(selWid){
        var aw=attacks.find(function(w){return w.id===selWid;});
        if(aw){
          var current=alchemyProjectedRange(aw.might,alSpellLevel,targetMagicDefense(tgt),growth?growth.defG:0,alTargetLevel);
          var targetHp=targetHpAtLevel(tgt,alTargetLevel);
          stats+='<div class="sc-stat-box"><div class="sc-stat-name">'+aw.label+' vs '+tgt.name+'</div>'
            +'<div class="sc-stat-row"><span>might</span><span class="sc-stat-val">'+aw.might+'</span></div>'
            +'<div class="sc-stat-row"><span>spell power</span><span class="sc-stat-val">'+current.spellPower+'</span></div>'
            +'<div class="sc-stat-row"><span>dmg@S'+alSpellLevel+'</span><span class="sc-stat-val">'+fmtDmgRange(current.min,current.max,current.pct999,false)+'</span></div>'
            +'<div class="sc-stat-row"><span>htk</span><span class="sc-stat-val">'+(current.max>0?Math.ceil(targetHp/current.max):'?')+'–'+(current.min>0?Math.ceil(targetHp/current.min):'?')+'</span></div>'
            +'</div>';
        }
      }
      document.getElementById('sc-stats').innerHTML=stats;
      return;
    }
    var wdata=attacks.map(function(w){
      var mins=[],maxs=[],p999s=[];
      for(var lv=1;lv<=SC_MAX_LEVEL;lv++){
        var d=dmgRange(srcAtkAtLv(srcId,lv,w.bonus),def);
        mins.push(d.min);maxs.push(d.max);p999s.push(d.pct999||0);
      }
      return{id:w.id,label:w.label,type:w.type,bonus:w.bonus,mins:mins,maxs:maxs,p999s:p999s};
    });

    var yMax=0;
    wdata.forEach(function(wd){wd.maxs.forEach(function(v){if(v>yMax)yMax=v;});});
    yMax=Math.max(10,Math.ceil(yMax*1.1/10)*10);
    var W=_CW,H=_CH,ml=_ml,mt=_mt,mr=_mr,mb=_mb,pw=W-ml-mr,ph=H-mt-mb;
    function xp(lv){return ml+(lv-1)/(SC_MAX_LEVEL-1)*pw;}
    function yp(v){return mt+ph-Math.min(v,yMax)/yMax*ph;}
    function linePts(arr){return arr.map(function(v,i){return xp(i+1).toFixed(1)+' '+yp(v).toFixed(1);}).join(' L ');}
    function bandPath(mins,maxs){
      var fwd=maxs.map(function(v,i){return xp(i+1).toFixed(1)+' '+yp(v).toFixed(1);}).join(' L ');
      var rev=mins.slice().reverse().map(function(v,i,a){var idx=a.length-1-i;return xp(idx+1).toFixed(1)+' '+yp(a[i]).toFixed(1);}).join(' L ');
      return 'M '+fwd+' L '+rev+' Z';
    }
    var g='';
    var xstep=Math.max(1,Math.round(SC_MAX_LEVEL/9));
    for(var lv=1;lv<=SC_MAX_LEVEL;lv+=xstep){g+='<line x1="'+xp(lv).toFixed(1)+'" y1="'+mt+'" x2="'+xp(lv).toFixed(1)+'" y2="'+(mt+ph)+'" stroke="#1c1c1c"/>';}
    var ystep=Math.max(5,Math.ceil(yMax/6/5)*5);
    for(var yi=0;yi<=yMax;yi+=ystep){g+='<line x1="'+ml+'" y1="'+yp(yi).toFixed(1)+'" x2="'+(ml+pw)+'" y2="'+yp(yi).toFixed(1)+'" stroke="#1c1c1c"/>';}
    var ax='';
    for(var lv2=1;lv2<=SC_MAX_LEVEL;lv2+=xstep){
      ax+='<line x1="'+xp(lv2).toFixed(1)+'" y1="'+(mt+ph)+'" x2="'+xp(lv2).toFixed(1)+'" y2="'+(mt+ph+4)+'" stroke="#444"/>';
      ax+='<text x="'+xp(lv2).toFixed(1)+'" y="'+(mt+ph+14)+'" text-anchor="middle" font-size="9">'+lv2+'</text>';
    }
    for(var yi2=0;yi2<=yMax;yi2+=ystep){
      ax+='<line x1="'+(ml-4)+'" y1="'+yp(yi2).toFixed(1)+'" x2="'+ml+'" y2="'+yp(yi2).toFixed(1)+'" stroke="#444"/>';
      ax+='<text x="'+(ml-6)+'" y="'+(yp(yi2)+3).toFixed(1)+'" text-anchor="end" font-size="9">'+yi2+'</text>';
    }
    var bands='';
    wdata.forEach(function(wd,wi){
      var col=wd.color||SC_COLORS[wd.type]||'#888';
      var opac=SC_TIER_OPAC[wi%4];
      var isAct=selWid===wd.id,isOther=!!(selWid&&!isAct);
      bands+='<g class="sc-band" data-wid="'+wd.id+'" style="cursor:pointer">'
        +'<path d="'+bandPath(wd.mins,wd.maxs)+'" fill="'+col+'" fill-opacity="'+(isOther?(opac*0.1).toFixed(2):opac.toFixed(2))+'" stroke="none"/>'
        +'<path d="M '+linePts(wd.maxs)+'" fill="none" stroke="'+col+'" stroke-opacity="'+(isOther?'0.12':(isAct?'1.0':'0.55'))+'" stroke-width="'+(isAct?2:1)+'"/>'
        +'</g>';
    });
    var xhair='';
    if(crosshairLv!==null){
      var cx=xp(crosshairLv).toFixed(1);
      xhair='<line x1="'+cx+'" y1="'+mt+'" x2="'+cx+'" y2="'+(mt+ph)+'" stroke="#ffd700" stroke-width="1.5" stroke-dasharray="4,3" pointer-events="none"/>'
        +'<circle cx="'+cx+'" cy="'+(mt+ph/2).toFixed(1)+'" r="2.5" fill="#ffd700" pointer-events="none"/>';
    }
    var hl=srcLv>0?srcLv:0;
    var lvMark='';
    if(attackMode!=='alchemy'&&hl>0&&crosshairLv===null){
      var lmx=xp(hl);
      lvMark='<line x1="'+lmx.toFixed(1)+'" y1="'+mt+'" x2="'+lmx.toFixed(1)+'" y2="'+(mt+ph)+'" stroke="#ffd700" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.5" pointer-events="none"/>';
    }
    var svg='<svg id="sc-svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" style="display:block;cursor:crosshair">'
      +'<rect x="'+ml+'" y="'+mt+'" width="'+pw+'" height="'+ph+'" fill="#111"/>'
      +g+bands+xhair+lvMark+ax
      +'<text x="'+(ml+pw/2)+'" y="'+(H-2)+'" text-anchor="middle" font-size="9" fill="#555">'+(attackMode==='alchemy'?'flat preview':'level')+'</text>'
      +'<text x="10" y="'+(mt+ph/2)+'" text-anchor="middle" font-size="9" fill="#555" transform="rotate(-90,10,'+(mt+ph/2)+')">dmg</text>'
      +'</svg>';
    document.getElementById('sc-chart').innerHTML=svg;
    document.querySelectorAll('#sc-chart .sc-band').forEach(function(el){
      var wid=el.dataset.wid;
      el.addEventListener('click',function(e){selWid=(selWid===wid)?null:wid;e.stopPropagation();redraw();});
    });
    var svgEl=document.getElementById('sc-svg');
    if(svgEl)attachSvgEvents(svgEl);

    var xinfo='';
    if(crosshairLv!==null){
      var showW=selWid?wdata.filter(function(wd){return wd.id===selWid;}):wdata;
      xinfo='<span style="color:#ffd700">'+(attackMode==='alchemy'?'L0':'L'+crosshairLv)+'</span>';
      showW.forEach(function(wd){
        var col=wd.color||SC_COLORS[wd.type]||'#888';
        var mn=wd.mins[crosshairLv-1],mx=wd.maxs[crosshairLv-1];
        var p999=wd.p999s&&wd.p999s[crosshairLv-1]||0;
        var htkHi=mx>0?Math.ceil((tgt.hp||1)/mx):'?',htkLo=mn>0?Math.ceil((tgt.hp||1)/mn):'?';
        var dmgStr=fmtDmgRange(mn,mx,p999,true);
        xinfo+='   <span style="color:'+col+'">'+wd.label+':</span> '+dmgStr
          +' <span style="opacity:.55">(htk '+htkHi+'–'+htkLo+')</span>';
      });
      if(attackMode!=='alchemy'){
        var hitRate=srcHitRateAtLv(srcId,crosshairLv);
        var evadeVal=tgt.evade||0;
        var hitRow=SC_HIT_LOOKUP&&SC_HIT_LOOKUP[hitRate];
        var hitPct=hitRow&&hitRow[evadeVal]!==undefined?hitRow[evadeVal].toFixed(1):Math.max(0,hitRate-evadeVal);
        xinfo+='   <span style="opacity:.4">hit='+hitPct+'%</span>';
      }
    }
    document.getElementById('sc-xinfo').innerHTML=xinfo;

    var leg='';
    var hlv=crosshairLv||(hl>0?hl:1);
    wdata.forEach(function(wd){
      var col=wd.color||SC_COLORS[wd.type]||'#888';
      var isAct=selWid===wd.id,isOther=!!(selWid&&!isAct);
      var d1=attackMode==='alchemy'?alchemyRange(wd.might,targetMagicDefense(tgt)):dmgRange(srcAtkAtLv(srcId,hlv,wd.bonus),def);
      var d37=attackMode==='alchemy'?d1:dmgRange(srcAtkAtLv(srcId,SC_MAX_LEVEL,wd.bonus),def);
      var r1=fmtDmgRange(d1.min,d1.max,d1.pct999,false);
      var r37=fmtDmgRange(d37.min,d37.max,d37.pct999,false);
      leg+='<div class="sc-leg-row'+(isAct?' sc-leg-sel':'')+(isOther?' sc-leg-dim':'')+'" data-wid="'+wd.id+'">'
        +'<span class="sc-leg-dot" style="background:'+col+'"></span>'
        +'<span class="sc-leg-name">'+wd.label+'</span>'
        +'<span class="sc-leg-range">'+(attackMode==='alchemy'?('L0:'+r1+' → fixed:'+r37):('L'+hlv+':'+r1+' → L37:'+r37))+'</span>'
        +'</div>';
    });
    document.getElementById('sc-legend').innerHTML=leg;
    document.querySelectorAll('#sc-legend .sc-leg-row').forEach(function(el){
      var wid=el.dataset.wid;
      el.addEventListener('click',function(){selWid=(selWid===wid)?null:wid;redraw();});
    });

    var srcChar=SC_CHARS.find(function(c){return c.id===+srcId;})||{name:'?'};
    var sc=SC_SCALABLE[srcId];
    var hlv2=crosshairLv||(hl>0?hl:1);
    var stats='';
    if(attackMode==='alchemy'){
      var rawMdef=targetMagicDefense(tgt);
      stats='<div class="sc-stat-box"><div class="sc-stat-name">Offensive Alchemy</div>'
        +'<div class="sc-stat-row"><span>model</span><span class="sc-stat-val">level 0</span></div>'
        +'<div class="sc-stat-row"><span>spell scale</span><span class="sc-stat-val">TODO</span></div>'
        +'</div>'
        +'<div class="sc-stat-box"><div class="sc-stat-name">'+tgt.name+'</div>'
        +'<div class="sc-stat-row"><span>hp</span><span class="sc-stat-val">'+tgt.hp+'</span></div>'
        +'<div class="sc-stat-row"><span>mdef raw</span><span class="sc-stat-val">'+rawMdef+'</span></div>'
        +'<div class="sc-stat-row"><span>effective</span><span class="sc-stat-val">'+effectiveMdef(rawMdef)+'</span></div>'
        +'</div>';
    }else{
      stats='<div class="sc-stat-box"><div class="sc-stat-name">'+srcChar.name+(sc?' ★':'')+'</div>'
        +(sc?('<div class="sc-stat-row"><span>atk L'+hlv2+'</span><span class="sc-stat-val">'+srcAtkAtLv(srcId,hlv2,0)+'</span></div>'
            +'<div class="sc-stat-row"><span>atk L37</span><span class="sc-stat-val">'+srcAtkAtLv(srcId,SC_MAX_LEVEL,0)+'</span></div>')
          :('<div class="sc-stat-row"><span>atk</span><span class="sc-stat-val">'+(srcChar.attack||0)+'</span></div>'))
        +'</div>'
        +'<div class="sc-stat-box"><div class="sc-stat-name">'+tgt.name+(scaleEnemies?' (scaled)':'')+'</div>'
        +'<div class="sc-stat-row"><span>hp</span><span class="sc-stat-val">'+tgt.hp+'</span></div>'
        +'<div class="sc-stat-row"><span>def</span><span class="sc-stat-val">'+def+'</span></div>'
        +'<div class="sc-stat-row"><span>def÷4</span><span class="sc-stat-val">'+(def>>2)+'</span></div>'
        +'</div>';
    }
    if(selWid){
      var aw=attacks.find(function(w){return w.id===selWid;});
      var awd=wdata.find(function(wd){return wd.id===selWid;});
      if(aw&&awd){
        var lvidx=Math.max(0,hlv2-1);
        var amn=awd.mins[lvidx],amx=awd.maxs[lvidx];
        var ap=awd.p999s&&awd.p999s[lvidx]||0;
        var amn37=awd.mins[36],amx37=awd.maxs[36],ap37=awd.p999s&&awd.p999s[36]||0;
        if(attackMode==='alchemy'){
          stats+='<div class="sc-stat-box"><div class="sc-stat-name">'+aw.label+' vs '+tgt.name+'</div>'
            +'<div class="sc-stat-row"><span>might</span><span class="sc-stat-val">'+aw.might+'</span></div>'
            +'<div class="sc-stat-row"><span>dmg@L0</span><span class="sc-stat-val">'+fmtDmgRange(amn,amx,ap,false)+'</span></div>'
            +'<div class="sc-stat-row"><span>htk</span><span class="sc-stat-val">'+(amx>0?Math.ceil(tgt.hp/amx):'?')+'–'+(amn>0?Math.ceil(tgt.hp/amn):'?')+'</span></div>'
            +'</div>';
        }else{
          stats+='<div class="sc-stat-box"><div class="sc-stat-name">'+aw.label+' vs '+tgt.name+'</div>'
            +'<div class="sc-stat-row"><span>dmg@L'+hlv2+'</span><span class="sc-stat-val">'+fmtDmgRange(amn,amx,ap,false)+'</span></div>'
            +'<div class="sc-stat-row"><span>htk@L'+hlv2+'</span><span class="sc-stat-val">'+(amx>0?Math.ceil(tgt.hp/amx):'?')+'–'+(amn>0?Math.ceil(tgt.hp/amn):'?')+'</span></div>'
            +'<div class="sc-stat-row"><span>dmg@L37</span><span class="sc-stat-val">'+fmtDmgRange(amn37,amx37,ap37,false)+'</span></div>'
            +'</div>';
        }
      }
    }
    document.getElementById('sc-stats').innerHTML=stats;

    (function(){
      var hc=document.getElementById('sc-hit-chart');if(!hc)return;
      if(attackMode==='alchemy'){hc.innerHTML='';return;}
      if(!SC_HIT_LOOKUP||!Object.keys(SC_HIT_LOOKUP).length){hc.innerHTML='';return;}
      var evadeVal=tgt.evade||0;
      var W=_CW,H=_CH,ml=_ml,mr=_mr,mt=_mt,mb=_mb,pw=W-ml-mr,ph=H-mt-mb;
      function xp2(lv){return ml+(lv-1)/(SC_MAX_LEVEL-1)*pw;}
      var pts='',prevOk=false;
      for(var lv=1;lv<=SC_MAX_LEVEL;lv++){
        var hr=srcHitRateAtLv(srcId,lv);
        var row=SC_HIT_LOOKUP[hr];
        var pct=row&&row[evadeVal]!==undefined?row[evadeVal]:null;
        if(pct===null){prevOk=false;continue;}
        var x=xp2(lv).toFixed(1),y=(mt+ph-pct/100*ph).toFixed(1);
        pts+=prevOk?'L'+x+' '+y:'M'+x+' '+y;
        prevOk=true;
      }
      var xhairLine='';
      if(crosshairLv!==null){var cx2=xp2(crosshairLv).toFixed(1);xhairLine='<line x1="'+cx2+'" y1="'+mt+'" x2="'+cx2+'" y2="'+(mt+ph)+'" stroke="#ffd700" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/>';}
      var axLabels='';
      for(var yi=0;yi<=100;yi+=25){axLabels+='<text x="'+(ml-4)+'" y="'+(mt+ph-yi/100*ph+3).toFixed(1)+'" text-anchor="end" font-size="8" fill="#444">'+yi+'</text>';}
      var svg='<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" style="display:block">'
        +'<rect x="'+ml+'" y="'+mt+'" width="'+pw+'" height="'+ph+'" fill="#0d1a0d"/>'
        +'<line x1="'+ml+'" y1="'+mt+'" x2="'+ml+'" y2="'+(mt+ph)+'" stroke="#222"/>'
        +(pts?'<path d="'+pts+'" fill="none" stroke="#44cc44" stroke-width="1.5"/>':'')
        +xhairLine+axLabels
        +'<text x="'+(ml+pw/2)+'" y="'+(H-1)+'" text-anchor="middle" font-size="8" fill="#444">hit% vs level</text>'
        +'</svg>';
      hc.innerHTML=svg;
    })();
  }
  updateLevelFields();
  updateAlchemySliderLabels();
  syncAlchemyTargetSlider();
  var initW=getAttackItems();if(initW.length)selWid=initW[0].id;
  redraw();
})();
