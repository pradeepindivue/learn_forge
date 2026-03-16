-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create tables

-- TABLE: courses
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    share_slug TEXT UNIQUE,
    chapter_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE: source_documents
CREATE TABLE IF NOT EXISTS source_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    url TEXT,
    title TEXT,
    raw_content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    chunk_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE: chapters
CREATE TABLE IF NOT EXISTS chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT,
    key_concepts JSONB,
    order_index INTEGER NOT NULL,
    source_doc_ids UUID[] NOT NULL DEFAULT '{}',
    difficulty_level TEXT NOT NULL DEFAULT 'medium',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE: chunks
CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    source_doc_id UUID NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES chapters(id),
    content TEXT NOT NULL,
    embedding vector(1024) NOT NULL,
    chunk_index INTEGER NOT NULL,
    token_count INTEGER NOT NULL,
    source_type TEXT NOT NULL,
    source_url TEXT,
    timestamp_start INTEGER,
    timestamp_end INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create IVFFlat index on chunks.embedding
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- TABLE: ingestion_jobs
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    sources JSONB NOT NULL,
    progress JSONB NOT NULL DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- TABLE: quizzes
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    difficulty_level TEXT NOT NULL DEFAULT 'medium',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_cached BOOLEAN NOT NULL DEFAULT true
);

-- TABLE: quiz_questions
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL,
    options JSONB,
    correct_answer TEXT NOT NULL,
    explanation TEXT NOT NULL,
    keywords JSONB,
    source_chunk_id UUID REFERENCES chunks(id),
    order_index INTEGER NOT NULL
);

-- TABLE: quiz_attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id),
    user_id UUID REFERENCES auth.users(id),
    anonymous_session_id TEXT,
    score INTEGER NOT NULL,
    max_score INTEGER NOT NULL DEFAULT 7,
    answers JSONB NOT NULL,
    difficulty_level TEXT NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE: flashcards
CREATE TABLE IF NOT EXISTS flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    source_chunk_id UUID REFERENCES chunks(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE: flashcard_progress
CREATE TABLE IF NOT EXISTS flashcard_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    flashcard_id UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'unseen',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, flashcard_id)
);

-- TABLE: chapter_progress
CREATE TABLE IF NOT EXISTS chapter_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    UNIQUE(user_id, chapter_id)
);

-- TABLE: deep_dive_ratings
CREATE TABLE IF NOT EXISTS deep_dive_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id),
    question TEXT NOT NULL,
    answer_snippet TEXT NOT NULL,
    rating INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- Setup Row Level Security (RLS) policies

-- Helper function to check if the current user owns a specific course id
CREATE OR REPLACE FUNCTION public.is_course_owner(course_id UUID) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM courses WHERE id = course_id AND user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if the current user owns a specific chapter id
CREATE OR REPLACE FUNCTION public.is_chapter_owner(chapter_id UUID) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM chapters c JOIN courses cr ON c.course_id = cr.id WHERE c.id = chapter_id AND cr.user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all user-data tables
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own chapters" ON chapters FOR INSERT WITH CHECK (public.is_course_owner(course_id));
CREATE POLICY "Users can update their own chapters" ON chapters FOR UPDATE USING (public.is_course_owner(course_id));
CREATE POLICY "Users can delete their own chapters" ON chapters FOR DELETE USING (public.is_course_owner(course_id));

-- Quizzes RLS
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own quizzes" ON quizzes FOR SELECT USING (public.is_chapter_owner(chapter_id));
CREATE POLICY "Users can insert their own quizzes" ON quizzes FOR INSERT WITH CHECK (public.is_chapter_owner(chapter_id));

-- Quiz Attempts RLS
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own attempts" ON quiz_attempts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own attempts" ON quiz_attempts FOR INSERT WITH CHECK (user_id = auth.uid());

-- Flashcards RLS
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own flashcards" ON flashcards FOR SELECT USING (public.is_chapter_owner(chapter_id));
CREATE POLICY "Users can insert their own flashcards" ON flashcards FOR INSERT WITH CHECK (public.is_chapter_owner(chapter_id));

-- Flashcard Progress RLS
ALTER TABLE flashcard_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own progress" ON flashcard_progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their own progress" ON flashcard_progress FOR ALL USING (user_id = auth.uid());

