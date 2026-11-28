local t = emu.memType
local f = 0
local inRoom = 0
local heldInput = {}
local holdFrames = 0
local done = false
local maxFrames = 1200
local startHp = nil

local function emit(tag, name, detail)
  local d = tostring(detail or ""):gsub('"', '\\"')
  print(string.format('%s {"name":"%s","detail":"%s"}', tag, name, d))
end

local function u16(mem, addr)
  return emu.read(addr, mem, false) + emu.read(addr + 1, mem, false) * 256
end

local function press(input, frames)
  heldInput = input
  holdFrames = frames or 4
end

local function findInItemsRing(targetId)
  local cnt = u16(t.snesWorkRam, 0x07C8)
  for i = 0, math.min(cnt, 16) - 1 do
    if u16(t.snesWorkRam, 0x07CC + i * 2) == targetId then return i end
  end
  return nil
end

emu.addEventCallback(function()
  if holdFrames > 0 then
    emu.setInput(heldInput, 0)
    holdFrames = holdFrames - 1
  else
    emu.setInput({}, 0)
  end
end, emu.eventType.inputPolled)

emu.addEventCallback(function()
  if done then return end
  f = f + 1
  local room = emu.read(0x0ADB, t.snesWorkRam, false)
  local count = emu.read(0x28F6, t.snesWorkRam, false) -- temp[194]

  if (room == 0x15 and count == 3) or inRoom > 0 then
    inRoom = inRoom + 1
    if inRoom == 40 then
      -- Ensure max HP is 999 so healing past vanilla 300 (Honey) to 999 is observable.
      if u16(t.snesWorkRam, 0x0A35) < 999 then
        emu.write(0x0A35, 999 & 0xFF, t.snesWorkRam)
        emu.write(0x0A36, 999 >> 8, t.snesWorkRam)
      end
      startHp = u16(t.snesWorkRam, 0x4EB3)
      emit("OE_PASS", "setup_consumable", string.format("hp=%d maxHp=%d count=%d", startHp, u16(t.snesWorkRam, 0x0A35), count))
    elseif inRoom == 45 then
      press({ y = true }, 4)
    elseif inRoom == 80 then
      press({ up = true }, 4)
    elseif inRoom == 120 then
      local ringFlags = u16(t.snesWorkRam, 0x05A9)
      local ringCat = u16(t.snesWorkRam, 0x05AB)
      local itemsSlot = findInItemsRing(2)
      if (ringFlags & 0x8000) ~= 0 and itemsSlot ~= nil then
        emit("OE_PASS", "items_ring_populated", string.format("cat=0x%04X cnt=%d slot=%d", ringCat, u16(t.snesWorkRam, 0x07C8), itemsSlot))
      else
        emit("OE_FAIL", "items_ring_populated", string.format("flags=0x%04X cat=0x%04X slot=%s cnt=%d", ringFlags, ringCat, tostring(itemsSlot), u16(t.snesWorkRam, 0x07C8)))
      end
      press({ b = true }, 4)
    elseif inRoom == 155 then
      press({ b = true }, 4)
    elseif inRoom == 420 then
      local hp = u16(t.snesWorkRam, 0x4EB3)
      if hp >= 900 then
        emit("OE_PASS", "healed_999", string.format("hp=%d->%d", startHp, hp))
      else
        emit("OE_FAIL", "healed_999", string.format("expected hp>=900 got %d (start=%d count=%d)", hp, startHp, count))
      end
      if count == 2 then
        emit("OE_PASS", "consumable_decremented", string.format("temp[194]=%d", count))
      else
        emit("OE_FAIL", "consumable_decremented", string.format("expected temp[194]=2 got %d", count))
      end
      local png = emu.takeScreenshot()
      if png and #png > 0 then
        local hex = png:gsub(".", function(ch) return string.format("%02x", string.byte(ch)) end)
        print("OE_PNGHEX heal_999 " .. hex)
      end
      print('OE_DONE {"frame":' .. f .. '}')
      done = true
      emu.stop(0)
    end
  end

  if f >= maxFrames and not done then
    local png = emu.takeScreenshot()
    if png and #png > 0 then
      local hex = png:gsub(".", function(ch) return string.format("%02x", string.byte(ch)) end)
      print("OE_PNGHEX heal_999 " .. hex)
    end
    emit("OE_FAIL", "timeout", string.format("room=0x%02X inRoom=%d count=%d hp=%d", room, inRoom, count, u16(t.snesWorkRam, 0x4EB3)))
    print('OE_DONE {"frame":' .. f .. '}')
    done = true
    emu.stop(0)
  end
end, emu.eventType.endFrame)
