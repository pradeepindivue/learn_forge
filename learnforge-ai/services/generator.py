import os
import json
import httpx
from groq import AsyncGroq
from services.vector_store import supabase_url, supabase_key
from api_schema import CourseOutlineResponse, ChapterDraft

groq_client = AsyncGroq(api_key=os.environ.get("GROQ_API_KEY"))

async def get_course_context(course_id: str) -> str:
    """Fetch top chunks for a course to ground generation."""
    endpoint = f"{supabase_url}/rest/v1/chunks?course_id=eq.{course_id}&select=content&limit=50"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}"
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.get(endpoint, headers=headers)
        res.raise_for_status()
        data = res.json()
        return "\n\n".join([row["content"] for row in data])

async def generate_course_curriculum(course_id: str):
    """
    Generates a course description and chapters structure using AI,
    then saves them to the database.
    """
    context = await get_course_context(course_id)
    
    if not context:
        print(f"No context found for course {course_id}. Skipping generation.")
        return
    
    prompt = f"""
    Based on the following source material context, generate a comprehensive course outline.
    The response MUST be valid JSON matching this schema:
    {{
      "course_title": "String",
      "description": "String",
      "chapters": [
        {{ "title": "String", "summary": "String", "key_concepts": ["String", "String", "String"], "source_doc_ids": [] }}
      ]
    }}
    
    Ensure the description is engaging. Chapters should follow a logical learning progression.
    
    Context:
    {context[:30000]} 
    """
    
    try:
        response = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        data = json.loads(response.choices[0].message.content)
        
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json"
        }
        
        # 1. Update Course Description and Title
        async with httpx.AsyncClient() as client:
            course_endpoint = f"{supabase_url}/rest/v1/courses?id=eq.{course_id}"
            chapter_endpoint = f"{supabase_url}/rest/v1/chapters"
            
            await client.patch(course_endpoint, json={
                "description": data.get("description", ""),
                "title": data.get("course_title", "Untitled Course")
            }, headers=headers)
            
            # 2. Clear existing chapters (to allow regeneration)
            await client.delete(f"{chapter_endpoint}?course_id=eq.{course_id}", headers=headers)
            
            # 3. Save Chapters
            chapters = data.get("chapters", [])
            for i, ch in enumerate(chapters):
                await client.post(chapter_endpoint, json={
                    "course_id": course_id,
                    "title": ch["title"],
                    "summary": ch["summary"],
                    "key_concepts": ch.get("key_concepts", []),
                    "order_index": i,
                    "difficulty_level": "medium"
                }, headers=headers)
            
        return data
        
    except Exception as e:
        print(f"Error generating curriculum for course {course_id}: {str(e)}")
        raise e
