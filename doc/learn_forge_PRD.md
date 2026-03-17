# LearnForge — Product Requirements Document

> **BMAD Phase 2 — PM Agent Output**
> `v1.0 | March 2026 | Status: DRAFT`

| BMAD Phase | Agent | Input | Feeds Into |
|---|---|---|---|
| Phase 2 — Planning | PM Agent | Project Brief v1.0 | Architect Agent |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Goals & Success Metrics](#2-product-goals--success-metrics)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [Epics Overview](#5-epics-overview)
6. [Epics & User Stories](#6-epics--user-stories)
7. [Out of Scope](#7-out-of-scope)
8. [Technical Dependencies & Constraints](#8-technical-dependencies--constraints)
9. [BMAD Handoff — Next Agent: Architect](#9-bmad-handoff--next-agent-architect)

---

## 1. Executive Summary

LearnForge is an AI-powered learning platform that transforms unstructured raw content — YouTube playlists, article URLs, and personal notes — into fully structured interactive courses complete with chapters, quizzes, adaptive flashcards, and a RAG-powered deep-dive chatbot. It solves the fundamental problem that self-directed learners face: consuming content is passive and fragmented, with no systematic way to generate grounded practice material or track mastery.

This PRD covers the full MVP scope (6 core features), three stretch goals, and all Epics and User Stories required to deliver the product. It is authored against the confirmed tech stack: **Next.js 14 + Python FastAPI** backend, **Claude (Anthropic)** for all AI generation, **Voyage AI** for embeddings, **Supabase** (PostgreSQL + pgvector + Auth), and **Vercel** for deployment.

---

## 2. Product Goals & Success Metrics

| KPI | Target | Timeline | Measurement Method |
|---|---|---|---|
| End-to-end course creation time | < 3 minutes | At launch | Timed test: 3 YouTube URLs → chapters visible |
| Quiz question grounding rate | ≥ 90% traceable to source | Sprint 2 review | Manual audit: 2 reviewers × 50 questions |
| RAG Deep Dive answer relevance | ≥ 85% thumbs-up | 30 days post-launch | In-app thumbs up/down widget per answer |
| D+7 user retention | ≥ 40% of sign-ups | 30 days post-launch | Supabase analytics: DAU/WAU cohort |
| Quiz completion rate | ≥ 60% of started quizzes | 30 days post-launch | `quiz_attempts`: started vs `completed_at NOT NULL` |
| Flashcard mastery rate | ≥ 50% cards marked Known in ≤ 2 sessions | 60 days post-launch | `flashcard_progress`: `status=known` / total cards |
| API p95 latency — course generation | < 4 seconds | At launch | Server-side timing on `/api/generate-course` |
| API p95 latency — RAG query | < 1.5 seconds | At launch | Server-side timing on `/api/deep-dive` |

---

## 3. Functional Requirements

> All FRs follow MoSCoW prioritisation: **Must** = MVP blocking · **Should** = MVP non-blocking · **Could** = Stretch

---

### FR-001 — YouTube URL Ingestion `[Must]`

The system shall accept one or more YouTube video or playlist URLs and extract full transcripts using the YouTube Transcript API. Auto-generated captions are accepted. Private or caption-disabled videos must return a graceful error.

**Acceptance Criteria:**
- Given a valid public YouTube URL with captions, the system extracts and stores the full transcript within 30 seconds
- Given a playlist URL, the system processes all videos in the playlist sequentially
- Given a private or caption-disabled video URL, the system displays a user-friendly error and allows the user to skip or paste a manual transcript
- Transcript text is chunked and stored linked to the source document record with `source_type=youtube`

---

### FR-002 — Article / Blog URL Ingestion `[Must]`

The system shall scrape readable text content from publicly accessible article and blog URLs. Cheerio is used for standard HTML pages; Playwright is used as a fallback for JavaScript-rendered pages.

**Acceptance Criteria:**
- Given a valid publicly accessible article URL, the system extracts body text (excluding nav, footer, ads) within 20 seconds
- Given a JS-rendered page (SPA), the system falls back to Playwright and still extracts content
- Given a blocked or paywalled URL, the system returns a clear error and offers a manual text-paste fallback
- Extracted article text is chunked and stored linked to the source document record with `source_type=article`

---

### FR-003 — Raw Text / Notes Ingestion `[Must]`

The system shall accept raw text input (up to 50,000 characters) via a textarea. This is the primary fallback for any unsupported source type.

**Acceptance Criteria:**
- Given a non-empty text input, the system accepts and processes the content on form submit
- Input exceeding 50,000 characters triggers a real-time character-count warning and blocks submission
- Raw text is chunked and stored with `source_type=text`

---

### FR-004 — Content Chunking & Voyage AI Embedding `[Must]`

All ingested content (YouTube transcripts, article text, raw notes) shall be semantically chunked into units of approximately 512 tokens with a 64-token overlap, then embedded using Voyage AI (`voyage-large-2` model) and stored in Supabase pgvector.

**Acceptance Criteria:**
- Each chunk is ≤ 512 tokens with ≥ 64-token overlap with adjacent chunks
- Each chunk record stores: `course_id`, `source_doc_id`, `content`, `embedding` (vector), `chunk_index`, `source_type`, `source_url`
- Embedding pipeline handles Voyage AI rate limits with exponential back-off retry (max 3 retries)
- Ingestion status is updated in real-time on the UI (e.g. "Extracting transcript… Chunking… Embedding 12/48 chunks…")
- Ingestion completes asynchronously — user is notified when all sources are embedded and the "Generate Course" button becomes active

---

### FR-005 — AI Course Structure Generation `[Must]`

Upon user request, Claude shall analyse the full embedded corpus via RAG and generate: a course title, a 2–3 sentence course description, and 4–8 chapters each with a title, 1-paragraph summary, and a list of source document IDs it draws from.

**Acceptance Criteria:**
- Given an embedded corpus, Claude generates a course with 4–8 chapters within 30 seconds
- Each chapter includes: title, 1-paragraph summary, and `source_doc_ids` array referencing ingested documents
- Course title and description are editable by the user before finalisation
- Generated course is saved with `status=draft` until the user finalises it

---

### FR-006 — Chapter Editor (Reorder & Rename) `[Must]`

After AI course generation, the user shall be able to drag-and-drop chapters to reorder them and rename chapter titles inline before finalising the course.

**Acceptance Criteria:**
- User can drag a chapter card to a new position; order is updated in real-time in the UI
- User can click a chapter title to edit it inline; changes are saved on blur or Enter
- A "Finalise Course" CTA is displayed; clicking it saves the finalised chapter order and titles and sets `course status=active`
- User can add a chapter manually (with a blank title) or delete an AI-generated chapter

---

### FR-007 — Chapter AI Summary & Key Concepts `[Must]`

Each chapter page shall display an AI-generated 2–3 paragraph summary and a "Key Concepts" section with 5–8 bullet points, both generated from RAG-retrieved chunks for that chapter.

**Acceptance Criteria:**
- Chapter summary is 2–3 paragraphs, generated from the top-k retrieved chunks for the chapter's source documents
- Key Concepts section shows 5–8 bullet points; each is a distinct concept extractable from the source material
- Both summary and key concepts are generated on first chapter view and cached; subsequent views serve the cached version
- Source references are shown (document title + YouTube timestamp range if applicable)

---

### FR-008 — Deep Dive RAG Chatbot `[Must]`

Each chapter shall include a "Deep Dive" chat interface where users can ask follow-up questions. All answers are generated by Claude using RAG retrieval scoped to the current chapter's source chunks.

**Acceptance Criteria:**
- Chat input is displayed on the chapter page; user can type and submit a question
- Each answer is generated by Claude using the top-5 most relevant chunks from the chapter's corpus via pgvector similarity search
- Source attribution is shown per answer (document title, chunk excerpt, YouTube timestamp if applicable)
- Conversation history within a session is maintained (multi-turn context window)
- Each answer includes a thumbs up/down rating widget; ratings are saved for KPI tracking

---

### FR-009 — Quiz Generation `[Must]`

For each chapter, Claude shall generate a quiz consisting of exactly 5 multiple-choice questions (4 options each, one correct) and 2 short-answer questions, all grounded in RAG-retrieved chunks.

**Acceptance Criteria:**
- Clicking "Take Quiz" generates and displays 5 MCQ + 2 short-answer questions
- All questions cite a specific chunk from the chapter corpus; no general-knowledge questions are permitted
- MCQ options include one correct answer and three plausible distractors drawn from the source material
- Short-answer questions have a model answer and 3–5 expected keywords for grading
- Quiz is generated once per chapter per difficulty level and cached; regeneration is available via a "Regenerate" button

---

### FR-010 — Quiz Submission & Scoring `[Must]`

After the user submits a quiz, the system shall reveal correct answers with explanations and save the score to the database.

**Acceptance Criteria:**
- On submit, each MCQ shows: user's answer highlighted, correct answer highlighted green, and a 2–3 sentence explanation
- Short-answer questions show the model answer and a "self-grade" checkbox for the user to mark as correct or incorrect
- Total score (X/7) is calculated and displayed prominently
- Score is saved to `quiz_attempts` table with: `user_id`, `quiz_id`, `score`, `answers (jsonb)`, `completed_at`
- User cannot change answers after submission

---

### FR-011 — Flashcard Generation `[Must]`

Claude shall generate 10–15 flashcards per chapter from RAG-retrieved content. Each flashcard has a front (concept question) and back (answer).

**Acceptance Criteria:**
- Flashcard set is generated from the top-k retrieved chunks for the chapter's source documents
- Each flashcard front is a distinct concept question; back is a concise 1–3 sentence answer
- Flashcards are generated once per chapter and cached; regeneration is available
- 10 flashcards minimum, 15 maximum per chapter

---

### FR-012 — Flashcard Study Mode UI `[Must]`

A flip-card interface allows users to study flashcards and mark each as "Known" or "Needs Review". Status is persisted per user.

**Acceptance Criteria:**
- Cards are displayed one at a time with a front-face question; clicking the card flips it to reveal the answer
- After viewing the back, two buttons appear: "Known ✓" and "Needs Review ↺"
- "Known" cards are marked in `flashcard_progress` table with `status=known`; "Needs Review" with `status=review`
- A progress indicator shows "X of Y cards reviewed" and "Z Known / W Needs Review"
- User can navigate back to previously viewed cards within a session
- Cards marked "Needs Review" are shown first in subsequent sessions

---

### FR-013 — User Authentication `[Must]`

Supabase Auth shall handle user sign-up and login via email/password. All user data is fully isolated per account.

**Acceptance Criteria:**
- User can sign up with email + password; email confirmation is sent via Supabase
- User can log in with email + password; invalid credentials show a clear error message
- User can reset password via email link
- All API routes require a valid Supabase JWT; unauthenticated requests return `401`
- User data (courses, quiz scores, flashcard progress) is scoped to `user_id`; cross-user data access is blocked at the RLS policy level

---

### FR-014 — Course Library Dashboard `[Must]`

An authenticated user shall see a dashboard listing all their created courses with title, creation date, chapter count, and an overall progress indicator.

**Acceptance Criteria:**
- Dashboard shows all courses belonging to the authenticated user, sorted by most recently updated
- Each course card shows: title, creation date, number of chapters, overall progress percentage
- Overall progress is calculated as: `(chapters_completed / total_chapters) × 100`
- User can click a course card to navigate to the course overview page
- User can delete a course (with confirmation); deletion cascades to all chapters, chunks, quizzes, and flashcards

---

### FR-015 — Progress Tracking `[Must]`

The system shall track and display: chapters marked complete, quiz scores per chapter, and flashcard mastery per chapter.

**Acceptance Criteria:**
- A "Mark as Complete" button on each chapter page creates a `chapter_progress` record for the user
- Chapter cards on the course overview show a status icon: not started, in progress, or complete
- Course progress bar shows percentage of chapters marked complete
- Quiz score history is shown per chapter (e.g. "Last score: 6/7, Attempted 2×")
- Flashcard mastery shows "X/Y cards known" per chapter

---

### FR-016 — Adaptive Quiz Difficulty `[Could — Stretch]`

Quiz difficulty shall adapt based on the user's most recent quiz score for the chapter: score > 80% → hard prompt; 50–80% → medium prompt; < 50% → easy prompt.

**Acceptance Criteria:**
- System reads the most recent `quiz_attempt` score for the `user+chapter` combination to determine difficulty level
- Three distinct Claude system prompts are maintained for easy/medium/hard difficulty
- Hard prompt: nuanced questions, trick distractors, requires synthesis across multiple concepts
- Easy prompt: foundational, direct recall questions with clearly incorrect distractors
- Difficulty level is stored on the quiz record and displayed to the user ("Difficulty: Advanced")

---

### FR-017 — Public Share Link `[Could — Stretch]`

A course owner can generate a public read-only UUID-slug URL. Anyone with the link can view chapters and take quizzes without authentication.

**Acceptance Criteria:**
- Owner clicks "Share Course" and the system generates a UUID slug and saves it to the `courses` table
- The public route `/share/[slug]` renders the course in read-only mode (no auth required)
- Shared view: chapter summaries, key concepts, and quiz are available; flashcard Known/Review state is not saved for anonymous users
- Owner can revoke the share link; revoked links return `404`
- Share link is copyable from the course settings page

---

### FR-018 — Course Completion Email `[Could — Stretch]`

When a user marks all chapters as complete, the system sends a course completion summary email via Resend containing: course title, per-chapter quiz scores, total score, and key concepts mastered.

**Acceptance Criteria:**
- Email is triggered automatically when `chapter_progress` records cover 100% of a course's chapters
- Email contains: course title, completion date, per-chapter quiz scores table, total aggregate score, and list of key concepts from all chapters
- Email is sent to the authenticated user's email address via Resend API
- Email template is responsive HTML; tested in Gmail and Outlook
- If no quiz has been taken for a chapter, that chapter shows "Not attempted" in the email

---

## 4. Non-Functional Requirements

| ID | Category | Requirement | Measurement / Target |
|---|---|---|---|
| NFR-001 | Performance | Course generation API response time shall be ≤ 4 seconds at p95 under 100 concurrent users | p95 ≤ 4s — measured via Vercel analytics |
| NFR-002 | Performance | RAG query (Deep Dive chat) response shall be ≤ 1.5 seconds at p95 | p95 ≤ 1.5s — server-side timing log |
| NFR-003 | Performance | Content ingestion (transcript + embed) for a 60-min video shall complete within 90 seconds | Timed test: 60-min YouTube video end-to-end |
| NFR-004 | Scalability | The system shall support at least 500 concurrent authenticated users without degradation | Load test with k6: 500 VUs, error rate < 1% |
| NFR-005 | Scalability | Supabase pgvector queries shall perform similarity search in ≤ 200ms for corpora up to 100,000 chunks | `EXPLAIN ANALYZE` on pgvector query with IVFFlat index |
| NFR-006 | Security | All API routes shall require a valid Supabase JWT; RLS policies shall prevent cross-user data access | Penetration test: attempt to fetch another user's course — expect 403 |
| NFR-007 | Security | Supabase RLS policies shall be enabled on all tables containing user data | RLS audit: all tables checked in Supabase dashboard |
| NFR-008 | Security | All secrets shall be stored in environment variables; none shall be committed to the repository | GitHub secret scanning + `.env.example` with placeholder values only |
| NFR-009 | Security | Article scraping shall respect `robots.txt`; the scraper shall not follow redirects to login pages | Scraper unit test: `robots.txt` check before fetch |
| NFR-010 | Reliability | The platform shall target 99.5% uptime (excluding scheduled Vercel maintenance) | Uptime Robot monitoring; monthly uptime report |
| NFR-011 | Reliability | Failed ingestion jobs shall be retried up to 3 times with exponential back-off before surfacing an error | Integration test: mock API timeout → verify 3 retries → error displayed |
| NFR-012 | Usability | The application shall be fully usable on mobile viewports ≥ 375px (iPhone SE) without horizontal scroll | Manual test on iPhone SE viewport in Chrome DevTools |
| NFR-013 | Usability | All interactive elements shall meet WCAG 2.1 AA colour contrast requirements | axe-core automated scan on all pages; 0 critical contrast violations |
| NFR-014 | Maintainability | All Next.js API routes and Python FastAPI endpoints shall have OpenAPI documentation auto-generated | FastAPI `/docs` endpoint live; Next.js routes documented in JSDoc |
| NFR-015 | Cost | Voyage AI embedding cost per course shall not exceed $0.05 for a typical 3-video, 2-article course | Cost calculation in embedding pipeline; alert if cost > $0.05 per course |

---

## 5. Epics Overview

| Epic | Title | FRs Covered | Stories | Priority |
|---|---|---|---|---|
| E-01 | Multi-Source Content Ingestion | FR-001, FR-002, FR-003, FR-004 | 5 | MVP — Must |
| E-02 | AI Course Generation | FR-005, FR-006 | 3 | MVP — Must |
| E-03 | Chapter Learning View | FR-007, FR-008 | 4 | MVP — Must |
| E-04 | Quiz System | FR-009, FR-010 | 4 | MVP — Must |
| E-05 | Flashcard Mode | FR-011, FR-012 | 3 | MVP — Must |
| E-06 | Auth & Progress Tracking | FR-013, FR-014, FR-015 | 4 | MVP — Must |
| E-07 | Adaptive Quiz Difficulty | FR-016 | 2 | Stretch — Could |
| E-08 | Public Share Link | FR-017 | 2 | Stretch — Could |
| E-09 | Course Completion Email | FR-018 | 1 | Stretch — Could |

---

## 6. Epics & User Stories

---

### EPIC 01 — Multi-Source Content Ingestion

> Enable users to ingest YouTube videos, article URLs, and raw text into a course corpus that is chunked, embedded, and stored ready for AI processing.
> **Stories:** US-001 through US-005

---

#### US-001 — Ingest YouTube Video/Playlist `[High]`

**User Story:** As a learner, I want to paste one or more YouTube URLs so that the system extracts transcripts and adds them to my course corpus.

**Acceptance Criteria:**
- **AC-01:** The ingestion form accepts one or more YouTube URLs (one per line or comma-separated)
- **AC-02:** On submission the system fetches the transcript for each valid URL using the YouTube Transcript API
- **AC-03:** A real-time progress indicator shows per-video status: Pending → Extracting → Chunking → Embedding → Done
- **AC-04:** Successfully processed videos appear in the "Sources" list with title, duration, and chunk count
- **AC-05:** Invalid or caption-disabled URLs show an inline error with a "Paste transcript manually" option
- **AC-06:** Playlist URLs are expanded to individual video URLs before processing

**Dependencies:** None

---

#### US-002 — Ingest Article / Blog URL `[High]`

**User Story:** As a learner, I want to paste an article or blog URL so that the system scrapes the content and adds it to my course corpus.

**Acceptance Criteria:**
- **AC-01:** The ingestion form accepts one or more article/blog URLs
- **AC-02:** The scraper attempts Cheerio first; falls back to Playwright for JS-rendered pages
- **AC-03:** Extracted content shows article title, estimated word count, and chunk count in the Sources list
- **AC-04:** Paywalled or blocked URLs return a "Could not access content" error with manual paste fallback
- **AC-05:** `robots.txt` is checked before scraping; disallowed URLs return a user-friendly message

**Dependencies:** None

---

#### US-003 — Ingest Raw Text / Notes `[High]`

**User Story:** As a learner, I want to paste raw notes or text directly so that I can include content from any source not supported by URL ingestion.

**Acceptance Criteria:**
- **AC-01:** A textarea accepts raw text up to 50,000 characters
- **AC-02:** A live character count is displayed; exceeding 50,000 shows a warning and disables submission
- **AC-03:** On submit, the text is chunked and embedded with `source_type=text`
- **AC-04:** The source appears in the Sources list as "Raw Notes" with word count and chunk count

**Dependencies:** None

---

#### US-004 — View Ingestion Progress & Manage Sources `[High]`

**User Story:** As a learner, I want to see the status of all my ingested sources and be able to remove a source before generating the course.

**Acceptance Criteria:**
- **AC-01:** All sources are listed with: type icon, title/URL, status, chunk count
- **AC-02:** Each source has a "Remove" button; removing a source deletes its chunks from the vector store
- **AC-03:** An overall progress bar shows "X of Y sources embedded"
- **AC-04:** The "Generate Course" button is disabled until at least one source is fully embedded

**Dependencies:** US-001, US-002, US-003

---

#### US-005 — Async Ingestion Job Queue `[High]`

**User Story:** As a learner, I want ingestion to run in the background so that I can navigate away and return when it is complete.

**Acceptance Criteria:**
- **AC-01:** Ingestion jobs are processed asynchronously; the user receives a notification when complete
- **AC-02:** Job status is persisted in the database; refreshing the page restores current status
- **AC-03:** Failed jobs (after 3 retries) surface a specific error message per source
- **AC-04:** User can trigger a re-run of a failed source without re-entering the URL

**Dependencies:** US-001, US-002, US-003

---

### EPIC 02 — AI Course Generation

> Use Claude + RAG to analyse the embedded corpus and generate a structured course. Allow the user to review, edit, and finalise before committing.
> **Stories:** US-006 through US-008

---

#### US-006 — Generate Course Structure `[High]`

**User Story:** As a learner, I want to click "Generate Course" so that Claude analyses my content and produces a structured course outline with chapters.

**Acceptance Criteria:**
- **AC-01:** Clicking "Generate Course" triggers a Claude API call with RAG-retrieved context from all course chunks
- **AC-02:** Claude returns a course title, 2–3 sentence description, and 4–8 chapters each with a title, summary, and `source_doc_ids`
- **AC-03:** The generated course is displayed in an editable preview within 30 seconds
- **AC-04:** If generation fails, a retry button is shown with the error message
- **AC-05:** Course is saved with `status=draft`; the user cannot take quizzes on a draft course

**Dependencies:** US-004 (at least one embedded source)

---

#### US-007 — Edit & Reorder Chapters `[High]`

**User Story:** As a learner, I want to reorder and rename chapters before finalising so that the course structure matches my learning goals.

**Acceptance Criteria:**
- **AC-01:** Chapters are displayed as draggable cards; drag-and-drop reorders them with live index update
- **AC-02:** Clicking a chapter title enters inline edit mode; pressing Enter or clicking away saves the new title
- **AC-03:** User can add a blank chapter manually via an "Add Chapter" button
- **AC-04:** User can delete any chapter; a confirmation prompt appears before deletion
- **AC-05:** Chapter order and titles are saved on every change (auto-save debounced 1s)

**Dependencies:** US-006

---

#### US-008 — Finalise Course `[High]`

**User Story:** As a learner, I want to finalise my course so that it becomes active and I can start studying.

**Acceptance Criteria:**
- **AC-01:** A "Finalise Course" button is shown after at least one chapter exists
- **AC-02:** Clicking "Finalise" sets `course status=active` and navigates to the course overview page
- **AC-03:** Finalised courses show all chapters with "Not started" progress badges
- **AC-04:** User can edit chapter titles on an active course but cannot reorder chapters without reverting to draft

**Dependencies:** US-007

---

### EPIC 03 — Chapter Learning View

> Deliver the core learning experience: AI summary, key concepts, source references, and a RAG-powered Deep Dive chatbot for each chapter.
> **Stories:** US-009 through US-012

---

#### US-009 — View Chapter Summary & Key Concepts `[High]`

**User Story:** As a learner, I want to open a chapter and see an AI-generated summary and key concepts so that I can quickly understand what the chapter covers.

**Acceptance Criteria:**
- **AC-01:** Chapter page displays AI-generated 2–3 paragraph summary generated from RAG-retrieved chunks
- **AC-02:** Key Concepts section shows 5–8 distinct bullet points extracted from the chapter corpus
- **AC-03:** Summary and key concepts are generated on first view and cached; subsequent loads serve from cache
- **AC-04:** Source references are displayed below the summary (document title, URL, YouTube timestamp range if applicable)
- **AC-05:** A skeleton loader is shown while content is being generated

**Dependencies:** US-008 (active course)

---

#### US-010 — Deep Dive RAG Chat `[High]`

**User Story:** As a learner, I want to ask follow-up questions about a chapter so that I can explore topics beyond the summary.

**Acceptance Criteria:**
- **AC-01:** A chat interface is displayed on the chapter page with a text input and submit button
- **AC-02:** Each question triggers a pgvector similarity search scoped to the chapter's source chunk IDs (top-5 chunks)
- **AC-03:** Claude generates an answer grounded in the retrieved chunks; hallucinated answers not supported by chunks are refused
- **AC-04:** Each answer shows source attribution: document title, excerpt snippet, and timestamp if YouTube
- **AC-05:** Conversation history (last 10 turns) is included in the Claude context window for multi-turn dialogue
- **AC-06:** Each answer shows a thumbs up / thumbs down rating button; ratings are stored in the database

**Dependencies:** US-009

---

#### US-011 — Mark Chapter as Complete `[High]`

**User Story:** As a learner, I want to mark a chapter as complete so that my progress is tracked on the course overview.

**Acceptance Criteria:**
- **AC-01:** A "Mark as Complete" button is shown at the bottom of each chapter page
- **AC-02:** Clicking it creates or updates a `chapter_progress` record with `completed=true` and `completed_at` timestamp
- **AC-03:** The chapter card on the course overview updates to show a green "Complete ✓" badge
- **AC-04:** The course progress bar percentage updates immediately

**Dependencies:** US-009

---

#### US-012 — Navigate Between Chapters `[Medium]`

**User Story:** As a learner, I want to navigate to the next and previous chapters easily so that I can progress through the course without going back to the dashboard.

**Acceptance Criteria:**
- **AC-01:** "Previous Chapter" and "Next Chapter" navigation buttons are shown at the top and bottom of each chapter page
- **AC-02:** Chapter navigation respects the finalised chapter order
- **AC-03:** A chapter sidebar/drawer shows all chapters with their completion status; clicking any chapter navigates directly to it

**Dependencies:** US-008

---

### EPIC 04 — Quiz System

> Generate per-chapter quizzes grounded in RAG context, allow submission, reveal answers with explanations, and persist scores.
> **Stories:** US-013 through US-016

---

#### US-013 — Generate Chapter Quiz `[High]`

**User Story:** As a learner, I want to take a quiz on a chapter so that I can test my retention of the material.

**Acceptance Criteria:**
- **AC-01:** A "Take Quiz" button is shown on each chapter page
- **AC-02:** Clicking it generates 5 MCQ + 2 short-answer questions via Claude with RAG context (if not already cached)
- **AC-03:** MCQ questions display 4 options as radio buttons; short-answer questions display a textarea
- **AC-04:** A question counter ("Question 3 of 7") and progress bar are shown
- **AC-05:** User can navigate between questions freely before submission; answers are auto-saved per question

**Dependencies:** US-009 (chapter summary generated)

---

#### US-014 — Submit Quiz & View Results `[High]`

**User Story:** As a learner, I want to submit my quiz and see my score with explanations so that I understand what I got wrong.

**Acceptance Criteria:**
- **AC-01:** A "Submit Quiz" button is shown after all 7 questions have been answered
- **AC-02:** On submission, each MCQ shows: user's selection highlighted, correct answer highlighted green, a 2–3 sentence explanation
- **AC-03:** Short-answer questions show the model answer and expected keywords; user self-grades via "Correct" / "Incorrect" checkbox
- **AC-04:** Total score (X/7) and percentage are shown prominently with a pass/fail indicator (pass ≥ 70%)
- **AC-05:** Score is saved to `quiz_attempts` table; a "Retake Quiz" button generates a new quiz set

**Dependencies:** US-013

---

#### US-015 — View Quiz Score History `[Medium]`

**User Story:** As a learner, I want to see my quiz score history for each chapter so that I can track my improvement.

**Acceptance Criteria:**
- **AC-01:** Chapter page shows "Quiz History" section with a list of past attempts: date, score, difficulty level
- **AC-02:** Best score and most recent score are highlighted
- **AC-03:** Average score across all attempts is calculated and shown

**Dependencies:** US-014

---

#### US-016 — Quiz Score Drives Chapter Progress `[Medium]`

**User Story:** As a learner, I want my quiz performance to be reflected in my chapter progress so that I can see my mastery at a glance.

**Acceptance Criteria:**
- **AC-01:** A quiz score badge (e.g. "Best: 6/7") is shown on the chapter card in the course overview
- **AC-02:** Chapters with a quiz score ≥ 70% show a "Quizzed ✓" badge on the course overview
- **AC-03:** The course dashboard aggregates total quiz score as "Average score: X%"

**Dependencies:** US-014

---

### EPIC 05 — Flashcard Mode

> Auto-generate flashcard sets per chapter and provide an interactive flip-card study UI with mastery state persistence.
> **Stories:** US-017 through US-019

---

#### US-017 — Generate Chapter Flashcards `[High]`

**User Story:** As a learner, I want flashcards to be generated for each chapter so that I have a ready-made revision set.

**Acceptance Criteria:**
- **AC-01:** A "Flashcards" button/tab is shown on each chapter page
- **AC-02:** Clicking it generates 10–15 flashcards via Claude from RAG-retrieved chapter chunks (if not already cached)
- **AC-03:** Each flashcard has a front (concept question) and back (concise 1–3 sentence answer)
- **AC-04:** Generated flashcards are stored in the `flashcards` table linked to `chapter_id`
- **AC-05:** A loading indicator is shown during generation

**Dependencies:** US-009 (chapter summary generated)

---

#### US-018 — Study Flashcards (Flip-Card UI) `[High]`

**User Story:** As a learner, I want to flip through flashcards and mark them as Known or Needs Review so that I can focus my revision.

**Acceptance Criteria:**
- **AC-01:** Cards are shown one at a time, front-face first, with a click/tap to flip animation
- **AC-02:** "Known ✓" and "Needs Review ↺" buttons are shown after flipping to the back
- **AC-03:** Tapping "Known" saves `status=known` to `flashcard_progress` for the current `user + flashcard`
- **AC-04:** Tapping "Needs Review" saves `status=review`; these cards are shown first in the next session
- **AC-05:** A progress bar shows "X of Y cards reviewed" and "Z Known / W Needs Review"
- **AC-06:** User can skip a card without marking it; it returns to the end of the deck

**Dependencies:** US-017

---

#### US-019 — Flashcard Mastery Summary `[Medium]`

**User Story:** As a learner, I want to see my flashcard mastery per chapter so that I know which topics still need revision.

**Acceptance Criteria:**
- **AC-01:** Chapter page shows "X/Y cards known" mastery indicator
- **AC-02:** Course overview shows aggregate flashcard mastery across all chapters
- **AC-03:** "Needs Review" cards can be started directly from the course overview ("Study weak cards")

**Dependencies:** US-018

---

### EPIC 06 — Authentication & Progress Tracking

> Secure per-user authentication with Supabase Auth, course library dashboard, and visual progress tracking.
> **Stories:** US-020 through US-023

---

#### US-020 — Sign Up & Log In `[High]`

**User Story:** As a new user, I want to sign up with my email and password and log in securely so that my courses and progress are saved.

**Acceptance Criteria:**
- **AC-01:** Sign-up form accepts email + password; password must be ≥ 8 characters
- **AC-02:** Email confirmation is sent on sign-up; account is active after clicking the confirmation link
- **AC-03:** Log-in form validates credentials; 3 failed attempts triggers a 30-second lockout
- **AC-04:** Invalid credentials show a generic "Invalid email or password" message (no user enumeration)
- **AC-05:** Successful login redirects to the course library dashboard
- **AC-06:** JWT is stored in `httpOnly` cookie; all API routes validate the JWT via Supabase middleware

**Dependencies:** None

---

#### US-021 — Password Reset `[High]`

**User Story:** As a user, I want to reset my password via email so that I can regain access if I forget it.

**Acceptance Criteria:**
- **AC-01:** "Forgot password?" link on the login page sends a reset email via Supabase Auth
- **AC-02:** Reset link is valid for 1 hour; expired links show a clear error and offer to resend
- **AC-03:** New password must meet the same ≥ 8 character requirement
- **AC-04:** After successful reset, user is redirected to login page with a success message

**Dependencies:** US-020

---

#### US-022 — Course Library Dashboard `[High]`

**User Story:** As an authenticated user, I want to see all my courses in one place so that I can manage and continue my learning.

**Acceptance Criteria:**
- **AC-01:** Dashboard lists all courses belonging to the authenticated user, sorted by last updated
- **AC-02:** Each course card shows: title, creation date, chapter count, overall progress bar, average quiz score
- **AC-03:** A "New Course" button navigates to the ingestion page
- **AC-04:** "Delete Course" button on each card shows a confirmation dialog; deletion cascades to all related data
- **AC-05:** Empty state shows an illustration and CTA to create first course

**Dependencies:** US-020

---

#### US-023 — Visual Course Progress Bar `[High]`

**User Story:** As a learner, I want to see a visual progress bar for each course so that I can see how much I have completed at a glance.

**Acceptance Criteria:**
- **AC-01:** Progress bar on the course overview and dashboard card shows percentage of chapters marked complete
- **AC-02:** Bar colour changes: grey (0%), blue (1–49%), amber (50–99%), green (100%)
- **AC-03:** Hovering over the bar shows a tooltip: "X of Y chapters complete"
- **AC-04:** Progress updates in real-time when a chapter is marked complete (no page refresh needed)

**Dependencies:** US-011, US-022

---

### EPIC 07 — Adaptive Quiz Difficulty *(Stretch)*

> Dynamically adjust quiz difficulty based on the user's most recent quiz score using score-gated Claude system prompts.
> **Stories:** US-024 through US-025

---

#### US-024 — Score-Gated Difficulty Selection `[Medium]`

**User Story:** As a learner, I want the quiz difficulty to adapt to my performance so that I am always appropriately challenged.

**Acceptance Criteria:**
- **AC-01:** After each quiz submission, the system writes a difficulty level to `quiz_attempts`: `easy` (<50%), `medium` (50–80%), `hard` (>80%)
- **AC-02:** On next quiz generation, the difficulty level is read from the most recent attempt for that `user + chapter` combination
- **AC-03:** If no prior attempt exists, default difficulty is `medium`
- **AC-04:** The difficulty level is shown to the user as a badge: "Difficulty: Beginner / Intermediate / Advanced"

**Dependencies:** US-014

---

#### US-025 — Difficulty-Specific Claude Prompts `[Medium]`

**User Story:** As a developer, I need three distinct Claude system prompts for easy, medium, and hard quiz generation so that questions are appropriately calibrated.

**Acceptance Criteria:**
- **AC-01:** Three system prompt variants are maintained in the codebase: `quiz_easy.txt`, `quiz_medium.txt`, `quiz_hard.txt`
- **AC-02:** Easy prompt: instructs Claude to ask direct recall questions, use clearly incorrect distractors, and avoid synthesis
- **AC-03:** Hard prompt: instructs Claude to ask synthesis questions, use plausible distractors drawn from the source material, and include edge-case knowledge
- **AC-04:** A/B test result comparing average scores across difficulty levels is tracked in the `quiz_attempts` table

**Dependencies:** US-024

---

### EPIC 08 — Public Share Link *(Stretch)*

> Allow course owners to share a public read-only URL so that anyone can view and take quizzes without creating an account.
> **Stories:** US-026 through US-027

---

#### US-026 — Generate & Manage Share Link `[Medium]`

**User Story:** As a course owner, I want to generate a public share link so that I can share my course with others.

**Acceptance Criteria:**
- **AC-01:** A "Share" button in course settings generates a UUID slug saved to `courses.share_slug`
- **AC-02:** The public URL format is `/share/[uuid-slug]`
- **AC-03:** Owner can copy the URL to clipboard with a single click
- **AC-04:** Owner can revoke the link; revoked links return `404` for all visitors
- **AC-05:** Share status (Active / Revoked) is shown in course settings

**Dependencies:** US-008 (active course)

---

#### US-027 — Public Read-Only Course View `[Medium]`

**User Story:** As an anonymous visitor with a share link, I want to view the course and take quizzes without creating an account.

**Acceptance Criteria:**
- **AC-01:** `/share/[uuid-slug]` renders the course in read-only mode without requiring authentication
- **AC-02:** Visitor can view all chapter summaries and key concepts
- **AC-03:** Visitor can take chapter quizzes; scores are stored with `user_id=null` and `anonymous_session_id`
- **AC-04:** Flashcard Known/Needs Review state is not persisted for anonymous visitors (session only)
- **AC-05:** A "Create your own course" CTA is shown prominently to drive sign-ups

**Dependencies:** US-026

---

### EPIC 09 — Course Completion Email *(Stretch)*

> Send a formatted completion summary email via Resend when a user finishes all chapters of a course.
> **Stories:** US-028

---

#### US-028 — Trigger & Send Completion Email `[Low]`

**User Story:** As a learner, I want to receive a summary email when I complete a course so that I have a record of what I learned and my scores.

**Acceptance Criteria:**
- **AC-01:** When `chapter_progress` records cover 100% of a course's chapters, a completion email is triggered automatically
- **AC-02:** Email contains: course title, completion date, table of chapter names + best quiz scores, total aggregate score, and concatenated key concepts from all chapters
- **AC-03:** Email is sent to the authenticated user's email address via Resend API
- **AC-04:** Email template is responsive HTML; renders correctly in Gmail, Outlook, and Apple Mail
- **AC-05:** If the email fails to send (Resend API error), the failure is logged and retried once after 5 minutes; user is not blocked from continuing

**Dependencies:** US-011 (all chapters complete), US-014 (quiz attempted)

---

## 7. Out of Scope

> The following are explicitly excluded from MVP and Stretch scope — deferred to post-v1.

- PDF, EPUB, or PowerPoint file upload and parsing
- Team or collaborative course workspaces (multi-user editing)
- Native mobile app (iOS / Android) — web-responsive only
- In-app payments, subscriptions, or freemium billing
- Fine-tuned or custom AI models (Claude only, no model fine-tuning)
- Private or authentication-gated video/article scraping
- Google / GitHub / SSO OAuth (email/password only for MVP)
- AI-generated course images or visual content
- Offline or PWA mode
- Real-time collaboration on course editing

---

## 8. Technical Dependencies & Constraints

### 8.1 Open Question Resolutions

The following open questions from the Project Brief have been resolved for this PRD:

- **Q1 — Ingestion pipeline sync vs async:** RESOLVED — Async with job queue. Ingestion runs as a background job; UI polls for status. Prevents Vercel serverless timeout on large playlists.
- **Q2 — Chunking strategy:** RESOLVED — Fixed-size chunking at 512 tokens with 64-token overlap, applied to all source types. Semantic chunking deferred to post-MVP optimisation.
- **Q3 — Short-answer quiz grading:** RESOLVED — MVP uses keyword matching (3–5 expected keywords per question) with user self-grade checkbox. Claude-as-judge deferred to v1.1.
- **Q4 — Adaptive difficulty state:** RESOLVED — Derived from `quiz_attempts` table (most recent attempt score). No separate state table needed for MVP.
- **Q5 — Auth scope:** RESOLVED — Email/password only for MVP. Google OAuth added in Sprint 2 post-launch if sign-up friction is observed.
- **Q6 — Shared quiz scores:** RESOLVED — Anonymous visitors' quiz scores stored with `user_id=null` + `anonymous_session_id`. Not linked to any account.
- **Q7 — Rate limiting:** RESOLVED — Per-user limits: max 20 YouTube URLs per course, max 10 article URLs per course, max 2-hour total video duration per course.
- **Q8 — Max corpus size:** RESOLVED — Max 50,000 chunks per course. Ingestion is blocked with a user-facing error if this limit is reached.

### 8.2 External Service Dependencies

| Service | Usage | Tier for MVP | Risk |
|---|---|---|---|
| Claude (Anthropic) | All AI generation: course, quiz, flashcards, chat | API — pay-per-token | Context window limits on large corpora; monitor cost per course |
| Voyage AI | All vector embeddings (`voyage-large-2`) | API — pay-per-token | Rate limits; cost scales with corpus size; confirmed non-negotiable |
| Supabase | PostgreSQL + pgvector + Auth + RLS | Free tier (MVP) → Pro (prod) | pgvector index required at >10k chunks; free tier has 500MB DB limit |
| YouTube Transcript API | Transcript extraction (Python lib) | Free (no API key) | Breaks on private/age-gated/no-caption videos; requires graceful fallback |
| Vercel | Frontend + API routes deployment | Hobby (MVP) → Pro (prod) | 60s execution limit on serverless; async ingestion required to work around |
| Resend *(stretch)* | Course completion emails | Free (100/day) | Domain verification required; free tier sufficient for MVP scale |

---

## 9. BMAD Handoff — Next Agent: Architect

> **`bmad-create-architecture`** — Load this PRD in a fresh chat with the Architect Agent.

**Architect Agent Instructions:**

- This PRD is the primary input for the Architecture Document. Load it in a fresh chat.
- Design the system architecture covering: Next.js App Router structure, Python FastAPI service, Supabase schema with pgvector, async ingestion job queue, Claude API integration patterns, and Vercel deployment topology.
- Define the API contract for all endpoints implied by the User Stories above (ingestion, course generation, chapter view, quiz, flashcards, progress, auth, share).
- Resolve: Python FastAPI deployment model (Vercel serverless Python vs. separate hosted service) and async job queue implementation (Supabase pg_cron / Edge Functions / simple polling).
- Define the Supabase RLS policy strategy for all tables; ensure cross-user data isolation is airtight.
- Specify the pgvector index type (IVFFlat vs. HNSW) and similarity search query pattern for RAG retrieval.
- After Architecture is approved, return to PM agent to run `bmad-create-epics-and-stories` for sprint-ready story files.
- Run `bmad-check-implementation-readiness` to validate PRD ↔ Architecture ↔ Stories cohesion before first sprint.

---

| Document | Totals | Next Step |
|---|---|---|
| LearnForge PRD v1.0 · BMAD Phase 2 | 18 FRs · 15 NFRs · 9 Epics · 28 User Stories | Architect Agent → `bmad-create-architecture` |
