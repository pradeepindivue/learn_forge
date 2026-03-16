# LearnForge - Comprehensive Implementation Plan

## 1. Goal Description
Implement the LearnForge platform, a hybrid Next.js and Python FastAPI application. LearnForge transforms unstructured content (YouTube playlists, Articles, Text) into fully structured, interactive courses with chapters, summaries, context-grounded quizzes, and adaptive flashcards using Claude LLM and Voyage AI.

This document serves as the comprehensive, end-to-end implementation plan spanning infrastructure, frontend, backend AI processing, and database schemas.

## 2. Architecture Overview & Base Codebase

### Codebase Structure
The project will be split into two primary deployment units within a monorepo or standard cohesive structure:

1. **`learnforge-web/`**: Next.js 14 frontend and lightweight API routes.
2. **`learnforge-ai/`**: Python FastAPI backend for AI processing and ingestion.

### 2.1 Supabase Database & Security (Infrastructure)
All data, including vectors, will reside in a single Supabase project.

#### Database Tables
*   **`users`**: Managed by Supabase Auth (auth.users).
*   **`courses`**: Stores `title`, `description`, `status` (draft/active), `share_slug`, `chapter_count`. Denormalized progress percentage calculated dynamically.
*   **`source_documents`**: Stores `source_type` (youtube/article/text), `url`, `raw_content`, `metadata`.
*   **`chunks`**: `content`, `embedding` (vector(1024)), `chunk_index`, `timestamp_start`, `timestamp_end`.
    *   *Index*: `CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);`
*   **`chapters`**: `title`, `summary`, `key_concepts` (jsonb), `order_index`, `difficulty_level`.
*   **`ingestion_jobs`**: Job tracking for async processing with `status` (pending/processing/completed/failed) and `progress` details.
*   **`quizzes`** & **`quiz_questions`**: Stores generated quizzes and individual questions with options and explanations.
*   **`quiz_attempts`**: Stores user scores, answers, and the calculated difficulty level at the time.
*   **`flashcards`** & **`flashcard_progress`**: Stores generated flashcards and per-user mastery state (unseen/known/review).
*   **`chapter_progress`**: Tracks boolean `completed` state per user, per chapter.

#### Row Level Security (RLS)
*   Enabled on all tables.
*   Policy Pattern: `CREATE POLICY "Users can only see their own data" ON <table> FOR ALL USING (auth.uid() = user_id);`
*   **Service Role Exception**: The FastAPI AI service will use the Supabase Service Role Key to bypass RLS for background ingestion jobs (writing to `chunks`, updating `ingestion_jobs`).

## 3. Phase-by-Phase Implementation Details

### Phase 1: Setup & Initialization
1.  **Initialize Next.js App (`learnforge-web`)**:
    *   Run `npx create-next-app@latest`. Use App Router, TypeScript, Tailwind CSS.
    *   Set up Supabase SSR client in `utils/supabase/server.ts` and `client.ts`.
2.  **Initialize FastAPI App (`learnforge-ai`)**:
    *   Create virtual environment. Install `fastapi`, `uvicorn`, `supabase`, `anthropic`, `voyageai`, `youtube-transcript-api`, `beautifulsoup4`.
    *   Configure CORS to accept requests from the Next.js frontend domain.
3.  **Database Provisioning**:
    *   Execute SQL migrations to create the schema defined above, enable `pgvector`, and define RLS policies.

### Phase 2: Next.js Frontend & API Routes
#### 2.1 Authentication & Layout
*   **`app/(auth)/login/page.tsx`**, **`signup/page.tsx`**: Forms for email/password auth using `@supabase/ssr`.
*   **`app/api/auth/[...supabase]/route.ts`**: Auth callback handlers.
*   **`app/(dashboard)/layout.tsx`**: Auth-gated layout ensuring `session` exists.

#### 2.2 Course Dashboard & CRUD
*   **`app/(dashboard)/page.tsx`**: Fetches and renders user courses from the `courses` table. Displays progress calculated via `chapter_progress`.
*   **`app/courses/new/page.tsx`**: Ingestion interface taking YouTube, Article URLs, or Text.
*   **`app/api/ingestion/start/route.ts`**: Validates input and triggers the internal FastAPI `/ingest` endpoint.
*   **`app/api/ingestion/status/[jobId]/route.ts`**: Polls the `ingestion_jobs` table for progress updates.

#### 2.3 Course Editing & Learning View
*   **`app/courses/[id]/edit/page.tsx`**: Drag-and-drop chapter reordering and inline renaming. Uses `PATCH /api/courses/[id]/chapters`.
*   **`app/courses/[id]/chapters/[chId]/page.tsx`**: The main learning view. Displays the AI-generated summary and key concepts.
*   **`app/api/chapters/[id]/complete/route.ts`**: Marks chapter complete in `chapter_progress`.

