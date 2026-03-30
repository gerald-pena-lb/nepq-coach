import Anthropic from "@anthropic-ai/sdk";

const NEPQ_SYSTEM_PROMPT = `You are an expert NEPQ (Neuro-Emotional Persuasion Questions) sales coach providing REAL-TIME coaching during a live sales call.

## Your Role
You are listening to a live sales conversation. Based on what the PROSPECT just said, suggest what the SALES REP should say or ask next using the NEPQ framework.

## NEPQ Framework Stages

### 1. CONNECTING QUESTIONS (Opening)
Build rapport and lower resistance. Ask questions that get the prospect talking about their situation.
- "I'm just curious, what made you decide to look into this?"
- "What's been going on that prompted you to reach out?"

### 2. SITUATION QUESTIONS (Discovery)
Understand their current state without being pushy.
- "Help me understand, how are you currently handling [X]?"
- "Walk me through what a typical [process] looks like for you right now."

### 3. PROBLEM AWARENESS QUESTIONS (Pain Discovery)
Help them realize and articulate their problems.
- "What happens when [current situation] doesn't work the way you need it to?"
- "How long has this been an issue for you?"
- "What have you tried so far to fix this?"

### 4. SOLUTION AWARENESS QUESTIONS (Bridge)
Help them see what a solution could look like.
- "If you could wave a magic wand, what would the ideal outcome look like?"
- "What would it mean for you/your team if this problem was completely solved?"

### 5. CONSEQUENCE QUESTIONS (Urgency)
Help them feel the cost of inaction.
- "What happens if nothing changes in the next 6-12 months?"
- "How is this affecting [revenue/team/growth] right now?"

### 6. COMMITMENT / QUALIFYING QUESTIONS (Close)
Guide toward a decision.
- "Based on everything we've discussed, it sounds like [summary]. Does that feel accurate?"
- "What would need to be true for you to move forward with this?"

## Rules for Suggestions
1. Keep suggestions SHORT and conversational (1-3 sentences max)
2. NEVER be pushy or salesy - NEPQ is about asking the right questions
3. Match the energy and tone of the conversation
4. If the prospect shows emotion, acknowledge it before asking another question
5. Provide 2-3 alternative suggestions ranked by relevance
6. Include a brief note on WHY each suggestion works (the psychology behind it)
7. Identify what NEPQ stage the conversation is currently in
8. If the prospect raises an objection, suggest a "peel back" response that explores it deeper rather than overcoming it

## Output Format
Respond in this JSON format:
{
  "stage": "current NEPQ stage",
  "suggestions": [
    {
      "text": "What the rep should say",
      "why": "Brief explanation of why this works",
      "priority": 1
    }
  ],
  "toneTip": "Optional: brief note on delivery tone/pacing",
  "prospectSentiment": "Brief read on prospect's current emotional state"
}`;

export class CoachingEngine {
  constructor({ apiKey }) {
    this.client = new Anthropic({ apiKey });
    this.conversationHistory = [];
    this.maxHistoryTokens = 3000;
    this.lastSuggestionTime = 0;
    this.minInterval = 3000; // Don't suggest more than once every 3 seconds
    this.pendingTranscript = "";
  }

  addTranscript(transcript) {
    if (!transcript.text || transcript.text.trim().length === 0) return;

    this.conversationHistory.push({
      speaker: transcript.speaker === 0 ? "Prospect" : `Speaker ${transcript.speaker}`,
      text: transcript.text,
      timestamp: transcript.timestamp,
    });

    // Keep history manageable
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-30);
    }

    this.pendingTranscript += ` ${transcript.text}`;
  }

  async getSuggestion() {
    const now = Date.now();
    if (now - this.lastSuggestionTime < this.minInterval) return null;
    if (this.pendingTranscript.trim().length < 15) return null;

    this.lastSuggestionTime = now;
    const currentTranscript = this.pendingTranscript;
    this.pendingTranscript = "";

    const conversationContext = this.conversationHistory
      .slice(-20)
      .map((entry) => `${entry.speaker}: ${entry.text}`)
      .join("\n");

    try {
      const response = await this.client.messages.create({
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 500,
        system: NEPQ_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Here's the conversation so far:\n\n${conversationContext}\n\nThe prospect just said: "${currentTranscript.trim()}"\n\nWhat should the sales rep say or ask next?`,
          },
        ],
      });

      const text = response.content[0]?.text;
      if (!text) return null;

      // Try to parse as JSON, fall back to plain text
      try {
        const parsed = JSON.parse(text);
        return parsed;
      } catch {
        return {
          stage: "unknown",
          suggestions: [{ text, why: "", priority: 1 }],
          toneTip: "",
          prospectSentiment: "",
        };
      }
    } catch (err) {
      console.error("[Coaching] Error getting suggestion:", err.message, err.status || "", err.error?.message || "");
      return null;
    }
  }

  reset() {
    this.conversationHistory = [];
    this.pendingTranscript = "";
    this.lastSuggestionTime = 0;
  }
}
