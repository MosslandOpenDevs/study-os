# Architecture Overview

## Monorepo shape

```text
apps/
  web/           user-facing study dashboard
  api/           backend API and background job entrypoints
packages/
  core/          domain types, business rules, shared utilities
  ingestion/     document parsing and study-unit extraction
  quiz-engine/   question generation and answer checking
  scheduler/     review scheduling and study planning logic
  ui/            shared UI components
```

## App responsibilities

### apps/web
- learner dashboard
- material upload flow
- quiz solving UI
- error notebook UI
- review queue UI
- exam plan and progress tracking

### apps/api
- auth and session management
- upload orchestration
- study-unit generation jobs
- quiz generation endpoints
- review scheduling endpoints
- analytics and progress summaries

## Package responsibilities

### packages/core
- domain models
- validation logic
- study state machine
- shared constants and types

### packages/ingestion
- file ingestion pipeline
- PDF/text parsing
- chunking into study units
- source citation mapping

### packages/quiz-engine
- quiz generation interfaces
- answer grading helpers
- wrong-answer explanation helpers

### packages/scheduler
- spaced repetition logic
- daily queue generation
- D-day plan calculation
- weak-topic prioritization

### packages/ui
- reusable components
- chart and dashboard primitives
- study card and review list building blocks

## Initial technical direction
- frontend: Next.js
- backend: Node.js API server
- database: Postgres
- queue/jobs: lightweight worker queue
- storage: object storage for uploaded materials
- vector search: optional semantic retrieval layer for source-grounded answers

## First implementation principle
Build the smallest loop that proves value:
- upload one document
- generate one Korean summary
- generate one quiz
- record one mistake
- schedule one review task