#### 2.4 Quizzes & Flashcards UI
*   **`app/courses/[id]/chapters/[chId]/quiz/page.tsx`**: Renders 5 MCQs and 2 short-answer questions. Handles self-grading logic and submission to `POST /api/quiz/[quizId]/submit`.
*   **`app/courses/[id]/chapters/[chId]/flashcards/page.tsx`**: Flip-card UI allowing marking cards as "Known" or "Needs Review".

### Phase 3: Python FastAPI AI Service (`learnforge-ai`)
#### 3.1 Async Ingestion Pipeline (`routers/ingest.py`)
*   Provides `POST /ingest` which immediately returns a `job_id` and kicks off a background task.
*   **Extractors (`services/youtube.py`, `services/scraper.py`)**: Uses `youtube-transcript-api` and `beautifulsoup4` (with Playwright fallback) to gather text.
*   **Chunker (`services/chunker.py`)**: Slices text into 512-token chunks with 64-token overlap.
*   **Embedder (`services/embedder.py`)**: Batches chunks and calls Voyage AI (`voyage-large-2`). Implements 3x exponential backoff for rate limits.
*   **Vector Storage (`services/vector_store.py`)**: Writes embeddings to the Supabase `chunks` table using the Service Role Key.

#### 3.2 Claude RAG Generation Pipeline (`routers/generate.py`)
*   **Course Structure**: `POST /generate/course`. Retrieves all course chunks. Uses Anthropic SDK to prompt Claude for a title, description, and chapter outline.
*   **Chapter Resources**: `POST /generate/chapter-summary`, `POST /generate/quiz`, `POST /generate/flashcards`. Each retrieves top-8 chunks for the assigned `chapter_id`.
*   **Prompts**: Dedicated `.txt` modules in `learnforge-ai/prompts/` dictating output schema (JSON) and RAG grounding rules.

#### 3.3 Deep Dive Chat (`routers/rag.py`)
*   **`POST /rag/query`**: Embeds the user's question, performs PGVector similarity search (Top 5 chunks) scoped to the `chapter_id`.
*   Streams the response back using Claude, appending source citations (document title, timestamp).

### Phase 4: Stretch Features
1.  **Adaptive Quiz Difficulty**: Modify `GET /api/chapters/[id]/quiz`. Check the user's latest score in `quiz_attempts`. If >80%, use `prompts/quiz_hard.txt`; if <50%, use `prompts/quiz_easy.txt`.
2.  **Public Share Link**: `POST /api/courses/[id]/share` assigns a UUID to `courses.share_slug`. A new public route `app/share/[slug]/page.tsx` renders a read-only view bypassing RLS.
3.  **Completion Email**: Track `chapter_progress`. When 100% is reached, trigger Next.js route `POST /api/email/completion` relying on the Resend API SDK.

## 4. Verification Plan

### Automated Testing
1.  **Next.js API Tests (Jest / Supertest)**:
    *   Test Supabase Auth flow endpoints.
    *   Test RLS: verify `GET /api/courses/[id]` errors (403/404) when queried by an unauthenticated or incorrect user account.
    *   Test Async polling: Mock `ingestion_jobs` records and verify `/api/ingestion/status/[jobId]` formatting.
2.  **FastAPI Tests (Pytest)**:
    *   Test the ingestion pipeline's resilience. Mock `youtube-transcript-api` and Voyage AI. Ensure the job status correctly transitions to `failed` upon unrecoverable mock timeouts.
    *   Test Voyage AI 3x exponential backoff logic explicitly.
    *   Test Claude prompt templating output schema parsing.

### Manual End-to-End Verification
To ensure complete system integration, execute the following manual user journey:
1.  **Authentication**: Navigate to `/signup`, create an account. Log out, then log back in via `/login`.
2.  **Content Ingestion**: Navigate to "New Course". Submit exactly 1 public YouTube URL and 1 public Blog URL.
    *   *Verification*: Observe the async status polling update in real-time from "Pending" to "Completed".
3.  **Course Structure Review**: Click "Generate Course".
    *   *Verification*: Ensure Claude generates 4–8 chapters. Drag and drop Chapter 1 to position 2. Rename Chapter 3. Click "Finalize".
4.  **Learning Journey**: Open the first chapter.
    *   *Verification*: Read the summary (it should reflect the content). Ask the "Deep Dive" chatbot a highly specific question about a minute mark in the YouTube video; verify the citation provided in the answer.
5.  **Assessment**: Take the chapter quiz.
    *   *Verification*: Select answers, self-grade the short-answer, submit. Ensure the total score persists exactly as calculated.
6.  **Progress Validation**: Return to the Dashboard. Verify that the global progress bar corresponds precisely to the number of completed chapters vs. total chapters.

### Deployment Validation
*   Deploy to Vercel.
*   Verify that long ingestion tasks (e.g., a 60-minute video) successfully enqueue the async job on FastAPI and do not hit the Vercel 60s timeout limit on the Next.js frontend request.
