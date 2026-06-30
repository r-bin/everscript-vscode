// Ownership: scaling tab initialization sequence — must be LAST in SCALING_JS_FILES.
// Calls helper functions and redraw() to set initial state, then closes the inner IIFE.
  updateLevelFields();
  updateAlchemySliderLabels();
  syncAlchemyTargetSlider();
  var initW=getAttackItems();if(initW.length)selWid=initW[0].id;
  redraw();
})();
