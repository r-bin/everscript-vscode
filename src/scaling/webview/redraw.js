// Ownership: main redraw function for the Scaling tab.
// References state vars from state.js and all helper/math functions.
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
          +'<span class="sc-leg-range">S'+alSpellLevel+':'+r1+' \u2192 S9/T'+(growth?SC_MAX_LEVEL:1)+':'+r9+'</span>'
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
        xinfo+='   <span style="color:'+col+'">'+wd.label+':</span> '+dmgStr
          +' <span style="opacity:.55">(htk '+htkHi+'\u2013'+htkLo+')</span>';
      });
      if(attackMode!=='alchemy'){
        var hitRate=srcHitRateAtLv(srcId,crosshairLv);
        var evadeVal=tgt.evade||0;
        var hitRow=SC_HIT_LOOKUP&&SC_HIT_LOOKUP[hitRate];
        var hitPct=hitRow&&hitRow[evadeVal]!==undefined?hitRow[evadeVal].toFixed(1):Math.max(0,hitRate-evadeVal);
        xinfo+='   <span style="opacity:.4">hit='+hitPct+'%</span>';
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
        +'<span class="sc-leg-range">'+(attackMode==='alchemy'?('L0:'+r1+' \u2192 fixed:'+r37):('L'+hlv+':'+r1+' \u2192 L37:'+r37))+'</span>'
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
      stats='<div class="sc-stat-box"><div class="sc-stat-name">'+srcChar.name+(sc?' \u2605':'')+'</div>'
        +(sc?('<div class="sc-stat-row"><span>atk L'+hlv2+'</span><span class="sc-stat-val">'+srcAtkAtLv(srcId,hlv2,0)+'</span></div>'
            +'<div class="sc-stat-row"><span>atk L37</span><span class="sc-stat-val">'+srcAtkAtLv(srcId,SC_MAX_LEVEL,0)+'</span></div>')
          :('<div class="sc-stat-row"><span>atk</span><span class="sc-stat-val">'+(srcChar.attack||0)+'</span></div>'))
        +'</div>'
        +'<div class="sc-stat-box"><div class="sc-stat-name">'+tgt.name+(scaleEnemies?' (scaled)':'')+'</div>'
        +'<div class="sc-stat-row"><span>hp</span><span class="sc-stat-val">'+tgt.hp+'</span></div>'
        +'<div class="sc-stat-row"><span>def</span><span class="sc-stat-val">'+def+'</span></div>'
        +'<div class="sc-stat-row"><span>def\u00f74</span><span class="sc-stat-val">'+(def>>2)+'</span></div>'
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
            +'<div class="sc-stat-row"><span>htk</span><span class="sc-stat-val">'+(amx>0?Math.ceil(tgt.hp/amx):'?')+'\u2013'+(amn>0?Math.ceil(tgt.hp/amn):'?')+'</span></div>'
            +'</div>';
        }else{
          stats+='<div class="sc-stat-box"><div class="sc-stat-name">'+aw.label+' vs '+tgt.name+'</div>'
            +'<div class="sc-stat-row"><span>dmg@L'+hlv2+'</span><span class="sc-stat-val">'+fmtDmgRange(amn,amx,ap,false)+'</span></div>'
            +'<div class="sc-stat-row"><span>htk@L'+hlv2+'</span><span class="sc-stat-val">'+(amx>0?Math.ceil(tgt.hp/amx):'?')+'\u2013'+(amn>0?Math.ceil(tgt.hp/amn):'?')+'</span></div>'
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
