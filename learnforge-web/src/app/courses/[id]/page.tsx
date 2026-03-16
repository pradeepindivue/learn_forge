import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

export default async function CoursePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return redirect('/login')
  }

  // Fetch Course
  const { data: course } = await supabase
    .from('courses')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!course) {
    return notFound()
  }

  // Fetch Chapters
  const { data: chapters } = await supabase
    .from('chapters')
    .select('*')
    .eq('course_id', params.id)
    .order('order_index', { ascending: true })

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4">
      <Link href="/dashboard" className="text-blue-600 hover:underline mb-6 inline-block font-medium">
        &larr; Back to Dashboard
      </Link>
      
      <div className="bg-white border text-neutral-900 rounded-xl shadow-sm p-8 mb-8">
        <h1 className="text-3xl font-bold mb-4">{course.title}</h1>
        {course.description && (
          <p className="text-neutral-600 text-lg">{course.description}</p>
        )}
        <div className="mt-4 inline-block bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wide">
          {course.status}
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4">Course Content</h2>
      
      {chapters && chapters.length > 0 ? (
        <div className="space-y-4">
          {chapters.map((chapter: any, index: number) => (
            <Link 
              key={chapter.id} 
              href={`/courses/${course.id}/chapters/${chapter.id}`}
              className="block bg-white text-neutral-900 border rounded-lg p-6 hover:border-blue-500 hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold group-hover:text-blue-600 transition-colors">
                    Chapter {index + 1}: {chapter.title}
                  </h3>
                  {chapter.summary && (
                    <p className="text-neutral-500 mt-2 line-clamp-2 text-sm">{chapter.summary}</p>
                  )}
                </div>
                <div className="text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn &rarr;
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-dashed border-neutral-300 rounded-lg p-8 text-center text-neutral-500">
          <p className="mb-4">No chapters have been generated for this course yet.</p>
          <Link href={`/courses/${course.id}/edit`} className="inline-block bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition">
            Go to Editor &rarr;
          </Link>
        </div>
      )}
    </div>
  )
}
