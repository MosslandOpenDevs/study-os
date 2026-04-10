# 4-Week MVP Roadmap

## Goal
Ship a usable Korean-first study MVP centered on document ingestion, Korean summaries, quiz generation, error notebook capture, and review scheduling.

## Week 1: Single-user learning loop foundation
- set up single-user local flow without full auth
- add persistence foundation
- build source upload and study-unit creation flow
- generate and display Korean summaries

Deliverables:
- local database wiring
- source ingestion endpoint
- study unit list UI
- summary generation contract and mock output UI

## Week 2: Quiz and mistake capture
- generate quizzes from study units
- submit answers
- grade answers
- save incorrect attempts into the error notebook

Deliverables:
- quiz generation endpoint
- quiz solving UI
- attempt submission flow
- error notebook persistence

## Week 3: Review and planning experience
- generate review tasks from notebook entries
- show a daily review queue
- add target exam / goal creation
- surface weak topics and pending tasks in the dashboard

Deliverables:
- scheduler-backed review queue
- review page
- goal setup page
- dashboard summary cards

## Week 4: Polish and release baseline
- improve prompt quality and UX clarity
- handle common edge cases and failures
- add seed/demo data
- prepare deployment baseline

Deliverables:
- cleaner empty/error states
- prompt preset refinement
- deployable environment config
- MVP demo walkthrough

## Explicit non-goals for the 4-week plan
- parent mode
- tutor/admin mode
- collaborative study rooms
- advanced personalization
- multimodal voice features
