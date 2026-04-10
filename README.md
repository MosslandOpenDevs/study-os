# study-os

Korean-first AI study operating system for notes, quizzes, review, and exam planning.

## Why this exists

Most AI learning tools stop at chat. Korean learners usually need a full study workflow:
- turn class material into usable notes
- generate quizzes from PDFs and documents
- track mistakes in an error notebook
- schedule spaced review
- plan toward a concrete exam date

study-os is designed as a study operating system, not just an AI tutor.

## Core product idea

study-os helps a learner take raw study material and turn it into a repeatable learning loop:
1. ingest material
2. summarize and explain it in Korean
3. generate questions
4. collect mistakes
5. schedule review
6. measure progress toward an exam goal

## Target users

### Primary
- Korean university students
- certificate exam learners
- developers learning from English technical docs
- self-directed learners with PDFs, handouts, and notes

### Secondary
- tutors and teachers preparing practice material
- parents who want lightweight progress visibility

## MVP

### 1. Material ingestion
- upload PDF, markdown, text, and copied lecture notes
- split documents into sections and study units
- preserve source references for each generated output

### 2. Korean study summary
- explain content in Korean
- generate short summary, key concepts, and likely confusion points
- support tone presets such as:
  - teacher
  - tutor
  - concise exam mode

### 3. Quiz generation
- multiple choice
- short answer
- fill-in-the-blank
- concept check cards
- generate quizzes directly from selected sections

### 4. Error notebook
- save wrong answers automatically
- classify mistakes:
  - concept gap
  - careless mistake
  - question misread
  - time pressure
- attach retry questions later

### 5. Review scheduler
- spaced repetition for concepts and wrong answers
- daily review queue
- overdue review detection
- lightweight streak and completion tracking

### 6. Exam planner
- choose a target exam or create a custom goal
- set D-day
- break content into weekly and daily plans
- show weak topics and unfinished units

## What makes this different

- Korean-first study flow
- focused on exam prep and review loops
- built around PDFs and lecture material, not just free-form chat
- error notebook as a first-class feature
- planner + quiz + review in one workflow

## Proposed architecture

### Frontend
- Next.js or similar web app
- mobile-friendly dashboard for study and review

### Backend
- API server for auth, ingestion, quiz generation, and planning
- job workers for document parsing and background generation

### AI layer
- model abstraction for summarization, explanation, and question generation
- Korean prompt presets
- source-grounded generation with citation links

### Data layer
- relational DB for users, study units, quizzes, review events
- vector search for semantic retrieval from uploaded materials
- object storage for PDFs and assets

## V1 non-goals

- full LMS replacement
- school admin system
- synchronous classroom tools
- generic all-purpose chatbot positioning

## Roadmap

### Phase 1
- upload document
- create Korean summary
- generate quiz
- save wrong answers
- daily review queue

### Phase 2
- exam templates
- progress dashboard
- tutor/teacher mode
- Notion/Obsidian export
- Anki export

### Phase 3
- parent mode
- collaborative study groups
- speaking and oral answer evaluation
- personalized curriculum adaptation

## Initial repository structure

```text
apps/
  web/
  api/
packages/
  ui/
  prompts/
  core/
  scheduler/
  ingestion/
  quiz-engine/
docs/
  product/
  architecture/
  roadmap/
```

## Initial docs

- product brief
- MVP scope
- roadmap
- user personas
- feature backlog

## Contributing

The project is in the planning stage. Early contributions should focus on:
- architecture proposals
- Korean learning UX research
- ingestion and quiz generation prototypes
- review scheduling design
