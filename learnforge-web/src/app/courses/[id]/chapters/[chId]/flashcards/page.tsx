'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Flashcard = {
  id: string
  front: string
  back: string
  status: 'unseen' | 'review' | 'known'
}

export default function FlashcardsPage() {
  const { id, chId } = useParams()
  
  const [cards, setCards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)

  useEffect(() => {
    // Scaffold: Fetch Flashcards Data
    setTimeout(() => {
      setCards([
        { id: '1', front: 'What is the primary constraint mentioned?', back: 'Rate limiting on the API calls.', status: 'unseen' },
        { id: '2', front: 'Define the core concept.', back: 'It is a mechanism for embedding text into vector space.', status: 'unseen' }
      ])
    }, 1000)
  }, [chId])

  const activeCard = cards[currentIndex]

  const handleNext = (statusUpdate: 'review' | 'known') => {
    // Scaffold: Update status in DB
    setIsFlipped(false)
    setTimeout(() => {
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(prev => prev + 1)
      } else {
        // Done with deck
        alert('Deck finished!')
        setCurrentIndex(0)
      }
    }, 150)
  }

  if (cards.length === 0) return <div className="p-8 text-center text-neutral-500">Loading flashcards...</div>

  return (
    <div className="w-full max-w-3xl mx-auto py-8 flex flex-col items-center">
      <div className="w-full flex justify-between items-center mb-8">
        <Link href={`/courses/${id}/chapters/${chId}`} className="text-sm text-neutral-500 hover:text-blue-600">
          ← Back to Chapter
        </Link>
        <div className="text-sm font-medium text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full">
          {currentIndex + 1} / {cards.length}
        </div>
      </div>

      <div 
        className="w-full aspect-[3/2] max-w-2xl perspective-1000 cursor-pointer group"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          {/* Front (Question) */}
          <div className="absolute inset-0 backface-hidden bg-white border-2 border-neutral-200 rounded-2xl shadow-sm flex flex-col justify-center items-center p-12 text-center hover:border-blue-300 transition-colors">
            <span className="absolute top-6 left-6 text-sm font-bold text-neutral-400 uppercase tracking-widest">Question</span>
            <h2 className="text-2xl md:text-3xl font-medium text-neutral-800 leading-snug">
              {activeCard.front}
            </h2>
            <p className="absolute bottom-6 text-sm text-neutral-400 opacity-60 group-hover:opacity-100 transition-opacity">Click to flip</p>
          </div>

          {/* Back (Answer) */}
          <div className="absolute inset-0 backface-hidden bg-blue-50 border-2 border-blue-200 rounded-2xl shadow-sm flex flex-col justify-center items-center p-12 text-center rotate-y-180">
            <span className="absolute top-6 left-6 text-sm font-bold text-blue-400 uppercase tracking-widest">Answer</span>
            <p className="text-2xl md:text-3xl font-medium text-neutral-800 leading-snug">
              {activeCard.back}
            </p>
          </div>
          
        </div>
      </div>

      {isFlipped && (
        <div className="flex gap-4 mt-12 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <button 
            onClick={() => handleNext('review')}
            className="flex flex-col items-center gap-2 bg-orange-100 hover:bg-orange-200 text-orange-800 px-8 py-3 rounded-xl transition-colors min-w-[140px]"
          >
            <span className="font-bold text-lg">Needs Review</span>
            <span className="text-xs opacity-70">Show me again later</span>
          </button>
          
          <button 
            onClick={() => handleNext('known')}
            className="flex flex-col items-center gap-2 bg-green-100 hover:bg-green-200 text-green-800 px-8 py-3 rounded-xl transition-colors min-w-[140px]"
          >
            <span className="font-bold text-lg">Got It</span>
            <span className="text-xs opacity-70">Mark as known</span>
          </button>
        </div>
      )}
    </div>
  )
}
