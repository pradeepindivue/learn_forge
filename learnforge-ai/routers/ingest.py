from fastapi import APIRouter, BackgroundTasks
from api_schema import IngestRequest, IngestResponse
import uuid
import asyncio
from services.youtube import fetch_transcript
from services.scraper import scrape_article
from services.chunker import chunk_text
from services.embedder import get_embeddings_with_backoff
from services.vector_store import store_source_document, store_chunks, update_job_progress

router = APIRouter()

async def process_ingestion_job(job_id: str, request: IngestRequest):
    try:
        await update_job_progress(job_id, "processing", {"step": "Starting extraction"})
        
        all_chunks_data = []
        for i, source in enumerate(request.sources):
            # 1. Extraction
            raw_content = ""
            if source.type == "youtube":
                raw_content = fetch_transcript(source.url)
            elif source.type == "article":
                raw_content = scrape_article(source.url)
            elif source.type == "text":
                raw_content = source.content
                
            # 2. Store original doc
            doc_id = await store_source_document(request.course_id, source.type, source.url or "raw_text", raw_content, source.title or "")
            
            # 3. Chunking
            chunks = chunk_text(raw_content, source.type)
            
            # 4. Preparation for Embedding
            texts_to_embed = [c["content"] for c in chunks]
            
            # 5. Embedding (with backoff)
            embeddings = await get_embeddings_with_backoff(texts_to_embed)
            
            # Attach embeddings back to chunk dicts
            for j, chunk in enumerate(chunks):
                chunk["embedding"] = embeddings[j]
                chunk["source_url"] = source.url or ""
                all_chunks_data.append(chunk)
                
            # 6. Store to pgvector
            await store_chunks(request.course_id, doc_id, chunks)
            
            await update_job_progress(job_id, "processing", {"step": f"Processed source {i+1}/{len(request.sources)}"})
            
        # Finish
        await update_job_progress(job_id, "completed", {"message": f"Successfully processed {len(all_chunks_data)} chunks"})
        
    except Exception as e:
        await update_job_progress(job_id, "failed", error=str(e))


@router.post("/", response_model=IngestResponse)
async def start_ingestion(request: IngestRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    # Fire and forget the background task
    background_tasks.add_task(process_ingestion_job, job_id, request)
    return IngestResponse(job_id=job_id, status="pending")
