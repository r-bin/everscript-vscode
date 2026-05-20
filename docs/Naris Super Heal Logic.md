# Naris Super Heal Logic

## Overview

Naris gives the player a chance to learn the alchemy spell `Super Heal`.

The minigame is effectively a 50/50 coin flip based on the low bit of the game timer.

There is also a cooldown between attempts.

---

# High-Level Flow

```pseudo
function talkToNaris():

    hideUnwindowedText()

    if controlledCharacter != Boy:
        showDogDialogue()
        return

    showIntroDialogue()

    if playerAlreadyHasSuperHeal:
        showAlchemyEquipMenu()
        return

    currentTimer = GameTimer & 0xFFFF

    # Calculate time since last attempt
    if currentTimer > lastAttemptTimer:
        elapsed = currentTimer - lastAttemptTimer
    else:
        elapsed = (0xFFFF - lastAttemptTimer) + currentTimer

    # Cooldown check
    if elapsed < 10000 AND lastAttemptTimer != 0:
        showCooldownDialogue()
        return

    # Generate two different random numbers
    # (unused fluff logic)
    do:
        randA = random(0..9)
        randB = random(0..9)
    while randA == randB

    # Secret winning value
    winningChoice = (GameTimer & 0xFFFF) & 1

    # Ask player to choose between two answers
    playerChoice = showGuessDialogue()

    clearText()

    # Save attempt time
    lastAttemptTimer = GameTimer & 0xFFFF

    if playerChoice == winningChoice:

        unlockSuperHeal()

        preselectAlchemy(SuperHeal)

        showAlchemySelectionScreen()

    else:

        showWrongAnswerDialogue()

    return