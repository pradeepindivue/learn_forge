from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Literal

# --- Ingestion Schemas ---
class SourceItem(BaseModel):
    type: Literal["youtube", "article", "text"]
    url: Optional[str] = None
    content: Optional[str] = None
    title: Optional[str] = None

class IngestRequest(BaseModel):
    course_id: str
    sources: List[SourceItem]

class IngestResponse(BaseModel):
    job_id: str
    status: str

# --- Generation Schemas ---
class GenerateCourseRequest(BaseModel):
    course_id: str

class GenerateChapterResourceRequest(BaseModel):
    chapter_id: str

class ChapterDraft(BaseModel):
    title: str
    summary: str
    source_doc_ids: List[str]

class CourseOutlineResponse(BaseModel):
    course_title: str
    description: str
    chapters: List[ChapterDraft]

# --- RAG Chat Schemas ---
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class DeepDiveRequest(BaseModel):
    question: str
    history: List[ChatMessage] = []

class SourceCitation(BaseModel):
    chunk_id: str
    excerpt: str
    source_title: str
    timestamp: Optional[int] = None

class DeepDiveResponse(BaseModel):
    answer: str
    sources: List[SourceCitation]
    rating_id: str
