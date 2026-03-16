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
    <div className="flex-1 w-full flex flex-col items-center">
      <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
        <div className="w-full max-w-4xl flex justify-between items-center p-3 text-sm">
          <div className="font-bold text-lg">LearnForge</div>
          <div className="flex gap-4">
            <Link href="/login" className="py-2 px-4 rounded-md no-underline bg-btn-background hover:bg-btn-background-hover">
              Login
            </Link>
          </div>
        </div>
      </nav>

      <div className="animate-in flex-1 flex flex-col gap-10 opacity-0 max-w-4xl px-3 items-center text-center mt-20">
        <h1 className="text-5xl font-bold tracking-tight text-neutral-900">
          Turn any content into an interactive course.
        </h1>
        <p className="text-xl text-neutral-600 max-w-2xl">
          Instantly generate chapters, context-grounded quizzes, and adaptive flashcards from YouTube playlists, articles, and your own notes using AI.
        </p>
        <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold px-8 py-3 rounded-lg mt-4 transition-colors">
          Get Started
        </Link>
      </div>
    </div>
  )
}
