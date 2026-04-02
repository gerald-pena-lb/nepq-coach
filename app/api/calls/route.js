import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  if (!supabase) {
    // Supabase not configured — silently succeed so the app works without it
    return NextResponse.json({ saved: false, reason: 'Supabase not configured' });
  }

  try {
    const body = await request.json();
    const { transcript, suggestions, duration, startedAt } = body;

    const { data, error } = await supabase.from('calls').insert([
      {
        transcript,
        suggestions,
        duration,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ saved: true, data });
  } catch (err) {
    console.error('Save call error:', err);
    return NextResponse.json(
      { error: 'Failed to save call data' },
      { status: 500 }
    );
  }
}
