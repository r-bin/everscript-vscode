'use strict';
// Ownership: Central entry point for all Evermore localizations and subjective names.
// Concentrates subjective names (maps, sounds, tables, functions) and supports
// optional in-game string indices resolved against ROM bytes.

const strings = require('./strings');
const maps = require('./maps');
const sounds = require('./sounds');
const tables = require('./tables');
const functions = require('./functions');

module.exports = {
    // Strings & resolution
    decodeRomString: strings.decodeRomString,
    resolveLocalizedName: strings.resolveLocalizedName,

    // Maps / Rooms
    VANILLA_MAPS: maps.VANILLA_MAPS,
    VANILLA_ROOMS: maps.VANILLA_ROOMS,
    MAP_BY_ID: maps.MAP_BY_ID,
    getMap: maps.getMap,
    getMapName: maps.getMapName,
    getMapArea: maps.getMapArea,

    // Sounds & Music
    MUSIC: sounds.MUSIC,
    SOUNDS: sounds.SOUNDS,
    EXTRAS: sounds.EXTRAS,
    getMusic: sounds.getMusic,
    getMusicName: sounds.getMusicName,
    getSound: sounds.getSound,
    getSoundName: sounds.getSoundName,

    // Tables
    TABLES: tables.TABLES,
    TABLE_BY_ADDRESS: tables.TABLE_BY_ADDRESS,
    getTable: tables.getTable,
    getTableName: tables.getTableName,

    // Functions
    FUNCTIONS: functions.FUNCTIONS,
    FUNCTION_BY_ADDRESS: functions.FUNCTION_BY_ADDRESS,
    getFunction: functions.getFunction,
    getFunctionName: functions.getFunctionName,
};
