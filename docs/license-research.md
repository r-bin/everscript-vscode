# Software & Knowledge Licensing in the AI Era: Research & Strategy

> **Context:** Assessment of software and data licensing options for `evermore-core`, `everscript-vscode`, and related Secret of Evermore tooling.  
> **Primary Goal:** Prevent third parties from selling, commercializing, or packaging the software, decompilations, or knowledge base into proprietary commercial products (including closed commercial AI services/datasets), while preserving full freedom for romhackers, reverse engineers, and hobbyist contributors.

---

## 1. The Core Tension: AI Crawling vs. Non-Commercial Protection

In the modern development environment, two separate challenges exist:

1. **AI Scraping & Training:** Modern web scrapers harvest public code and data regardless of traditional open-source license headers (MIT, GPL, etc.). A software license is a legal instrument, not a technical access barrier. A public repository on GitHub can be read by public crawlers unless made private.
2. **Commercial Exploitation & Reselling:** Traditional permissive licenses (such as MIT or BSD) explicitly permit third parties to sell the code, include it in commercial closed-source software, or bundle it into paid commercial APIs and AI services without sharing improvements.

To prevent third parties from monetizing our work, we must evaluate licenses specifically designed to prohibit commercial use, while remaining compatible with hobbyist romhacking and existing toolchain components.

---

## 2. Existing Repository Licensing Baseline

Currently, the extension repository contains:
- **`LICENSE`:** MIT License for extension-authored code.
- **Embedded Third-Party Components:** The embedded SNES emulator WebAssembly core (`snes9x2005-wasm`) and SPC engine are distributed under the **Snes9x non-commercial license** (`src/core/emulator/core/snes9x2005-wasm/copyright`):
  > *"Permission to use, copy, modify and distribute Snes9x in both binary and source form, for non-commercial purposes, is hereby granted..."*
- **`README.md` explicit constraint:**  
  > *"The extension must not be sold."*

Because the Snes9x core is inherently non-commercial, the overall combined binary of the extension cannot be sold commercially regardless of the MIT header on other files. However, the standalone knowledge files, scripts, and decompilations are currently under MIT unless specified otherwise.

---

## 3. Analysis of License Models

### Model A: Dedicated Non-Commercial / Source-Available (Strongest "No Selling" Protection)

If the non-negotiable rule is **"Nobody may sell this or use it for commercial gain"**, modern non-commercial licenses provide unambiguous legal definitions:

#### 1. Code: [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)
- **What it does:** Drafted by prominent software licensing attorneys (the PolyForm Project). Permits copying, modifying, and running the software for any **noncommercial purpose** (personal, research, hobby, education).
- **Commercial restriction:** Explicitly forbids commercial use, paid distribution, or incorporation into commercial products/services.
- **Why it fits:** Short, plain-language text that clearly defines permitted non-commercial activities and prohibits monetization.

#### 2. Data & Knowledge Base: [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
- **What it does:** The global standard for content, wikis, and structured databases.
- **Key terms:**
  - **BY (Attribution):** Must give appropriate credit.
  - **NC (NonCommercial):** May not use the material for commercial purposes or monetary compensation.
  - **SA (ShareAlike):** Any remix, transformation, or derivative work must be distributed under the same license.
- **Why it fits:** The ~9,000 Markdown knowledge entries, YAML frontmatter, and JSON schemas in `knowledge/` represent game reverse-engineering facts and data rather than algorithmic executable code. CC BY-NC-SA 4.0 is specifically designed for data and documentation.

---

### Model B: Strong Network Copyleft (OSI Open Source Alternative: AGPLv3)

If broad compatibility with the formal Open Source Initiative (OSI) definition is preferred while still deterring commercial exploitation:

#### [GNU Affero General Public License v3 (AGPLv3)](https://www.gnu.org/licenses/agpl-3.0.en.html)
- **Mechanism:** True open-source copyleft. Does not outright ban selling (as OSI definitions prohibit commercial restrictions), but enforces **network copyleft**: anyone running the code as a service (or training an online AI model / serving an API built on it) must make the complete corresponding source code available under AGPLv3.
- **Deterrent effect:** Commercial proprietary entities generally ban AGPLv3 software internally because using it threatens their proprietary IP.
- **Drawback:** It does not legally prevent someone from selling a physical or digital copy directly if they supply the source code.

