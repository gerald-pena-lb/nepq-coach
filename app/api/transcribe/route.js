import { NextResponse } from 'next/server';

// Known noise/hallucination patterns ElevenLabs returns for silence or background noise
const NOISE_PATTERNS = [
  /^\s*$/,
  /^[\s.,!?;:'"\-–—]+$/,
  /^(um+|uh+|ah+|eh+|oh+|hm+|mhm+)\s*[.,!?]?\s*$/i,
  /^(thank you|thanks|bye|goodbye|hello|hi)[.!?]?\s*$/i, // common Whisper/Scribe hallucinations on silence
  /^you['\s]?re welcome[.!?]?\s*$/i,
  /^\[.*\]\s*$/, // bracketed labels like [MUSIC]
  /^music|silence|background noise|applause|laughter$/i,
];

// Strip filler-only words (single-word utterances that are likely noise)
function isLikelyNoise(text) {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length < 2) return true;

  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  // If it's a single short word, treat as noise
  const words = trimmed.split(/\s+/);
  if (words.length === 1 && words[0].length < 4) return true;

  return false;
}

// Filter out non-English garbage: sound effect descriptions, CJK characters, etc.
function cleanTranscript(text) {
  if (!text) return '';

  // Remove common ElevenLabs sound effect hallucinations: (单音符), (抵抗的音效), (音乐), etc.
  let cleaned = text.replace(/\([^)]*\)/g, '').trim();
  cleaned = cleaned.replace(/\[[^\]]*\]/g, '').trim();

  if (!cleaned) return '';

  // Count ASCII letters vs non-ASCII characters
  const asciiLetters = (cleaned.match(/[a-zA-Z]/g) || []).length;
  const totalChars = cleaned.replace(/\s/g, '').length;

  // If less than 60% ASCII letters, it's probably not English speech
  if (totalChars > 0 && asciiLetters / totalChars < 0.6) {
    return '';
  }

  // Remove stray non-Latin characters that survived
  cleaned = cleaned.replace(/[^\x00-\x7FÀ-ɏ]/g, '').trim();
  cleaned = cleaned.replace(/\s+/g, ' ');

  // If what's left is too short or just punctuation, skip it
  if (cleaned.length < 3 || !/[a-zA-Z]{2,}/.test(cleaned)) {
    return '';
  }

  // Final noise check
  if (isLikelyNoise(cleaned)) return '';

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
