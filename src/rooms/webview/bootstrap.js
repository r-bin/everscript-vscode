// Ownership: bootstrap globals for the Rooms tab webview.
// Must be loaded LAST (after all other rooms/ files).
// Sets up the byteScriptFocus global and the message listener.

// _currentByteScriptFocus: current hex address string (no 0x prefix, uppercase)
// injected by the extension host via ACTIVE_BYTE_SCRIPT_FOCUS template variable.
var _currentByteScriptFocus=(typeof ACTIVE_BYTE_SCRIPT_FOCUS==='string'?ACTIVE_BYTE_SCRIPT_FOCUS:'').replace(/^0x/i,'').toUpperCase();

// _applyByteScriptFocus: set by setupByteScriptFocusBinding() when a room is rendered.
// Initially a no-op.
var _applyByteScriptFocus=function(){};

if(typeof window!=='undefined'&&window.addEventListener){
  window.addEventListener('message',function(evt){
    var data=evt.data;
    if(!data)return;
    if(data.command==='byteScriptFocus'){
      _currentByteScriptFocus=normScriptAddr(data.address);
      _applyByteScriptFocus();
    }else if(data.command==='roomTiles'){
      // Decoded collision grid for the room currently shown in the Rooms tab.
      if(typeof applyRoomTileOverlay==='function')applyRoomTileOverlay(data);
      if(data.error)console.warn('[RoomsRender] roomTiles:',data.error);
    }else if(data.command==='composedPreview'){
      // Swatches for metatiles composed in the editor but not yet written.
      if(typeof applyComposedPreview==='function')applyComposedPreview(data);
      if(data.error)console.warn('[RoomsRender] composedPreview:',data.error);
    }else if(data.command==='roomMetatiles'){
      // The room's placement palette, fetched only when the section is opened.
      if(typeof applyMetatilePalette==='function')applyMetatilePalette(data);
      if(data.error)console.warn('[RoomsRender] roomMetatiles:',data.error);
    }else if(data.command==='familySheet'){
      // Every graphic vanilla draws in one tile family, for the picker.
      if(typeof applyFamilySheet==='function')applyFamilySheet(data);
      if(data.error)console.warn('[RoomsRender] familySheet:',data.error);
    }else if(data.command==='blankRoom'){
      // A room that is not in the ROM, to try things in.
      if(typeof applyBlankRoom==='function')applyBlankRoom(data);
      if(data.error)console.warn('[RoomsRender] blankRoom:',data.error);
    }
  });
}
