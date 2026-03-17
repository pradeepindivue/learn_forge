# LearnForge — Architecture Document

> **BMAD Phase 3 — Architect Agent Output**
> `v1.0 | March 2026 | Status: DRAFT`

| BMAD Phase | Agent | Input | Feeds Into |
|---|---|---|---|
| Phase 3 — Solutioning | Architect Agent | PRD v1.0 | Epics & Stories |

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Component Architecture](#2-component-architecture)
3. [Architecture Decision Records (ADRs)](#3-architecture-decision-records-adrs)
4. [Database Schema](#4-database-schema-supabase-postgresql--pgvector)
5. [RAG Pipeline Design](#5-rag-pipeline-design)
6. [API Contracts](#6-api-contracts)
7. [Security Architecture & RLS Policies](#7-security-architecture--rls-policies)
8. [Deployment Architecture (Vercel)](#8-deployment-architecture-vercel)
9. [Performance & Scalability Strategy](#9-performance--scalability-strategy)
10. [Adaptive Difficulty Implementation (Stretch)](#10-adaptive-difficulty-implementation-stretch)
11. [Implementation Readiness Checklist](#11-implementation-readiness-checklist)
12. [BMAD Handoff](#12-bmad-handoff--next-epics--stories--implementation)

---

## 1. System Architecture Overview

LearnForge is built on a hybrid architecture: a Next.js 14 full-stack frontend handles UI and lightweight API routes, while a Python FastAPI service manages all AI-intensive operations. Both services deploy to Vercel. All data — structured and vector — lives in a single Supabase project, eliminating the need for a separate vector database.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LEARNFORGE SYSTEM DIAGRAM                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    HTTPS     ┌────────────────────────────────────────┐  │
│  │   Browser    │◄────────────►│      Vercel Edge Network (CDN)         │  │
│  │  (React SPA) │              └──────────┬─────────────────┬───────────┘  │
│  └──────────────┘                         │                 │              │
│                              ┌────────────▼──────┐  ┌──────▼──────────┐   │
│                              │  Next.js 14 App   │  │ Python FastAPI  │   │
│                              │  (App Router)     │  │ (AI Service)    │   │
│                              │                   │  │                 │   │
│                              │ • Auth middleware  │  │ • Ingestion     │   │
│                              │ • Course CRUD     │  │ • Chunking      │   │
│                              │ • Progress APIs   │  │ • Voyage AI     │   │
│                              │ • Share routes    │  │ • Claude calls  │   │
│                              │ • Resend email    │  │ • RAG queries   │   │
│                              └────────┬──────────┘  └──────┬──────────┘   │
│                                       │                    │              │
│                              ┌────────▼────────────────────▼──────────┐   │
│                              │              SUPABASE                  │   │
│                              │                                        │   │
│                              │  PostgreSQL ◄──── pgvector extension   │   │
│                              │  (structured data)   (vector store)    │   │
│                              │                                        │   │
│                              │  Supabase Auth  │  Row Level Security  │   │
│                              └────────────────────────────────────────┘   │
│                                                                             │
│  External APIs:  Claude (Anthropic) │ Voyage AI │ YouTube Transcript API   │
│                  Resend (email) │ Playwright (scraping fallback)           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture

### 2.1 Next.js 14 Application (Frontend + Lightweight APIs)

The Next.js App Router is the primary delivery layer for the React UI and all non-AI API routes. It is deployed as a Vercel serverless application and handles authentication middleware on every request.

```
app/
├── (auth)/
│   ├── login/page.tsx              # Login form
│   └── signup/page.tsx             # Sign-up form
├── (dashboard)/
│   ├── layout.tsx                  # Auth-gated layout with Supabase session check
│   └── page.tsx                    # Course library dashboard
├── courses/
│   ├── new/page.tsx                # New course ingestion form
│   ├── [id]/page.tsx               # Course overview + progress bar
│   ├── [id]/edit/page.tsx          # Chapter editor (drag-and-drop)
│   └── [id]/chapters/[chId]/
│       ├── page.tsx                # Chapter learning view
│       ├── quiz/page.tsx           # Quiz UI
│       └── flashcards/page.tsx     # Flashcard flip UI
├── share/[slug]/page.tsx           # Public read-only share view (no auth)
└── api/
    ├── auth/[...supabase]/         # Supabase Auth helpers
    ├── courses/                    # CRUD: list, create, get, update, delete
    ├── courses/[id]/progress/      # Chapter progress tracking
    ├── courses/[id]/share/         # Generate / revoke share slug
    ├── ingestion/status/[jobId]/   # Poll async ingestion job status
    └── email/completion/           # Trigger Resend completion email
```

### 2.2 Python FastAPI Service (AI Processing)

All compute-intensive AI operations live in the FastAPI service. This isolates Python dependencies (YouTube Transcript API, Playwright, LangChain utilities) from the Node.js runtime and keeps each operation within Vercel's 60-second serverless execution budget through async job design.

```
learnforge-ai/                       # Python FastAPI service
├── main.py                          # App entrypoint, router registration
├── routers/
│   ├── ingest.py                    # POST /ingest — accepts URLs/text, enqueues job
│   ├── generate.py                  # POST /generate/course, /chapter-summary,
│   │                                #               /quiz, /flashcards
│   └── rag.py                       # POST /rag/query — Deep Dive chat endpoint
├── services/
│   ├── youtube.py                   # YouTube Transcript API wrapper
│   ├── scraper.py                   # BeautifulSoup + Playwright fallback
│   ├── chunker.py                   # 512-token fixed-size chunking w/ 64-token overlap
│   ├── embedder.py                  # Voyage AI batch embedding w/ retry/backoff
│   ├── vector_store.py              # Supabase pgvector CRUD + similarity search
│   ├── claude.py                    # Anthropic SDK wrapper + prompt templates
│   └── job_queue.py                 # Async job state in Supabase ingestion_jobs table
├── prompts/
│   ├── course_generation.txt        # System prompt: course structure from RAG chunks
│   ├── chapter_summary.txt          # System prompt: chapter summary + key concepts
│   ├── quiz_easy.txt                # System prompt: easy quiz generation
│   ├── quiz_medium.txt              # System prompt: medium quiz generation
│   ├── quiz_hard.txt                # System prompt: hard quiz generation
│   ├── flashcards.txt               # System prompt: flashcard extraction
│   └── deep_dive.txt                # System prompt: RAG-grounded Q&A
└── api_schema.py                    # Pydantic request/response models
```

---

## 3. Architecture Decision Records (ADRs)

---

### ADR-001 — Hybrid Next.js + Python FastAPI Backend `[Accepted]`

**Context**
AI processing requires Python libraries (YouTube Transcript API, Playwright, LangChain). Running them in Next.js API routes would require complex native module bundling and exceed Node.js capability for some tasks.

**Decision**
Maintain two services: Next.js handles auth, CRUD, and UI; Python FastAPI handles all ingestion, embedding, and AI generation.

**Rationale**
Python is the dominant language for AI/ML tooling. FastAPI is lightweight, async-native, and deploys cleanly to Vercel Python serverless functions. Separation of concerns keeps each service focused and independently deployable.

**Consequences**
Adds inter-service HTTP calls (Next.js → FastAPI). Mitigated by co-deploying to Vercel and using internal API calls. Requires shared Supabase client configuration in both services.

---

### ADR-002 — Supabase pgvector as Sole Vector Store `[Accepted]`

**Context**
A separate vector database (Pinecone, Weaviate) was considered for storing Voyage AI embeddings. This would add another managed service, an additional API key, and separate billing.

**Decision**
Use Supabase pgvector extension as the vector store. All chunks and embeddings are stored in the `chunks` table with an `embedding` column of type `vector(1024)`.

**Rationale**
Eliminates a separate service. pgvector performs well for our expected scale (<100k chunks per user). IVFFlat indexing keeps similarity search under 200ms. Single data platform simplifies RLS and auth.

**Consequences**
pgvector performance degrades at >1M vectors without HNSW indexing. Monitor at scale and add HNSW index if needed. Free tier Supabase has 500MB DB limit — migrate to Pro at launch.

---

### ADR-003 — Async Ingestion Job Queue via Supabase Table `[Accepted]`

**Context**
Ingestion of a 60-minute YouTube video (extract + chunk + embed ~48 chunks) can take 30–90 seconds. Vercel serverless functions timeout at 60 seconds on the Hobby plan.

**Decision**
Ingestion is fully async: the FastAPI `/ingest` endpoint enqueues a job in the `ingestion_jobs` table and returns immediately with a `job_id`. The client polls `/ingestion/status/[jobId]` every 3 seconds until `status=completed`.

**Rationale**
Avoids Vercel timeout issues entirely. Uses Supabase (already in the stack) as the job queue — no additional infrastructure (no Redis, no BullMQ). Simple polling is adequate for MVP scale.

**Consequences**
Polling adds minor network overhead. Job state persists across page refreshes. Failed jobs are retryable from the UI. At scale, replace polling with Supabase Realtime subscriptions.

---

### ADR-004 — Fixed-Size Chunking (512 tokens, 64 overlap) `[Accepted]`

**Context**
Two chunking strategies were evaluated: fixed-size token windows and semantic/paragraph-based chunking. Semantic chunking produces higher-quality retrieval but requires an additional NLP pass.

**Decision**
Use fixed-size chunking at 512 tokens with 64-token overlap for all source types (YouTube transcripts, article text, raw notes).

**Rationale**
Simpler to implement, predictable Voyage AI embedding costs (cost scales with chunk count), and adequate retrieval quality for our use case. Overlap ensures concepts spanning chunk boundaries are captured. Semantic chunking is a post-MVP optimisation.

**Consequences**
Some concepts may be split across chunk boundaries. Overlap mitigates most cases. Retrieval quality should be monitored via the thumbs up/down rating in Deep Dive — if <85% positive, revisit chunking strategy.

---

### ADR-005 — Claude as Primary AI Provider (No Fine-Tuning) `[Accepted]`

**Context**
Options included GPT-4, Gemini, or a fine-tuned open-source model. Fine-tuning was considered for quiz quality improvement.

**Decision**
Use Claude (`claude-sonnet-4-20250514`) for all generation tasks via the Anthropic SDK. No fine-tuning for MVP.

**Rationale**
Claude provides the best instruction-following and long-context performance for structured generation tasks (course outlines, quizzes with 4 options each). RAG grounding via prompt engineering is sufficient for quality. Fine-tuning adds significant cost and complexity for MVP.

**Consequences**
Locked to Anthropic pricing and rate limits. Monitor token usage per course generation. Implement prompt caching where possible to reduce cost.

---

### ADR-006 — Supabase Row Level Security for Data Isolation `[Accepted]`

**Context**
With Supabase as the data layer, two isolation strategies exist: application-level filtering (`WHERE user_id = ?`) or database-level RLS policies.

**Decision**
Enable RLS on all user-data tables and enforce access via Supabase Auth JWT claims. Application code uses the authenticated Supabase client which automatically applies RLS policies.

**Rationale**
Database-level enforcement is more secure than application-level — even a buggy API route cannot accidentally expose another user's data. RLS policies are auditable and testable independently of application code.

**Consequences**
RLS policies must be defined carefully to avoid locking out service role operations. The FastAPI service uses the Supabase service role key (bypasses RLS) only for background ingestion jobs that need to write to tables on behalf of users.

---

### ADR-007 — Keyword Matching for Short-Answer Grading (MVP) `[Accepted]`

**Context**
Short-answer quiz questions require automated grading. Options: exact keyword matching, semantic similarity scoring, or Claude-as-judge.

**Decision**
MVP uses keyword matching with 3–5 expected keywords per question, combined with a user self-grade checkbox. Claude-as-judge grading is deferred to v1.1.

**Rationale**
Keyword matching is deterministic, zero additional API cost, and instant. The self-grade checkbox gives users agency and data for improvement. Claude-as-judge adds ~$0.002 per question at current pricing — significant at scale.

**Consequences**
Keyword matching produces false negatives for semantically correct but differently-worded answers. Mitigated by generous keyword sets and the self-grade fallback. User satisfaction data will inform whether to accelerate Claude-as-judge.

---

## 4. Database Schema (Supabase PostgreSQL + pgvector)

All tables reside in a single Supabase project. The pgvector extension is enabled on the database. Row Level Security is enabled on all user-data tables. The `ingestion_jobs` table is managed by the FastAPI service role.

> **Setup Requirements**
> - Enable pgvector: `CREATE EXTENSION IF NOT EXISTS vector;`
> - All tables except `ingestion_jobs` use RLS with `auth.uid() = user_id` policy pattern
> - Service role key is used only by FastAPI for ingestion writes — never exposed to the frontend
> - Indexes: IVFFlat on `chunks.embedding`; B-tree on all FK columns and frequently filtered columns

---

### 4.1 Core Tables

#### `users` *(auth.users — managed by Supabase Auth)*

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY | Auto-generated by Supabase Auth |
| `email` | `text` | NOT NULL, UNIQUE | User email address |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() | Account creation timestamp |
| `confirmed_at` | `timestamptz` | NULLABLE | Email confirmation timestamp |

> **RLS:** Managed by Supabase Auth — not directly accessible via RLS

---

#### `courses`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY DEFAULT gen_random_uuid() | Course identifier |
| `user_id` | `uuid` | NOT NULL, FK → auth.users(id) ON DELETE CASCADE | Owner |
| `title` | `text` | NOT NULL | AI-generated or user-edited course title |
| `description` | `text` | NULLABLE | 2–3 sentence course description |
| `status` | `text` | NOT NULL DEFAULT 'draft' | `draft` \| `active` |
| `share_slug` | `text` | UNIQUE, NULLABLE | UUID slug for public share link |
| `chapter_count` | `integer` | NOT NULL DEFAULT 0 | Denormalised count for dashboard performance |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() | Creation timestamp |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT now() | Last modified timestamp |

> **RLS:** `USING auth — user_id = auth.uid()`

---

#### `source_documents`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY DEFAULT gen_random_uuid() | Source document identifier |
| `course_id` | `uuid` | NOT NULL, FK → courses(id) ON DELETE CASCADE | Parent course |
| `source_type` | `text` | NOT NULL | `youtube` \| `article` \| `text` |
| `url` | `text` | NULLABLE | Original URL (null for raw text sources) |
| `title` | `text` | NULLABLE | Video title / article title / "Raw Notes" |
| `raw_content` | `text` | NOT NULL | Full extracted text content |
| `metadata` | `jsonb` | NOT NULL DEFAULT '{}' | `duration_seconds`, `word_count`, `scraped_at`, etc. |
| `chunk_count` | `integer` | NOT NULL DEFAULT 0 | Number of chunks created from this document |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() | Ingestion timestamp |

> **RLS:** via `courses.user_id` join

---

#### `chunks`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY DEFAULT gen_random_uuid() | Chunk identifier |
| `course_id` | `uuid` | NOT NULL, FK → courses(id) ON DELETE CASCADE | Parent course (for scoped similarity search) |
| `source_doc_id` | `uuid` | NOT NULL, FK → source_documents(id) ON DELETE CASCADE | Parent source document |
| `chapter_id` | `uuid` | NULLABLE, FK → chapters(id) | Assigned chapter (set after course generation) |
| `content` | `text` | NOT NULL | Raw chunk text (≤512 tokens) |
| `embedding` | `vector(1024)` | NOT NULL | Voyage AI `voyage-large-2` embedding |
| `chunk_index` | `integer` | NOT NULL | Position within parent document |
| `token_count` | `integer` | NOT NULL | Actual token count of this chunk |
| `source_type` | `text` | NOT NULL | Denormalised from `source_documents` for fast filtering |
| `source_url` | `text` | NULLABLE | Denormalised URL for citation display |
| `timestamp_start` | `integer` | NULLABLE | YouTube start timestamp (seconds) for citation |
| `timestamp_end` | `integer` | NULLABLE | YouTube end timestamp (seconds) for citation |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() | Embedding timestamp |

> **RLS:** via `course_id`

**pgvector Index:**
```sql
CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Similarity search query:
SELECT id, content, 1 - (embedding <=> $1::vector) AS similarity
FROM chunks
WHERE course_id = $2
ORDER BY embedding <=> $1::vector
LIMIT 5;
```
> IVFFlat with `lists=100` is appropriate for up to ~500k chunks. Increase `lists` proportionally beyond that.

---

#### `chapters`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY DEFAULT gen_random_uuid() | Chapter identifier |
| `course_id` | `uuid` | NOT NULL, FK → courses(id) ON DELETE CASCADE | Parent course |
| `title` | `text` | NOT NULL | AI-generated or user-edited chapter title |
| `summary` | `text` | NULLABLE | AI-generated 2–3 paragraph summary (cached on first view) |
| `key_concepts` | `jsonb` | NULLABLE | Array of 5–8 concept strings (cached on first view) |
| `order_index` | `integer` | NOT NULL | Display order (0-based, user-reorderable) |
| `source_doc_ids` | `uuid[]` | NOT NULL DEFAULT '{}' | Array of source_document IDs this chapter draws from |
| `difficulty_level` | `text` | NOT NULL DEFAULT 'medium' | Current quiz difficulty: `easy` \| `medium` \| `hard` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() | Creation timestamp |

> **RLS:** via `course.user_id`

---

#### `ingestion_jobs`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY DEFAULT gen_random_uuid() | Job identifier returned to client for polling |
| `course_id` | `uuid` | NOT NULL, FK → courses(id) ON DELETE CASCADE | Associated course |
| `user_id` | `uuid` | NOT NULL, FK → auth.users(id) | Owner (for RLS on polling endpoint) |
| `status` | `text` | NOT NULL DEFAULT 'pending' | `pending` \| `processing` \| `completed` \| `failed` |
| `sources` | `jsonb` | NOT NULL | Array of `{type, url/text, title}` objects to process |
| `progress` | `jsonb` | NOT NULL DEFAULT '{}' | `{total, completed, current_source, errors[]}` |
| `error_message` | `text` | NULLABLE | Top-level error if job failed after retries |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() | Job creation timestamp |
| `completed_at` | `timestamptz` | NULLABLE | Completion timestamp |

> **RLS:** `user_id = auth.uid()` for read; service role for write

---

### 4.2 Quiz & Flashcard Tables

#### `quizzes`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY DEFAULT gen_random_uuid() | Quiz identifier |
| `chapter_id` | `uuid` | NOT NULL, FK → chapters(id) ON DELETE CASCADE | Parent chapter |
| `difficulty_level` | `text` | NOT NULL DEFAULT 'medium' | `easy` \| `medium` \| `hard` |
| `generated_at` | `timestamptz` | NOT NULL DEFAULT now() | Generation timestamp |
| `is_cached` | `boolean` | NOT NULL DEFAULT true | Whether questions are cached or regenerated |

> **RLS:** via `chapter → course → user_id`

---

#### `quiz_questions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY DEFAULT gen_random_uuid() | Question identifier |
| `quiz_id` | `uuid` | NOT NULL, FK → quizzes(id) ON DELETE CASCADE | Parent quiz |
| `question_text` | `text` | NOT NULL | The question text |
| `question_type` | `text` | NOT NULL | `mcq` \| `short_answer` |
| `options` | `jsonb` | NULLABLE | Array of 4 option strings (MCQ only) |
| `correct_answer` | `text` | NOT NULL | Correct option text (MCQ) or model answer (short) |
| `explanation` | `text` | NOT NULL | 2–3 sentence explanation shown after submission |
| `keywords` | `jsonb` | NULLABLE | Array of 3–5 expected keywords (short_answer only) |
| `source_chunk_id` | `uuid` | NULLABLE, FK → chunks(id) | Grounding chunk for citation |
| `order_index` | `integer` | NOT NULL | Display order within quiz |

> **RLS:** via `quiz → chapter → course → user_id`

---

#### `quiz_attempts`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY DEFAULT gen_random_uuid() | Attempt identifier |
| `quiz_id` | `uuid` | NOT NULL, FK → quizzes(id) | Parent quiz |
| `user_id` | `uuid` | NULLABLE, FK → auth.users(id) | NULL for anonymous shared-course attempts |
| `anonymous_session_id` | `text` | NULLABLE | Session ID for anonymous attempts |
| `score` | `integer` | NOT NULL | Raw score (e.g., 6 out of 7) |
| `max_score` | `integer` | NOT NULL DEFAULT 7 | Total questions |
| `answers` | `jsonb` | NOT NULL | Array of `{question_id, user_answer, is_correct}` |
| `difficulty_level` | `text` | NOT NULL | Difficulty at time of attempt |
| `completed_at` | `timestamptz` | NOT NULL DEFAULT now() | Completion timestamp |

> **RLS:** `user_id = auth.uid()` for read; anonymous attempts stored separately

---

#### `flashcards`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY DEFAULT gen_random_uuid() | Flashcard identifier |
| `chapter_id` | `uuid` | NOT NULL, FK → chapters(id) ON DELETE CASCADE | Parent chapter |
| `front` | `text` | NOT NULL | Concept question (front of card) |
| `back` | `text` | NOT NULL | Concise 1–3 sentence answer (back of card) |
| `order_index` | `integer` | NOT NULL | Display order within deck |
| `source_chunk_id` | `uuid` | NULLABLE, FK → chunks(id) | Grounding chunk for citation |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() | Generation timestamp |

> **RLS:** via `chapter → course → user_id`

---

#### `flashcard_progress`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY DEFAULT gen_random_uuid() | Progress record identifier |
| `user_id` | `uuid` | NOT NULL, FK → auth.users(id) ON DELETE CASCADE | User |
| `flashcard_id` | `uuid` | NOT NULL, FK → flashcards(id) ON DELETE CASCADE | Flashcard |
| `status` | `text` | NOT NULL DEFAULT 'unseen' | `unseen` \| `known` \| `review` |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT now() | Last status change timestamp |

> **RLS:** `user_id = auth.uid()` — `UNIQUE(user_id, flashcard_id)`

---

#### `chapter_progress`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY DEFAULT gen_random_uuid() | Progress record identifier |
| `user_id` | `uuid` | NOT NULL, FK → auth.users(id) ON DELETE CASCADE | User |
| `chapter_id` | `uuid` | NOT NULL, FK → chapters(id) ON DELETE CASCADE | Chapter |
| `completed` | `boolean` | NOT NULL DEFAULT false | Whether user marked chapter as complete |
| `completed_at` | `timestamptz` | NULLABLE | When chapter was marked complete |

> **RLS:** `user_id = auth.uid()` — `UNIQUE(user_id, chapter_id)`

---

#### `deep_dive_ratings`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY DEFAULT gen_random_uuid() | Rating identifier |
| `user_id` | `uuid` | NOT NULL, FK → auth.users(id) ON DELETE CASCADE | User |
| `chapter_id` | `uuid` | NOT NULL, FK → chapters(id) | Chapter context |
| `question` | `text` | NOT NULL | User question asked |
| `answer_snippet` | `text` | NOT NULL | First 200 chars of Claude answer |
| `rating` | `integer` | NOT NULL | `1` (thumbs up) or `-1` (thumbs down) |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() | Rating timestamp |

> **RLS:** `user_id = auth.uid()`

---

## 5. RAG Pipeline Design

### 5.1 Ingestion Pipeline

The ingestion pipeline runs entirely within the Python FastAPI service as an async background job. It handles three source types and writes chunks + embeddings to Supabase pgvector.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    INGESTION PIPELINE (FastAPI)                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼────────────────────────┐
         │                           │                        │
   YouTube URL               Article URL               Raw Text
         │                           │                        │
         ▼                           ▼                        ▼
 YouTube Transcript        Cheerio (HTML)           Direct text
     API (Python)       → Playwright fallback         input
         │                           │                        │
         └───────────────────────────┼────────────────────────┘
                                     │
                             raw_content (text)
                                     │
                                     ▼
                         ┌──────────────────────┐
                         │   Token Chunker      │
                         │  512 tok / 64 overlap│
                         └──────────┬───────────┘
                                    │
                            chunks[] (text)
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   Voyage AI Embedder │
                         │  voyage-large-2      │
                         │  Batch: 128 chunks   │
                         │  Retry: 3x backoff   │
                         └──────────┬───────────┘
                                    │
                         embeddings[] (vector 1024)
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  Supabase pgvector   │
                         │  INSERT INTO chunks  │
                         │  UPDATE job status   │
                         └──────────────────────┘
```

### 5.2 Retrieval Pipeline (RAG Query)

All generation tasks — course outlines, chapter summaries, quizzes, flashcards, and Deep Dive chat — use the same retrieval pattern. The scope of the vector search varies by task.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     RAG QUERY PIPELINE (FastAPI)                         │
└─────────────────────────────────────────┬────────────────────────────────┘
                                          │
                               User query / task context
                                          │
                                          ▼
                             ┌────────────────────────┐
                             │   Embed query text     │
                             │   Voyage AI (1 call)   │
                             └────────────┬───────────┘
                                          │
                               query_vector (1024d)
                                          │
                                          ▼
                             ┌────────────────────────┐
                             │  pgvector similarity   │
                             │  search                │
                             │  WHERE course_id = X   │  ◄── Course-scoped
                             │    AND chapter_id = Y  │  ◄── Chapter-scoped (optional)
                             │  ORDER BY cosine dist  │
                             │  LIMIT k (default: 5)  │
                             └────────────┬───────────┘
                                          │
                                top-k chunks (text + metadata)
                                          │
                                          ▼
                             ┌────────────────────────┐
                             │  Build Claude Prompt   │
                             │  system: task prompt   │
                             │  user: query +         │
                             │    <context> chunks    │
                             │  history (Deep Dive)   │
                             └────────────┬───────────┘
                                          │
                                          ▼
                             ┌────────────────────────┐
                             │  Claude API call       │
                             │  claude-sonnet-4-...   │
                             │  max_tokens: 2048      │
                             └────────────┬───────────┘
                                          │
                              Structured response (JSON)
                                          │
                                          ▼
                             ┌────────────────────────┐
                             │  Cache to Supabase     │
                             │  (summary/quiz/cards)  │
                             │  OR stream to client   │
                             │  (Deep Dive chat)      │
                             └────────────────────────┘
```

### 5.3 Retrieval Scope by Feature

| Feature | Scope Filter | top-k | Prompt File | Output Cache |
|---|---|---|---|---|
| Course Generation | `course_id = X` | 20 | `course_generation.txt` | `chapters` table |
| Chapter Summary | `chapter_id = Y` (via source_doc_ids) | 8 | `chapter_summary.txt` | `chapters.summary` |
| Quiz Generation | `chapter_id = Y` | 8 | `quiz_{level}.txt` | `quizzes + quiz_questions` |
| Flashcard Generation | `chapter_id = Y` | 8 | `flashcards.txt` | `flashcards` table |
| Deep Dive Chat | `chapter_id = Y` | 5 | `deep_dive.txt` | No cache (streaming) |

---

## 6. API Contracts

All Next.js API routes use the `/api` prefix and require a valid Supabase JWT in the `Authorization` header unless marked as **Public**. Python FastAPI endpoints are called by Next.js server-side and are not directly exposed to the browser.

---

### 6.1 Authentication Routes (Next.js)

---

#### `POST /api/auth/signup` — Public

Create a new user account using Supabase Auth.

**Request Body:**
```json
{ "email": "string", "password": "string (min 8 chars)" }
```

**Response (200):**
```json
{ "user": { "id": "uuid", "email": "string" }, "session": { "access_token": "string" } }
```

**Errors:** `400` validation error | `422` email already registered

---

#### `POST /api/auth/login` — Public

Authenticate user and return session tokens.

**Request Body:**
```json
{ "email": "string", "password": "string" }
```

**Response (200):**
```json
{ "user": { "id": "uuid", "email": "string" }, "session": { "access_token": "string", "refresh_token": "string" } }
```

**Errors:** `401` invalid credentials | `429` rate limited (3 failed attempts)

---

#### `POST /api/auth/reset-password` — Public

Send a password reset email via Supabase Auth.

**Request Body:**
```json
{ "email": "string" }
```

**Response (200):**
```json
{ "message": "Reset email sent" }
```

**Errors:** `400` invalid email — always returns `200` to prevent user enumeration

---

### 6.2 Course Routes (Next.js)

---

#### `GET /api/courses` — JWT Required

List all courses for the authenticated user, sorted by `updated_at DESC`.

**Response (200):**
```json
{ "courses": [{ "id": "uuid", "title": "string", "status": "string", "chapter_count": 0, "progress_pct": 0, "avg_quiz_score": 0, "updated_at": "iso" }] }
```

**Errors:** `401` unauthenticated

---

#### `POST /api/courses` — JWT Required

Create a new course record (`status=draft`) and return its ID.

**Request Body:**
```json
{ "title": "string (optional — defaults to untitled)" }
```

**Response (200):**
```json
{ "course": { "id": "uuid", "title": "string", "status": "draft", "created_at": "iso" } }
```

**Errors:** `401` unauthenticated

---

#### `PATCH /api/courses/[id]` — JWT Required

Update course title, description, or status. Used when user finalises a draft course (`status → active`).

**Request Body:**
```json
{ "title"?: "string", "description"?: "string", "status"?: "active|draft" }
```

**Response (200):**
```json
{ "course": { "id": "uuid", "title": "string", "status": "string", "updated_at": "iso" } }
```

**Errors:** `401` | `403` not owner | `404` not found

---

#### `DELETE /api/courses/[id]` — JWT Required

Delete course and all cascaded data (chapters, chunks, quizzes, flashcards, progress).

**Response (200):**
```json
{ "deleted": true }
```

**Errors:** `401` | `403` not owner | `404` not found

---

### 6.3 Ingestion Routes (Next.js → FastAPI)

---

#### `POST /api/ingestion/start` — JWT Required

Enqueue an async ingestion job. Returns a `job_id` for polling.

**Request Body:**
```json
{ "course_id": "uuid", "sources": [{ "type": "youtube|article|text", "url": "string?", "content": "string?" }] }
```

**Response (200):**
```json
{ "job_id": "uuid", "status": "pending" }
```

**Errors:** `400` invalid sources | `401` | `422` exceeds rate limits (20 YT URLs, 10 article URLs)

---

#### `GET /api/ingestion/status/[jobId]` — JWT Required

Poll the status of an ingestion job.

**Response (200):**
```json
{ "job_id": "uuid", "status": "pending|processing|completed|failed", "progress": { "total": 3, "completed": 2, "current_source": "Extracting video 2 of 3", "errors": [] } }
```

**Errors:** `401` | `403` not owner | `404` job not found

---

### 6.4 Course Generation Routes (Next.js → FastAPI)

---

#### `POST /api/courses/[id]/generate` — JWT Required

Trigger Claude course structure generation from the embedded corpus.

**Request Body:**
```json
{ "course_id": "uuid" }
```

**Response (200):**
```json
{ "course_title": "string", "description": "string", "chapters": [{ "title": "string", "summary": "string", "source_doc_ids": ["uuid"] }] }
```

**Errors:** `400` no embedded chunks | `401` | `404`

---

#### `PATCH /api/courses/[id]/chapters` — JWT Required

Save updated chapter order, titles, and source assignments after user edits. Batch upsert.

**Request Body:**
```json
{ "chapters": [{ "id": "uuid?", "title": "string", "order_index": 0, "source_doc_ids": ["uuid"] }] }
```

**Response (200):**
```json
{ "chapters": [{ "id": "uuid", "title": "string", "order_index": 0 }] }
```

**Errors:** `401` | `403` not owner | `404`

---

### 6.5 Chapter Learning Routes (Next.js → FastAPI)

---

#### `GET /api/chapters/[id]/summary` — JWT Required

Get AI-generated chapter summary and key concepts. Returns cached version if available, otherwise generates and caches.

**Response (200):**
```json
{ "summary": "string (2-3 paragraphs)", "key_concepts": ["string"], "sources": [{ "doc_id": "uuid", "title": "string", "url": "string", "timestamp_start": 0 }] }
```

**Errors:** `401` | `403` | `404`

---

#### `POST /api/chapters/[id]/deep-dive` — JWT Required

Submit a Deep Dive RAG question. Returns Claude's answer with source citations.

**Request Body:**
```json
{ "question": "string", "history": [{ "role": "user|assistant", "content": "string" }] }
```

**Response (200):**
```json
{ "answer": "string", "sources": [{ "chunk_id": "uuid", "excerpt": "string", "source_title": "string", "timestamp": 120 }], "rating_id": "uuid" }
```

**Errors:** `400` empty question | `401` | `403`

---

### 6.6 Quiz Routes (Next.js → FastAPI)

---

#### `GET /api/chapters/[id]/quiz` — JWT Required

Get the cached quiz for this chapter at the user's current difficulty level. Generates if not cached.

**Response (200):**
```json
{ "quiz_id": "uuid", "difficulty": "easy|medium|hard", "questions": [{ "id": "uuid", "type": "mcq|short_answer", "text": "string", "options": ["string"] }] }
```

**Errors:** `401` | `403` | `404`

---

#### `POST /api/quiz/[quizId]/submit` — JWT Required

Submit a completed quiz. Returns correct answers, explanations, and updated difficulty level.

**Request Body:**
```json
{ "answers": [{ "question_id": "uuid", "answer": "string" }] }
```

**Response (200):**
```json
{ "score": 6, "max_score": 7, "results": [{ "question_id": "uuid", "correct": true, "correct_answer": "string", "explanation": "string" }], "new_difficulty": "hard", "attempt_id": "uuid" }
```

**Errors:** `400` incomplete submission | `401` | `404`

---

### 6.7 Flashcard Routes (Next.js → FastAPI)

---

#### `GET /api/chapters/[id]/flashcards` — JWT Required

Get flashcards for a chapter with the user's current mastery status for each card.

**Response (200):**
```json
{ "flashcards": [{ "id": "uuid", "front": "string", "back": "string", "status": "unseen|known|review" }] }
```

**Errors:** `401` | `403` | `404`

---

#### `PATCH /api/flashcards/[id]/status` — JWT Required

Update mastery status for a single flashcard.

**Request Body:**
```json
{ "status": "known|review|unseen" }
```

**Response (200):**
```json
{ "flashcard_id": "uuid", "status": "known", "updated_at": "iso" }
```

**Errors:** `400` invalid status | `401` | `404`

---

### 6.8 Progress & Share Routes (Next.js)

---

#### `POST /api/chapters/[id]/complete` — JWT Required

Mark a chapter as complete for the authenticated user.

**Response (200):**
```json
{ "chapter_id": "uuid", "completed": true, "course_progress_pct": 75 }
```

**Errors:** `401` | `403` | `404`

---

#### `POST /api/courses/[id]/share` — JWT Required

Generate a public share slug for the course. Returns the share URL.

**Response (200):**
```json
{ "share_slug": "string (uuid)", "share_url": "https://learnforge.app/share/[slug]" }
```

**Errors:** `401` | `403` not owner | `404`

---

#### `GET /share/[slug]` — Public (No Auth)

Render a read-only public course view. Returns course data for server-side rendering.

**Response (200):**
```json
{ "course": { "title": "string", "description": "string", "chapters": [...] } }
```

**Errors:** `404` slug not found or revoked

---

## 7. Security Architecture & RLS Policies

### 7.1 Authentication Flow

```
 Client (Browser)        Next.js Middleware          Supabase Auth
       │                        │                         │
       │── POST /api/auth/login ──►                        │
       │                        │── createClient() ──────►│
       │                        │◄── access_token ────────│
       │◄── Set-Cookie ─────────│   (httpOnly cookie)     │
       │                        │                         │
       │── GET /api/courses ────►                          │
       │                        │── verifyJWT() ─────────►│
       │                        │◄── {user_id, email} ────│
       │                        │                         │
       │                        │── supabase.from('courses')
       │                        │   .select() ← RLS auto-filters by user_id
       │◄── courses[] ──────────│
```

### 7.2 RLS Policy Definitions

```sql
-- Enable RLS on all user-data tables (example: courses)
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own courses"
  ON courses FOR ALL
  USING (auth.uid() = user_id);
```

**Same pattern applies to:**
- `source_documents` — via `courses` join
- `chapters` — via `courses`
- `chunks` — via `courses`
- `quiz_attempts`, `flashcard_progress`, `chapter_progress`, `deep_dive_ratings` — direct `user_id`
- `ingestion_jobs` — users can `SELECT` their own; FastAPI service role can `INSERT`/`UPDATE` all
- `flashcards`, `quizzes`, `quiz_questions` — read-accessible via `chapter → course → user_id` join policy

### 7.3 Service Role Usage (FastAPI)

The FastAPI service uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS. This is necessary for background ingestion jobs that write to the `chunks` table on behalf of users. **The service role key is never exposed to the frontend.**

| ✅ Service Role Used For | 🚫 Service Role NEVER Used For |
|---|---|
| Writing chunks and embeddings during ingestion | Any operation initiated directly from the browser |
| Updating `ingestion_jobs` status during processing | Reading user data for display (always use anon key + JWT) |
| Writing generated quiz questions to `quiz_questions` | Exposed in any client-side code or public environment variable |
| Writing generated flashcards to `flashcards` | Any operation without an associated `user_id` verified server-side |

---

## 8. Deployment Architecture (Vercel)

```
┌───────────────────────────────────────────────────────────────────────────┐
│                       VERCEL DEPLOYMENT                                   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Next.js Project (learnforge-web)                                   │ │
│  │                                                                     │ │
│  │  • Static assets → Vercel Edge CDN (global)                        │ │
│  │  • app/ pages    → Vercel Serverless Functions (Node.js 20)         │ │
│  │  • /api routes   → Vercel Serverless Functions (Node.js 20, 60s)   │ │
│  │                                                                     │ │
│  │  Environment variables:                                             │ │
│  │    NEXT_PUBLIC_SUPABASE_URL          (client-safe)                  │ │
│  │    NEXT_PUBLIC_SUPABASE_ANON_KEY     (client-safe)                  │ │
│  │    FASTAPI_INTERNAL_URL              (server-only)                  │ │
│  │    RESEND_API_KEY                    (server-only)                  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Python FastAPI Project (learnforge-ai)                             │ │
│  │                                                                     │ │
│  │  • Deployed as Vercel Python Serverless Functions                   │ │
│  │  • Each route = separate serverless function                        │ │
│  │  • Max execution: 60s (Hobby) → 300s (Pro)                         │ │
│  │                                                                     │ │
│  │  Environment variables:                                             │ │
│  │    SUPABASE_URL                      (server-only)                  │ │
│  │    SUPABASE_SERVICE_ROLE_KEY         (server-only — never public)   │ │
│  │    ANTHROPIC_API_KEY                 (server-only)                  │ │
│  │    VOYAGE_API_KEY                    (server-only)                  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  Domains:                                                                 │
│    learnforge.app          → Next.js (primary domain)                    │
│    api.learnforge.app      → FastAPI (internal, not public-facing)       │
└───────────────────────────────────────────────────────────────────────────┘
```

### 8.1 Environment Configuration

| Variable | Service | Visibility | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Next.js | Public | Supabase project URL for client-side auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Next.js | Public | Supabase anon key (RLS-gated) |
| `SUPABASE_SERVICE_ROLE_KEY` | FastAPI | Server only | Bypasses RLS — never expose to client |
| `ANTHROPIC_API_KEY` | FastAPI | Server only | Claude API access |
| `VOYAGE_API_KEY` | FastAPI | Server only | Voyage AI embedding API |
| `FASTAPI_INTERNAL_URL` | Next.js | Server only | Internal URL of FastAPI service |
| `NEXT_PUBLIC_APP_URL` | Next.js | Public | Used to construct share links |
| `RESEND_API_KEY` | Next.js | Server only | Transactional email (stretch) |

### 8.2 Vercel Serverless Constraints & Mitigations

| Constraint | Limit | Impact | Mitigation |
|---|---|---|---|
| Execution timeout | 60s (Hobby) | Long ingestion jobs fail | Async job queue — ingestion returns `job_id` immediately |
| Bundle size | 50MB (Python) | Large ML libs excluded | No heavy ML libs; use APIs only (Voyage, Claude, YouTube) |
| Cold starts | ~1–3s (Python) | First request latency | Pre-warm via scheduled ping; async UX masks cold start |
| Memory | 1GB default | Playwright memory usage | Use Playwright only as fallback; default to requests + BS4 |
| Concurrent executions | 1000 (Pro) | Concurrent user limit | Adequate for MVP scale; monitor and optimise |

---

## 9. Performance & Scalability Strategy

### 9.1 Caching Strategy

| Resource | Cache Location | TTL | Invalidation |
|---|---|---|---|
| Chapter summary + key concepts | `chapters.summary` / `chapters.key_concepts` (DB) | Permanent | Manual regeneration by user |
| Quiz questions (per difficulty) | `quizzes + quiz_questions` (DB) | Permanent | On difficulty change or user regeneration |
| Flashcards | `flashcards` (DB) | Permanent | Manual regeneration by user |
| Course structure (during editing) | Draft course in DB | Until finalised | On chapter reorder/rename |
| Static assets (JS, CSS) | Vercel Edge CDN | Immutable (hashed filenames) | Auto on deploy |
| Supabase query results | Next.js `React cache()` (in-memory) | Per request | Per page render |

### 9.2 Database Performance

- pgvector IVFFlat index on `chunks.embedding` with `lists=100` — handles up to ~500k chunks
- B-tree indexes on: `chunks.course_id`, `chunks.chapter_id`, `courses.user_id`, `quiz_attempts.user_id`
- `chapter_count` is denormalised on `courses` table to avoid `COUNT(*)` on chapters for every dashboard render
- `progress_pct` computed on write and stored on `courses` — avoids expensive JOIN for dashboard
- Supabase connection pooler (PgBouncer) used in transaction mode for all serverless function connections

### 9.3 API Cost Management

| API | Usage Pattern | Cost Control |
|---|---|---|
| Voyage AI | Per-chunk embedding on ingestion | Batch 128 chunks/call; deduplicate re-ingested content; ~$0.02 per typical 3-video course |
| Claude API | Per generation task (course, quiz, flashcards, chat) | Cache all outputs in DB; only re-generate on explicit user request; Deep Dive is the only non-cacheable call |
| Claude API (Deep Dive) | Per chat message | `max_tokens=1024` for chat responses; limit conversation history to last 10 turns in context |
| Supabase | Per row read/write + storage | pgvector queries use `LIMIT 5–20`; no unbounded queries; RLS prevents cross-user data leakage inflating reads |

---

## 10. Adaptive Difficulty Implementation (Stretch)

Adaptive quiz difficulty is derived from the most recent `quiz_attempt` score for the `user + chapter` combination. No separate state table is required — difficulty is computed on read.

```
User completes quiz (score: 6/7 = 85%)
         │
         ▼
INSERT INTO quiz_attempts (score=6, max_score=7, difficulty_level='medium')
         │
         ▼
UPDATE chapters SET difficulty_level = 'hard'  (85% > 80% threshold)
         │
         ▼
Next quiz request: GET /api/chapters/[id]/quiz
         │
         ├── Read chapters.difficulty_level = 'hard'
         │
         ├── Load prompts/quiz_hard.txt as system prompt
         │
         └── Generate new quiz with hard prompt → cache with difficulty='hard'

Difficulty thresholds:
  score < 50%  → difficulty = easy   (foundational recall, clear distractors)
  50–80%       → difficulty = medium  (default, balanced)
  score > 80%  → difficulty = hard   (synthesis, nuanced distractors)
```

**Prompt Engineering Strategy per Difficulty:**

- **EASY** — Direct recall questions only; one clearly incorrect distractor per option; no cross-chapter synthesis; avoid technical jargon
- **MEDIUM** — Mix of recall and application; plausible distractors using related concepts; 1 inference question per quiz
- **HARD** — Synthesis across multiple concepts; all 4 options plausible from source material; include edge cases and nuanced distinctions; require application not just recall
- **All three prompts** include the same RAG grounding instruction: *"Only generate questions from the provided context chunks. Do not use general knowledge."*

---

## 11. Implementation Readiness Checklist

> Validates that all PRD requirements are addressable by this architecture before sprint planning begins.

| PRD Ref | Requirement | Architectural Coverage | Status |
|---|---|---|---|
| FR-001 | YouTube ingestion | `youtube.py` service + `ingestion_jobs` async queue | ✅ Ready |
| FR-002 | Article scraping | `scraper.py` + Playwright fallback | ✅ Ready |
| FR-003 | Raw text ingestion | Direct to `chunker.py` pipeline | ✅ Ready |
| FR-004 | Chunking + Voyage embedding | `chunker.py` + `embedder.py` + `chunks` table | ✅ Ready |
| FR-005 | AI course generation | `generate.py` + `course_generation.txt` + Claude | ✅ Ready |
| FR-006 | Chapter editor | `PATCH /api/courses/[id]/chapters` + drag-drop UI | ✅ Ready |
| FR-007 | Chapter summary | `GET /api/chapters/[id]/summary` + cache in `chapters` | ✅ Ready |
| FR-008 | Deep Dive RAG chat | `POST /api/chapters/[id]/deep-dive` + `deep_dive.txt` | ✅ Ready |
| FR-009 | Quiz generation | `GET /api/chapters/[id]/quiz` + `quiz_{level}.txt` | ✅ Ready |
| FR-010 | Quiz submission + scoring | `POST /api/quiz/[id]/submit` + keyword matching | ✅ Ready |
| FR-011 | Flashcard generation | `GET /api/chapters/[id]/flashcards` + `flashcards.txt` | ✅ Ready |
| FR-012 | Flashcard study UI | `PATCH /api/flashcards/[id]/status` + `flashcard_progress` | ✅ Ready |
| FR-013 | Auth (email/password) | Supabase Auth + Next.js middleware + RLS | ✅ Ready |
| FR-014 | Course library dashboard | `GET /api/courses` + denormalised `progress_pct` | ✅ Ready |
| FR-015 | Progress tracking | `chapter_progress` table + `POST /api/chapters/[id]/complete` | ✅ Ready |
| FR-016 | Adaptive difficulty (stretch) | `chapters.difficulty_level` + 3 quiz prompt files | ✅ Ready |
| FR-017 | Public share link (stretch) | `GET /share/[slug]` + `courses.share_slug` | ✅ Ready |
| FR-018 | Completion email (stretch) | `POST /api/email/completion` + Resend SDK | ✅ Ready |
| NFR-001 | Course gen < 4s p95 | Claude streaming + pgvector IVFFlat < 200ms | ✅ Addressed |
| NFR-006 | RLS data isolation | RLS policies on all user tables + service role isolation | ✅ Addressed |
| NFR-011 | Ingestion retry | 3× exponential backoff in `embedder.py` + job status | ✅ Addressed |

---

## 12. BMAD Handoff — Next: Epics & Stories + Implementation

> **`bmad-create-epics-and-stories`** — Load PRD v1.0 + this Architecture Document in a fresh chat with the PM Agent.

**PM Agent Instructions:**

- Load PRD v1.0 + this Architecture Document in a fresh chat.
- Create sprint-ready story files for all 28 User Stories. Each story file must include: full architectural context (relevant DB tables, API endpoints, service files), implementation guidelines, acceptance criteria from PRD, and test cases.
- Story files should reference specific file paths from Section 2 (Component Architecture) so developers know exactly where to implement each story.
- Prioritise stories in this order: **E-06 Auth first** (all other Epics depend on it), E-01 Ingestion, E-02 Course Generation, E-03 Chapter View, E-04 Quiz, E-05 Flashcards, then stretch Epics 7–9.
- After stories are created, run `bmad-check-implementation-readiness` to validate PRD ↔ Architecture ↔ Stories cohesion.

---

| Document | Coverage | Next Steps |
|---|---|---|
| LearnForge Architecture v1.0 · BMAD Phase 3 | 7 ADRs · 11 DB Tables · 18 API endpoints · All 18 FRs covered | PM Agent → `bmad-create-epics-and-stories` → Dev Agent → Sprint 1 |
