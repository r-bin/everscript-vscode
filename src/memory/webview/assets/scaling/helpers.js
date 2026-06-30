// Ownership: character/weapon/spell/UI helper functions for the Scaling tab.
// All are function declarations — hoisted to the inner IIFE scope.
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
