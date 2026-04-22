import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { NEPQ_SYSTEM_PROMPT } from '@/lib/salesFramework';

const anthropic = new Anthropic();

// Models: Haiku for fast paths, Sonnet for deep reasoning
const MODEL_FAST = 'claude-haiku-4-5-20251001';
const MODEL_DEEP = 'claude-sonnet-4-6';

// System prompt with caching — the large NEPQ prompt is reused across every request.
// With cache_control: ephemeral, subsequent calls within 5 minutes get a ~85% TTFT reduction.
const SYSTEM_CACHED = [
  {
    type: 'text',
    text: NEPQ_SYSTEM_PROMPT,
    cache_control: { type: 'ephemeral' },
  },
];

const SYSTEM_CACHED_PREGEN = [
  {
    type: 'text',
    text:
      NEPQ_SYSTEM_PROMPT +
      `\n\n## PRE-GENERATION MODE\nReturn exactly 2 suggestions ranked by relevance. Format:\n{"candidates":[{"stage":"...","suggestions":[{"text":"...","why":"...","priority":N}],"prospectSentiment":"..."}]}\nEach candidate is a complete suggestion object. Rank by priority (1=best).`,
    cache_control: { type: 'ephemeral' },
  },
];

function buildConversationContext(conversationHistory, repCalibration, currentStage) {
  const fullHistory = (conversationHistory || []).slice(-60);
  const historyText = fullHistory.map((t, i) => `[${i + 1}] ${t.text}`).join('\n');

  const calibrationContext = repCalibration
    ? `\n\n[REP VOICE CALIBRATION — this is how the setter sounds: "${repCalibration}"]`
    : '';

  const stageContext = currentStage
    ? `\n\nCURRENT STAGE (the setter has set this): ${currentStage}\nGenerate suggestions appropriate for this stage.`
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
    parsed.suggestions = parsed.suggestions.map((s) => ({
      ...s,
      text: enforceSingleQuestion(s.text || ''),
    }));
    return parsed;
  } catch {
    return {
      stage: currentStage || 'COACHING',
      suggestions: [
        { text: enforceSingleQuestion(responseText.slice(0, 300)), why: '', priority: 1 },
      ],
      prospectSentiment: '',
    };
  }
}

function enforceSingleQuestion(text) {
  if (!text) return '';
  const trimmed = text.trim();
  const firstQ = trimmed.indexOf('?');
  if (firstQ === -1) return trimmed;
  return trimmed.slice(0, firstQ + 1).trim();
}

// Shorter analysis instructions — trimmed to save output tokens without losing behavior
const WHOLE_CONTEXT_INSTRUCTIONS = `

## HOW TO ANALYZE
Read the ENTIRE transcript above. Identify themes, what's been revealed, what's missing for the current stage. Pick the single best NEPQ move. Reference the prospect's exact words. Never repeat a question. Output JSON only.`;

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

    const hasHistory = Array.isArray(conversationHistory) && conversationHistory.length > 0;
    const hasLatest = latestText && latestText.trim().length >= 5;
    if (!hasHistory && !hasLatest) {
      return NextResponse.json(
        { error: 'Not enough conversation context yet' },
        { status: 400 }
      );
    }

    const { historyText, calibrationContext, stageContext } =
      buildConversationContext(conversationHistory, repCalibration, currentStage);

    if (goDeeper && previousSuggestion) {
      const userMessage = `FULL CONVERSATION TRANSCRIPT (chronological, numbered):\n${historyText}${calibrationContext}${stageContext}\n\nThe previous suggestion was:\n"${previousSuggestion}"\n\nThat suggestion was too surface-level. Generate a deeper follow-up that references the prospect's exact words, pushes past the logical layer into emotional core, and does NOT repeat anything already asked.${WHOLE_CONTEXT_INSTRUCTIONS}`;

      const message = await anthropic.messages.create({
        model: MODEL_DEEP,
        max_tokens: 350,
        system: SYSTEM_CACHED,
        messages: [{ role: 'user', content: userMessage }],
      });

      const parsed = parseResponse(message.content[0]?.text || '', currentStage);
      return NextResponse.json(parsed);
    }

    if (pregenerate) {
      const userMessage = `FULL CONVERSATION TRANSCRIPT (chronological, numbered):\n${historyText}${calibrationContext}${stageContext}\n\nGenerate exactly 2 different coaching suggestions ranked by relevance (priority 1 = best). Each must reference specific things the prospect said. Do NOT repeat questions. Take different angles.${WHOLE_CONTEXT_INSTRUCTIONS}`;

      const message = await anthropic.messages.create({
        model: MODEL_FAST,
        max_tokens: 500,
        system: SYSTEM_CACHED_PREGEN,
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
          suggestions: [
            {
              ...c.suggestions[0],
              text: enforceSingleQuestion(c.suggestions[0].text),
            },
          ],
          prospectSentiment: c.prospectSentiment || '',
        }));

      candidatesArr.sort(
        (a, b) => (a.suggestions[0].priority || 1) - (b.suggestions[0].priority || 1)
      );

      return NextResponse.json({ candidates: candidatesArr });
    }

    // Standard single-suggestion mode (on-demand fallback)
    const userMessage = `FULL CONVERSATION TRANSCRIPT (chronological, numbered):\n${historyText}${calibrationContext}${stageContext}\n\nThe setter just tapped SUGGEST. Based on the ENTIRE conversation, suggest the single best thing the setter should say next.${WHOLE_CONTEXT_INSTRUCTIONS}`;

    const message = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 300,
      system: SYSTEM_CACHED,
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
