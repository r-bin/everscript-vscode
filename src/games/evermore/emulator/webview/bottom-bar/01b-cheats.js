// TODO port to TS (docs/todo/port-to-ts.md)

    // -- Cheats (pause menu CHEATS tab) -----------------------------------------------------
    // Each cheat is memory it holds, the way the practice ROM does it in Everscript (everscript repo:
    // in/practice/main.evs; names from in/core/.../03_sprites.evs ATTRIBUTE_FLAGS and 02_ram.evs):
    //   bit   an entity flag bit, set while on, cleared when switched off
    //   word  a word held at a value while on; the game's own value is kept and put back when switched off
    //         (the game may rebuild it meanwhile: a level up or new gear recomputes the stats, $8F:8398 / $8F:8600)
    //   min   a word held at least at a value (nothing to put back)
    // maintainCheats() runs before every frame (not during a replay) and writes only what differs, so a
    // recording gets a W event when the game changed something, not one per byte per frame.
    const CHEAT_BOY = 0x7E4E89, CHEAT_DOG = 0x7E4F37;   // entity records (knowledge ram/7e4e89.md)
    const CHEAT_PARTY = [CHEAT_BOY, CHEAT_DOG];
    const cheatPartyBit = (offset, bit) => CHEAT_PARTY.map(e => ({ kind: 'bit', addr: e + offset, bit: bit }));

    const CHEATS = [
      // attribute(.., NO_CLIP, True): FLAGS_2 (entity+$11) bit $04
      { id: 'noclip', holds: cheatPartyBit(0x11, 0x04) },
      // attribute(.., INVINCIBLE, True): FLAGS_1 (entity+$10) bit $02
      { id: 'invincible', holds: cheatPartyBit(0x10, 0x02) },
      // fake_atlas(): the stat words $0A3F / $0A41 (Boy) and $0A89 / $0A8B (Dog) and entity+$A0 / +$A2 at $EFFF
      // (their names disagree across the repo: attack / defence, evade / magic defence; docs/todo/emulator-and-runtime.md),
      // plus the atlas-glitch invincibility, FLAGS_5 (entity+$14) bit $08.
      // (main.evs's unfake_atlas() puts fixed $0010 / $0000 back and clears the Dog's bit in the Boy's flags.)
      { id: 'atlas', holds: [0x7E0A3F, 0x7E0A41, 0x7E0A89, 0x7E0A8B].concat(CHEAT_PARTY.flatMap(e => [e + 0xA0, e + 0xA2]))
        .map(a => ({ kind: 'word', addr: a, value: 0xEFFF })).concat(cheatPartyBit(0x14, 0x08)) },
      // Current HP (entity+$2A, BOY_CURRENT_HP $4EB3) never below 999: hits land, nobody dies.
      { id: 'hp', holds: CHEAT_PARTY.map(e => ({ kind: 'min', addr: e + 0x2A, value: 999 })) },
    ];
    const cheatOn = { noclip: false, invincible: false, atlas: false, hp: false };
    const cheatKept = new Map();   // word hold address -> the game's own value

    function cheatRead16(m, a) { return m.readMemory(a) | (m.readMemory(a + 1) << 8); }
    function cheatWrite16(m, a, v) { m.writeMemory(a, v & 0xFF); m.writeMemory(a + 1, (v >> 8) & 0xFF); }

    function cheatHold(m, h) {
      if (h.kind === 'bit') {
        const v = m.readMemory(h.addr);
        if (!(v & h.bit)) m.writeMemory(h.addr, v | h.bit);
        return;
      }
      const v = cheatRead16(m, h.addr);
      if (h.kind === 'min') {
        if (v < h.value) cheatWrite16(m, h.addr, h.value);
        return;
      }
      if (v === h.value) return;
      cheatKept.set(h.addr, v);   // the first time, or the game rebuilt it
      cheatWrite16(m, h.addr, h.value);
    }

    function cheatRelease(m, h) {
      if (h.kind === 'bit') {
        const v = m.readMemory(h.addr);
        if (v & h.bit) m.writeMemory(h.addr, v & ~h.bit);
      } else if (h.kind === 'word' && cheatKept.has(h.addr)) {
        // Only while it still holds the cheat's value: after a reset the game owns it again.
        if (cheatRead16(m, h.addr) === h.value) cheatWrite16(m, h.addr, cheatKept.get(h.addr));
        cheatKept.delete(h.addr);
      }
    }

    function cheatModule() {
      const m = getModule();
      return m && hasDebuggerApi(m) && romLoaded ? m : null;
    }

    function maintainCheats(m) {
      if (!m || !hasDebuggerApi(m) || !romLoaded) return;
      try {
        for (const c of CHEATS) if (cheatOn[c.id]) c.holds.forEach(h => cheatHold(m, h));
      } catch (_) {}
    }

    function setCheat(id, on) {
      if (!(id in cheatOn)) return;
      cheatOn[id] = !!on;
      const m = cheatModule();
      const c = CHEATS.find(x => x.id === id);
      if (m) {
        try { c.holds.forEach(h => (on ? cheatHold(m, h) : cheatRelease(m, h))); } catch (_) {}
      }
      setPillState('menu-val-cheat-' + id, cheatOn[id]);
    }

    /** Any cheat on: the recording says so (tas: `# cheats`). */
    function cheatsActive() {
      return Object.keys(cheatOn).some(id => cheatOn[id]);
    }

    function disableAllCheats() {
      for (const id of Object.keys(cheatOn)) if (cheatOn[id]) setCheat(id, false);
    }

    // Full heal: current HP = max HP (stats block: BOY_MAX_HP $0A35, DOG_MAX_HP $0A7F).
    function healParty(m) {
      if (!m || !hasDebuggerApi(m)) return;
      [[CHEAT_BOY, 0x7E0A35], [CHEAT_DOG, 0x7E0A7F]].forEach(([e, max]) => {
        const hp = cheatRead16(m, max);
        if (hp) cheatWrite16(m, e + 0x2A, hp);
      });
      updateCheatsTab(m);
    }

    // unlock(ITEM.MONEY): 6,666,666 of each currency, the four 24-bit purses TALONS $0AC6, JEWELS $0AC9,
    // GOLD $0ACC, CREDITS $0ACF (scripts add and take through the same purses: $8C:D557 / $8C:D501).
    const CHEAT_MONEY = 6666666;
    function giveMoney(m) {
      if (!m || !hasDebuggerApi(m)) return;
      for (const a of [0x7E0AC6, 0x7E0AC9, 0x7E0ACC, 0x7E0ACF]) {
        m.writeMemory(a, CHEAT_MONEY & 0xFF);
        m.writeMemory(a + 1, (CHEAT_MONEY >> 8) & 0xFF);
        m.writeMemory(a + 2, (CHEAT_MONEY >> 16) & 0xFF);
      }
    }

    // The CHEATS tab's rows, in menu-tabs.html order: a toggle (cheat id) or an action.
    const CHEAT_ROWS = ['noclip', 'invincible', 'atlas', 'hp',
      { act: m => healParty(m), sound: 'click_confirm' },
      { act: m => giveMoney(m), sound: 'click_confirm' },
      { act: () => disableAllCheats(), sound: 'click_toggle' }];

    // Left / right (delta) or B (no delta) on a CHEATS row.
    function cheatMenuRow(row, delta) {
      const r = CHEAT_ROWS[row];
      if (typeof r === 'string') {
        setCheat(r, delta === undefined ? !cheatOn[r] : delta > 0);
        playMenuSound('click_toggle');
      } else if (r) {
        const m = cheatModule();
        if (m) r.act(m);
        playMenuSound(r.sound);
      }
    }

    function cheatMenuSync() {
      for (const id of Object.keys(cheatOn)) setPillState('menu-val-cheat-' + id, cheatOn[id]);
    }
