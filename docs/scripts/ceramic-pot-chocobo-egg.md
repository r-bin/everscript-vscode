# Secret of Evermore — Ceramic Pot / Chocobo Egg Logic

## Overview

This script controls:

1. Buying ceramic pots in the Nobilia market
2. Hidden treasure rewards inside purchased pots
3. The random chance to obtain the Chocobo Egg

---

# Important Variables

| Variable | Meaning |
|---|---|
| `$251b` | Current ceramic pot count |
| `$285d` | Snapshot of pot count BEFORE purchase |
| `$285b` | Number of pots selected for purchase |
| `$2527` | Player rice amount |
| `$289d` | Temporary random/result variable |
| `$289f` | Dialog response variable |

---

# Key Discovery

Before the purchase menu appears, the script saves the current pot count:

```c
$285d = $251b;
```

After a successful purchase:

```c
$251b += purchasedPots;
```

Therefore:

```c
$251b > ($285d + 6)
```

really means:

```c
purchasedPots >= 7
```

and:

```c
$251b > ($285d + 1)
```

means:

```c
purchasedPots >= 2
```

---

# Actual Purchase Behavior

| Purchase Amount | Hidden Reward Chance |
|---|---|
| 1 pot | 0% |
| 5 pots | 3/8 = 37.5% |
| 10 pots | 3/16 = 18.75% |

Surprisingly, buying 5 pots gives better odds than buying 10.

---

# Full Pseudocode

```c
oldPots = currentPots;

buyPots(amount);

newPots = oldPots + amount;

// -------------------------------------------------
// Determine whether a hidden item is found
// -------------------------------------------------

bool foundSomething = false;

if (amount >= 7)
{
    // buying 10 pots

    if ((rand() & 15) < 3)
        foundSomething = true;
}
else if (amount >= 2)
{
    // buying 5 pots

    if ((rand() & 7) < 3)
        foundSomething = true;
}

// buying 1 pot can never trigger reward

if (!foundSomething)
    return;

// -------------------------------------------------
// Reward triggered
// -------------------------------------------------

show("One of these ceramic pots has something in it!");

// Already owns special items?
if (hasMagicGourd || hasChocoboEgg)
{
    giveJewels(50);
    return;
}

// Roll for Chocobo Egg
if ((rand() & 15) == 7)
{
    giveChocoboEgg();
}
else
{
    giveJewels(10);
}
```

---

# Effective Egg Probability

The Chocobo Egg itself has a 1/16 chance after the hidden reward event triggers.

## Buying 5 Pots

```text
Reward trigger chance:
3/8 = 37.5%

Egg chance:
37.5% * 1/16
= 2.34375%
```

## Buying 10 Pots

```text
Reward trigger chance:
3/16 = 18.75%

Egg chance:
18.75% * 1/16
= 1.171875%
```

---

# Final Conclusion

The optimal strategy for obtaining the Chocobo Egg is:

- Buy 5 pots repeatedly
- Never buy 1 pot
- Buying 10 pots is statistically worse than buying 5

This appears to be either:

- an accidental probability inversion by the developers
- or a misunderstood balancing attempt involving `RAND & 15`

