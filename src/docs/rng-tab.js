
(function(){
  function simStats(arr){
    var n=arr.length,sum=0;
    for(var i=0;i<n;i++)sum+=arr[i];
    arr.sort(function(a,b){return a-b;});
    return{avg:(sum/n).toFixed(1),p50:arr[Math.floor(n*.5)],p90:arr[Math.floor(n*.9)],p99:arr[Math.floor(n*.99)]};
  }
  function simNaris(){
    var r=[];
    for(var i=0;i<10000;i++){var a=0;while(true){a++;if(Math.random()<.5)break;}r.push(a);}
    return r;
  }
  // Simulate one prophet run per trial.
  // Returns {prompts[], resets[], successRate} where:
  //   prompts = total prophet interactions until state 8 (win) or state 5 (tilt, mash only)
  //   resets  = player-initiated resets of story to state 0
  //   successRate = % of 10,000 runs ending at state 8
  // Profiles:
  //   mash      - never reset; run ends at 8 (win) or 5 (tilt)
  //   reset4chaos - reset when s=4 (50% tilt risk) or any chaos (9+)
  //   reset4    - reset only at s=4; allows chaos recovery via state 6
  //   metaonly  - reset whenever outside meta arc (6-8), except from state 0
  function simProphetProfile(profile){
    var promptsArr=[],resetsArr=[],successes=0;
    for(var i=0;i<10000;i++){
      var prompts=0,stResets=0,s=0,t=0,cr=0,cn=0;
      while(prompts<50000){
        var x=Math.random()*32|0;
        cn=0;
        if(s<=2){
          if(x<2){s=6;}
          else if(x<4){cn=(Math.random()*8|0)+9;s=(cn===16)?6:cn;}
          else{s++;t++;}
        } else if(s>=3&&s<=5){
          if(t<=30){
            if(x<9){s=6;}
            else if(x<16){cn=(Math.random()*8|0)+9;s=(cn===16)?6:cn;}
            else{s++;t++;}
          } else {
            if(x<20){s=6;}
            else if(x<31){cn=(Math.random()*8|0)+9;s=(cn===16)?6:cn;}
          }
        } else if(s>=6&&s<=8){
          if(x<3){s=Math.random()*4|0;t=0;cr=0;}
          else if(x<6){cn=(Math.random()*8|0)+9;s=(cn===16)?6:cn;}
          else{s++;}
        } else {
          cr++;
          cn=(Math.random()*8|0)+9;
          s=(cn===16||t>29)?6:cn;
        }
        prompts++;
        if(s===8){successes++;break;}
        if(s===5&&profile==='mash'){break;} // tilt — ends run as failure
        var doReset=false;
        if(profile==='reset4chaos'){doReset=(s===4||s>=9);}
        else if(profile==='reset4'){doReset=(s===4);}
        else if(profile==='metaonly'){doReset=((s>=1&&s<=5)||s>=9);}
        if(doReset){stResets++;s=0;t=0;cr=0;}
      }
      promptsArr.push(prompts);
      resetsArr.push(stResets);
    }
    return{prompts:promptsArr,resets:resetsArr,successRate:(successes/100).toFixed(1)};
  }
  function simEgg(pots){
    var r=[];
    for(var i=0;i<10000;i++){
      var p=0;
      while(true){
        p++;
        var hit=pots===5?(Math.random()*8|0)<3:(Math.random()*16|0)<3;
        if(hit&&(Math.random()*16|0)===7)break;
      }
      r.push(p);
    }
    return r;
  }
  function renderHist(data,id){
    var b={},mx=0;
    for(var i=0;i<data.length;i++){b[data[i]]=(b[data[i]]||0)+1;if(b[data[i]]>mx)mx=b[data[i]];}
    var ks=Object.keys(b).map(Number).sort(function(a,b){return a-b;});
    var bw=Math.max(2,Math.min(14,Math.floor(300/ks.length)));
    var h='';
    for(var j=0;j<ks.length;j++){
      var bh=Math.max(1,Math.round(b[ks[j]]/mx*36));
      h+='<div class="rng-hist-bar" title="'+ks[j]+': '+b[ks[j]]+'" style="height:'+bh+'px;width:'+bw+'px"></div>';
    }
    var el=document.getElementById(id);if(el)el.innerHTML=h;
  }
  function showOut(id,s){
    var el=document.getElementById(id);
    if(el)el.innerHTML='avg: <b>'+s.avg+'</b>&nbsp; p50: '+s.p50+'&nbsp; p90: '+s.p90+'&nbsp; p99: '+s.p99;
  }
  function bindSim(btnId,outId,histId,simFn){
    var btn=document.getElementById(btnId);
    if(!btn)return;
    btn.addEventListener('click',function(){
      btn.disabled=true;
      setTimeout(function(){var d=simFn();var s=simStats(d);showOut(outId,s);renderHist(d,histId);btn.disabled=false;},0);
    });
  }
  bindSim('rng-naris-btn','rng-naris-out','rng-naris-hist',simNaris);
  var prophetStrat=document.getElementById('rng-prophet-strat');
  var prophetDesc=document.getElementById('rng-prophet-strat-desc');
  var STRAT_DESC={
    'mash':'Never reset. Talk to prophet until state 8 (win) or state 5 (tilt). Only profile that can fail. Shows success rate.',
    'reset4chaos':'Reset when landing on state 4 (avoids the 50% tilt advance) or any chaos (9+). Prevents both tilt and chaos drift.',
    'reset4':'Reset only at state 4. Allows chaos states to recover organically to state 6. Fewer resets than 4+chaos.',
    'metaonly':'Reset whenever outside the meta arc (6–8), except from state 0. Fishes only for the direct 0→6 shortcut (2/32). Most resets per run.'
  };
  function updateProphetDesc(){
    var v=prophetStrat?prophetStrat.value:'reset4';
    if(prophetDesc)prophetDesc.textContent=STRAT_DESC[v]||'';
  }
  if(prophetStrat)prophetStrat.addEventListener('change',updateProphetDesc);
  updateProphetDesc();
  function showProphetOut(res){
    var ps=simStats(res.prompts),rs=simStats(res.resets);
    var el=document.getElementById('rng-prophet-out');
    if(!el)return;
    var txt='prompts: avg <b>'+ps.avg+'</b>  p50 '+ps.p50+'  p90 '+ps.p90;
    txt+=' │  resets: avg <b>'+rs.avg+'</b>  p50 '+rs.p50;
    if(parseFloat(res.successRate)<100)txt+=' │  success: <b>'+res.successRate+'%</b>';
    el.innerHTML=txt;
  }
  var prophetBtn=document.getElementById('rng-prophet-btn');
  if(prophetBtn)prophetBtn.addEventListener('click',function(){
    var v=prophetStrat?prophetStrat.value:'reset4';
    prophetBtn.disabled=true;
    setTimeout(function(){var res=simProphetProfile(v);showProphetOut(res);renderHist(res.prompts,'rng-prophet-hist');prophetBtn.disabled=false;},0);
  });
  var eggBtn=document.getElementById('rng-egg-btn');
  if(eggBtn)eggBtn.addEventListener('click',function(){
    var sel=document.getElementById('rng-pot-sel');
    var pots=sel?parseInt(sel.value,10):5;
    eggBtn.disabled=true;
    setTimeout(function(){var d=simEgg(pots);var s=simStats(d);showOut('rng-egg-out',s);renderHist(d,'rng-egg-hist');eggBtn.disabled=false;},0);
  });
})();
