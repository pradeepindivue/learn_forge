'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function CourseEditPage() {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const jobId = searchParams.get('job')
  const router = useRouter()
  const supabase = createClient()

  const [course, setCourse] = useState<any>(null)
  const [chapters, setChapters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  
  // Drag and drop state
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)

  useEffect(() => {
    async function loadData() {
      // 1. Fetch Course
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single()
      
      if (courseData) setCourse(courseData)

      // 2. Fetch Chapters
      const { data: chaptersData } = await supabase
        .from('chapters')
        .select('*')
        .eq('course_id', id)
        .order('order_index', { ascending: true })
      
      if (chaptersData) setChapters(chaptersData)

      // 3. Monitor Job Status if jobId exists
      if (jobId) {
        const { data: jobData } = await supabase
          .from('ingestion_jobs')
          .select('status')
          .eq('id', jobId)
          .single()
        
        if (jobData) {
          setJobStatus(jobData.status)
          // If still pending or processing, poll every 3 seconds
          if (jobData.status !== 'completed' && jobData.status !== 'failed') {
             setTimeout(loadData, 5000)
             setLoading(false)
             return
          }
        }
      }
      
      setLoading(false)
    }

    loadData()
  }, [id, jobId, supabase])

  const handleFinalize = async () => {
    // 1. Save chapter order
    if (chapters.length > 0) {
      const updates = chapters.map((ch, idx) => ({
        id: ch.id,
        course_id: id,
        title: ch.title,
        order_index: idx
      }))
      await supabase.from('chapters').upsert(updates)
    }

    // 2. Set course to active
    await supabase.from('courses').update({ status: 'active' }).eq('id', id)
    
    // 3. Redirect to final course page
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
          <h1 className="text-3xl font-bold mb-2 text-neutral-900">{course?.title || 'Draft Course'}</h1>
          <p className="text-neutral-500">{course?.description || 'AI is generating your course description...'}</p>
        </div>
        <button 
          onClick={handleFinalize}
          disabled={jobStatus === 'pending' || jobStatus === 'processing'}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-2 rounded-lg transition-colors"
        >
          Finalize Course
        </button>
      </div>

      {jobStatus && jobStatus !== 'completed' && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-8 animate-pulse">
          <p className="font-medium text-lg">AI Ingestion in Progress...</p>
          <p className="text-sm opacity-80 mt-1">We are extracting video transcripts, chunking text, and generating your chapter structure in the background. This page will automatically update when new chapters arrive.</p>
        </div>
      )}
      
      {jobStatus === 'failed' && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-8">
          <p className="font-medium">Ingestion Failed</p>
          <p className="text-sm mt-1">There was an error processing your sources. Please try creating a new course.</p>
        </div>
      )}

      <div className="bg-white border rounded-xl shadow-sm p-6 text-neutral-900">
        <h2 className="text-xl font-bold mb-4 text-neutral-900">Course Chapters</h2>
        
        {chapters.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 border border-dashed rounded-lg bg-neutral-50">
            Scanning sources and building curriculum...
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}
