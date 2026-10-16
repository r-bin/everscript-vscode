# src/games/terra — Terranigma Support

Terranigma (SNES, Quintet / Enix, 1995) support module for the multi-game architecture.

## Overview
- **Descriptor**: Registered as game id `terra` with URI scheme `terra://`.
- **Variants**: Recognizes European base ROM, German, German Rev 1, French, Spanish, and Japanese (Tenchi Souzou) releases.
- **ROM Inspection**: Validates HiROM FastROM 4 MB cartridge headers and decodes the 1104-entry room pointer table (Table A) and event table (Table B).

See [docs/terra/README.md](../../../docs/terra/README.md) for reverse-engineered facts, ROM maps, and table addresses.
