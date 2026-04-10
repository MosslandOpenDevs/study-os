# Domain Model v1

## Core entities

### User
Represents a learner using study-os.

Fields:
- id
- displayName
- locale
- timezone
- createdAt

### StudyGoal
Represents a target such as an exam or personal learning goal.

Fields:
- id
- userId
- title
- targetDate
- goalType
- status

### StudySource
Represents an uploaded or imported learning source.

Fields:
- id
- userId
- title
- sourceType
- originalFilename
- storageUrl
- createdAt

### StudyUnit
Represents a chunk of learning material derived from a source.

Fields:
- id
- sourceId
- title
- content
- orderIndex
- citationStart
- citationEnd

### SummaryCard
Represents generated summary content for a study unit.

Fields:
- id
- studyUnitId
- shortSummary
- keyConcepts
- confusionPoints
- tonePreset

### QuizSet
Represents a generated set of quiz items.

Fields:
- id
- studyUnitId
- title
- quizType
- createdAt

### QuizItem
Represents one generated question.

Fields:
- id
- quizSetId
- prompt
- answer
- explanation
- difficulty

### Attempt
Represents a learner answer submission.

Fields:
- id
- userId
- quizItemId
- submittedAnswer
- isCorrect
- createdAt

### ErrorNotebookEntry
Represents a stored mistake for later review.

Fields:
- id
- userId
- quizItemId
- attemptId
- errorType
- note
- nextReviewAt
- reviewCount

### ReviewTask
Represents a scheduled review event.

Fields:
- id
- userId
- notebookEntryId
- scheduledAt
- status

## Initial relationships
- User has many StudyGoals
- User has many StudySources
- StudySource has many StudyUnits
- StudyUnit has one SummaryCard
- StudyUnit has many QuizSets
- QuizSet has many QuizItems
- QuizItem has many Attempts
- Attempt may create one ErrorNotebookEntry
- ErrorNotebookEntry has many ReviewTasks
