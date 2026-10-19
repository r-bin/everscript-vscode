'use strict';
// Ownership: `soe://rom/assets/maps/<id>/objects/` and `.../widgets/`.
// Section 3 map objects (composition, states, rendered PNG and animated GIF)
// and map widgets (portable deco stamps, composition, and previews).

const maps = require('../../../../dist/games/evermore/maps');
const { buildDecoCatalogue } = require('../../../../dist/games/evermore/rooms/rendering/deco-catalogue');
const { entryRoom } = require('../rooms/rendering/deco-preview');
const { encodeGif } = require('../../../../dist/games/evermore/resources/gif');
const { dir, file, json, text } = require('../../../../dist/games/evermore/resources/nodes');
const { hexId } = require('../../../../dist/games/evermore/resources/resource-uri');

/**
 * Resolve Section 3 map objects for a room.
 * URIs:
 *   soe://rom/assets/maps/<id>/objects/
 *   soe://rom/assets/maps/<id>/objects/index.json
 *   soe://rom/assets/maps/<id>/objects/index.md
 *   soe://rom/assets/maps/<id>/objects/<index>/info.json
 *   soe://rom/assets/maps/<id>/objects/<index>/composition.json
 *   soe://rom/assets/maps/<id>/objects/<index>/preview.png
 *   soe://rom/assets/maps/<id>/objects/<index>/preview.gif
 *   soe://rom/assets/maps/<id>/objects/<index>/state_<sId>.png
 */
function resolveRoomObjects(room, rom, segments) {
  if (!room || !rom) return null;
  const objects = room.objects || [];
  const [sub, leaf] = segments;

  if (sub === undefined) {
    const entries = [
      ['index.json', 'file'],
      ['index.md', 'file'],
      ...objects.map((o, idx) => [String(o.objectIndex !== undefined ? o.objectIndex : idx), 'dir']),
    ];
    return dir(entries, () => objectsMarkdown(room, rom));
  }

  if (sub === 'index.json') {
    return json(() => buildObjectsIndexData(room, rom));
  }

  if (sub === 'index.md') {
    return text(() => objectsMarkdown(room, rom));
  }

  const objIdx = parseInt(sub, 10);
  if (isNaN(objIdx)) return null;
  const obj = objects.find(o => o.objectIndex === objIdx) || objects[objIdx];
  if (!obj) return null;
  const internalIdx = objects.indexOf(obj);

  if (leaf === undefined) {
    const count = typeof maps.objectStateCount === 'function' ? maps.objectStateCount(obj) : (obj.states.length + 1);
    const entries = [
      ['info.json', 'file'],
      ['composition.json', 'file'],
      ['preview.png', 'file'],
      ['preview.gif', 'file'],
    ];
    for (let s = 0; s < count; s++) {
      entries.push([`state_${s}.png`, 'file']);
      entries.push([`${s}.png`, 'file']);
    }
    return dir(entries, () => singleObjectMarkdown(room, rom, obj, internalIdx));
  }

  if (leaf === 'info.json') {
    return json(() => singleObjectInfo(room, rom, obj, internalIdx));
  }

  if (leaf === 'composition.json') {
    return json(() => singleObjectComposition(room, rom, obj));
  }

  if (leaf === 'preview.png') {
    return file(() => {
      const img = maps.renderObjectState(rom, room, internalIdx, 0);
      return img ? maps.encodePng(img) : Buffer.alloc(0);
    });
  }

  if (leaf === 'preview.gif') {
    return file(() => renderObjectGif(rom, room, internalIdx));
  }

  const stateMatch = /^(?:state_)?(\d+)\.png$/i.exec(leaf);
  if (stateMatch) {
    const sId = parseInt(stateMatch[1], 10);
    return file(() => {
      const img = maps.renderObjectState(rom, room, internalIdx, sId);
      return img ? maps.encodePng(img) : Buffer.alloc(0);
    });
  }

  return null;
}

function buildObjectsIndexData(room, rom) {
  const objects = room.objects || [];
  return objects.map((obj, internalIdx) => {
    const box = maps.objectBounds(rom, room, obj);
    const count = typeof maps.objectStateCount === 'function' ? maps.objectStateCount(obj) : (obj.states.length + 1);
    const objId = obj.objectIndex !== undefined ? obj.objectIndex : internalIdx;
    const states = [];
    for (let s = 0; s < count; s++) {
      const st = s > 0 ? obj.states[s - 1] : obj.states[0];
      states.push({
        state: s,
        metatileId: st ? st.metatileId : 0,
        preview: `objects/${objId}/state_${s}.png`,
      });
    }
    return {
      index: objId,
      x: box ? box.x * 16 : 0,
      y: box ? box.y * 16 : 0,
      w: box ? box.w * 16 : 16,
      h: box ? box.h * 16 : 16,
      statesCount: count,
      preview: `objects/${objId}/preview.png`,
      animation: `objects/${objId}/preview.gif`,
      states: states,
    };
  });
}

