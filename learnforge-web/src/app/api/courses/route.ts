import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, description } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Insert a new course
    const { data: course, error } = await supabase
      .from('courses')
      .insert({
        user_id: user.id,
        title: title,
        description: description || null,
        status: 'draft',
      })
      .select()
      .single()

    if (error) {
      console.error('Course creation error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ course })
    
  } catch (error: any) {
    console.error('Course creation exception:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
