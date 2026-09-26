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
    }else if(data.command==='familyCatalogue'){
      // Every tile family the ROM attests, for the family picker.
      if(typeof applyFamilyCatalogue==='function')applyFamilyCatalogue(data);
      if(data.error)console.warn('[RoomsRender] familyCatalogue:',data.error);
    }else if(data.command==='decoLibrary'){
      // Every distinct object vanilla places, as stampable deco.
      if(typeof applyDecoLibrary==='function')applyDecoLibrary(data);
      if(data.error)console.warn('[RoomsRender] decoLibrary:',data.error);
    }else if(data.command==='decoPreviews'){
      if(typeof applyDecoPreviews==='function')applyDecoPreviews(data);
    }else if(data.command==='decoCells'){
      if(typeof applyDecoCells==='function')applyDecoCells(data);
    }else if(data.command==='relatedTiles'){
      // What vanilla draws beside the tiles already in play.
      if(typeof applyRelatedTiles==='function')applyRelatedTiles(data);
      if(data.error)console.warn('[RoomsRender] relatedTiles:',data.error);
    }else if(data.command==='neighbourTiles'){
      // What vanilla draws on each side of the armed brush (§8b).
      if(typeof applyNeighbourTiles==='function')applyNeighbourTiles(data);
      if(data.error)console.warn('[RoomsRender] neighbourTiles:',data.error);
    }else if(data.command==='familyPreviews'){
      // One strip of art per family, so the picker shows before it asks.
      // Two-tile chips and eight-tile strips share one builder; `chips`
      // says which came back so they do not overwrite each other.
      if(data.chips){ if(typeof applyChipPreviews==='function')applyChipPreviews(data); }
      else if(typeof applyFamilyPreviews==='function')applyFamilyPreviews(data);
      if(data.error)console.warn('[RoomsRender] familyPreviews:',data.error);
    }else if(data.command==='familySheet'){
      // Every graphic vanilla draws in one tile family, for the picker.
      if(typeof applyFamilySheet==='function')applyFamilySheet(data);
      if(data.error)console.warn('[RoomsRender] familySheet:',data.error);
    }else if(data.command==='newMap'){
      // `> everscript new map`: open a room to borrow graphics from, turn
      // edit mode on, and draft a blank grid in it.
      if(typeof roomsNewMap==='function')roomsNewMap();
    }else if(data.command==='uiPrefs'){
      // UI state the host remembers across panels (map-editor-tiles.js).
      if(typeof applyUiPrefs==='function')applyUiPrefs(data.prefs);
      // Custom maps live in their own folders on the host now; the prefs
      // arriving is the moment to ask for them (map-editor-custom-store.js).
      if(typeof customRequestMaps==='function')customRequestMaps();
    }else if(data.command==='customMaps'){
      if(typeof customLoadMaps==='function')customLoadMaps(data);
    }else if(data.command==='customMapDeleted'){
      if(typeof applyCustomMapDeleted==='function')applyCustomMapDeleted(data);
    }else if(data.command==='widgets'){
      // The user's own widgets (map-editor-widgets.js).
      if(typeof applyWidgets==='function')applyWidgets(data);
    }else if(data.command==='customMapExported'){
      if(typeof applyCustomMapExported==='function')applyCustomMapExported(data);
    }else if(data.command==='draftCollision'){
      // A drafted map's collision layer (map-editor-collision.js).
      if(typeof applyDraftCollision==='function')applyDraftCollision(data);
    }else if(data.command==='mapExportRomDone'){
      // Export ROM finished, failed or was cancelled (map-editor-rom-export.js).
      if(typeof applyRomExportDone==='function')applyRomExportDone(data);
    }else if(data.command==='blankRoom'){
      // A room that is not in the ROM, to try things in.
      if(typeof applyBlankRoom==='function')applyBlankRoom(data);
      if(data.error)console.warn('[RoomsRender] blankRoom:',data.error);
    }
  });
}
