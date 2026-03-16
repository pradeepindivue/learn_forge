from fastapi import APIRouter
from api_schema import DeepDiveRequest, DeepDiveResponse, SourceCitation
import uuid
import os
from anthropic import AsyncAnthropic
from services.vector_store import supabase
from services.embedder import get_embeddings_with_backoff

router = APIRouter()
anthropic_client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

async def perform_similarity_search(query_embedding: list, chapter_id: str, limit: int = 5):
    """Hits the Supabase pgvector RPC function to find similar chunks."""
    if not supabase: return []
    try:
        # Assuming an RPC function 'match_chunks' exists in Supabase
        res = supabase.rpc(
            'match_chunks',
            {'query_embedding': query_embedding, 'match_threshold': 0.7, 'match_count': limit, 'filter_chapter_id': chapter_id}
        ).execute()
        return res.data
    except Exception as e:
        print(f"Similarity search failed: {e}")
        return []

@router.post("/query", response_model=DeepDiveResponse)
async def rag_query(request: DeepDiveRequest, chapter_id: str):
    # 1. Embed the query
    try:
        embeddings = await get_embeddings_with_backoff([request.question])
        query_vector = embeddings[0]
    except Exception:
        query_vector = []

    # 2. Search vector DB for top 5 chunks
    chunks = await perform_similarity_search(query_vector, chapter_id)
    
    # 3. Construct context
    context_text = ""
    sources = []
    for chunk in chunks:
        context_text += f"\n[Doc: {chunk.get('source_title', 'Unknown')}]\n{chunk.get('content', '')}\n"
        sources.append(SourceCitation(
            chunk_id=chunk.get('id', str(uuid.uuid4())),
            excerpt=chunk.get('content', '')[:100] + "...",
            source_title=chunk.get('source_title', 'Unknown'),
            timestamp=chunk.get('timestamp_start')
        ))
        
    if not context_text:
        context_text = "No relevant context found in the course material."

    # 4. Generate answer with Claude
    system_prompt = "You are a helpful AI tutor for the LearnForge platform. Answer the user's question using ONLY the provided course material text. If the answer is not in the material, say so."
    
    messages = []
    for msg in request.history[-5:]: # Keep last 5 messages for context
        messages.append({"role": msg.role, "content": msg.content})
        
    messages.append({
        "role": "user",
        "content": f"Context:\n{context_text}\n\nQuestion: {request.question}"
    })
    
    try:
        response = await anthropic_client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1000,
            system=system_prompt,
            messages=messages
        )
        answer = response.content[0].text
    except Exception as e:
        answer = "I'm sorry, I encountered an error generating an answer."
        
    return DeepDiveResponse(
        answer=answer,
        sources=sources,
        rating_id=str(uuid.uuid4())
    )
