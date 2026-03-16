import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: courses, error } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', user?.id)
    .order('updated_at', { ascending: false })

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="flex justify-between items-center w-full">
        <h1 className="text-2xl font-bold text-neutral-900">My Courses</h1>
        <Link href="/courses/new" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md transition-colors">
          + New Course
        </Link>
      </div>

      {error && <div className="text-red-500">Error loading courses: {error.message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
        {!courses?.length ? (
          <div className="col-span-full py-12 text-center text-neutral-500 bg-neutral-100 rounded-lg border border-dashed border-neutral-300">
            <h3 className="text-lg font-medium text-neutral-700 mb-2">No courses yet</h3>
            <p className="mb-4">Create your first course by importing content from YouTube or articles.</p>
            <Link href="/courses/new" className="text-blue-600 font-medium hover:underline">
              Create a Course →
            </Link>
          </div>
        ) : (
          courses.map((course) => (
            <div key={course.id} className="border border-neutral-200 bg-white rounded-lg p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-neutral-900 line-clamp-1">{course.title || 'Untitled Course'}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${course.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {course.status}
                  </span>
                </div>
                <p className="text-sm text-neutral-500 line-clamp-2 mb-4 h-10">
                  {course.description || 'No description provided.'}
                </p>
                <div className="text-xs text-neutral-500 mb-4">
                  {course.chapter_count} chapters
                </div>
              </div>
              
              <Link href={`/courses/${course.id}${course.status === 'draft' ? '/edit' : ''}`} className="w-full text-center py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-medium rounded transition-colors text-sm">
                {course.status === 'draft' ? 'Continue Editing' : 'View Course'}
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
