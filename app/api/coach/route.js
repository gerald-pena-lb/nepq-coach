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
    const { conversationHistory, latestText } = await request.json();

    if (!latestText || latestText.trim().length < 15) {
      return NextResponse.json(
        { error: 'Not enough text to generate coaching' },
        { status: 400 }
      );
    }

    const recentHistory = (conversationHistory || []).slice(-20);
    const historyText = recentHistory
      .map((t) => t.text)
      .join('\n');

    const userMessage = `Conversation so far:\n${historyText}\n\nProspect just said: "${latestText}"\n\nWhat should I say next?`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: NEPQ_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const responseText = message.content[0]?.text || '';

    // Parse JSON from response — handle potential markdown fences
    let parsed;
    try {
      const cleaned = responseText
        .replace(/^```json?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        stage: 'UNKNOWN',
        suggestions: [
          {
            text: responseText.slice(0, 200),
            why: 'Raw response — could not parse structured output',
            priority: 1,
          },
        ],
        prospectSentiment: 'Unknown',
      };
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('Coaching error:', err);

    if (err.status === 401) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }
    if (err.status === 429) {
      return NextResponse.json({ error: 'Rate limited — try again' }, { status: 429 });
    }

    return NextResponse.json(
      { error: 'Failed to generate coaching suggestion' },
      { status: 500 }
    );
  }
}
