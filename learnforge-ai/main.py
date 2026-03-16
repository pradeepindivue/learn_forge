from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables before importing routers
load_dotenv()

from routers import ingest, generate, rag

app = FastAPI(
    title="LearnForge AI Service",
    description="Backend service for AI-intensive operations in LearnForge.",
    version="1.0.0"
)

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://learnforge.app"],  # Add production URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ingest.router, prefix="/ingest", tags=["Ingestion"])
app.include_router(generate.router, prefix="/generate", tags=["Generation"])
app.include_router(rag.router, prefix="/rag", tags=["RAG"])

@app.get("/health")
def health_check():
    return {"status": "ok"}
