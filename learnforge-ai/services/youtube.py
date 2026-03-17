from youtube_transcript_api import YouTubeTranscriptApi
from urllib.parse import urlparse, parse_qs

def extract_video_id(url: str) -> str:
    """Extracts the YouTube video ID from a given URL."""
    query = urlparse(url)
    if query.hostname == 'youtu.be':
        return query.path[1:]
    if query.hostname in ('www.youtube.com', 'youtube.com'):
        if query.path == '/watch':
            p = parse_qs(query.query)
            return p.get('v', [None])[0]
        if query.path[:7] == '/embed/':
            return query.path.split('/')[2]
        if query.path[:3] == '/v/':
            return query.path.split('/')[2]
    return None

import asyncio
from concurrent.futures import ThreadPoolExecutor

from requests import Session

import subprocess
import sys
import json

async def fetch_transcript(url: str) -> str:
    """Fetches the transcript by running a subprocess, as the library tends to hang in this environment."""
    video_id = extract_video_id(url)
    if not video_id:
        raise ValueError(f"Invalid YouTube URL: {url}")
        
    # We'll run a small script in a subprocess with a strict timeout
    script = f"""
from youtube_transcript_api import YouTubeTranscriptApi
import json
import sys
try:
    api = YouTubeTranscriptApi()
    transcript = api.fetch('{video_id}')
    full_text = " ".join([t['text'] for t in transcript])
    print(full_text)
except Exception as e:
    print(f"ERROR:{{e}}", file=sys.stderr)
    sys.exit(1)
"""
    try:
        # Use the same python executable as the current environment
        process = await asyncio.create_subprocess_exec(
            sys.executable, "-c", script,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=45.0)
            if process.returncode == 0:
                return stdout.decode().strip()
            else:
                error_msg = stderr.decode().strip()
                raise Exception(f"YouTube subprocess failed: {error_msg}")
        except asyncio.TimeoutError:
            process.kill()
            raise Exception(f"YouTube transcript fetch timed out after 45s for video {video_id}")
            
    except Exception as e:
        print(f"DEBUG: YouTube Fetch Error: {e}")
        raise Exception(f"Failed to fetch transcript: {str(e)}")
