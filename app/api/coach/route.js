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
    const { conversationHistory, latestText, repCalibration, currentStage } =
      await request.json();

    if (!latestText || latestText.trim().length < 5) {
      return NextResponse.json(
        { error: 'Not enough text to generate coaching' },
        { status: 400 }
      );
    }

    const recentHistory = (conversationHistory || []).slice(-20);
    const historyText = recentHistory.map((t) => t.text).join('\n');

    const calibrationContext = repCalibration
      ? `\n\n[REP VOICE CALIBRATION: "${repCalibration}"]`
      : '';

    const stageContext = currentStage
      ? `\n\nThe rep has indicated they are currently in: ${currentStage}. Generate your suggestion for THIS stage specifically. Do not suggest moving to a different stage unless the conversation clearly warrants it.`
      : '';

    const userMessage = `Conversation so far:\n${historyText}\n\nLatest speech: "${latestText}"${calibrationContext}${stageContext}\n\nThe rep is asking for a coaching suggestion right now. Suggest exactly ONE thing the rep should say next, appropriate for the current stage.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
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
        stage: currentStage || 'COACHING',
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

    // Ensure there's always at least one suggestion
    if (!parsed.suggestions || parsed.suggestions.length === 0) {
      parsed.suggestions = [
        {
          text: responseText.slice(0, 200),
          why: '',
          priority: 1,
        },
      ];
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
