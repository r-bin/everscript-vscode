'use strict';
// Thin shim — delegates all exports to the rooms/ subsystem.
// See rooms/data/ for the actual implementations.
// This file kept for backward compatibility with existing require() calls.

module.exports = require('./rooms');
