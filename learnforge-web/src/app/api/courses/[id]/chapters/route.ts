import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { chapters } = body // Array of { id, order_index, title }

    if (!chapters || !Array.isArray(chapters)) {
      return NextResponse.json({ error: 'Invalid chapter payload' }, { status: 400 })
    }

    // Verify course ownership
    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (courseErr || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    // Execute bulk update (using upsert or individual updates in a loop for simplicity here)
    for (const chapter of chapters) {
      await supabase
        .from('chapters')
        .update({ order_index: chapter.order_index, title: chapter.title })
        .eq('id', chapter.id)
        .eq('course_id', params.id)
    }

    return NextResponse.json({ success: true })
    
  } catch (error: any) {
    console.error('Chapter update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
