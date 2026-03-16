import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { course_id, sources } = body

    if (!course_id || !sources || !sources.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Call the internal FastAPI service
    // In production, NEXT_PUBLIC_AI_API_URL would point to the deployed Python service
    const aiServiceUrl = process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:8000'
    const res = await fetch(`${aiServiceUrl}/ingest/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id, sources })
    })

    if (!res.ok) {
      throw new Error(`AI Service returned ${res.status}`)
    }

    const { job_id } = await res.json()
    
    // Also track initial job state in Supabase directly
    await supabase.from('ingestion_jobs').insert({
      id: job_id,
      course_id,
      user_id: user.id,
      status: 'pending',
      sources: sources
    })

    return NextResponse.json({ job_id })
    
  } catch (error: any) {
    console.error('Ingestion start error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
