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

def fetch_transcript(url: str) -> str:
    """Fetches the transcript for a YouTube video and returns it as a single string."""
    video_id = extract_video_id(url)
    if not video_id:
        raise ValueError(f"Invalid YouTube URL: {url}")
        
    try:
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        # Combine text from all transcript chunks
        full_text = " ".join([t['text'] for t in transcript_list])
        return full_text
    except Exception as e:
        raise Exception(f"Failed to fetch transcript: {str(e)}")
