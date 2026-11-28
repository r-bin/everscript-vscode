-- MesenCE headless check of the cheat menu: opens it with L+R in Brian's room, changes something in every category,
-- checks the WRAM it wrote, leaves, and checks the field still runs and the menu opens again. It also covers what
-- broke while it was built: removing the held weapon, long charm descriptions, quick presses during a redraw and the
-- icon colours after the ring menu.
local W = emu.memType.snesWorkRam
local frames, inRoom, step, wait, failed = 0, 0, 1, 0, false
local pad = {}
local function u8(a) return emu.read(a, W, false) end
local function u16(a) return u8(a) + u8(a + 1) * 256 end
local function u24(a) return u16(a) + u8(a + 2) * 65536 end
local function poke(a, v) emu.write(a, v, W) end
local function result(ok, name, detail)
    if not ok then failed = true end
    print((ok and "OE_PASS" or "OE_FAIL") .. string.format(' {"name":"%s","detail":"%s"}', name, detail or ""))
end
local function shot(name)
    local png = emu.takeScreenshot()
    print("OE_PNGHEX " .. name .. " " .. png:gsub(".", function(c) return string.format("%02x", string.byte(c)) end))
end

local queue = {}
local function pause(n) queue[#queue + 1] = { "wait", n } end
local function tap(key, settle) queue[#queue + 1] = { "pad", { [key] = true } }; pause(4); queue[#queue + 1] = { "pad", {} }; pause(settle or 30) end
local function openMenu() queue[#queue + 1] = { "pad", { l = true, r = true } }; pause(8); queue[#queue + 1] = { "pad", {} }; pause(200) end
local function run(fn) queue[#queue + 1] = { "call", fn } end
local function expect(name, read, want)
    run(function() local got = read(); result(got == want, name, string.format("got %d, want %d", got, want)) end)
end
local function page(key) tap(key or "r", 90) end
local MENU = function() return u8(0x0D11) end

pause(120)
run(function()
    -- the skipped opening leaves both names empty
    for i, c in ipairs({ 66, 111, 121, 0 }) do poke(0x2210 + i - 1, c) end
    for i, c in ipairs({ 68, 111, 103, 0 }) do poke(0x2234 + i - 1, c) end
end)
openMenu()
expect("menu_opens_lit", function() return u8(0x0106) end, 15)
expect("first_page", MENU, 0)

-- a script's "no weapon" state survives edits
run(function() poke(0x23BF, 1) end)

-- weapons: B owns the Gladiator Sword, Right raises its level
tap("down", 40); tap("b", 60); tap("right", 60)
expect("weapon_owned", function() return u8(0x22DA) & 0x04 end, 4)
expect("weapon_level", function() return u16(0x0AE1) end, 0x0200)
run(function() shot("weapons") end)
tap("b", 60)
expect("weapon_removed", function() return u8(0x22DA) & 0x04 end, 0)
tap("b", 60)
expect("pacified_kept", function() return u8(0x23BF) end, 1)
run(function() poke(0x23BF, 0) end)
-- the held Bone Crusher goes: the Boy holds the other sword, never "weapon 0"
tap("up", 40); tap("b", 60)
expect("held_weapon_removed", function() return u8(0x22DA) & 0x02 end, 0)
expect("holds_another", function() return u16(0x0ABA) end, 4)
-- and the last one stays
tap("down", 40); tap("b", 60)
expect("last_weapon_stays", function() return u8(0x22DA) & 0x04 end, 4)
-- two quick presses while the first page is still being drawn both count
queue[#queue + 1] = { "pad", { r = true } }; pause(2); queue[#queue + 1] = { "pad", {} }; pause(3)
queue[#queue + 1] = { "pad", { r = true } }; pause(2); queue[#queue + 1] = { "pad", {} }; pause(90)
expect("quick_presses_count", MENU, 2)
page("l"); page("l")

-- bazooka ammunition: Right twice, Left once; B to the maximum and back to none
page()
tap("right"); tap("right"); tap("left", 60)
expect("ammo_amount", function() return u8(0x2345) end, 1)
tap("b", 60); expect("ammo_max", function() return u8(0x2345) end, 99)
tap("b", 60); expect("ammo_none", function() return u8(0x2345) end, 0)
tap("left", 40); expect("ammo_floor", function() return u8(0x2345) end, 0)

-- alchemy: B learns Atlas, Right raises it, Up wraps from the first row to the last
page()
tap("down", 40); tap("b", 60); tap("right", 60)
expect("formula_known", function() return u8(0x2258) & 0x02 end, 2)
expect("formula_level", function() return u16(0x2F9A) end, 1)
tap("up", 40); tap("up", 150)
expect("wraps_to_last", function() return u8(0x0D0D) end, 34)
expect("list_scrolled", function() return u8(0x0D0F) end, 28)
run(function() shot("alchemy_end") end)

-- ingredients: X fills every row
page()
tap("x", 150)
expect("ingredient_first", function() return u8(0x22FF) end, 99)
expect("ingredient_last", function() return u8(0x2314) end, 99)
run(function() shot("cheat_menu") end)

-- items: X; Call Beads get their capacity
page()
tap("x", 150)
expect("petals_max", function() return u8(0x2315) end, 6)
expect("call_beads_max", function() return u8(0x231C) end, 99)

-- armour: nine rows down scrolls; one Right
page()
for _ = 1, 9 do tap("down", 70) end
tap("right", 60)
expect("armor_count", function() return u8(0x231D + 9) end, 1)
run(function() shot("armor") end)

-- charms: Right turns one on, Left off, Right on
page()
tap("right", 60); expect("charm_on", function() return u8(0x2261) & 0x20 end, 0x20)
tap("left", 60); expect("charm_off", function() return u8(0x2261) & 0x20 end, 0)
tap("right", 60)
run(function() shot("charms") end)
-- every long description fits: a wrap past the window would wait for a button and run the field inside the menu
for _ = 1, 10 do tap("down", 50) end
expect("long_descriptions", function() return u8(0x0D0D) end, 10)
tap("right", 60)
expect("charm_staff", function() return u8(0x2262) & 0x80 end, 0x80)
tap("left", 60)
for _ = 1, 10 do tap("up", 50) end

-- trade goods
page()
tap("right", 40); tap("right", 60)
expect("trade_amount", function() return u16(0x2517) end, 2)

-- money: Right is 100, B fills a 24-bit purse
page()
tap("right", 60); expect("talons_step", function() return u24(0x0AC6) end, 100)
tap("down", 40); tap("b", 60); expect("jewels_max", function() return u24(0x0AC9) end, 999999)
expect("talons_kept", function() return u24(0x0AC6) end, 100)
run(function() shot("money") end)

-- party: the Boy's level recomputes stats and HP
page()
tap("right", 90)
expect("boy_level", function() return u16(0x0A50) end, 2)
run(function() result(u16(0x4EB3) == u16(0x0A35) and u16(0x0A35) > 30, "boy_hp_follows_level", u16(0x4EB3) .. "/" .. u16(0x0A35)) end)
tap("down", 40); tap("left", 60)
run(function() result(u16(0x4EB3) == u16(0x0A35) - 10, "boy_hp_step", u16(0x4EB3) .. "/" .. u16(0x0A35)) end)
run(function() shot("party") end)

-- L goes back, R wraps to the first page
page("l"); expect("page_back", MENU, 8)
page("r"); page("r"); expect("page_wraps", MENU, 0)

-- leave, and the field runs again
local x0
tap("y", 220)
run(function() shot("field"); x0 = u16(0x4E89 + 0x1A) end)
queue[#queue + 1] = { "pad", { right = true } }; pause(40); queue[#queue + 1] = { "pad", {} }; pause(20)
run(function() local x = u16(0x4E89 + 0x1A); result(x > x0, "boy_walks", x0 .. " -> " .. x) end)
expect("talons_stay", function() return u24(0x0AC6) end, 100)

-- a second opening, after the ring menu has used the sprite palettes
tap("y", 90); tap("up", 90); tap("y", 120)
openMenu()
run(function() shot("reopened") end)
expect("reopens_lit", function() return u8(0x0106) end, 15)
-- the weapons' palette in sprite slot 1 is the game's, colour for colour
run(function()
    local bad = 0
    for c = 1, 15 do
        local a = (128 + 16 + c) * 2
        local screen = emu.read(a, emu.memType.snesCgRam, false) + 256 * emu.read(a + 1, emu.memType.snesCgRam, false)
        local rom = 0x100000 + 0xAA8B + 2 * c
        local want = emu.read(rom, emu.memType.snesPrgRom, false) + 256 * emu.read(rom + 1, emu.memType.snesPrgRom, false)
        if screen ~= want then bad = bad + 1 end
    end
    result(bad == 0, "icon_colours", bad .. " colours differ")
end)
tap("y", 220)
run(function() x0 = u16(0x4E89 + 0x1A) end)
queue[#queue + 1] = { "pad", { left = true } }; pause(40); queue[#queue + 1] = { "pad", {} }; pause(20)
run(function() local x = u16(0x4E89 + 0x1A); result(x < x0, "closes_again", x0 .. " -> " .. x) end)
queue[#queue + 1] = { "end" }

emu.addEventCallback(function() emu.setInput(pad, 0) end, emu.eventType.inputPolled)
emu.addEventCallback(function()
    frames = frames + 1
    if inRoom > 0 or u8(0x0ADB) == 0x15 then inRoom = inRoom + 1 end
    if frames > 9000 then
        shot("timeout"); result(false, "finished", "stopped at step " .. step); print("OE_DONE"); emu.stop(0)
    end
    if inRoom == 0 then return end
    if wait > 0 then wait = wait - 1; return end
    while true do
        local a = queue[step]
        if not a then return end
        step = step + 1
        if a[1] == "wait" then wait = a[2]; return
        elseif a[1] == "pad" then pad = a[2]
        elseif a[1] == "call" then a[2]()
        else print("OE_DONE"); emu.stop(0); return end
    end
end, emu.eventType.endFrame)
