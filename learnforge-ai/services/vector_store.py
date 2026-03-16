import os
from supabase import create_client, Client
from typing import List, Dict, Any

# Must use the service role key to bypass RLS for ingestion background jobs
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if supabase_url and supabase_key:
    supabase: Client = create_client(supabase_url, supabase_key)
else:
    # Fallback for local dev/testing if not fully configured
    supabase = None

async def store_source_document(course_id: str, source_type: str, url: str, raw_content: str, title: str = "") -> str:
    """Stores the raw source document and returns its ID."""
    if not supabase: return "mock_doc_id"
    
    data = {
        "course_id": course_id,
        "source_type": source_type,
        "url": url,
        "title": title,
        "raw_content": raw_content,
        "chunk_count": 0
    }
    
    result = supabase.table("source_documents").insert(data).execute()
    return result.data[0]["id"]

async def store_chunks(course_id: str, source_doc_id: str, chunks_data: List[Dict[str, Any]]):
    """
    Inserts a list of chunk dictionaries into the `chunks` pgvector table.
    chunks_data expected format:
    [{ "content": str, "embedding": List[float], "chunk_index": int, "token_count": int, "source_type": str, "source_url": str }]
    """
    if not supabase: return
    
    insert_data = []
    for chunk in chunks_data:
        insert_data.append({
            "course_id": course_id,
            "source_doc_id": source_doc_id,
            "content": chunk["content"],
            "embedding": chunk["embedding"],
            "chunk_index": chunk["chunk_index"],
            "token_count": chunk["token_count"],
            "source_type": chunk.get("source_type", "unknown"),
            "source_url": chunk.get("source_url")
        })
        
    # Update source doc chunk count
    supabase.table("source_documents").update({"chunk_count": len(chunks_data)}).eq("id", source_doc_id).execute()
    
    # Insert chunks in batches of 100 to avoid request size limits
    batch_size = 100
    for i in range(0, len(insert_data), batch_size):
        batch = insert_data[i:i + batch_size]
        supabase.table("chunks").insert(batch).execute()
        
async def update_job_progress(job_id: str, status: str, progress_data: dict = None, error: str = None):
    """Updates the async ingestion job tracking row."""
    if not supabase: return
    
    update_payload = {"status": status}
    if progress_data: update_payload["progress"] = progress_data
    if error: update_payload["error_message"] = error
    if status in ['completed', 'failed']: update_payload["completed_at"] = 'now()'
    
    supabase.table("ingestion_jobs").update(update_payload).eq("id", job_id).execute()
