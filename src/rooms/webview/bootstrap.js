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
    }
  });
}
