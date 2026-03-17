import os
import httpx
import asyncio
from typing import List

# Voyage AI REST API configuration
VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings"
VOYAGE_API_KEY = os.environ.get("VOYAGE_API_KEY")
MODEL_NAME = "voyage-2"

async def _fetch_batch(client: httpx.AsyncClient, batch_texts: List[str], max_retries: int = 3) -> List[List[float]]:
    """Helper to fetch a single batch of embeddings with retries."""
    if not VOYAGE_API_KEY:
        raise ValueError("Missing VOYAGE_API_KEY environment variable.")

    for attempt in range(max_retries):
        try:
            response = await client.post(
                VOYAGE_API_URL,
                headers={
                    "Authorization": f"Bearer {VOYAGE_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "input": batch_texts,
                    "model": MODEL_NAME
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return [item["embedding"] for item in data["data"]]
            elif response.status_code == 429:
                # Force a significant sleep on 429
                sleep_time = (5 ** (attempt + 1)) 
                print(f"Voyage Rate limit hit (429) on batch. Retrying in {sleep_time}s...")
            else:
                print(f"Voyage API error: {response.status_code} - {response.text}")
                sleep_time = (2 ** attempt)
                
            response.raise_for_status()
            
        except Exception as e:
            if attempt == max_retries - 1:
                raise Exception(f"Failed to fetch batch after {max_retries} attempts: {str(e)}")
            
            await asyncio.sleep(sleep_time)
    return []

async def get_embeddings_with_backoff(texts: List[str], max_retries: int = 5) -> List[List[float]]:
    """
    Fetches embeddings from Voyage AI, handling batching and rate limits.
    """
    if not VOYAGE_API_KEY:
        raise ValueError("Missing VOYAGE_API_KEY environment variable.")
        
    if not texts:
        return []

    # Reduced batch size for better rate limit compliance
    BATCH_SIZE = 50 
    all_embeddings = []

    async with httpx.AsyncClient(timeout=60.0) as client:
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i:i + BATCH_SIZE]
            batch_embeddings = await _fetch_batch(client, batch, max_retries)
            all_embeddings.extend(batch_embeddings)
            
            # Sublte delay between batches
            if i + BATCH_SIZE < len(texts):
                await asyncio.sleep(1.0)
                
    return all_embeddings
