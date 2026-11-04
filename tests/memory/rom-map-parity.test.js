const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const ROM_DIR = path.join(ROOT, 'src/games/evermore/localizations/knowledge/rom');
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

    test.it('rom-map.md contains complete 1,690+ catalog and superset of knowledge/rom/', () => {
        const romFiles = fs.readdirSync(ROM_DIR).filter(f => f.endsWith('.md'));
        const routineFiles = fs.readdirSync(ROUTINES_DIR).filter(f => f.endsWith('.md'));
        const allEntries = getAllRomEntries();

        assert.equal(romFiles.length, 1329, 'Previous system must have 1329 files');
        assert.ok(routineFiles.length >= 1680, `New routines directory must have 1680+ files (got ${routineFiles.length})`);
        assert.equal(allEntries.length, routineFiles.length, 'rom-map.md must match routine files count');
    });

    test.it('every routine file preserves frontmatter, address and body from previous system', () => {
        const romFiles = fs.readdirSync(ROM_DIR).filter(f => f.endsWith('.md'));
        for (const rf of romFiles) {
            const oldEntry = parseEntry(path.join(ROM_DIR, rf));
            assert.ok(oldEntry, `Old entry must parse: ${rf}`);

            // Lookup entry in the new ROM map by address
            const newEntry = getRomEntry(oldEntry.addr);
            assert.ok(newEntry, `Entry for address $${oldEntry.addr.toString(16)} must exist in new system`);

            const newFile = path.join(ROUTINES_DIR, `${newEntry.name}.md`);
            assert.ok(fs.existsSync(newFile), `New file must exist: ${newFile}`);

            const parsedNew = parseEntry(newFile);
            assert.ok(parsedNew, `New entry must parse: ${newFile}`);

            assert.equal(parsedNew.addr, oldEntry.addr, `Address match for ${newEntry.name}`);
            assert.ok(parsedNew.size > 0, `Size must be positive for ${newEntry.name}`);
            assert.equal(parsedNew.kind, oldEntry.kind, `Kind match for ${newEntry.name}`);
            assert.equal(parsedNew.confidence, oldEntry.confidence, `Confidence match for ${newEntry.name}`);
            assert.deepEqual(parsedNew.evidence, oldEntry.evidence, `Evidence match for ${newEntry.name}`);
            const expectedBody = oldEntry.body
                .replace(/\(8fac84\.md\)/g, '(player_b_trigger_search_box_setup.md)')
                .replace(/\(8fc3ba\.md\)/g, '(entity_move_step_north.md)');
            assert.equal(parsedNew.body, expectedBody, `Body match for ${newEntry.name}`);
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
});
