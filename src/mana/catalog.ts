// Ownership: every map of a ROM, grouped into areas, with the ids that draw the same
// picture grouped together (across areas: a map's variants may be listed elsewhere). Shared by the som:// file system and the Evermore view.

import { Rom, romTitle } from './rom';
import { MAP_COUNT, readHeader } from './header';
import { mapSize, pictureKey } from './placement';
import { AREAS, areaOf, mapsWithoutArea } from './areas';

export interface CatalogMap { id: number; hex: string; w: number; h: number; area: string | null }
/** `pictures`: one row per picture — the area's map first, then every other id that draws it (any area). */
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
    // Every id that draws the same picture, across areas, in id order.
    const sameAs = new Map<number, number[]>();
    const byKey = new Map<string, number[]>();
    for (const id of ids) {
        const k = pictureKey(rom, id, readHeader(rom, id).bytes);
        byKey.set(k, [...(byKey.get(k) || []), id]);
    }
    for (const group of byKey.values()) for (const id of group) sameAs.set(id, group);
    // One picture per row: the area's own map first (the one matched to the area's picture), then the
    // other ids that draw it — from this area, another area or "Other maps" — in id order.
    const pictures = (list: number[]): number[][] => {
        const seen = new Set<number>();
        const out: number[][] = [];
        for (const id of list) {
            if (seen.has(id)) continue;
            const group = sameAs.get(id) || [id];
            group.forEach(x => seen.add(x));
            out.push([id, ...group.filter(x => x !== id)]);
        }
        return out;
    };
    const area = (name: string, slug: string, list: number[]): CatalogArea => ({ name, slug, maps: list, pictures: pictures(list) });
    const areas = AREAS.map(a => area(a.name, slugOf(a.name), a.maps.filter(id => ids.includes(id))));
    // A map no area lists but that draws an area's picture is a variant there, not an "other map".
    const shown = new Set(areas.flatMap(a => a.pictures.flat()));
    areas.push(area('Other maps', 'other', mapsWithoutArea(ids).filter(id => !shown.has(id))));
    const out = { title: romTitle(rom), maps, areas };
    catalogs.set(rom, out);
    return out;
}
