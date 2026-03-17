'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

export default function ChapterLearningPage() {
  const { id, chId } = useParams()
  const [data, setData] = useState<any>(null)
  const [chatMessage, setChatMessage] = useState('')
  const [chatHistory, setChatHistory] = useState<any[]>([])

  const supabase = createClient()

  useEffect(() => {
    async function fetchChapter() {
      const { data: chapter, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('id', chId)
        .single()
      
      if (error) {
        console.error('Error fetching chapter:', error)
        return
      }

      if (chapter) {
        setData({
          title: chapter.title,
          summary: chapter.summary,
          key_concepts: chapter.key_concepts || [
            'Understand the core principles presented in this chapter.',
            'Apply the concepts to practical examples.',
            'Identify key takeaways and their implications.'
          ]
        })
      }
    }

    if (chId) {
      fetchChapter()
    }
  }, [chId, supabase])

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatMessage.trim()) return
    
    const userMsg = { role: 'user', content: chatMessage, id: Date.now() }
    setChatHistory([...chatHistory, userMsg])
    setChatMessage('')
    
    // Real Deep Dive RAG API
    try {
      const response = await fetch('http://localhost:8002/generate/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter_id: chId, question: userMsg.content })
      })
      const data = await response.json()
      if (data.answer) {
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: data.answer, 
          id: Date.now() 
        }])
      }
    } catch (err) {
      console.error('Chat error:', err)
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I'm having trouble connecting to the knowledge base right now.", 
        id: Date.now() 
      }])
    }
  }

  if (!data) return <div className="p-8 text-center text-neutral-500">Generating chapter content...</div>

  return (
    <div className="w-full max-w-5xl mx-auto py-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Learning Material */}
      <div className="lg:col-span-2 space-y-8">
        <div>
          <Link href={`/courses/${id}`} className="text-sm text-neutral-500 hover:text-blue-600 mb-4 inline-block">
            ← Back to Course Outline
          </Link>
          <h1 className="text-3xl font-bold mt-2">{data.title}</h1>
        </div>

        <section className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4">Summary</h2>
          <p className="text-neutral-700 leading-relaxed">{data.summary}</p>
        </section>

        <section className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4">Key Concepts</h2>
          <ul className="list-disc pl-5 space-y-2 text-neutral-700">
            {data.key_concepts.map((concept: string, i: number) => (
              <li key={i}>{concept}</li>
            ))}
          </ul>
        </section>
        
        <div className="flex gap-4 pt-4 border-t">
          <Link href={`/courses/${id}/chapters/${chId}/quiz`} className="flex-1 text-center bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold py-3 rounded-lg transition-colors">
            Take Chapter Quiz
          </Link>
          <Link href={`/courses/${id}/chapters/${chId}/flashcards`} className="flex-1 text-center bg-purple-100 hover:bg-purple-200 text-purple-800 font-semibold py-3 rounded-lg transition-colors">
            Study Flashcards
          </Link>
        </div>
        
        <div className="pt-4 flex justify-between">
          <button className="text-neutral-500 hover:text-neutral-900 border px-4 py-2 rounded">Previous Chapter</button>
          <button className="bg-green-600 hover:bg-green-700 text-white font-medium px-8 py-2 rounded">Mark as Complete</button>
        </div>
      </div>

      {/* Right Column: Deep Dive Chatbot */}
      <div className="bg-white border text-sm rounded-xl flex flex-col h-[600px] shadow-sm overflow-hidden sticky top-24">
        <div className="bg-neutral-50 border-b p-4 font-bold text-neutral-800 flex gap-2 items-center">
          <span className="text-blue-600">✨</span> Deep Dive QA
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
          <div className="bg-neutral-100 text-neutral-700 rounded-lg p-3 self-start max-w-[85%]">
            Ask me anything about this chapter! I'll only use the source material to answer.
          </div>
          
          {chatHistory.map((msg) => (
            <div key={msg.id} className={`rounded-lg p-3 max-w-[85%] ${msg.role === 'user' ? 'bg-blue-600 text-white self-end' : 'bg-neutral-100 text-neutral-700 self-start'}`}>
              {msg.content}
            </div>
          ))}
        </div>
        
        <form onSubmit={handleChatSubmit} className="border-t p-3 flex gap-2 bg-neutral-50">
          <input
            type="text"
            className="flex-1 border rounded-md px-3 py-2"
            placeholder="Ask a question..."
            value={chatMessage}
            onChange={e => setChatMessage(e.target.value)}
          />
          <button type="submit" disabled={!chatMessage.trim()} className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50">
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
