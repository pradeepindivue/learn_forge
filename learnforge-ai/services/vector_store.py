import os
import httpx
import json
from typing import List, Dict, Any

# Must use the service role key to bypass RLS for ingestion background jobs
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Missing Supabase credentials in backend .env")

# Note: We are using raw httpx calls because the supabase-py client 
# was experiencing intermittent hangs in this environment.
# This ensures more reliable async execution without blocking the event loop.

async def store_source_document(course_id: str, source_type: str, url: str, raw_content: str, title: str = "") -> str:
    print(f"DEBUG: Storing source doc for course {course_id} via httpx")
    endpoint = f"{supabase_url}/rest/v1/source_documents"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation" # To get the ID back
    }
    data = {
        "course_id": course_id,
        "source_type": source_type,
        "url": url,
        "title": title,
        "raw_content": raw_content,
        "chunk_count": 0
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.post(endpoint, json=data, headers=headers)
        res.raise_for_status()
        doc_id = res.json()[0]["id"]
        print(f"DEBUG: Stored source doc {doc_id}")
        return doc_id

async def store_chunks(course_id: str, source_doc_id: str, chunks_data: List[Dict[str, Any]]):
    print(f"DEBUG: Storing {len(chunks_data)} chunks for doc {source_doc_id} via httpx")
    endpoint = f"{supabase_url}/rest/v1/chunks"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
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
    async with httpx.AsyncClient() as client:
        upd_endpoint = f"{supabase_url}/rest/v1/source_documents?id=eq.{source_doc_id}"
        await client.patch(upd_endpoint, json={"chunk_count": len(chunks_data)}, headers=headers)
        
        # Insert chunks in batches
        batch_size = 50
        for i in range(0, len(insert_data), batch_size):
            batch = insert_data[i:i + batch_size]
            print(f"DEBUG: Inserting chunk batch {i//batch_size + 1}")
            res = await client.post(endpoint, json=batch, headers=headers)
            res.raise_for_status()
            
    print(f"DEBUG: Finished storing all chunks")

async def update_job_progress(job_id: str, status: str, progress_data: dict = None, error: str = None):
    print(f"DEBUG: Updating job {job_id} to status {status} via httpx")
    endpoint = f"{supabase_url}/rest/v1/ingestion_jobs?id=eq.{job_id}"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
    update_payload = {"status": status}
    if progress_data: update_payload["progress"] = progress_data
    if error: update_payload["error_message"] = error
    if status in ['completed', 'failed']: update_payload.update({"completed_at": "now()"})
    
    async with httpx.AsyncClient() as client:
        res = await client.patch(endpoint, json=update_payload, headers=headers)
        if res.status_code >= 400:
             print(f"DEBUG: Job update FAILED: {res.status_code} - {res.text}")
        else:
             print(f"DEBUG: Job update for {job_id} SUCCESS")

# Keep the legacy supabase client for generate router if needed
from supabase import create_client, Client
supabase: Client = create_client(supabase_url, supabase_key)
