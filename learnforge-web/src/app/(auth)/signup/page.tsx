import { signup } from '@/app/actions/auth'
import Link from 'next/link'

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error: string; message: string }
}) {
  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mt-20 mx-auto">
      <Link
        href="/"
        className="absolute left-8 top-8 py-2 px-4 rounded-md no-underline text-neutral-900 bg-neutral-100 hover:bg-neutral-200 flex items-center group text-sm"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>{' '}
        Back
      </Link>

      <form
        className="flex-1 flex flex-col w-full justify-center gap-2 text-neutral-900"
        action={signup}
      >
        <h2 className="text-3xl font-bold text-center mb-6">Sign Up for LearnForge</h2>

        <label className="text-md" htmlFor="email">
          Email
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          name="email"
          placeholder="you@example.com"
          required
        />
        <label className="text-md" htmlFor="password">
          Password
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          type="password"
          name="password"
          placeholder="••••••••"
          required
          minLength={8}
        />
        <button className="bg-blue-600 text-white font-medium rounded-md px-4 py-2 mb-2 hover:bg-blue-700 transition">
          Sign Up
        </button>

        {searchParams?.error && (
          <p className="mt-4 p-4 bg-red-100 text-red-600 text-center rounded-md">
            {searchParams.error}
          </p>
        )}
        {searchParams?.message && (
          <p className="mt-4 p-4 bg-green-100 text-green-700 text-center rounded-md">
            {searchParams.message}
          </p>
        )}
        
        <p className="text-center text-sm mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-500 hover:underline">
            Sign In
          </Link>
        </p>
      </form>
    </div>
  )
}
