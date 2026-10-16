// Ownership: PNG output for rendered pictures (PixelBuffer). The encoder itself is platform/png.ts.
import { encodePng as encodeRgba } from '../../../platform/png';
import { PixelBuffer } from './render';

/** Encode an RGBA pixel buffer as a PNG. */
export function encodePng(image: PixelBuffer): Buffer {
    return encodeRgba(image.width, image.height, image.data);
}

/** Encode as a `data:` URI, ready to drop into an `<img src>`. */
export function encodePngDataUri(image: PixelBuffer): string {
    return 'data:image/png;base64,' + encodePng(image).toString('base64');
}
