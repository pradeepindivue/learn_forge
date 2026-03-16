'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

export default function CourseEditPage() {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const jobId = searchParams.get('job')
  const router = useRouter()

  const [course, setCourse] = useState<any>(null)
  const [chapters, setChapters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [jobStatus, setJobStatus] = useState<string | null>(jobId ? 'pending' : null)
  
  // Drag and drop state
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)

  useEffect(() => {
    // Scaffold: Fetch course details
    setTimeout(() => {
      setCourse({ id, title: 'Draft Course', description: 'Generated from sources', status: 'draft' })
      setChapters([
        { id: '1', title: 'Introduction', order_index: 0 },
        { id: '2', title: 'Core Concepts', order_index: 1 },
      ])
      setLoading(false)
      if (jobId) setJobStatus('completed') // Mocking async job completion
    }, 1500)
  }, [id, jobId])

  const handleFinalize = async () => {
    router.push(`/courses/${id}`)
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    if (draggedIdx === null || draggedIdx === index) return
    const newChapters = [...chapters]
    const draggedItem = newChapters[draggedIdx]
    newChapters.splice(draggedIdx, 1)
    newChapters.splice(index, 0, draggedItem)
    setDraggedIdx(index)
    setChapters(newChapters)
  }

  const handleDragEnd = () => {
    setDraggedIdx(null)
  }

  if (loading) return <div className="p-8 text-center text-neutral-500">Loading course details...</div>

  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">{course?.title}</h1>
          <p className="text-neutral-400">{course?.description}</p>
        </div>
        <button 
          onClick={handleFinalize}
          className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2 rounded-lg transition-colors"
        >
          Finalize Course
        </button>
      </div>

      {jobStatus && jobStatus !== 'completed' && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-8 animate-pulse">
          <p className="font-medium">Ingestion in progress...</p>
          <p className="text-sm opacity-80 mt-1">We are extracting transcripts and generating your course structure.</p>
        </div>
      )}

      <div className="bg-white border rounded-xl shadow-sm p-6 text-neutral-900">
        <h2 className="text-xl font-bold mb-4 text-neutral-900">Course Chapters</h2>
        <p className="text-sm text-neutral-500 mb-6">Drag and drop to reorder chapters before finalizing.</p>

        <div className="space-y-3 text-neutral-900">
          {chapters.map((chapter, index) => (
            <div 
              key={chapter.id} 
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`flex items-center gap-4 p-4 border rounded-lg bg-neutral-50 hover:bg-neutral-100 cursor-move transition-opacity ${draggedIdx === index ? 'opacity-50' : 'opacity-100'}`}
            >
              <span className="text-neutral-400">☰</span>
              <div className="font-medium">{chapter.title}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
