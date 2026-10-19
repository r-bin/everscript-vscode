// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: physical and Atlas Ring damage calculation functions.
// All are function declarations hoisted to the inner IIFE scope.
  var _dmgCache={};
  function fmtPct(pct){
    if(pct===0||pct===100)return String(pct.toFixed(0));
    var digits=pct<0.01?6:3;
    return pct.toFixed(digits).replace(/0+$/,'').replace(/.$/,'');
  }
  function dmgRangeFull(w){
    // damageRangeFull: alchemy-math.js (outer scope), cached per base value.
    if(_dmgCache[w]===undefined)_dmgCache[w]=damageRangeFull(w);
    return _dmgCache[w];
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