---

### Model C: AI and Text & Data Mining (TDM) Reservation

Under modern intellectual property frameworks (most notably **Article 4(3) of the European Union Digital Single Market Directive 2019/790**), copyright holders can formally opt out of automated text and data mining by commercial entities if the opt-out is expressly reserved in an appropriate manner (e.g., machine-readable metadata and terms).

While unauthorized scrapers operating in loose jurisdictions may ignore notices, compliant commercial AI vendors (including major corporate model providers) respect statutory TDM reservations to avoid copyright liability.

#### Recommended TDM Reservation Clause
```markdown
### AI Training and Data Mining Reservation
Pursuant to Article 4(3) of EU Directive 2019/790 and similar provisions in other 
jurisdictions, the author(s) expressly reserve all rights regarding the reproduction, 
scraping, extraction, and text and data mining (TDM) of this repository and its contents 
for the training, evaluation, fine-tuning, or development of machine learning or 
artificial intelligence models without prior written permission.
```

---

## 4. Proposed Strategy for the Evermore Ecosystem

For a modular architecture (`evermore-core`, `everscript-vscode`, `SecretOfEvermoreRecomp`, `everscript`):

```
┌────────────────────────────────────────────────────────────────────────┐
│                          evermore-core                                 │
├───────────────────────────────────┬────────────────────────────────────┤
│  Knowledge & Data (knowledge/,    │  CC BY-NC-SA 4.0                   │
│  data/, specs/, docs/)            │  (Attribution, NonCommercial, SA)  │
├───────────────────────────────────┼────────────────────────────────────┤
│  Tooling & Code (scripts/,        │  PolyForm Noncommercial 1.0.0      │
│  reconstructed-c/)                │  (Permits hobbyists, blocks sale)  │
├───────────────────────────────────┼────────────────────────────────────┤
│  AI Crawler Terms                 │  Statutory TDM Reservation         │
└───────────────────────────────────┴────────────────────────────────────┘
```

### Advantages of This Setup:
1. **Completely Clear Non-Commercial Stance:** Eliminates ambiguity. Hobbyists, romhackers, fan-translators, and speedrunners can read, fork, edit, and build upon everything freely.
2. **Commercial Exploitation Barred:** Neither individual sellers nor commercial companies can package the decompilations, data tables, or editor into paid software.
3. **Harmonious with Snes9x:** Matches the existing non-commercial requirement of the embedded Snes9x core.
4. **Clean Code vs. Data Distinction:** Software logic uses a software-specific license (PolyForm), while the extensive reverse-engineering database uses a database/creative-commons license (CC BY-NC-SA).

---

## 5. Summary Matrix

| License Candidate | Type | Selling Prohibited? | AI Commercial Training Prohibited? | Compatible with Snes9x Non-Commercial? |
|---|---|---|---|---|
| **MIT (Current)** | Permissive Open Source | ❌ No (Permits commercial sale) | ❌ No | ⚠️ Clashes with bundled Snes9x binary |
| **PolyForm Noncommercial 1.0.0** | Source-Available | ✅ Yes (Strictly non-commercial) | ✅ Yes (Commercial AI barred) | ✅ Fully compatible |
| **CC BY-NC-SA 4.0** (Data/Docs) | Content / Data License | ✅ Yes (Strictly non-commercial) | ✅ Yes (Commercial AI barred) | ✅ Fully compatible |
| **AGPLv3** | Strong Copyleft (OSI) | ⚠️ Partial (Must open all source) | ⚠️ Indirect (Source disclosure required) | ⚠️ Complex combination issues |
| **TDM Opt-Out Reservation** | Statutory Notice | N/A (Targets AI scraping) | ✅ Yes (Statutory barrier under EU DSM) | ✅ Additive to any license |