-- Chapter Progress RLS
ALTER TABLE chapter_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own progress" ON chapter_progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their own progress" ON chapter_progress FOR ALL USING (user_id = auth.uid());

-- Deep Dive Ratings RLS
ALTER TABLE deep_dive_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own ratings" ON deep_dive_ratings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own ratings" ON deep_dive_ratings FOR INSERT WITH CHECK (user_id = auth.uid());

-- Source Documents RLS
ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own source docs" ON source_documents FOR SELECT USING (public.is_course_owner(course_id));
CREATE POLICY "Users can insert their own source docs" ON source_documents FOR INSERT WITH CHECK (public.is_course_owner(course_id));

-- Chunks RLS (Read-only for users, written by backend service role)
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view chunks for their courses" ON chunks FOR SELECT USING (public.is_course_owner(course_id));

-- Ingestion Jobs RLS
ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own jobs" ON ingestion_jobs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own jobs" ON ingestion_jobs FOR INSERT WITH CHECK (user_id = auth.uid());ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE deep_dive_ratings ENABLE ROW LEVEL SECURITY;

-- Policies for 'courses'
CREATE POLICY "Users can fully manage their own courses" ON courses
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public read for shared courses" ON courses
    FOR SELECT USING (share_slug IS NOT NULL);

-- Policies for 'source_documents'
CREATE POLICY "Users can fully manage their own source documents" ON source_documents
    FOR ALL USING (public.is_course_owner(course_id));

-- Policies for 'chapters'
CREATE POLICY "Users can fully manage their own chapters" ON chapters
    FOR ALL USING (public.is_course_owner(course_id));

CREATE POLICY "Public read for shared chapters" ON chapters
    FOR SELECT USING (EXISTS (SELECT 1 FROM courses WHERE id = chapters.course_id AND share_slug IS NOT NULL));

-- Policies for 'chunks'
CREATE POLICY "Users can fully manage their own chunks" ON chunks
    FOR ALL USING (public.is_course_owner(course_id));

-- Policies for 'ingestion_jobs'
CREATE POLICY "Users can read their own ingestion jobs" ON ingestion_jobs
    FOR SELECT USING (auth.uid() = user_id);
-- Insert/Update handled by Service Role

-- Policies for 'quizzes'
CREATE POLICY "Users can fully manage their own quizzes" ON quizzes
    FOR ALL USING (public.is_chapter_owner(chapter_id));
CREATE POLICY "Public read for shared quizzes" ON quizzes
    FOR SELECT USING (EXISTS (SELECT 1 FROM chapters c JOIN courses co ON c.course_id = co.id WHERE c.id = quizzes.chapter_id AND co.share_slug IS NOT NULL));

-- Policies for 'quiz_questions'
CREATE POLICY "Users can fully manage their own quiz_questions" ON quiz_questions
    FOR ALL USING (EXISTS (SELECT 1 FROM quizzes q JOIN chapters c ON q.chapter_id = c.id JOIN courses co ON c.course_id = co.id WHERE q.id = quiz_questions.quiz_id AND co.user_id = auth.uid()));
CREATE POLICY "Public read for shared quiz_questions" ON quiz_questions
    FOR SELECT USING (EXISTS (SELECT 1 FROM quizzes q JOIN chapters c ON q.chapter_id = c.id JOIN courses co ON c.course_id = co.id WHERE q.id = quiz_questions.quiz_id AND co.share_slug IS NOT NULL));

-- Policies for 'quiz_attempts'
CREATE POLICY "Users can fully manage their own quiz attempts" ON quiz_attempts
    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anonymous users can create attempts" ON quiz_attempts
    FOR INSERT WITH CHECK (user_id IS NULL AND anonymous_session_id IS NOT NULL);

-- Policies for 'flashcards'
CREATE POLICY "Users can fully manage their own flashcards" ON flashcards
    FOR ALL USING (public.is_chapter_owner(chapter_id));

-- Policies for 'flashcard_progress'
CREATE POLICY "Users can fully manage their flashcard progress" ON flashcard_progress
    FOR ALL USING (auth.uid() = user_id);

-- Policies for 'chapter_progress'
CREATE POLICY "Users can fully manage their chapter progress" ON chapter_progress
    FOR ALL USING (auth.uid() = user_id);

-- Policies for 'deep_dive_ratings'
CREATE POLICY "Users can fully manage their ratings" ON deep_dive_ratings
    FOR ALL USING (auth.uid() = user_id);
