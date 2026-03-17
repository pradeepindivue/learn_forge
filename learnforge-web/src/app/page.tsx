import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function Index() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    return redirect('/dashboard')
  }

  return (
    <div className="flex-1 w-full flex flex-col items-center bg-white min-h-screen relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-white to-white -z-10" />

      <nav className="w-full flex justify-center border-b border-neutral-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="w-full max-w-6xl flex justify-between items-center p-4">
          <div className="font-extrabold text-2xl text-blue-700 tracking-tight">LearnForge</div>
          <div className="flex gap-4">
            <Link href="/login" className="py-2 px-6 rounded-full font-medium text-blue-600 hover:bg-blue-50 transition-colors">
              Login
            </Link>
          </div>
        </div>
      </nav>

      <div className="animate-in flex-1 flex flex-col gap-8 opacity-0 max-w-4xl px-4 items-center text-center mt-32 z-10">
        <div className="inline-block bg-blue-100 text-blue-700 font-semibold px-4 py-1.5 rounded-full text-sm mb-4">
          ✨ Next-Gen AI Learning
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-neutral-900 leading-tight">
          Turn any content into an <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">interactive course.</span>
        </h1>
        <p className="text-xl text-neutral-600 max-w-2xl leading-relaxed mt-2">
          Instantly generate chapters, context-grounded quizzes, and adaptive flashcards from YouTube playlists, articles, and your own notes using AI.
        </p>
        <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold px-10 py-4 rounded-full mt-6 shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95">
          Start Building for Free
        </Link>
      </div>
    </div>
  )
}