function singleObjectInfo(room, rom, obj, internalIdx) {
  const box = maps.objectBounds(rom, room, obj);
  const count = typeof maps.objectStateCount === 'function' ? maps.objectStateCount(obj) : (obj.states.length + 1);
  const objId = obj.objectIndex !== undefined ? obj.objectIndex : internalIdx;
  const states = [];
  for (let s = 0; s < count; s++) {
    const st = s > 0 ? obj.states[s - 1] : obj.states[0];
    states.push({
      state: s,
      metatileId: st ? st.metatileId : 0,
      hold: st ? st.hold : 0,
      preview: `state_${s}.png`,
    });
  }
  return {
    index: objId,
    internalIndex: internalIdx,
    x: box ? box.x * 16 : 0,
    y: box ? box.y * 16 : 0,
    w: box ? box.w * 16 : 16,
    h: box ? box.h * 16 : 16,
    statesCount: count,
    previewUri: 'preview.png',
    animationUri: 'preview.gif',
    states: states,
  };
}

function singleObjectComposition(room, rom, obj) {
  const states = [];
  for (let s = 0; s < obj.states.length; s++) {
    const st = obj.states[s];
    const stamp = maps.parseObjectStamp(rom, room.objectArea, st.metatileId);
    states.push({
      state: s + 1,
      hold: st.hold,
      tileX: st.tileX,
      tileY: st.tileY,
      targetWidth: st.targetWidth,
      targetHeight: st.targetHeight,
      metatileId: st.metatileId,
      stamp: {
        valid: stamp.valid,
        tw: stamp.tw,
        th: stamp.th,
        deltas: stamp.deltas,
      },
    });
  }
  return {
    index: obj.objectIndex,
    descriptors: states,
  };
}

function renderObjectGif(rom, room, internalIdx) {
  const obj = room.objects[internalIdx];
  if (!obj) return Buffer.alloc(0);
  const count = typeof maps.objectStateCount === 'function' ? maps.objectStateCount(obj) : (obj.states.length + 1);
  const frames = [];
  let maxW = 0, maxH = 0;

  for (let s = 0; s < count; s++) {
    try {
      const img = maps.renderObjectState(rom, room, internalIdx, s);
      if (img && img.width > 0 && img.height > 0) {
        maxW = Math.max(maxW, img.width);
        maxH = Math.max(maxH, img.height);
        frames.push(img);
      }
    } catch (_) {}
  }

  if (!frames.length || maxW <= 0 || maxH <= 0) return Buffer.alloc(0);

  const normFrames = frames.map(f => {
    if (f.width === maxW && f.height === maxH) {
      return { data: f.data, delay: 35 };
    }
    const padded = new Uint8Array(maxW * maxH * 4);
    for (let y = 0; y < f.height; y++) {
      for (let x = 0; x < f.width; x++) {
        const si = (y * f.width + x) * 4;
        const di = (y * maxW + x) * 4;
        padded[di] = f.data[si];
        padded[di + 1] = f.data[si + 1];
        padded[di + 2] = f.data[si + 2];
        padded[di + 3] = f.data[si + 3];
      }
    }
    return { data: padded, delay: 35 };
  });

  return encodeGif(maxW, maxH, normFrames);
}

function objectsMarkdown(room, rom) {
  const objects = room.objects || [];
  const lines = [
    `# Section 3 Objects - Room 0x${hexId(room.id, 2)}`,
    '',
    `${objects.length} Section 3 map objects found.`,
    '',
    '| Index | Bounds | States | Preview | Animation |',
    '|---|---|---|---|---|',
  ];
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    const box = maps.objectBounds(rom, room, obj);
    const count = typeof maps.objectStateCount === 'function' ? maps.objectStateCount(obj) : (obj.states.length + 1);
    const id = obj.objectIndex !== undefined ? obj.objectIndex : i;
    const bStr = box ? `${box.x},${box.y} (${box.w}x${box.h})` : '-';
    lines.push(`| [OBJ #${id}](${id}/info.json) | ${bStr} | ${count} | ![Preview](${id}/preview.png) | [![Animation](${id}/preview.gif)](${id}/preview.gif) |`);
  }
  lines.push('');
  return lines.join('\n');
}

