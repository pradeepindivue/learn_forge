import os
import json
import httpx
from groq import AsyncGroq
from services.vector_store import supabase_url, supabase_key
from fastapi import APIRouter
from api_schema import GenerateChapterResourceRequest

router = APIRouter()
groq_client = AsyncGroq(api_key=os.environ.get("GROQ_API_KEY"))

async def get_chapter_context(chapter_id: str) -> str:
    """Fetch chunks specifically assigned to a chapter or the whole course for grounding."""
    # Try chapter specific first
    endpoint = f"{supabase_url}/rest/v1/chunks?chapter_id=eq.{chapter_id}&select=content&limit=20"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}"
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.get(endpoint, headers=headers)
        data = res.json()
        if not data:
            # Fallback to course context if chapter mapping is missing
            # First find course_id
            ch_res = await client.get(f"{supabase_url}/rest/v1/chapters?id=eq.{chapter_id}&select=course_id", headers=headers)
            ch_data = ch_res.json()
            if ch_data:
                course_id = ch_data[0]['course_id']
                res = await client.get(f"{supabase_url}/rest/v1/chunks?course_id=eq.{course_id}&select=content&limit=30", headers=headers)
                data = res.json()
        
        return "\n\n".join([row["content"] for row in data])

@router.post("/quiz")
async def generate_quiz(request: GenerateChapterResourceRequest):
    context = await get_chapter_context(request.chapter_id)
    prompt = f"""
    Given the following educational context, generate a 5-question multiple choice quiz.
    The response MUST be raw JSON with this format:
    {{
      "questions": [
        {{
          "text": "Question text?",
          "type": "mcq",
          "options": ["Opt 1", "Opt 2", "Opt 3", "Opt 4"],
          "correct_answer": "Opt 1",
          "explanation": "Why it's correct"
        }}
      ]
    }}
    Context:
    {context[:30000]}
    """
    
    response = await groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    
    data = json.loads(response.choices[0].message.content)
    # Store quiz in DB (optional, but good for caching)
    # For now, just return to frontend
    return data

@router.post("/flashcards")
async def generate_flashcards(request: GenerateChapterResourceRequest):
    context = await get_chapter_context(request.chapter_id)
    prompt = f"""
    Given the following educational context, generate 10 flashcards for study.
    Each flashcard should have a 'front' (question/term) and 'back' (answer/definition).
    The response MUST be raw JSON with this format:
    {{
      "flashcards": [
        {{ "front": "Term", "back": "Definition" }}
      ]
    }}
    Context:
    {context[:30000]}
    """
    
    response = await groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    
    data = json.loads(response.choices[0].message.content)
    return data

@router.post("/chat")
async def chat_with_context(request: dict):
    # request: { chapter_id: str, question: str }
    chapter_id = request.get("chapter_id")
    question = request.get("question")
    
    context = await get_chapter_context(chapter_id)
    
    prompt = f"""
    You are an AI learning assistant. Answer the user's question based ONLY on the provided context.
    If the answer is not in the context, say you don't know based on the provided materials.
    
    Context:
    {context[:30000]}
    
    User Question: {question}
    """
    
    response = await groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}]
    )
    
    return {"answer": response.choices[0].message.content}
