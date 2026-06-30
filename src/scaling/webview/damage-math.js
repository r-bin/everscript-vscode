// Ownership: physical and Atlas Ring damage calculation functions.
// All are function declarations hoisted to the inner IIFE scope.
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
