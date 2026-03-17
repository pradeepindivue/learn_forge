import httpx
from bs4 import BeautifulSoup
import re

async def scrape_article(url: str) -> str:
    """Fetches the main text content of an article URL."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(url, headers=headers)
            res.raise_for_status()
            
            soup = BeautifulSoup(res.text, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style", "header", "footer", "nav", "aside"]):
                script.extract()
                
            # Get text
            text = soup.get_text(separator=' ')
            
            # Clean up whitespace
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = '\n'.join(chunk for chunk in chunks if chunk)
            
            return text

    except Exception as e:
        raise Exception(f"Failed to scrape article {url}: {str(e)}")
