import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/actions/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b bg-white top-0 z-50 sticky px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-blue-700">LearnForge</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-600">{user.email}</span>
          <form action={logout}>
            <button className="text-sm border border-neutral-300 rounded px-3 py-1 hover:bg-neutral-100 transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto p-6 md:p-8">
        {children}
      </main>
    </div>
  )
}
