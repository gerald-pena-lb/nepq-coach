import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { NEPQ_SYSTEM_PROMPT } from '@/lib/salesFramework';

const anthropic = new Anthropic();

function buildConversationContext(conversationHistory, repCalibration, currentStage) {
  // Use the FULL conversation history, not just recent. Limit to last 60 entries to stay within context.
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
    return parsed;
  } catch {
    return {
      stage: currentStage || 'COACHING',
      suggestions: [{ text: responseText.slice(0, 200), why: '', priority: 1 }],
      prospectSentiment: '',
    };
  }
}

// Instruction block added to every suggestion request — forces Claude to review the whole conversation
const WHOLE_CONTEXT_INSTRUCTIONS = `
## HOW TO ANALYZE
Before suggesting anything, do this analysis internally:

1. **Read the ENTIRE conversation transcript above from start to finish.** Do not just react to the last thing said.
2. **Identify the arc:** What has the prospect revealed across the whole conversation? What themes, emotions, specific details have come up more than once? What have they said they want, fear, have tried, or are avoiding?
3. **Identify what's missing:** Based on the NEPQ framework for the CURRENT STAGE, what has NOT yet been explored that needs to be? What's the biggest gap in what you know about this prospect?
4. **Identify the best NEPQ move:** Using the NEPQ script for the current stage, what is the single most valuable next question? It should reference specific things the prospect has said across the whole conversation — not just the last sentence.
5. **Never repeat.** Scan the full transcript — if a similar question was already asked, do NOT suggest it again. Go deeper instead.

Then output your JSON. The suggestion must feel like it was crafted by someone who has been listening to the entire call with full attention, not just the last few seconds.`;

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

    // Need at least some conversation history or latest text to work with
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
      const userMessage = `FULL CONVERSATION TRANSCRIPT (chronological, numbered):\n${historyText}${calibrationContext}${stageContext}\n\nThe previous suggestion was:\n"${previousSuggestion}"\n\nThat suggestion was too surface-level. Generate a deeper follow-up that:\n1. Reviews the ENTIRE transcript above to find the emotional thread\n2. References specific things the prospect said (use their exact words)\n3. Pushes past the logical/rational layer into the emotional core\n4. Does NOT repeat anything already asked — go to the next layer underneath\n5. Feels like a question from a master therapist, not a sales script\n${WHOLE_CONTEXT_INSTRUCTIONS}`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: NEPQ_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });

      const parsed = parseResponse(message.content[0]?.text || '', currentStage);
      return NextResponse.json(parsed);
    }

    if (pregenerate) {
      const userMessage = `FULL CONVERSATION TRANSCRIPT (chronological, numbered):\n${historyText}${calibrationContext}${stageContext}\n\nGenerate exactly 3 different coaching suggestions the setter could use next, ranked by relevance (priority 1 = best).\n\nRULES:\n- Each suggestion MUST reference specific things the prospect said across the whole transcript\n- Do NOT suggest questions that have already been asked\n- Each suggestion takes a different angle: one continues the current thread, one goes deeper emotionally, one connects back to something said earlier\n- Use the prospect's exact language\n- Suggestions must be NEPQ-appropriate for the current stage\n${WHOLE_CONTEXT_INSTRUCTIONS}`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
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

    // Standard single-suggestion mode (on-demand)
    const userMessage = `FULL CONVERSATION TRANSCRIPT (chronological, numbered):\n${historyText}${calibrationContext}${stageContext}\n\nThe setter just tapped SUGGEST. Based on reviewing the ENTIRE conversation above (not just the last phrase), suggest the single best thing the setter should say next.${WHOLE_CONTEXT_INSTRUCTIONS}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
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
