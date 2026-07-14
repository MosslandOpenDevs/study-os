# study-os

Korean-first study tooling — currently being narrowed from a broad "AI study OS"
concept toward a focused target: a **source-grounded error-remediation engine**
for a single Korean exam track. That target is a direction, not a description of
what runs today (see [Implementation status](#implementation-status)).

> **Status: Experimental / Pre-alpha.**
>
> This repository contains a working **text-only vertical slice** — Korean
> ingestion with resolvable citations, fail-closed summary generation, an
> FSRS review scheduler, and upload/review APIs over PostgreSQL — but it is
> **not** yet a usable study service: no auth, no PDF support, no deployment
> (see [Implementation status](#implementation-status)).
>
> This is an *experimental reference implementation*, not a released product.
> The code is open source under **Apache-2.0** (see [LICENSE](LICENSE));
> benchmark/corpus data is licensed separately (see
> [docs/data-licensing.md](docs/data-licensing.md)).

The original scaffold was authored on a single day (2026-04-10); the current
implementation landed on 2026-07-14 across PRs #18–#26. The repository is kept
under a **conditional-maintenance gate** with 30- and 60-day checkpoints
measured from 2026-07-14 (see [Maintenance gate](#maintenance-gate)); if the
gate is not met it will be archived rather than developed further.

---

## What's actually here today

- A pnpm workspace monorepo (`apps/*`, `packages/*`).
- Shared domain **types** in `@study-os/core` and a Prisma **schema** covering
  users, sources/revisions/spans, study units, quizzes with citations,
  attempts, and the remediation loop (`ErrorEpisode`, `Intervention`,
  `TransferAttempt`, `ReviewEvent`).
- A **database layer** (`packages/db`): Prisma 7 with the PostgreSQL driver
  adapter, migrations, and an idempotent seed — applied and smoke-tested
  against real Postgres in CI.
- A working **text ingestion pipeline** (`@study-os/ingestion`): deterministic,
  Korean-aware segmentation into study units whose citation offsets always
  resolve back to the exact source text, persisted atomically with real ids
  through `@study-os/db`.
- An **FSRS review scheduler** (`@study-os/scheduler`): ts-fsrs isolated
  behind an adapter, raw append-only `ReviewEvent`s (rating, latency,
  algorithm version, opaque state snapshots), and a prioritized daily queue
  where recurring errors outrank overdue time — served via
  `GET /api/review/queue` and `POST /api/review/events`.
- An **evidence-cited quiz engine** (`@study-os/quiz-engine`): the model emits
  verbatim evidence quotes that are anchored to verified offsets (fail-closed
  if a quote is not found in the source); Claude-backed or deterministic mock;
  Korean-aware normalized grading; wrong answers auto-open an `ErrorEpisode`
  via `POST /api/quiz-items/:id/attempts`.
- A **Fastify API** (`apps/api`) with health/readiness endpoints (readiness
  verifies database connectivity when a database is configured), graceful
  shutdown, and the first product endpoints: text source upload
  (`POST /api/sources` — validated, ingested, persisted atomically),
  source/unit retrieval with citation offsets, and the review endpoints above.
- A Vite + React **web app** (`apps/web`): study-unit list backed by the API
  (loading/error/empty states, citation badges) and a summary-card component,
  tested with Testing Library.
- **Quality gates:** Biome lint, Vitest unit tests, and a GitHub Actions
  pipeline (frozen install → lint → typecheck → test → build → runtime smoke
  test of the built API).
- A set of **planning documents** in [`docs/`](docs/).

**What is _not_ here yet:** authentication (userId travels in request bodies —
must be replaced before any public exposure), PDF processing, object storage.

---

## Where this is going

### Product thesis (hypothesis under evaluation)

> Let a Korean learner see *why* they got a question wrong — by cause — and track
> whether that cause recurs, using evidence-linked corrective and transfer items.

The earlier framing ("an all-in-one AI study OS, not just a chatbot") no longer
holds up. As of mid-2026, PDF summaries, AI quiz generation, page citations,
error saving, daily review, and D-day planning are **commodity** features shipped
by NotebookLM, RemNote, Gemini study notebooks, LilysAI, 유니브AI, and Anki's
FSRS. Spaced repetition on its own is not a differentiator either.

So the bet is narrowed to one thing those tools do *not* center: **cause-specific
remediation with recurrence measurement**, on a single exam vertical.

### Target loop

Instead of merely *saving* a wrong answer (the old `ErrorNotebookEntry`, now
removed), each error is attributed to a cause, prescribed an intervention, and
tracked for recurrence. The full loop is **modeled in the database** (see
`prisma/schema.prisma`); the application wiring lands with M2:

```text
SourceSpan
  → evidence-linked QuizItem
  → Attempt (+ response time + confidence)
  → ErrorEpisode
  → model-proposed cause  →  learner-confirmed cause
  → cause-specific Intervention
  → same-concept TransferItem
  → FSRS ReviewEvent
  → recurrence measured
```

**The model proposes a cause; the learner confirms it.** The system must not
diagnose a root cause from a single answer alone.

| Confirmed cause              | Intervention                                                  |
| ---------------------------- | ------------------------------------------------------------- |
| Concept gap                  | check prerequisites → re-explain → near/far transfer items    |
| Condition misread            | surface the problem's conditions → evidence-identification drills |
| Sign / unit / procedure slip | checklists + discrimination items on look-alike concepts      |
| Time pressure                | timed sets of isomorphic items                                |
| Faulty generated item        | stop attributing the error → discard and regenerate the item  |

### First vertical

Targeting students, certificate-takers, developers, teachers, and parents at once
just recreates a generic tool. The first target should be **one Korean exam** that
has a published official standard, modelable subject weights / passing lines /
time limits, mostly text-based assessment, obtainable rights to reuse items, and
real repeat-taking demand. `정보처리기사` is a candidate but is **not confirmed**
pending user validation and item-usage rights.

---

## Implementation status

| Area | State | Notes |
| --- | --- | --- |
| Domain types (`@study-os/core`) | ✅ Implemented | TypeScript interfaces + a product-vision string; no runtime logic |
| Ingestion (`@study-os/ingestion`) | ✅ Implemented (text) | Deterministic Korean-aware segmentation (Markdown/`제N장`/numbered/가나다 headings + paragraphs) with citation offsets satisfying `rawText.slice(start, end) === content`; validation; persisted transactionally with real ids via `@study-os/db` (integration-tested against Postgres in CI). PDF ingestion is M3. |
| Quiz generation (`@study-os/quiz-engine`) | ✅ Implemented | Quote-anchored citations (model emits verbatim quotes; provider resolves offsets deterministically — **fail-closed** if a quote isn't found in the source); type-specific validation (MCQ 3-5 choices/1 correct, `____` blanks); Claude-backed (structured outputs, adaptive thinking) or deterministic mock; Korean-aware normalized grading (NFC/whitespace/punctuation); `POST /api/units/:id/quiz` persists items with revision-mapped `SourceSpan` citations; wrong attempts auto-open `ErrorEpisode`s |
| Review scheduler (`@study-os/scheduler`) | ✅ Implemented | FSRS (ts-fsrs 5) behind an adapter — no hand-rolled algorithm; deterministic (fuzz off); JSON-serializable opaque card state; daily queue prioritizes recurring errors (failed transfers) over overdue time; validation + 12 unit tests; wired to `POST /api/review/events` (raw-event append) and `GET /api/review/queue` |
| Web app (`apps/web`) | 🟡 First screens | Study-unit list (`GET /api/sources` via dev proxy, loading/error/empty states, citation badges) + summary card rendering mock data with an AI-generated provenance label; Testing Library tests. Not yet a full study flow. |
| API (`apps/api`) | 🟡 First product endpoints | Fastify: `POST /api/sources` (zod-validated upload → ingestion → atomic persistence), source/unit retrieval with citations, `POST /api/demo/summary`; `/readyz` verifies DB connectivity; **no auth yet** (userId in body — pre-public blocker) |
| Database (`prisma/`, `packages/db`) | ✅ Wired | Prisma 7 (PostgreSQL driver adapter), migrations + seed, docker-compose; CI applies migrations and smoke-tests against real Postgres |
| Remediation data model (issue #2) | ✅ Implemented | `SourceRevision`/`SourceSpan` evidence backbone, `GenerationRun` provenance, `QuizItem` with choices/rubric/citations, `Attempt` (latency/confidence), `ErrorEpisode` (suggested vs confirmed cause), `Intervention`, `TransferAttempt`, append-only `ReviewEvent`; integration-tested end to end in CI. Application wiring is M2. |
| Summary generation (`@study-os/summary`) | ✅ Implemented | Korean-first `SummaryProvider` contract with provenance (`GenerationRun` info: model, prompt version, input hash, tokens); Claude-backed provider (structured outputs, adaptive thinking) when `ANTHROPIC_API_KEY` is set, deterministic offline mock otherwise; **fail-closed** on missing/insufficient evidence, refusals, and malformed output; demo route `POST /api/demo/summary` |
| PDF / storage | ❌ Missing | No PDF parser or object storage (M3) |
| Tests / lint / CI | ✅ Implemented | Biome lint, Vitest unit tests, GitHub Actions with a frozen-lockfile install and a runtime smoke test of the built API |

> Note on the build: the original scaffold compiled while the built API crashed
> at runtime (`ERR_MODULE_NOT_FOUND`), because `tsconfig` path aliases masked
> undeclared dependencies. That trap is now closed: workspace packages are
> declared dependencies resolved through built `dist` exports, and CI boots the
> actual built artifact on every change. **Compiling is not the same as being
> deployable — which is why the smoke test exists.**

---

## Repository layout

```text
apps/
  web/            # Vite + React: study-unit list + summary card screens
  api/            # Fastify API: sources upload/read, review events/queue, health
packages/
  core/           # shared TypeScript domain types
  db/             # Prisma 7 client factory (PostgreSQL driver adapter)
  ingestion/      # Korean-aware segmentation with resolvable citation offsets
  quiz-engine/    # evidence-cited quiz generation + Korean-aware grading
  scheduler/      # FSRS adapter (ts-fsrs) + prioritized daily review queue
  summary/        # Korean summary provider: Claude-backed or deterministic mock
prisma/
  schema.prisma   # data model
  migrations/     # SQL migrations (applied in CI against real Postgres)
  seed.mts        # idempotent dev seed
prisma.config.ts  # Prisma 7 config: schema/migrations paths, seed, datasource
scripts/
  smoke-api.mjs   # boots the built API artifact and verifies it end to end
  smoke-db.mjs    # verifies the built client against the migrated, seeded DB
docs/             # planning notes: product brief, MVP, roadmap, personas,
                  # architecture, backlog
```

There is **no `packages/prompts`** (it was listed in an earlier version of this
README but never existed). The formerly empty `packages/ui` placeholder was
removed; a UI package will be created when there is real shared UI code.

---

## Tech stack (as built)

- **Runtime / tooling:** Node 24 (`.nvmrc`), pnpm 11 (pinned via
  `packageManager`), committed lockfile, Biome for lint/format, Vitest for
  tests.
- **Web:** Vite 7 + React 19 (the earlier README proposed Next.js; the actual
  implementation is Vite, and this is the intended direction).
- **Packages/API:** TypeScript project references building to `dist` (packages
  are consumed through their built `exports`, not source aliases), ESM,
  Fastify 5, `tsx` for dev.
- **Database:** Prisma 7 (`prisma-client` generator into `packages/db`,
  PostgreSQL driver adapter, config in `prisma.config.ts`), migrations + seed,
  local Postgres via docker-compose.

### Known gaps

- **No authentication** — `userId` travels in request bodies; must be replaced
  before any public exposure.
- **No PDF ingestion or object storage** (M3 by design).
- **Cause attribution and interventions are not yet served over the API** —
  wrong answers open `ErrorEpisode`s automatically, but the suggest/confirm
  cause flow and intervention generation are the next slice.

Earlier gaps — the git-ignored lockfile, the non-runnable API, the missing
linter/tests/CI, the schema-only database layer, the placeholder ingestion and
scheduler — are fixed. **M0, M1, and M2 are complete.**

---

## Roadmap

**GitHub Issues are the single source of truth** for planned work. The milestones
below are the shape; the docs under [`docs/`](docs/) are historical planning
notes, not a live backlog.

| Milestone | Done when |
| --- | --- |
| **M0 — Reproducible baseline** | Committed lockfile, real lint + tests, CI, a genuinely runnable API, first DB migration |
| **M1 — Text-only vertical slice** | Text input → source span → Korean summary → evidence-linked question, in the UI |
| **M2 — Remediation loop** | `ErrorEpisode` → confirmed cause → intervention → transfer item → FSRS `ReviewEvent` |
| **M3 — Secure PDF / LLM** | Sandboxed parser, verifiable citations, privacy controls, and an evaluation harness |

Before broadening to PDFs, the goal is to complete a **text-only** slice end to
end. The remediation data model is **implemented**: `SourceRevision` (verbatim
source text — citations resolve forever) / `SourceSpan`, `GenerationRun`
(provider, model, prompt version, input hash, tokens, cost), a richer
`QuizItem` (choices, accepted answers, rubric, span citations), `Attempt`
(latency, confidence, grading method), `ErrorEpisode` (suggested vs.
learner-confirmed cause, status lifecycle), `Intervention`, `TransferAttempt`
(recurrence measurement), and the append-only `ReviewEvent` log (rating,
latency, algorithm version, opaque pre/post scheduler state — recomputable).

FSRS is **implemented behind an adapter** (`@study-os/scheduler`): `again /
hard / good / easy` ratings, latency, and the algorithm version are preserved
as raw `ReviewEvent`s with opaque before/after state, so schedules can be
recomputed later.

### AI quality & safety gates (targets, not yet met)

Grounding is the point of the product, so shipping generated items publicly
should be gated on: citations that resolve to real document spans, high
expert-verified answer accuracy, answers entailed by their source, a low rate of
ambiguous/multi-answer items, and a majority of items usable without edits.
Generation should **fail closed** when evidence is missing, and treat text inside
uploaded documents as untrusted data, never as instructions.

---

## Maintenance gate

This repo is kept as a **Labs / Experimental** project under a conditional gate:

- **By 2026-08-13:** a named owner (DRI — still needed); ~~M0 CI green~~ ✓;
  ~~a runnable API and a text-only demo~~ ✓; ~~over-claims removed from this
  README~~ ✓; ~~a license decision~~ ✓ (Apache-2.0).
- **By 2026-09-12:** one exam vertical; a source-grounded remediation slice;
  publishable golden fixtures and evaluation results; a small (10–20 person)
  comparison test; and evidence that cause-based remediation adds value over
  NotebookLM / RemNote.

Pass the gate → the project continues as `v0.1.0-alpha`. Miss it → the repository
is archived with a banner and documented revival conditions.

---

## Not planned / deferred

Explicitly out of scope for now, to keep the bet narrow:

- Parent / tutor / study-group modes
- Voice / oral answer evaluation
- Notion / Obsidian integration and concept maps
- Vector database and multi-model routing
- Generic LMS / school-admin positioning
- Integrations with other Mossland services (Passport, Agora, MOC)
- Pinned-repository / showcase listing

---

## Local development

Requires Node 24+ (see `.nvmrc`) and pnpm 11 (pinned via `packageManager`; with
Corepack, `corepack enable` picks it up automatically).

```bash
pnpm install --frozen-lockfile   # reproducible install from the committed lockfile
pnpm lint                        # Biome
pnpm typecheck                   # prisma generate + tsc -b across all references + web
pnpm test                        # Vitest unit tests
pnpm build                       # prisma generate + packages/API to dist/, web via Vite
pnpm smoke                       # boots the built API and verifies health + shutdown
pnpm dev                         # web app (proxies /api → :3000) + API in parallel
```

Database (optional locally; CI always runs it):

```bash
cp .env.example .env             # DATABASE_URL (defaults match docker-compose.yml)
docker compose up -d             # local Postgres 17
pnpm db:migrate:dev              # create/apply migrations in development
pnpm db:migrate:deploy           # apply committed migrations (what CI runs)
pnpm db:seed                     # idempotent demo data
pnpm smoke:db                    # built client ↔ migrated DB round-trip check
```

The API listens on `PORT` (default `3000`, host `127.0.0.1`) and exposes
`/healthz`, `/readyz`, `POST/GET /api/sources`, `GET /api/sources/:id`,
`POST /api/review/events`, `GET /api/review/queue`, and the demo routes
(`/api/demo/study-loop`, `POST /api/demo/summary`).

---

## Contributing

M0–M2 are complete and every package is model-backed or fully implemented —
there are no stubs left. Current focus areas: the **suggest/confirm cause
flow** (serving `ErrorEpisode` attribution + interventions over the API), the
**exam vertical** decision, and the **M3** secure-PDF/evaluation work. Please
use **GitHub Issues** as the source of truth for what's actually being worked
on; open an issue before large changes.

## License

**Code: [Apache-2.0](LICENSE)** (chosen to encourage adoption of the reference
engine; includes an explicit patent grant). See also [NOTICE](NOTICE).

**Benchmark/corpus data is licensed separately from the code** — every
published dataset must carry a per-item `creator / source_url / license`
manifest, and unlicensed material is never committed. Full policy:
[docs/data-licensing.md](docs/data-licensing.md).
