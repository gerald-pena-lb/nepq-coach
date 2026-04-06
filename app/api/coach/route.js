import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { NEPQ_SYSTEM_PROMPT } from '@/lib/salesFramework';

const anthropic = new Anthropic();

function buildConversationContext(conversationHistory, latestText, repCalibration, currentStage) {
  const recentHistory = (conversationHistory || []).slice(-20);
  const historyText = recentHistory.map((t) => t.text).join('\n');

  const calibrationContext = repCalibration
    ? `\n\n[REP VOICE CALIBRATION: "${repCalibration}"]`
    : '';

  const stageContext = currentStage
    ? `\n\nThe rep has indicated they are currently in: ${currentStage}. Generate suggestions for THIS stage specifically.`
    : '';

  return { historyText, calibrationContext, stageContext };
}

function parseResponse(responseText, currentStage) {
  try {
    const cleaned = responseText
      .replace(/^```json?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.suggestions || parsed.suggestions.length === 0) {
      parsed.suggestions = [{ text: responseText.slice(0, 200), why: '', priority: 1 }];
    }
    return parsed;
  } catch {
    return {
      stage: currentStage || 'COACHING',
      suggestions: [{ text: responseText.slice(0, 200), why: '', priority: 1 }],
      prospectSentiment: '',
    };
  }
}

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 500 }
    );
  }

  try {
    const {
      conversationHistory,
      latestText,
      repCalibration,
      currentStage,
      pregenerate,
      goDeeper,
      previousSuggestion,
    } = await request.json();

    if (!latestText || latestText.trim().length < 5) {
      return NextResponse.json(
        { error: 'Not enough text to generate coaching' },
        { status: 400 }
      );
    }

    const { historyText, calibrationContext, stageContext } =
      buildConversationContext(conversationHistory, latestText, repCalibration, currentStage);

    if (goDeeper && previousSuggestion) {
      // GO DEEPER mode: take the last suggestion and the full transcript, generate a deeper follow-up
      const userMessage = `Full conversation transcript:\n${historyText}\n\nLatest speech: "${latestText}"${calibrationContext}${stageContext}\n\nThe rep was previously shown this suggestion:\n"${previousSuggestion}"\n\nThat suggestion was too surface-level. The rep wants to GO DEEPER. Generate a more penetrating, emotionally deeper follow-up question that:\n1. Builds directly on what the prospect has already revealed in the transcript\n2. Uses the prospect's own words and specific details they shared\n3. Pushes past the logical/rational layer into the emotional core\n4. Does NOT repeat anything already asked — go to the next layer underneath\n5. Should make the prospect pause and think before answering\n\nThis should feel like a question from a master therapist, not a sales script.`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        system: NEPQ_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });

      const parsed = parseResponse(message.content[0]?.text || '', currentStage);
      return NextResponse.json(parsed);
    }

    if (pregenerate) {
      // Pre-generation mode: return 3 ranked candidates that build on conversation context
      const userMessage = `Full conversation transcript:\n${historyText}\n\nLatest speech: "${latestText}"${calibrationContext}${stageContext}\n\nGenerate exactly 3 different coaching suggestions the rep could say next, ranked by relevance. CRITICAL RULES:\n- Each suggestion MUST reference specific things the prospect said in the transcript\n- Do NOT suggest questions that have already been asked\n- Each suggestion should take a different depth level: one that continues the current thread, one that goes deeper emotionally, and one that connects to something said earlier in the conversation\n- Use the prospect's exact language in your suggestions where possible`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: NEPQ_SYSTEM_PROMPT + `\n\n## PRE-GENERATION MODE\nReturn exactly 3 suggestions ranked by relevance. Format:\n{"candidates":[{"stage":"...","suggestions":[{"text":"...","why":"...","priority":N}],"prospectSentiment":"..."}]}\nEach candidate is a complete suggestion object. Rank by priority (1=best).`,
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
          candidates: [
            {
              stage: currentStage || 'COACHING',
              suggestions: [{ text: responseText.slice(0, 200), why: '', priority: 1 }],
              prospectSentiment: '',
            },
          ],
        };
      }

      let candidatesArr = parsed.candidates || parsed;
      if (!Array.isArray(candidatesArr)) candidatesArr = [candidatesArr];

      candidatesArr = candidatesArr
        .filter((c) => c.suggestions?.[0]?.text)
        .map((c) => ({
          stage: c.stage || currentStage || 'COACHING',
          suggestions: [c.suggestions[0]],
          prospectSentiment: c.prospectSentiment || '',
        }));

      candidatesArr.sort(
        (a, b) => (a.suggestions[0].priority || 1) - (b.suggestions[0].priority || 1)
      );

      return NextResponse.json({ candidates: candidatesArr });
    }

    // Standard single-suggestion mode (on-demand fallback)
    const userMessage = `Full conversation transcript:\n${historyText}\n\nLatest speech: "${latestText}"${calibrationContext}${stageContext}\n\nSuggest exactly ONE thing the rep should say next. It MUST build on what the prospect has already said — reference their specific words and go deeper into what they revealed. Do NOT suggest anything generic or already asked.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: NEPQ_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const parsed = parseResponse(message.content[0]?.text || '', currentStage);
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
