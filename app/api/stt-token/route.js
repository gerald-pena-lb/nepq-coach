import { NextResponse } from 'next/server';

export async function POST() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ELEVENLABS_API_KEY not configured' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      'https://api.elevenlabs.io/v1/speech-to-text/get-websocket-token',
      {
        method: 'GET',
        headers: { 'xi-api-key': apiKey },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('ElevenLabs token error:', res.status, text);
      return NextResponse.json(
        { error: 'Failed to get STT token' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ token: data.token });
  } catch (err) {
    console.error('Token request error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
