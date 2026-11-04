const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const ROUTINES_DIR = path.join(ROOT, 'src/games/evermore/localizations/knowledge/routines');
const DATA_ROM_MAP = path.join(ROOT, 'src/games/evermore/localizations/data/rom-map.md');
const DOCS_ROM_MAP = path.join(ROOT, 'docs/disassembly/engine-core/rom-map.md');

const {
    getAllRomEntries,
    getRomEntry,
    getRomEntryByName,
    getRomEntriesByBank,
} = require('../../dist/games/evermore/localizations/rom-map');
const { parseEntry } = require('../../dist/games/evermore/localizations/knowledge');

test.describe('ROM Map & Routine Knowledge Parity (Zero Data Loss)', () => {
    test.it('rom-map.md exists in data and docs and matches', () => {
        assert.ok(fs.existsSync(DATA_ROM_MAP), 'data/rom-map.md must exist');
        assert.ok(fs.existsSync(DOCS_ROM_MAP), 'docs/disassembly/engine-core/rom-map.md must exist');
        const dataContent = fs.readFileSync(DATA_ROM_MAP, 'utf8');
        const docsContent = fs.readFileSync(DOCS_ROM_MAP, 'utf8');
        assert.equal(dataContent, docsContent, 'docs rom-map.md must match data/rom-map.md');
    });

    test.it('rom-map.md contains complete 7,000+ catalog with exact parity to knowledge/routines/', () => {
        const routineFiles = fs.readdirSync(ROUTINES_DIR).filter(f => f.endsWith('.md'));
        const allEntries = getAllRomEntries();

        assert.ok(routineFiles.length >= 7000, `Routines directory must have 7000+ files (got ${routineFiles.length})`);
        assert.equal(allEntries.length, routineFiles.length, 'rom-map.md must match routine files count');
    });

    test.it('every routine file in knowledge/routines/ parses and has valid address and size', () => {
        const allEntries = getAllRomEntries();
        for (const entry of allEntries) {
            const filePath = path.join(ROUTINES_DIR, `${entry.name}.md`);
            assert.ok(fs.existsSync(filePath), `Routine file must exist: ${entry.name}.md`);

            const parsed = parseEntry(filePath);
            assert.ok(parsed, `Routine entry must parse: ${filePath}`);
            assert.equal(parsed.addr, entry.addr, `Address match for ${entry.name}`);
            assert.ok(parsed.size && parsed.size > 0, `Size must be positive for ${entry.name}`);
            assert.equal(parsed.end, entry.addr + parsed.size - 1, `End address match for ${entry.name}`);
        }
    });

    test.it('all entries have valid sizes and total size exceeds 1 MB', () => {
        const allEntries = getAllRomEntries();
        let totalSize = 0;
        for (const e of allEntries) {
            assert.ok(e.size > 0, `Size must be positive for ${e.name}`);
            assert.equal(e.end, e.addr + e.size - 1, `End address must equal addr + size - 1 for ${e.name}`);
            totalSize += e.size;
        }
        assert.ok(totalSize >= 1000000, `Total size across entries must exceed 1 MB (got ${totalSize})`);
    });

    test.it('getRomEntry supports exact address and range queries', () => {
        const resetExact = getRomEntry(0x808020);
        assert.ok(resetExact);
        assert.equal(resetExact?.name, 'reset_handler');

        const resetRange = getRomEntry(0x808025);
        assert.ok(resetRange);
        assert.equal(resetRange?.name, 'reset_handler');

        const nmiRange = getRomEntry(0x808240);
        assert.ok(nmiRange);
        assert.equal(nmiRange?.name, 'nmi_handler');
    });

    test.it('memory maps validate cleanly against physical ROM, naming, and forbidden content rules', () => {
        const { execFileSync } = require('child_process');
        const output = execFileSync(process.execPath, ['tools/check-maps.mts'], {
            cwd: ROOT,
            encoding: 'utf8',
        });
        assert.ok(output.includes('Memory map validation succeeded with ZERO errors!'));
    });
});
