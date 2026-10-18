'use strict';
// Ownership: public entry of the Secret of Mana -> Evermore conversion (README.md).
module.exports = {
    ...require('./rooms'),
    ...require('./convert'),
    ...require('../../../../../dist/games/evermore/imports/mana/virtual-rom'),
    ids: require('../../../../../dist/games/evermore/imports/mana/ids'),
};