function singleObjectMarkdown(room, rom, obj, internalIdx) {
  const id = obj.objectIndex !== undefined ? obj.objectIndex : internalIdx;
  const count = typeof maps.objectStateCount === 'function' ? maps.objectStateCount(obj) : (obj.states.length + 1);
  const lines = [
    `# Object #${id} - Room 0x${hexId(room.id, 2)}`,
    '',
    `Total appearances: ${count} states.`,
    '',
    '| State | Metatile | Preview |',
    '|---|---|---|',
  ];
  for (let s = 0; s < count; s++) {
    const st = s > 0 ? obj.states[s - 1] : obj.states[0];
    const meta = st ? `\`$${hexId(st.metatileId, 4)}\`` : '-';
    lines.push(`| ${s} | ${meta} | ![State ${s}](state_${s}.png) |`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Resolve map widgets for a room.
 * URIs:
 *   soe://rom/assets/maps/<id>/widgets/
 *   soe://rom/assets/maps/<id>/widgets/index.json
 *   soe://rom/assets/maps/<id>/widgets/index.md
 *   soe://rom/assets/maps/<id>/widgets/<widgetId>/info.json
 *   soe://rom/assets/maps/<id>/widgets/<widgetId>/composition.json
 *   soe://rom/assets/maps/<id>/widgets/<widgetId>/preview.png
 */
function resolveRoomWidgets(room, rom, segments) {
  if (!room || !rom) return null;
  const allWidgets = buildDecoCatalogue(rom);
  const widgets = allWidgets.filter(w => w.room === room.id);
  const [sub, leaf] = segments;

  if (sub === undefined) {
    const entries = [
      ['index.json', 'file'],
      ['index.md', 'file'],
      ...widgets.map(w => [String(w.id), 'dir']),
    ];
    return dir(entries, () => widgetsMarkdown(room, widgets));
  }

  if (sub === 'index.json') {
    return json(() => widgets.map(w => ({
      id: w.id,
      room: w.room,
      w: w.w,
      h: w.h,
      states: w.states,
      cells: w.cells.length,
      front: w.front,
      back: w.back,
      preview: `widgets/${w.id}/preview.png`,
    })));
  }

  if (sub === 'index.md') {
    return text(() => widgetsMarkdown(room, widgets));
  }

  const wid = parseInt(sub, 10);
  const widget = widgets.find(w => w.id === wid);
  if (!widget) return null;

  if (leaf === undefined) {
    return dir([
      ['info.json', 'file'],
      ['composition.json', 'file'],
      ['preview.png', 'file'],
    ], () => singleWidgetMarkdown(widget));
  }

  if (leaf === 'info.json') {
    return json(() => ({
      id: widget.id,
      room: widget.room,
      roomName: widget.roomName,
      w: widget.w,
      h: widget.h,
      states: widget.states,
      families: widget.families,
      graphics: widget.graphics,
      front: widget.front,
      back: widget.back,
      scriptId: widget.trigger ? widget.trigger.scriptId : null,
    }));
  }

  if (leaf === 'composition.json') {
    return json(() => ({
      id: widget.id,
      w: widget.w,
      h: widget.h,
      cells: widget.cells,
      stateCells: widget.stateCells || [],
    }));
  }

  if (leaf === 'preview.png') {
    return file(() => {
      const baseRoom = maps.decodeRoom(rom, widget.room || 0x34);
      const mini = entryRoom(rom, widget, baseRoom);
      const img = maps.renderRoomComposite(rom, mini, { backdrop: [0, 0, 0, 0] });
      return img ? maps.encodePng(img) : Buffer.alloc(0);
    });
  }

  return null;
}

function widgetsMarkdown(room, widgets) {
  const lines = [
    `# Widgets - Room 0x${hexId(room.id, 2)}`,
    '',
    `${widgets.length} stamped widgets originate from this room.`,
    '',
    '| ID | Size | Cells | Front | Preview |',
    '|---|---|---|---|---|',
  ];
  for (const w of widgets) {
    lines.push(`| [Widget #${w.id}](${w.id}/info.json) | ${w.w}x${w.h} | ${w.cells.length} | ${w.front ? 'Yes' : 'No'} | ![Preview](${w.id}/preview.png) |`);
  }
  lines.push('');
  return lines.join('\n');
}

function singleWidgetMarkdown(widget) {
  return [
    `# Widget #${widget.id}`,
    '',
    `- **Origin room:** 0x${hexId(widget.room, 2)} (${widget.roomName || ''})`,
    `- **Size:** ${widget.w}x${widget.h} tiles (${widget.cells.length} cells)`,
    `- **Front only:** ${widget.front ? 'Yes' : 'No'}`,
    '',
    `![Preview](preview.png)`,
    '',
  ].join('\n');
}

module.exports = {
  resolveRoomObjects,
  resolveRoomWidgets,
  buildObjectsIndexData,
};
