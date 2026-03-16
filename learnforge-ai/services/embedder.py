import os
import voyageai
import time
import asyncio
from typing import List

# Initialize the Voyage client using the environment variable VOYAGE_API_KEY
client = voyageai.AsyncClient(api_key=os.environ.get("VOYAGE_API_KEY"))
MODEL_NAME = "voyage-large-2"

async def get_embeddings_with_backoff(texts: List[str], max_retries: int = 3) -> List[List[float]]:
    """
    Fetches embeddings from Voyage AI for a list of text strings, 
    implementing exponential backoff on failure matching the architecture spec.
    """
    for attempt in range(max_retries):
        try:
            # Voyage AI handles batching internally, but passing up to 128 texts is optimal
            response = await client.embed(
                texts,
                model=MODEL_NAME
            )
            return response.embeddings
        except Exception as e:
            if attempt == max_retries - 1:
                raise Exception(f"Failed to fetch embeddings after {max_retries} attempts: {str(e)}")
            
            # Exponential backoff: 2^attempt * 1 second (1s, 2s, 4s...)
            sleep_time = (2 ** attempt)
            print(f"Embedding failed. Retrying in {sleep_time} seconds... (Attempt {attempt+1}/{max_retries})")
            await asyncio.sleep(sleep_time)
            
    return []
