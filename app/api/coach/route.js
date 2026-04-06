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
    const { conversationHistory, latestText, repCalibration, currentStage, pregenerate } =
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
      ? `\n\nThe rep has indicated they are currently in: ${currentStage}. Generate suggestions for THIS stage specifically.`
      : '';

    if (pregenerate) {
      // Pre-generation mode: return 3 ranked candidates
      const userMessage = `Conversation so far:\n${historyText}\n\nLatest speech: "${latestText}"${calibrationContext}${stageContext}\n\nGenerate exactly 3 different coaching suggestions the rep could say next, ranked by relevance. Each should take a different angle or approach while staying in the current stage. Return them as a JSON array of objects.`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: NEPQ_SYSTEM_PROMPT + `\n\n## PRE-GENERATION MODE\nReturn exactly 3 suggestions ranked by relevance. Format:\n{"candidates":[{"stage":"...","suggestions":[{"text":"...","why":"...","priority":N}],"prospectSentiment":"..."}]}\nEach candidate is a complete suggestion object. Rank by priority (1=best). Use different angles/approaches for each.`,
        messages: [{ role: 'user', content: userMessage }],
      });

      const responseText = message.content[0]?.text || '';

      let parsed;
      try {
        const cleaned = responseText
          .replace(/^```json?\s*/i, '')
          .replace(/```\s*$/, '')
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
        // If parsing fails, wrap as a single candidate
        parsed = {
          candidates: [
            {
              stage: currentStage || 'COACHING',
              suggestions: [{ text: responseText.slice(0, 200), why: '', priority: 1 }],
              prospectSentiment: '',
            },
          ],
        };
      }

      // Normalize: ensure candidates is an array
      let candidatesArr = parsed.candidates || parsed;
      if (!Array.isArray(candidatesArr)) candidatesArr = [candidatesArr];

      // Ensure each candidate has the right shape
      candidatesArr = candidatesArr
        .filter((c) => c.suggestions?.[0]?.text)
        .map((c) => ({
          stage: c.stage || currentStage || 'COACHING',
          suggestions: [c.suggestions[0]],
          prospectSentiment: c.prospectSentiment || '',
        }));

      // Sort by priority (lowest number = best)
      candidatesArr.sort(
        (a, b) => (a.suggestions[0].priority || 1) - (b.suggestions[0].priority || 1)
      );

      return NextResponse.json({ candidates: candidatesArr });
    }

    // Standard single-suggestion mode (on-demand fallback)
    const userMessage = `Conversation so far:\n${historyText}\n\nLatest speech: "${latestText}"${calibrationContext}${stageContext}\n\nSuggest exactly ONE thing the rep should say next, appropriate for the current stage.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: NEPQ_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const responseText = message.content[0]?.text || '';

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
        suggestions: [{ text: responseText.slice(0, 200), why: '', priority: 1 }],
        prospectSentiment: '',
      };
    }

    if (!parsed.suggestions || parsed.suggestions.length === 0) {
      parsed.suggestions = [{ text: responseText.slice(0, 200), why: '', priority: 1 }];
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
