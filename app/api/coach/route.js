import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { NEPQ_SYSTEM_PROMPT } from '@/lib/salesFramework';

const anthropic = new Anthropic();

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 500 }
    );
  }

  try {
    const { conversationHistory, latestText, repCalibration } =
      await request.json();

    if (!latestText || latestText.trim().length < 10) {
      return NextResponse.json(
        { error: 'Not enough text to generate coaching' },
        { status: 400 }
      );
    }

    const recentHistory = (conversationHistory || []).slice(-20);
    const historyText = recentHistory.map((t) => t.text).join('\n');

    const calibrationContext = repCalibration
      ? `\n\n[REP VOICE CALIBRATION — the rep said this before the call started: "${repCalibration}"]\nUse this to identify which parts of the transcript are the rep vs the prospect.`
      : '';

    const userMessage = `Conversation so far:\n${historyText}\n\nLatest speech: "${latestText}"${calibrationContext}\n\nAnalyze who just spoke (rep or prospect). If the prospect spoke, suggest what the rep should say next. If the rep just spoke, indicate you're waiting for the prospect.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: NEPQ_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const responseText = message.content[0]?.text || '';

    // Parse JSON from response
    let parsed;
    try {
      const cleaned = responseText
        .replace(/^```json?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        stage: 'COACHING',
        suggestions: [
          {
            text: responseText.slice(0, 200),
            why: '',
            priority: 1,
          },
        ],
        prospectSentiment: '',
      };
    }

    // If Claude detected the rep was speaking, skip this suggestion
    if (
      parsed.skipReason === 'rep_speaking' ||
      (parsed.suggestions && parsed.suggestions.length === 0)
    ) {
      return NextResponse.json({ skipped: true, reason: 'rep_speaking' });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('Coaching error:', err);

    if (err.status === 401) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }
    if (err.status === 429) {
      return NextResponse.json(
        { error: 'Rate limited — try again' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate coaching suggestion' },
      { status: 500 }
    );
  }
}
