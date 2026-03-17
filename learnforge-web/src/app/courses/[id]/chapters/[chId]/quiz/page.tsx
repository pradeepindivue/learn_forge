'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Question = {
  id: string
  text: string
  type: 'mcq' | 'short_answer'
  options?: string[]
}

export default function QuizPage() {
  const { id, chId } = useParams()
  const router = useRouter()
  
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)

  useEffect(() => {
    async function fetchQuiz() {
      try {
        const response = await fetch('http://localhost:8002/generate/quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chapter_id: chId })
        })
        const data = await response.json()
        if (data.questions) {
          setQuestions(data.questions.map((q: any, i: number) => ({
            id: String(i),
            text: q.text,
            type: q.type || 'mcq',
            options: q.options
          })))
        }
      } catch (err) {
        console.error('Failed to fetch quiz:', err)
      }
    }

    if (chId) {
      fetchQuiz()
    }
  }, [chId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Scaffold scoring logic
    setScore(5) // Mock score out of 7
    setSubmitted(true)
  }

  if (questions.length === 0) return <div className="p-8 text-center text-neutral-500">Loading your quiz... it might be generating.</div>

  if (submitted) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 text-center animate-in fade-in zoom-in">
        <h1 className="text-4xl font-bold mb-4">Quiz Complete!</h1>
        <div className="text-6xl font-black text-blue-600 mb-6">{score} / 7</div>
        <p className="text-neutral-600 mb-8">Great job testing your knowledge. View your detailed results below or continue learning.</p>
        
        <div className="flex justify-center gap-4">
          <button onClick={() => setSubmitted(false)} className="px-6 py-2 border rounded-lg hover:bg-neutral-50 font-medium">
            Review Answers
          </button>
          <Link href={`/courses/${id}/chapters/${chId}`} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
            Back to Chapter
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-8">
      <Link href={`/courses/${id}/chapters/${chId}`} className="text-sm text-neutral-500 hover:text-blue-600 mb-6 inline-block">
        ← Back to Chapter
      </Link>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Chapter Quiz</h1>
        <p className="text-neutral-600">Answer the following questions to test your understanding. Take your time.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white border rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">
              <span className="text-neutral-400 mr-2">{idx + 1}.</span> 
              {q.text}
            </h3>
            
            {q.type === 'mcq' && q.options && (
              <div className="space-y-3">
                {q.options.map((opt, i) => (
                  <label key={i} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                    <input 
                      type="radio" 
                      name={q.id} 
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                      required
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-neutral-800">{opt}</span>
                  </label>
                ))}
              </div>
            )}
            
            {q.type === 'short_answer' && (
              <div>
                <textarea 
                  className="w-full border rounded-lg p-3 min-h-[100px]"
                  placeholder="Type your answer here..."
                  required
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                />
                <p className="text-xs text-neutral-500 mt-2">Your answer will be evaluated by AI for key concepts.</p>
              </div>
            )}
          </div>
        ))}
        
        <div className="flex justify-end pt-4">
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 rounded-lg transition-colors shadow-sm">
            Submit Quiz
          </button>
        </div>
      </form>
    </div>
  )
}
