import { NextResponse } from 'next/server';

// Filter out non-English garbage: sound effect descriptions, CJK characters, etc.
// Returns empty string if the text is mostly non-English or noise.
function cleanTranscript(text) {
  if (!text) return '';

  // Remove common ElevenLabs sound effect hallucinations: (单音符), (抵抗的音效), etc.
  let cleaned = text
    .replace(/\([^)]*\)/g, '') // remove anything in parentheses — sound effect labels
    .trim();

  if (!cleaned) return '';

  // Count ASCII letters vs non-ASCII characters
  const asciiLetters = (cleaned.match(/[a-zA-Z]/g) || []).length;
  const totalChars = cleaned.replace(/\s/g, '').length;

  // If less than 50% ASCII letters, it's probably not English speech
  if (totalChars > 0 && asciiLetters / totalChars < 0.5) {
    return '';
  }

  // Remove stray non-Latin characters that survived
  cleaned = cleaned.replace(/[^\x00-\x7F\u00C0-\u024F]/g, '').trim();

  // If what's left is too short or just punctuation, skip it
  if (cleaned.length < 2 || !/[a-zA-Z]{2,}/.test(cleaned)) {
    return '';
  }

  return cleaned;
}

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

    // Build the request to ElevenLabs Scribe
    const elevenLabsForm = new FormData();
    elevenLabsForm.append('file', audioFile, 'audio.wav');
    elevenLabsForm.append('model_id', 'scribe_v1');
    elevenLabsForm.append('language_code', 'en');

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
    const rawText = data.text || '';
    const cleanedText = cleanTranscript(rawText);

    return NextResponse.json({
      text: cleanedText,
      language_code: 'en',
    });
  } catch (err) {
    console.error('Transcription error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
