import re
from typing import List

# Simple approximation: 1 token is roughly 4 characters in English
CHARS_PER_TOKEN = 4
MAX_TOKENS = 512
OVERLAP_TOKENS = 64

def chunk_text(text: str, source_type: str, chunk_size: int = MAX_TOKENS, chunk_overlap: int = OVERLAP_TOKENS) -> List[dict]:
    """
    Slices text into chunks of roughly `chunk_size` tokens with `chunk_overlap`.
    Returns a list of dictionaries containing chunk data.
    """
    # Clean up excess whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    char_size = chunk_size * CHARS_PER_TOKEN
    char_overlap = chunk_overlap * CHARS_PER_TOKEN
    
    chunks = []
    start = 0
    text_length = len(text)
    index = 0
    
    while start < text_length:
        end = min(start + char_size, text_length)
        
        # If we're not at the end of the text, try to find a natural break (space or punctuation)
        if end < text_length:
            # Look backwards from 'end' to find a space or period to avoid cutting words
            last_space = text.rfind(' ', start, end)
            last_period = text.rfind('. ', start, end)
            
            # Prefer breaking at sentences, then words
            if last_period != -1 and last_period > start + (char_size // 2):
                end = last_period + 1
            elif last_space != -1:
                end = last_space
        
        chunk_content = text[start:end].strip()
        
        if chunk_content: # Don't add empty chunks
            chunks.append({
                "content": chunk_content,
                "token_count": len(chunk_content) // CHARS_PER_TOKEN,
                "chunk_index": index,
                "source_type": source_type
            })
            index += 1
            
        start = end - char_overlap
        # Ensure we always move forward to prevent infinite loops (if overlap is >= size)
        if start <= end - char_size: 
            start = end
            
    return chunks
