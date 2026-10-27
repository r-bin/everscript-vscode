// Ownership: public entry point of the music domain (the radar panel's Music tab).

import { buildMusicModel } from './model/catalog';
import { handlesMusicMessage, handleMusicMessage, sfxNames } from './host';
import { buildMusicTabHtml } from './render-music-tab';
import { trackTimeline, trackSequence } from './model/track-timeline';

export { buildMusicModel, handlesMusicMessage, handleMusicMessage, sfxNames, buildMusicTabHtml, trackTimeline, trackSequence };
