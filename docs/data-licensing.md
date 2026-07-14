# Benchmark & Corpus Data Licensing Policy

The **code** in this repository is licensed under Apache-2.0 (see
[LICENSE](../LICENSE)). **Benchmark data, golden fixtures, and evaluation
corpora are licensed separately** and are never covered by the code license.

## Rules

1. **No data enters this repository without a provenance manifest.** Every
   published benchmark/corpus directory must contain a `MANIFEST.json` with
   one entry per item:

   ```json
   {
     "items": [
       {
         "id": "sample-001",
         "creator": "<author or rights holder>",
         "source_url": "<where the material came from>",
         "license": "<SPDX identifier or explicit terms>",
         "notes": "<usage constraints, if any>"
       }
     ]
   }
   ```

2. **Default-deny.** Material without a confirmed license or usage right is
   not committed — no exam questions, textbook excerpts, or lecture material
   whose reuse rights have not been verified. This applies doubly to Korean
   exam items (기출문제): item usage rights must be secured **before** any
   exam vertical corpus lands here (see the maintenance gate in the README).

3. **Synthetic-first.** Prefer synthetic or self-authored Korean fixtures
   (like the ones already used in tests) — they carry the repo's data license
   by default and need no external clearance.

4. **Data license declaration.** Each corpus directory declares its own
   license in its manifest (e.g. CC-BY-4.0 for self-authored evaluation sets).
   If unstated, the data is **all rights reserved** and must not be
   redistributed.

5. **Takedown.** Rights holders can request removal via a GitHub issue;
   confirmed requests are honored by removing the item and its derived
   artifacts (embeddings, caches, fixtures) in the next release.
