// SNES hardware register names (no game): the PPU ($2100-$213F), APU ports ($2140-$2143), WRAM port
// ($2180-$2183), joypad serial ($4016/7), CPU ($4200-$421F) and the eight DMA channels ($43n0-$43nA), by
// the names the hardware documentation uses. Pure.

const PPU = [
    'INIDISP', 'OBSEL', 'OAMADDL', 'OAMADDH', 'OAMDATA', 'BGMODE', 'MOSAIC', 'BG1SC', 'BG2SC', 'BG3SC', 'BG4SC', 'BG12NBA', 'BG34NBA',
    'BG1HOFS', 'BG1VOFS', 'BG2HOFS', 'BG2VOFS', 'BG3HOFS', 'BG3VOFS', 'BG4HOFS', 'BG4VOFS', 'VMAIN', 'VMADDL', 'VMADDH', 'VMDATAL', 'VMDATAH',
    'M7SEL', 'M7A', 'M7B', 'M7C', 'M7D', 'M7X', 'M7Y', 'CGADD', 'CGDATA', 'W12SEL', 'W34SEL', 'WOBJSEL', 'WH0', 'WH1', 'WH2', 'WH3',
    'WBGLOG', 'WOBJLOG', 'TM', 'TS', 'TMW', 'TSW', 'CGWSEL', 'CGADSUB', 'COLDATA', 'SETINI', 'MPYL', 'MPYM', 'MPYH', 'SLHV',
    'RDOAM', 'RDVRAML', 'RDVRAMH', 'RDCGRAM', 'OPHCT', 'OPVCT', 'STAT77', 'STAT78', 'APUIO0', 'APUIO1', 'APUIO2', 'APUIO3',
];
const CPU = [
    'NMITIMEN', 'WRIO', 'WRMPYA', 'WRMPYB', 'WRDIVL', 'WRDIVH', 'WRDIVB', 'HTIMEL', 'HTIMEH', 'VTIMEL', 'VTIMEH', 'MDMAEN', 'HDMAEN', 'MEMSEL',
    '', '', 'RDNMI', 'TIMEUP', 'HVBJOY', 'RDIO', 'RDDIVL', 'RDDIVH', 'RDMPYL', 'RDMPYH', 'JOY1L', 'JOY1H', 'JOY2L', 'JOY2H', 'JOY3L', 'JOY3H', 'JOY4L', 'JOY4H',
];
/** `#` is the channel number. */
const DMA = ['DMAP#', 'BBAD#', 'A1T#L', 'A1T#H', 'A1B#', 'DAS#L', 'DAS#H', 'DASB#', 'A2A#L', 'A2A#H', 'NTRL#'];
const OTHER: Record<number, string> = { 0x2180: 'WMDATA', 0x2181: 'WMADDL', 0x2182: 'WMADDM', 0x2183: 'WMADDH', 0x4016: 'JOYSER0', 0x4017: 'JOYSER1' };

/** The register at `addr` (bank-less, $2100-$43FF), e.g. `INIDISP`, `A1T3L` (DMA channel 3); null when there is none. */
function ioRegisterName(addr: number): string | null {
    if (addr >= 0x2100 && addr < 0x2100 + PPU.length) return PPU[addr - 0x2100];
    if (addr >= 0x4200 && addr < 0x4200 + CPU.length) return CPU[addr - 0x4200] || null;
    if (addr >= 0x4300 && addr < 0x4380 && (addr & 0xF) < DMA.length) {
        return DMA[addr & 0xF].replace('#', String((addr >> 4) & 7));
    }
    return OTHER[addr] ?? null;
}

export { ioRegisterName };
