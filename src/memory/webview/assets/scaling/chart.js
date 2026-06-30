// Ownership: SVG chart rendering for the Scaling tab (renderTrendChart, attachSvgEvents).
// Function declarations hoisted to inner IIFE scope.
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
