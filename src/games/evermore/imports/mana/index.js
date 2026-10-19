'use strict';
// Ownership: public entry of the Secret of Mana -> Evermore conversion (README.md).
module.exports = {
    ...require('../../../../../dist/games/evermore/imports/mana/rooms'),
    ...require('../../../../../dist/games/evermore/imports/mana/convert'),
    ...require('../../../../../dist/games/evermore/imports/mana/virtual-rom'),
    ids: require('../../../../../dist/games/evermore/imports/mana/ids'),
};
