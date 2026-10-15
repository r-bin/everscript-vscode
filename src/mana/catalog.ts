// Ownership: every map of a ROM, grouped into areas, with the ids that draw the same
// picture grouped together. Shared by the som:// file system and the Evermore view.

import { Rom, romTitle } from './rom';
import { MAP_COUNT, readHeader } from './header';
import { mapSize, pictureKey } from './placement';
import { AREAS, areaOf, mapsWithoutArea } from './areas';

export interface CatalogMap { id: number; hex: string; w: number; h: number; area: string | null }
export interface CatalogArea { name: string; slug: string; maps: number[]; pictures: number[][] }
export interface MapCatalog { title: string; maps: CatalogMap[]; areas: CatalogArea[] }

export const slugOf = (name: string): string =>
    name.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const catalogs = new WeakMap<Rom, MapCatalog>();

/** The catalogue, built once per ROM buffer; areas end with "Other maps". */
export function mapCatalog(rom: Rom): MapCatalog {
    const hit = catalogs.get(rom);
    if (hit) return hit;
    const maps: CatalogMap[] = [];
    for (let id = 0; id < MAP_COUNT; id++) {
        const size = mapSize(rom, id);
        if (!size) continue;
        const area = areaOf(id);
        maps.push({ id, hex: id.toString(16), w: size.w, h: size.h, area: area ? area.name : null });
    }
    const ids = maps.map(m => m.id);
    const pictures = (list: number[]): number[][] => {
        const groups = new Map<string, number[]>();
        for (const id of list) {
            const k = pictureKey(rom, id, readHeader(rom, id).bytes);
            groups.set(k, [...(groups.get(k) || []), id]);
        }
        return [...groups.values()];
    };
    const area = (name: string, slug: string, list: number[]): CatalogArea => ({ name, slug, maps: list, pictures: pictures(list) });
    const areas = AREAS.map(a => area(a.name, slugOf(a.name), a.maps.filter(id => ids.includes(id))));
    areas.push(area('Other maps', 'other', mapsWithoutArea(ids)));
    const out = { title: romTitle(rom), maps, areas };
    catalogs.set(rom, out);
    return out;
}
