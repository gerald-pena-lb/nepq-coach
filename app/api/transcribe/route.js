import { NextResponse } from 'next/server';

export async function POST(request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ELEVENLABS_API_KEY not configured' },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Build the request to ElevenLabs Scribe v2
    const elevenLabsForm = new FormData();
    elevenLabsForm.append('file', audioFile, 'audio.wav');
    elevenLabsForm.append('model_id', 'scribe_v1');

    const response = await fetch(
      'https://api.elevenlabs.io/v1/speech-to-text',
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
        },
        body: elevenLabsForm,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Transcription failed', detail: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      text: data.text || '',
      language_code: data.language_code || 'en',
    });
  } catch (err) {
    console.error('Transcription error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
