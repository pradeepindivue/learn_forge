from fastapi import APIRouter, BackgroundTasks
from api_schema import IngestRequest, IngestResponse
import uuid
import asyncio
from services.youtube import fetch_transcript
from services.scraper import scrape_article
from services.chunker import chunk_text
from services.embedder import get_embeddings_with_backoff
from services.vector_store import store_source_document, store_chunks, update_job_progress
import traceback

router = APIRouter()

async def process_ingestion_job(job_id: str, request: IngestRequest):
    print(f"DEBUG: Starting ingestion job {job_id} for course {request.course_id}")
    try:
        await update_job_progress(job_id, "processing", {"step": "Starting extraction"})
        print(f"DEBUG: Updated job status to processing for {job_id}")
        
        all_chunks_data = []
        for i, source in enumerate(request.sources):
            try:
                # 1. Extraction
                raw_content = ""
                if source.type == "youtube":
                    print(f"DEBUG: Fetching transcript for {source.url}")
                    raw_content = await fetch_transcript(source.url)
                elif source.type == "article":
                    print(f"DEBUG: Scraping article {source.url}")
                    raw_content = await scrape_article(source.url)
                elif source.type == "text":
                    print(f"DEBUG: Processing raw text")
                    raw_content = source.content
                
                print(f"DEBUG: Extraction complete. Content length: {len(raw_content)}")
                    
                # 2. Store original doc
                doc_id = await store_source_document(request.course_id, source.type, source.url or "raw_text", raw_content, source.title or "")
                
                # 3. Chunking
                chunks = chunk_text(raw_content, source.type)
                
                # 4. Preparation for Embedding
                texts_to_embed = [c["content"] for c in chunks]
                
                # 5. Embedding (with backoff)
                print(f"DEBUG: Generating embeddings for {len(texts_to_embed)} chunks")
                embeddings = await get_embeddings_with_backoff(texts_to_embed)
                print(f"DEBUG: Embedding complete")
                
                # Attach embeddings back to chunk dicts
                for j, chunk in enumerate(chunks):
                    chunk["embedding"] = embeddings[j]
                    chunk["source_url"] = source.url or ""
                    all_chunks_data.append(chunk)
                    
                await store_chunks(request.course_id, doc_id, chunks)
                
                await update_job_progress(job_id, "processing", {"step": f"Processed source {i+1}/{len(request.sources)}"})
            except Exception as e:
                print(f"DEBUG: Source {i+1} failed: {e}")
                await update_job_progress(job_id, "processing", {"step": f"Warning: source {i+1} failed ({str(e)})"})
                continue
            
        # 7. Generate Curriculum
        from services.generator import generate_course_curriculum
        print(f"DEBUG: Starting curriculum generation for course {request.course_id}")
        await update_job_progress(job_id, "processing", {"step": "Building curriculum..."})
        await generate_course_curriculum(request.course_id)
        print(f"DEBUG: Curriculum generation complete")
        
        # Finish
        await update_job_progress(job_id, "completed", {"message": f"Successfully processed {len(all_chunks_data)} chunks and generated chapters"})
        print(f"DEBUG: Ingestion job {job_id} COMPLETED successfully")
        
    except Exception as e:
        print(f"INGESTION ERROR for job {job_id}:")
        traceback.print_exc()
        try:
           await update_job_progress(job_id, "failed", error=str(e))
        except:
           pass


@router.post("/", response_model=IngestResponse)
async def start_ingestion(request: IngestRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    # Fire and forget the background task
    background_tasks.add_task(process_ingestion_job, job_id, request)
    return IngestResponse(job_id=job_id, status="pending")
