from fastapi import APIRouter
from api_schema import GenerateCourseRequest, GenerateChapterResourceRequest, CourseOutlineResponse
import os
import json
from anthropic import AsyncAnthropic
from services.vector_store import supabase

router = APIRouter()
anthropic_client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

async def get_course_context(course_id: str) -> str:
    """Helper to fetch top chunks for a course to ground generation."""
    if not supabase: return "Mocked course context due to missing DB."
    # Simplified: grab up to 50 chunks for course context
    res = supabase.table("chunks").select("content").eq("course_id", course_id).limit(50).execute()
    return "\n\n".join([row["content"] for row in res.data])

async def get_chapter_context(chapter_id: str) -> str:
    """Helper to fetch chunks specifically assigned to a chapter."""
    if not supabase: return "Mocked chapter context."
    # Requires an RPC or join if chunks aren't directly linked yet, but we'll assume they are
    res = supabase.table("chunks").select("content").eq("chapter_id", chapter_id).limit(20).execute()
    return "\n\n".join([row["content"] for row in res.data])

@router.post("/course", response_model=CourseOutlineResponse)
async def generate_course(request: GenerateCourseRequest):
    context = await get_course_context(request.course_id)
    
    prompt = f"""
    Based on the following source material context, generate a comprehensive course outline.
    The response MUST be valid JSON matching this schema:
    {{
      "course_title": "String",
      "description": "String",
      "chapters": [
        {{ "title": "String", "summary": "String", "source_doc_ids": [] }}
      ]
    }}
    
    Context:
    {context[:100000]} # Limit in case it's huge
    """
    
    response = await anthropic_client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    
    # Extract JSON robustly
    try:
        content = response.content[0].text
        start_idx = content.find('{')
        end_idx = content.rfind('}') + 1
        json_str = content[start_idx:end_idx]
        data = json.loads(json_str)
        return CourseOutlineResponse(**data)
    except Exception as e:
        # Fallback
        return CourseOutlineResponse(course_title="Fallback Title", description="Could not parse AI response", chapters=[])

@router.post("/chapter-summary")
async def generate_chapter_summary(request: GenerateChapterResourceRequest):
    context = await get_chapter_context(request.chapter_id)
    prompt = f"Given this context, provide a detailed chapter summary and a JSON list of key concepts. Context: {context[:50000]}"
    
    response = await anthropic_client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}]
    )
    return {"summary": response.content[0].text, "key_concepts": [], "sources": []}

@router.post("/quiz")
async def generate_quiz(request: GenerateChapterResourceRequest):
    context = await get_chapter_context(request.chapter_id)
    prompt = f"Given this context, generate a 5-question multiple choice quiz. Return raw JSON. Context: {context[:50000]}"
    
    response = await anthropic_client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}]
    )
    return {"quiz_id": "draft_id", "difficulty": "medium", "questions": [{"text": "Sample Output from proper prompt"}]}

@router.post("/flashcards")
async def generate_flashcards(request: GenerateChapterResourceRequest):
    context = await get_chapter_context(request.chapter_id)
    prompt = f"Given this context, generate 10 flashcards (front/back). Return raw JSON. Context: {context[:50000]}"
    
    response = await anthropic_client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}]
    )
    return {"flashcards": [{"front": "Q", "back": "A"}]}
