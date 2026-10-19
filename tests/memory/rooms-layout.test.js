// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
/**
 * tests/memory/rooms-layout.test.js — responsive layout and compact overlay sidebar tests.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const layoutJs = fs.readFileSync(path.join(__dirname, '../../src/core/map-editor/shell/layout.js'), 'utf8');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}

function createMockEnv(initialWidth) {
  let width = initialWidth || 1200;
  const elements = {};

  function makeEl(tag, className, id) {
    let classList = new Set((className || '').split(' ').filter(Boolean));
    const el = {
      tagName: tag.toUpperCase(),
      id: id || '',
      get className() { return Array.from(classList).join(' '); },
      set className(val) {
        classList = new Set((val || '').split(' ').filter(Boolean));
      },
      classList: {
        add: (...c) => { c.forEach(x => classList.add(x)); },
        remove: (...c) => { c.forEach(x => classList.delete(x)); },
        toggle: (c, val) => {
          if (val === undefined) val = !classList.has(c);
          if (val) classList.add(c); else classList.delete(c);
          return val;
        },
        has: (c) => classList.has(c),
        contains: (c) => classList.has(c),
      },
      style: {
        setProperty: () => {},
      },
      getBoundingClientRect: () => ({
        width: width,
        height: 600,
        left: 0,
        right: width,
        top: 0,
        bottom: 600,
      }),
      appendChild: (child) => {
        el.children.push(child);
        child.parentNode = el;
        if (child.id) elements['#' + child.id] = child;
      },
      children: [],
      addEventListener: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
    };
    if (id) elements['#' + id] = el;
    if (className) elements['.' + className.split(' ')[0]] = el;
    return el;
  }

  const document = {
    documentElement: makeEl('html', '', ''),
    body: makeEl('body', '', ''),
    querySelector: (sel) => elements[sel] || null,
    getElementById: (id) => elements['#' + id] || null,
    querySelectorAll: (sel) => elements[sel] ? [elements[sel]] : [],
    createElement: (tag) => makeEl(tag, '', ''),
    addEventListener: () => {},
  };

  const window = {
    innerWidth: width,
    addEventListener: () => {},
  };

  const panels = makeEl('div', 'rm-panels', 'rm-panels');
  elements['.rm-panels'] = panels;

  const rail = makeEl('div', 'rm-left rm-rail', 'rm-rail');
  elements['.rm-rail'] = rail;
  elements['.rm-left.rm-rail'] = rail;

  const roomDetail = makeEl('div', 'rg-theme', 'room-detail');
  elements['#room-detail'] = roomDetail;

  const dock = makeEl('div', 'rg-dock', 'rg-dock');
  elements['#rg-dock'] = dock;
  elements['.rg-dock'] = dock;

  const context = vm.createContext({
    document,
    window,
    LAYOUT_MIN: { rail: 160, dock: 300 },
    LAYOUT_MAP_MIN: 360,
    renderEditHeadActs: () => {},
    _zoomRefit: () => {},
    vs: { postMessage: () => {} },
    console,
  });

  vm.runInContext(layoutJs, context);

  return {
    context,
    setWidth: (w) => {
      width = w;
      context.window.innerWidth = w;
    },
    elements,
  };
}

console.log('\nRooms layout responsive tests:');

test('isCompactMode detects wide viewport (>= 1050px)', () => {
  const env = createMockEnv(1200);
  assert.strictEqual(env.context.isCompactMode(), false);
});

test('isCompactMode detects narrow viewport (< 1050px)', () => {
  const env = createMockEnv(800);
  assert.strictEqual(env.context.isCompactMode(), true);
});

test('layoutUpdateCompact applies compact classes when narrow', () => {
  const env = createMockEnv(800);
  env.context.layoutUpdateCompact();
  assert.strictEqual(env.elements['.rm-panels'].classList.contains('rm-compact'), true);
  assert.strictEqual(env.elements['#room-detail'].classList.contains('rg-compact'), true);
});

test('mutual exclusion in compact mode: opening rail closes dock', () => {
  const env = createMockEnv(800);
  env.context._layoutCollapsed.dock = false; // dock open
  env.context._layoutCollapsed.rail = true;  // rail closed

  env.context.editToggleRail(); // Open rail

  assert.strictEqual(env.context._layoutCollapsed.rail, false, 'rail should be open');
  assert.strictEqual(env.context._layoutCollapsed.dock, true, 'dock should have been closed');
});

test('mutual exclusion in compact mode: opening dock closes rail', () => {
  const env = createMockEnv(800);
  env.context._layoutCollapsed.rail = false; // rail open
  env.context._layoutCollapsed.dock = true;  // dock closed

  env.context.editToggleDock(); // Open dock

  assert.strictEqual(env.context._layoutCollapsed.dock, false, 'dock should be open');
  assert.strictEqual(env.context._layoutCollapsed.rail, true, 'rail should have been closed');
});

test('closeOverlays collapses both rail and dock', () => {
  const env = createMockEnv(800);
  env.context._layoutCollapsed.rail = false;
  env.context.closeOverlays();

  assert.strictEqual(env.context._layoutCollapsed.rail, true);
  assert.strictEqual(env.context._layoutCollapsed.dock, true);
});

test('backdrop element is created and toggles active in compact mode', () => {
  const env = createMockEnv(800);
  env.context._layoutCollapsed.rail = false; // open
  env.context.layoutApplyBackdrop();

  const bd = env.elements['#rg-overlay-backdrop'];
  assert.ok(bd, 'backdrop element should exist');
  assert.strictEqual(bd.classList.contains('active'), true, 'backdrop should be active when overlay open');

  env.context._layoutCollapsed.rail = true; // closed
  env.context._layoutCollapsed.dock = true; // closed
  env.context.layoutApplyBackdrop();
  assert.strictEqual(bd.classList.contains('active'), false, 'backdrop should be inactive when overlays closed');
});

test('in wide mode, sidebars can both be open simultaneously', () => {
  const env = createMockEnv(1400);
  env.context._layoutCollapsed.rail = false;
  env.context._layoutCollapsed.dock = true;

  env.context.editToggleDock(); // open dock

  assert.strictEqual(env.context._layoutCollapsed.rail, false, 'rail remains open');
  assert.strictEqual(env.context._layoutCollapsed.dock, false, 'dock opens as well');
});

test('fresh dock element gets collapsed class when layoutApplyCollapsed is called', () => {
  const env = createMockEnv(800);
  env.context._layoutCollapsed.dock = true;
  // Simulate fresh dock created on room reload without collapsed class
  env.elements['#rg-dock'].className = 'rg-dock';
  assert.strictEqual(env.elements['#rg-dock'].classList.contains('collapsed'), false);

  env.context.layoutApplyCollapsed();
  assert.strictEqual(env.elements['#rg-dock'].classList.contains('collapsed'), true);
});

test('newly rendered room-detail retains rg-compact when layoutUpdateCompact runs', () => {
  const env = createMockEnv(800);
  // Simulate roomDetail innerHTML/className reset to 'rg-theme'
  env.elements['#room-detail'].className = 'rg-theme';
  assert.strictEqual(env.elements['#room-detail'].classList.contains('rg-compact'), false);

  env.context.layoutUpdateCompact();
  assert.strictEqual(env.elements['#room-detail'].classList.contains('rg-compact'), true);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
