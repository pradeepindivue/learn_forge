'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewCoursePage() {
  const router = useRouter()
  const [sources, setSources] = useState([{ type: 'youtube', value: '' }])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addSource = (type: string) => {
    setSources([...sources, { type, value: '' }])
  }

  const updateSource = (index: number, value: string) => {
    const newSources = [...sources]
    newSources[index].value = value
    setSources(newSources)
  }

  const removeSource = (index: number) => {
    const newSources = [...sources]
    newSources.splice(index, 1)
    setSources(newSources)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    
    // Filter out empty sources
    const validSources = sources.filter(s => s.value.trim().length > 0)
    
    if (validSources.length === 0) {
      setError('Please add at least one valid source.')
      setIsSubmitting(false)
      return
    }

    try {
      const courseRes = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Draft Course' })
      })
      
      if (!courseRes.ok) {
        const errData = await courseRes.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to create course draft (${courseRes.status})`);
      }
      
      const { course } = await courseRes.json()
      
      // 2. Start ingestion job
      const ingestRes = await fetch('/api/ingestion/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: course.id,
          sources: validSources.map(s => ({
            type: s.type,
            [s.type === 'text' ? 'content' : 'url']: s.value
          }))
        })
      })
      
      if (!ingestRes.ok) {
        const errData = await ingestRes.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to start ingestion (${ingestRes.status})`);
      }
      
      const { job_id } = await ingestRes.json()
      
      // 3. Redirect to editing page
      router.push(`/courses/${course.id}/edit?job=${job_id}`)
      
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'An error occurred during submission.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-8 text-neutral-900">
      <h1 className="text-3xl font-bold mb-2">Create a New Course</h1>
      <p className="text-neutral-600 mb-8">Add links to YouTube videos, articles, or paste your own notes.</p>
      
      <form onSubmit={handleSubmit} className="bg-white border rounded-xl shadow-sm p-6">
        <div className="space-y-4 mb-8">
          {sources.map((source, idx) => (
            <div key={idx} className="flex gap-3 items-start">
              <div className="w-32 shrink-0 pt-2">
                <span className="text-sm font-semibold text-neutral-700 capitalize">
                  {source.type} Source
                </span>
              </div>
              <div className="flex-1">
                {source.type === 'text' ? (
                  <textarea 
                    className="w-full border rounded-lg p-3 min-h-[120px] text-sm"
                    placeholder="Paste your raw notes here..."
                    value={source.value}
                    onChange={e => updateSource(idx, e.target.value)}
                    required
                  />
                ) : (
                  <input 
                    type="url"
                    className="w-full border rounded-lg p-3 text-sm"
                    placeholder={source.type === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://example.com/article'}
                    value={source.value}
                    onChange={e => updateSource(idx, e.target.value)}
                    required
                  />
                )}
              </div>
              {sources.length > 1 && (
                <button 
                  type="button" 
                  onClick={() => removeSource(idx)}
                  className="text-neutral-400 hover:text-red-500 pt-3 px-2"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        
        <div className="flex gap-3 mb-8 border-b pb-8">
          <button type="button" onClick={() => addSource('youtube')} className="text-sm bg-neutral-100 font-medium px-4 py-2 rounded text-neutral-700 hover:bg-neutral-200">
            + YouTube URL
          </button>
          <button type="button" onClick={() => addSource('article')} className="text-sm bg-neutral-100 font-medium px-4 py-2 rounded text-neutral-700 hover:bg-neutral-200">
            + Article URL
          </button>
          <button type="button" onClick={() => addSource('text')} className="text-sm bg-neutral-100 font-medium px-4 py-2 rounded text-neutral-700 hover:bg-neutral-200">
            + Raw Notes
          </button>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        <div className="flex justify-end">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className={`bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? 'Starting Ingestion...' : 'Import Content & Generate Course'}
          </button>
        </div>
      </form>
    </div>
  )
}
