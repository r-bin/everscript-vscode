Prophet Bronze Armor Logic

Core State Variables

Variable	Meaning
$244f	Prophet dialog/story state
$236b	Prophet NPC mode/state
$2451	Number of prophet interactions
$2895	Random value (RAND & 31)
$254d	Timestamp used for cooldown
$22eb & 0x80	Reward already obtained

Leaving the prophet area resets progression:

void resetProphetArea() {
    prophetState = 0; // $244f
}

⸻

Full Pseudo Code

// Entering/leaving prophet area
void resetProphetArea() {
    prophetState = 0;   // $244f
}
// Talk to prophet
void talkToProphet() {
    interactionCount++;                 // $2451++
    rand32 = RNG() & 31;               // $2895 = RAND & 31
    bool rerolled = false;
    // -------------------------------------------------
    // Special temporary lock state
    // -------------------------------------------------
    if (npcState == 4) {               // $236b == 4
        prophetState = 5;
        // cooldown expired?
        if (savedTimer < (gameTimer - 0x0E10)
            && !gotArmorReward) {
            npcState = 0;
            prophetState = 0;
        }
        rerolled = true;
    }
    // -------------------------------------------------
    // States 0-2
    // -------------------------------------------------
    if ((prophetState >= 0 && prophetState < 3)
        && !rerolled) {
        // 2/32 chance
        if (rand32 < 2) {
            prophetState = 6;
            rerolled = true;
        }
        // 2/32 chance
        else if (rand32 > 29) {
            prophetState = 9;
            rerolled = true;
        }
        // otherwise:
        // stay on normal progression
    }
    // -------------------------------------------------
    // States 3-5
    // -------------------------------------------------
    if ((prophetState >= 3 && prophetState < 6)
        && !rerolled) {
        // early interactions
        if (interactionCount <= 30) {
            // 9/32 chance
            if (rand32 < 9) {
                prophetState = 6;
                rerolled = true;
            }
            // 7/32 chance
            else if (rand32 > 24) {
                prophetState = 9;
                rerolled = true;
            }
        }
        // later interactions
        else {
            // 20/32 chance
            if (rand32 < 20) {
                prophetState = 6;
                rerolled = true;
            }
            // 11/32 chance
            else if (rand32 > 20) {
                prophetState = 9;
                rerolled = true;
            }
        }
    }
    // -------------------------------------------------
    // States 6-8
    // -------------------------------------------------
    if ((prophetState >= 6 && prophetState < 9)
        && !rerolled) {
        // 3/32 chance
        if (rand32 < 3) {
            prophetState = RNG() & 3; // 0-3
            rerolled = true;
        }
        // 3/32 chance
        else if (rand32 > 28) {
            prophetState = 9;
            rerolled = true;
        }
    }
    // -------------------------------------------------
    // States 10+
    // -------------------------------------------------
    if (prophetState > 9) {
        prophetState = (RNG() & 7) + 9;
        if (prophetState == 16 || rand32 > 29) {
            prophetState = 6;
            rerolled = true;
        }
        else if (rand32 < 10 && !rerolled) {
            prophetState = RNG() & 3;
        }
    }
    // -------------------------------------------------
    // Show dialog
    // -------------------------------------------------
    showDialog(prophetState);
    // -------------------------------------------------
    // Bronze Armor branch
    // -------------------------------------------------
    if (prophetState == 8) {
        choice = menu(
            "Goat",
            "Chicken",
            "Basket"
        );
        if (choice == CANCEL) {
            if (!gotBronzeArmor) {
                give("Bronze Armor");
            }
            else if (!gotStoneVest) {
                give("Stone Vest");
            }
            else if (!gotCenturianCape) {
                give("Centurian Cape");
            }
            else {
                giveJewels();
            }
        }
    }
    // -------------------------------------------------
    // Progress to next state
    // -------------------------------------------------
    prophetState++;
}

⸻

How the Bronze Armor Route Works

The Bronze Armor event only occurs when:

prophetState == 8

At that point the prophet says:

“This is a video game…”

Then the player receives the Goat/Chicken/Basket menu.

To obtain Bronze Armor:

1. Reach dialog state 8
2. Cancel the menu (0xFFFF)
3. Have not already received Bronze Armor

The reward itself is deterministic once the correct dialog is reached.

⸻

Odds of Getting the Bronze Armor Dialog

To naturally reach dialog 8 from a fresh reset:

* the dialog chain must avoid reroutes
* avoid jumps to 6
* avoid jumps to 9+
* avoid resets back to 0-3

Approximate probability:

\left(\frac{28}{32}\right)^3
\times
\left(\frac{16}{32}\right)^3
\times
\left(\frac{26}{32}\right)^2
\approx 0.045

\left(\frac{28}{32}\right)^3 \times \left(\frac{16}{32}\right)^3 \times \left(\frac{26}{32}\right)^2 \approx 4.5\%

So:

Event	Probability
Reach Bronze Armor dialog	~4.5%
Fail route	~95.5%

⸻

Average Number of Attempts

Expected attempts:

E[\text{attempts}] = \frac{1}{0.045} \approx 22.2

E[\text{attempts}] = \frac{1}{0.045} \approx 22.2

So on average:

* about 22 resets
* before successfully reaching the Bronze Armor dialog

⸻

Best Strategy

Optimal Reset Timing

Reset immediately when:

* the prophet jumps to state 9+
* the dialog chain becomes obviously incorrect
* the route rerolls backward

Do not wait for cooldown expiration.

The fastest strategy is:

while (!gotBronzeArmor) {
    resetProphetArea();
    while (true) {
        talkToProphet();
        if (prophetState >= 10) {
            // dead route
            resetProphetArea();
            break;
        }
        if (gotBronzeArmor) {
            return SUCCESS;
        }
    }
}

⸻

Practical Player Strategy

Fastest Human Method

1. Enter prophet area
2. Mash through dialog
3. Watch for:
    * jumps into late prophecy IDs
    * bad reroutes
4. Immediately reset on dead route
5. Continue only if progression stays alive
6. Reach:
    “This is a video game…”
7. Cancel the menu
8. Receive Bronze Armor

The optimization is therefore not RNG manipulation itself, but:

* minimizing time spent on dead routes
* resetting immediately when the chain becomes invalid
* preserving only promising progression paths