// Ownership: Central entry point for all Evermore localizations and subjective names.
// Concentrates subjective names (maps, sounds, tables, functions) and supports
// optional in-game string indices resolved against ROM bytes.

import * as strings from './strings';
import * as maps from './maps';
import * as sounds from './sounds';
import * as tables from './tables';
import * as functions from './functions';
import * as scripts from './scripts';
import * as comments from './comments';

export const decodeRomString = strings.decodeRomString;
export const resolveLocalizedName = strings.resolveLocalizedName;
export const VANILLA_MAPS = maps.VANILLA_MAPS;
export const VANILLA_ROOMS = maps.VANILLA_ROOMS;
export const MAP_BY_ID = maps.MAP_BY_ID;
export const getMap = maps.getMap;
export const getMapName = maps.getMapName;
export const getMapArea = maps.getMapArea;
export const MUSIC = sounds.MUSIC;
export const SOUNDS = sounds.SOUNDS;
export const EXTRAS = sounds.EXTRAS;
export const getMusic = sounds.getMusic;
export const getMusicName = sounds.getMusicName;
export const getSound = sounds.getSound;
export const getSoundName = sounds.getSoundName;
export const TABLES = tables.TABLES;
export const TABLE_BY_ADDRESS = tables.TABLE_BY_ADDRESS;
export const getTable = tables.getTable;
export const getTableName = tables.getTableName;
export const FUNCTIONS = functions.FUNCTIONS;
export const FUNCTION_BY_ADDRESS = functions.FUNCTION_BY_ADDRESS;
export const getFunction = functions.getFunction;
export const getFunctionName = functions.getFunctionName;
export const NPC_SCRIPTS = scripts.NPC_SCRIPTS;
export const ABS_SCRIPTS = scripts.ABS_SCRIPTS;
export const GLOBAL_SCRIPTS = scripts.GLOBAL_SCRIPTS;
export const getNpcScript = scripts.getNpcScript;
export const getNpcScriptName = scripts.getNpcScriptName;
export const getAbsScript = scripts.getAbsScript;
export const getAbsScriptName = scripts.getAbsScriptName;
export const getGlobalScript = scripts.getGlobalScript;
export const getGlobalScriptName = scripts.getGlobalScriptName;
export const setScriptOverride = scripts.setScriptOverride;
export const getRomComment = comments.getRomComment;
export const getWramComment = comments.getWramComment;
export const getAllRomComments = comments.getAllRomComments;

