# Third-Party Licenses and Legal Notices

The **Everscript VS Code Extension** is open-source software provided free of charge under the MIT License (see [LICENSE](file:///Users/v/Documents/GitHub/everscript-vscode/LICENSE)).

This extension bundles precompiled WebAssembly binaries of the `snes9x2005` emulator core for non-commercial in-editor testing and debugging. The emulator core contains code governed by third-party licenses:

---

## 1. Embedded SNES Emulator Core (`snes9x2005-wasm`)

The embedded WebAssembly runtime (`src/emulator/core/snes9x2005-wasm/`) is built from:
- **Fork with debugger integration:** [https://github.com/r-bin/snes9x2005-wasm](https://github.com/r-bin/snes9x2005-wasm) (branch: `feature/vscode-debugger-integration`)
- **Upstream snes9x2005-wasm:** [https://github.com/lrusso/snes9x2005-wasm](https://github.com/lrusso/snes9x2005-wasm)

### License Terms

1. **Snes9x Non-Commercial License**:
   - The Snes9x code is freeware for **personal, non-commercial use only**.
   - Commercial use, distribution, or inclusion in commercial products without written permission is prohibited.
   - All copies of the software must retain copyright notices of the Snes9x authors.
   - Full copyright and author list: see [`src/emulator/core/snes9x2005-wasm/copyright`](file:///Users/v/Documents/GitHub/everscript-vscode/src/emulator/core/snes9x2005-wasm/copyright).

2. **GNU General Public License v2 (GPL-2.0)**:
   - Portions derived from NDSSFC (Copyright (C) 2010 dking, GBAtemp users BassAceGold, ShadauxCat, Nebuleon) and ZSNES/C4 emulation are licensed under the **GNU General Public License Version 2**.
   - In compliance with GPL v2 Section 3, complete machine-readable source code for the built emulator core is publicly available at:
     - [https://github.com/r-bin/snes9x2005-wasm](https://github.com/r-bin/snes9x2005-wasm)
     - [https://github.com/lrusso/snes9x2005-wasm](https://github.com/lrusso/snes9x2005-wasm)

3. **Packaging Notice**:
   - The compiled WebAssembly artifacts (`snes9x_2005.js`, `snes9x_2005.wasm`) ship alongside the required `copyright` notice file inside every distribution package.
   - The extension itself does not distribute ROMs or copyrighted game assets. Users supply their own legally acquired ROMs.
