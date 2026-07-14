# study-os

Korean-first study tooling — currently being narrowed from a broad "AI study OS"
concept toward a focused target: a **source-grounded error-remediation engine**
for a single Korean exam track. That target is a direction, not a description of
what runs today (see [Implementation status](#implementation-status)).

> **Status: Experimental / Pre-alpha.**
>
> This repository currently contains an **architectural scaffold** — planning
> docs, shared TypeScript types, stub algorithms, and a minimal API that boots
> but serves only health/demo endpoints. It is **not** a usable study service
> (see [Implementation status](#implementation-status)).
>
> This is an *experimental reference implementation*, not a released product and
> not (yet) open source: **no LICENSE has been chosen**, so treat the code as
> *all rights reserved / license pending*.

All code to date was authored on a single day (2026-04-10) as an initial
scaffold. The repository is kept under a **conditional-maintenance gate** with
30- and 60-day checkpoints measured from 2026-07-14 (see
[Maintenance gate](#maintenance-gate)); if the gate is not met it will be
archived rather than developed further.

---

## What's actually here today

- A pnpm workspace monorepo (`apps/*`, `packages/*`).
- Shared domain **types** in `@study-os/core` and a Prisma **schema** describing
  users, sources, study units, quizzes, attempts, an error notebook, and review
  tasks.
- A working **text ingestion pipeline** (`@study-os/ingestion`): deterministic,
  Korean-aware segmentation into study units whose citation offsets always
  resolve back to the exact source text, persisted atomically with real ids
  through `@study-os/db`.
- Two **stub algorithm packages** (quiz-engine, scheduler) that build and pass
  tests but contain placeholder logic and no LLM calls.
- A minimal **Fastify API** (`apps/api`) that boots, serves `/healthz`,
  `/readyz`, and a demo route, and shuts down gracefully — no product
  endpoints yet.
- A static Vite + React **intro page** (`apps/web`).
- **Quality gates:** Biome lint, Vitest unit tests, and a GitHub Actions
  pipeline (frozen install → lint → typecheck → test → build → runtime smoke
  test of the built API).
- A set of **planning documents** in [`docs/`](docs/).

- A **database layer** (`packages/db`): Prisma 7 with the PostgreSQL driver
  adapter, a first migration, and an idempotent seed — applied and
  smoke-tested against real Postgres in CI.

**What is _not_ here yet:** product API endpoints, any real LLM or PDF
processing, storage, or authentication.

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

Instead of merely *saving* a wrong answer (today's `ErrorNotebookEntry`), the
intended flow attributes each error to a cause, prescribes an intervention, and
verifies whether the same concept fails again:

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
| Quiz generation (`@study-os/quiz-engine`) | 🟡 Stub | English placeholder prompts, no model; `gradeAnswer` is exact lowercased string match (no Korean normalization) |
| Review scheduler (`@study-os/scheduler`) | 🟡 Stub | Fixed 24h / 72h / 7d / 14d table; caps at 14 days forever after the 4th review; no FSRS |
| Web app (`apps/web`) | 🟡 Placeholder | Vite + React static intro page; not a product UI |
| API (`apps/api`) | 🟡 Minimal but runnable | Fastify server with `/healthz`, `/readyz`, graceful shutdown, and a demo route proving runtime package resolution; no product endpoints |
| Database (`prisma/`, `packages/db`) | ✅ Wired | Prisma 7 (`prisma-client` generator, PostgreSQL driver adapter), first migration, idempotent seed, `.env.example`, docker-compose Postgres; CI applies the migration and smoke-tests the built client against a real database |
| LLM / PDF / storage | ❌ Missing | No model calls, PDF parser, or object storage |
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
  web/            # Vite + React intro page
  api/            # Fastify API: /healthz, /readyz, demo route, graceful shutdown
packages/
  core/           # shared TypeScript domain types
  db/             # Prisma 7 client factory (PostgreSQL driver adapter)
  ingestion/      # text-split stub
  quiz-engine/    # placeholder quiz generation + exact-match grading
  scheduler/      # fixed-interval review stub
prisma/
  schema.prisma   # data model
  migrations/     # SQL migrations (applied in CI against real Postgres)
  seed.ts         # idempotent dev seed
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

### Known baseline gaps

- The API serves only health/demo endpoints; product endpoints arrive with the
  M1 vertical slice.

Earlier gaps — the git-ignored lockfile, the non-runnable API, the missing
linter/tests/CI, and the schema-only database layer — are fixed. **M0 is
complete.**

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
end. The near-term data model the slice needs (beyond today's types) includes
`SourceRevision` / `SourceSpan`, a `GenerationRun` (model, prompt, parser version,
input hash, cost), a richer `QuizItem` (choices, accepted answers, rubric,
citations), `Attempt` (latency, confidence, grading method), `ErrorEpisode`
(suggested vs. confirmed cause), `Intervention` / `TransferAttempt`, and
`ReviewEvent` (rating, pre/post FSRS state, algorithm version).

FSRS should be introduced **behind an adapter**, preserving `Again / Hard / Good /
Easy`, latency, and algorithm version as raw events so schedules can be
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

- **By 2026-08-13:** a named owner (DRI); M0 CI green; a runnable API and a
  text-only demo; over-claims removed from this README; a license decision (or a
  clear *license pending* notice).
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
pnpm dev                         # web intro page + API (tsx watch) in parallel
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
`/healthz`, `/readyz`, and `/api/demo/study-loop`.

---

## Contributing

Early contributions should focus on the reproducible baseline (**M0**) and the
text-only vertical slice (**M1**). Please use **GitHub Issues** as the source of
truth for what's actually being worked on; open an issue before large changes.

## License

**None yet.** No license has been selected, so all rights are reserved by default
— do not assume MIT or any other permissive terms. A license (likely Apache-2.0
or AGPL-3.0, pending a rights review) will be added before any wider adoption is
encouraged. Benchmark/corpus data, if published, will be licensed separately from
the code with a per-item `creator / source_url / license` manifest.
