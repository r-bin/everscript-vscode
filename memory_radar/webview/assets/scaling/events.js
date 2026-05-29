// Ownership: scaling tab event listener setup.
// References state vars from state.js and helpers from helpers.js.
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
