# LearnForge - Project Brief

## 1. Executive Summary
LearnForge is a full-stack, AI-powered learning platform designed to transform unstructured raw content—such as YouTube playlists, article URLs, and plain-text notes—into fully structured, interactive courses. The platform parses this content into semantically chunked vectors, generating coherent courses with chapters, context-grounded quizzes, and adaptive flashcards.

### Value Proposition
- **One-click course generation** from any combination of URLs or text.
- **RAG-grounded assessments**: All quizzes and flashcards are grounded in the actual source material via Retrieval-Augmented Generation (RAG).
- **Chapter-level deep-dive Q&A**: Allows learners to interrogate their own content.
- **Adaptive learning**: Quiz difficulty automatically adapts based on learner performance over time.

## 2. Target Users
- Self-learners building structured study plans from curated YouTube playlists.
- Students turning lecture notes and reading lists into practice material.
- Professionals upskilling from blog/documentation resources.
- Content creators packaging their own material into courses.

## 3. Core Features (MVP)
1. **Multi-Source Content Ingestion**: Accepts YouTube URLs, public article URLs, and raw text notes. Extracts transcripts, scrapes text, chunks content, and embeds using Voyage AI into Supabase pgvector.
2. **AI Course Generation**: Claude analyzes ingested content via RAG to generate a course outline with chapters, summaries, and source attributions.
3. **Chapter Learning View**: Displays AI-generated summaries, key concepts, and a "Deep Dive" RAG chatbot for follow-up questions anchored to the chapter's content.
4. **Quiz Generator & Scoring**: Generates 5 MCQs and 2 short-answer questions per chapter. Provides explanations, stores scores, and adjusts future difficulty.
5. **Flashcard Mode**: 10–15 flashcards generated per chapter with a flip-card UI supporting "Known" and "Needs Review" mastery states.
6. **Authentication & Progress Tracking**: Supabase Auth (email/password). Tracks completed chapters, quiz scores, and flashcard mastery, showing visual progress per course.

## 4. Stretch Features (Bonus)
- **Adaptive Quiz Difficulty**: Difficulty scales (easy, medium, hard) based on previous quiz scores.
- **Share Course (Public Link)**: Generate a public, read-only URL for shared access without authentication.
- **Email Course Completion Summary**: Resend integration to email users a summary of their performance upon completing a course.

## 5. Technology Stack
- **Frontend**: Next.js 14 (App Router) + React, TypeScript.
- **Backend / API**: Next.js API Routes (UI/Auth/CRUD) + Python FastAPI (AI Processing).
- **AI / LLM**: Claude (Anthropic) for course/quiz/card generation and Chat.
- **Embeddings**: Voyage AI (`voyage-large-2`).
- **Database + Auth**: Supabase (PostgreSQL, pgvector, Auth with RLS).
- **Deployment**: Vercel (both Next.js and FastAPI serverless functions).
- **Scraping**: YouTube Transcript API (Python) + Cheerio/Playwright.

## 6. Key Architecture Decisions
- **Hybrid Backend Strategy**: Next.js handles lightweight operations, while Python FastAPI handles AI-intensive operations within Vercel's serverless budget via async jobs.
- **Single Vector Store**: All structured and vector data is stored in a single Supabase project using the `pgvector` extension.
- **Async Ingestion Queue**: Ingestion operates asynchronously in FastAPI and updates a `ingestion_jobs` table, avoiding Vercel serverless timeouts.
- **Fixed-Size Chunking**: 512 tokens with 64-token overlap.
