// Ownership: a dog form's pictures for the script listings — its idle animation's first frame
// facing south, and its HUD portrait (dog-forms.ts: header +3), in its own palette, as PNG data URIs. Apart from dog-forms.ts, which the animation
// decoder reads (through character-model.ts): drawing here needs the decoder. Pure.

import { readDogForm, DOG_FORM_COUNT } from './dog-forms';
import { renderAnimation } from './animation-decoder';
import * as maps from '../maps';
import { paletteAt } from '../maps/character-record';

/** The Dog's character record. */
const DOG = 1;

/**
 * `form` is the request value (ram/7e2443: 2, 4, … $0C; the entry table at $8F:945D starts with
 * no form at 0); null for another value.
 */
function dogFormIcon(rom: Uint8Array, form: number): string | null {
    if (form < 2 || form > 2 * DOG_FORM_COUNT || form & 1) return null;
    const f = readDogForm(rom, form / 2 - 1);
    const idle = f.anims.find((a) => a.purpose === 'idle');
    if (!idle) return null;
    const anim = renderAnimation(rom, DOG, { key: 'record', category: 'external', animRec: idle.animRec, paletteAddr: f.paletteAddr, paletteForced: true }, 8);
    return anim?.frames?.[0]?.png ?? null;
}

/** A dog form's HUD portrait (the face beside its HP): the form's portrait sprite in its palette; null for another value. */
function dogPortrait(rom: Uint8Array, form: number): string | null {
    if (form < 2 || form > 2 * DOG_FORM_COUNT || form & 1) return null;
    const f = readDogForm(rom, form / 2 - 1);
    const img = maps.renderSpriteAt(rom, f.portrait, paletteAt(rom, f.paletteAddr));
    return img ? maps.encodePngDataUri(img) : null;
}

export { dogFormIcon, dogPortrait };
