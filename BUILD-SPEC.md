# NEPQ Coach — Build Document

**For:** Engineering Team  
**From:** Gerald  
**Date:** April 2026  
**Priority:** High  

---

## What We're Building

A web app that listens to our sales calls in real time and shows the rep what to say next — live, on a second screen.

The rep opens the app on their phone, places it near their laptop during a Google Meet call, and the app:
1. Listens to the conversation through the phone's microphone
2. Transcribes what's being said
3. Figures out where we are in our sales process
4. Shows the rep exactly what to say next

The rep never touches the app during the call. It just listens, thinks, and coaches.

---

## Who Uses It

Our sales reps. They're on Google Meet calls with prospects who want to write a book. The rep has their laptop for the Meet call and opens this app on a second device (phone or tablet) sitting next to their laptop.

---

## How It Should Work — Step by Step

1. Rep opens the web app URL on their phone
2. Taps "Start Coaching"
3. Phone asks for microphone permission — rep allows it
4. Phone starts listening to the room
5. The app transcribes the conversation and shows it in a "Live Transcript" panel
6. When the prospect pauses for about 1 second, the AI generates a coaching suggestion
7. The suggestion appears in a "Say This Next" panel — one suggestion at a time
8. The suggestion includes:
   - What stage of the sales process we're in
   - The exact words to say (1-3 sentences)
   - Why that response works
   - How the prospect seems to be feeling
9. When the prospect talks again, the timer resets — no new suggestion until they pause
10. Rep taps "Stop" when the call ends

---

## The Sales Framework (What the AI Follows)

The AI must follow our 6-stage NEPQ sales framework. It should use this as a **flexible guide** — not read it word for word. It needs to detect which stage the conversation is in and suggest appropriate responses.

### Stage 1 — CONNECT
**Goal:** Build rapport. Get the prospect to own WHY they showed up.

The prospect booked the call after a teammate messaged them on LinkedIn. The rep needs to get the prospect to claim the decision. Key moves:
- "What was it about your conversation with [teammate] on LinkedIn that caused you to want to book time with me today?"
- If they give a surface answer ("just curious"): "Curiosity doesn't usually get people to block out time on their calendar. What was underneath that?"
- If they credit the teammate: "Nobody put this time in your calendar except you. What made you decide it was worth it?"
- If they're vague: "What would have had to be true about your situation for you to have just ignored the message and moved on?"
- Transition to next stage: "Most people say they want to write a book. You made it here. What is it about writing a book that's calling to you right now?"

### Stage 2 — SITUATION
**Goal:** Understand what they want, what they've tried, and where the gap is.

Key moves:
- "Do you already have a sense of what kind of help you're looking for, or are you still figuring that out?"
- "What would you actually want to use your book for? What's the main goal?"
- "Why is that important to you? Where does that drive come from?"
- "What are you currently doing to move toward that goal? How long have you been at it?"
- If they've tried before: "What got in the way? Was it the process, the time, or not knowing what to do with it once it was done?"

### Stage 3 — PROBLEM
**Goal:** Get the prospect to say — in their own words — why staying where they are is NOT okay. This is where the sale is made.

Key moves:
- "What's been happening lately that made you open to exploring this now — instead of just continuing the way things are?"
- "Less than 1% of people will ever write a book. 99% never will. What makes you not okay with being in that 99%?"
- "How long have you been feeling this way? What happened that shifted something for you?"
- "Why not just continue with the way things are going now? What's making that unacceptable?"
- If "not the right time": "What would need to be different for it to be the right time? How long have you been waiting for that?"
- If "I want to try doing it myself first": "What's your plan for getting it done — and by when? What happened the last time you tried to move forward on this alone?"

### Stage 4 — CONSEQUENCE
**Goal:** Help the prospect FEEL the real cost of doing nothing. This is the heaviest stage. Don't rush it.

Key moves:
- "What kind of impact do you want your story to have on the people who read it?"
- "If nothing changes — if the book never gets written and things stay exactly the way they are — what happens?"
- "What happens if your story never gets told and it dies with you?"
- "How does it feel — knowing you haven't been able to contribute the way you really want to, up to this point?"
- "Would you be okay continuing to feel that way? Some people choose to."
- If "I need to think about it": "Of course — what specifically do you need to think through? You mentioned [their consequence]. How much longer are you okay with that continuing while you think it over?"

### Stage 5 — OPEN WALLET TEST
**Goal:** Find out if they're financially serious — without giving pricing. We're filtering, not closing.

Key moves:
- "As you probably know, getting professional help to publish a book involves some level of financial investment. Think of it like buying a car — most people don't walk in knowing the exact number, but they have a range in mind. What range would you be working within to make this happen?"
- If "I can't afford it": "Totally understand. A lot of people start with our Best-Seller Mastermind — a few sessions where you learn directly from the same team that's published over 500 authors and made 250 of them bestsellers."
- If "I need to talk to my spouse": "Would they be open to jumping on a quick call so they can hear the same information you did — and you can both make a decision together?"

### Stage 6 — BOOK THE STRATEGY CALL
**Goal:** Lock in a next step. Get them on the calendar. Send prep materials.

Key moves:
- "Here's what I can do — I'm going to get you booked onto a call where we take a deeper look at your goals and see whether this is the right fit for you."
- "Before that conversation, I'll send you our latest book — it has case studies and results from clients we've worked with. Would you be willing to set aside 30 minutes to go through it so the next discussion is much more productive?"
- If "I need to think about it": "Of course. What's holding you back from locking in a time right now? The call isn't a commitment — it's just a deeper conversation. What's the downside of getting on it?"
- If "bad timing": "The strategy call is exactly where you get clarity on whether now is actually the right time. That's what it's for."

---

## AI Coaching Behavior Rules

1. **One suggestion at a time.** Never show multiple suggestions simultaneously.
2. **Wait for the prospect to pause.** Don't suggest while they're mid-sentence. Wait ~1 second of silence.
3. **Don't rush stages.** Stay in the current stage until the rep has gotten what they need. Don't skip ahead.
4. **If the prospect shows emotion, acknowledge it first.** Before moving to the next question, the AI should suggest something like "That makes total sense" or "I appreciate you sharing that."
5. **On objections, go deeper — don't overcome.** If the prospect pushes back, suggest a question that explores the objection, not a rebuttal.
6. **Keep it short.** Suggestions should be 1-3 sentences max. The rep needs to glance at their phone and respond naturally.
7. **Minimum 10 seconds between suggestions.** Even if the prospect pauses multiple times, don't spam.
8. **Need at least 15 characters of new transcript** before generating a suggestion. Ignore noise.

---

## Tech Stack to Use

| Component | Tool | Why |
|-----------|------|-----|
| **Frontend** | React | Mobile-responsive web app. Must work on iPhone Safari and Android Chrome. |
| **Build Tool** | Vite | Fast builds, good dev experience. |
| **Server** | Node.js + Express | Lightweight, handles WebSocket well. |
| **Real-Time Communication** | WebSocket (ws library) | Need bidirectional real-time data — audio up, transcripts and suggestions down. |
| **Speech-to-Text** | Deepgram (Nova-2 model, REST API) | Best accuracy, fast, $200 free credits. Use their REST API — not WebSocket streaming. |
| **AI Coaching** | Claude Sonnet 4.6 (Anthropic SDK) | Best reasoning for complex multi-stage sales coaching. Model ID: `claude-sonnet-4-6`. |
| **Hosting** | TBD (currently Replit for MVP) | Needs to support Node.js + WebSocket. |

---

## API Details

### Deepgram (Speech-to-Text)

- **Endpoint:** `POST https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true`
- **Auth:** `Authorization: Token <DEEPGRAM_API_KEY>`
- **Content-Type:** `audio/wav`
- **Body:** Raw WAV audio bytes (RIFF header + 16-bit PCM, mono)
- **Response:** JSON — transcript is at `results.channels[0].alternatives[0].transcript`
- **Signup:** console.deepgram.com (free $200 credits, no credit card)

### Claude / Anthropic (AI Coaching)

- **SDK:** `@anthropic-ai/sdk` (npm)
- **Model:** `claude-sonnet-4-6`
- **Max tokens:** 500
- **System prompt:** The full 6-stage sales framework (see above)
- **User message format:** `"Conversation so far:\n{last 20 transcript lines}\n\nProspect just said: \"{latest text}\"\n\nWhat should I say next?"`
- **Expected response format (JSON):**
```
{
  "stage": "STAGE 3 — PROBLEM",
  "suggestions": [
    {
      "text": "What's making that unacceptable for you at this point?",
      "why": "Forces them to verbalize the pain — once they say it out loud, they own it",
      "priority": 1
    }
  ],
  "prospectSentiment": "Hesitant but opening up"
}
```
- **Signup:** console.anthropic.com (requires billing — ask admin to enable `claude-sonnet-4-6` on the API key)

---

## Audio Capture Requirements

The browser captures audio from the phone's microphone using the Web Audio API.

- **API:** `navigator.mediaDevices.getUserMedia({ audio: true })`
- **Settings:** Echo cancellation OFF, noise suppression OFF, auto gain control ON
  - Why: We need to hear both the rep AND the prospect coming through the laptop speakers. Echo cancellation would filter out the prospect's voice.
- **Processing:** ScriptProcessor captures raw float32 audio → convert to 16-bit int16 PCM → wrap in WAV file with RIFF header
- **Send interval:** Every 3 seconds, send the accumulated audio (up to last 30 seconds) to the server as binary via WebSocket
- **Max buffer:** 30 seconds sliding window. Drop oldest audio when buffer exceeds 30 seconds.
- **Must work on:** iPhone Safari (use `webkitAudioContext` fallback), Android Chrome, desktop Chrome

---

## WebSocket Protocol

Single WebSocket connection between client and server. Used for both binary audio and JSON messages.

### Client → Server

| Type | Format | Description |
|------|--------|-------------|
| Binary | Raw WAV bytes | Full audio recording (up to 30 sec), sent every 3 seconds |
| JSON | `{ "event": "start" }` | Manually start a coaching session |
| JSON | `{ "event": "stop" }` | End the coaching session |

### Server → Client

| Event | Data | Description |
|-------|------|-------------|
| `transcript` | `{ text, isFinal, speaker, confidence, timestamp }` | New transcript text (only the delta — not the full transcript) |
| `suggestion` | `{ stage, suggestions, prospectSentiment }` | Coaching suggestion from Claude |
| `status` | `{ status, message }` | Session status updates |
| `error` | `{ message }` | Error messages |

### Session Lifecycle

1. Client connects via WebSocket — no session created yet
2. Client starts sending binary audio — server auto-creates session on first audio chunk
3. Server creates a TranscriptionService (Deepgram) and CoachingEngine (Claude)
4. Audio → Deepgram → transcript → Claude → suggestion → client
5. Client sends `{ event: "stop" }` or disconnects → server cleans up session

---

## Server Logic

### Transcription Flow
1. Receive binary WAV audio from client
2. Ignore if < 1000 bytes (just headers, no real audio)
3. Keep only the latest audio buffer (if a new one arrives while processing, skip to the newer one)
4. POST the WAV to Deepgram REST API
5. Compare result to previous transcript — extract only the NEW text (delta)
6. Send delta to client as `transcript` event
7. Feed delta to coaching engine

### Coaching Flow
1. Each new transcript delta is added to conversation history (keep last 50, trim to 30 when full)
2. Also accumulated into a `pendingTranscript` buffer
3. When transcript arrives: clear any existing timer, set a new 1-second timer
4. If no new transcript arrives within 1 second (prospect paused): trigger suggestion generation
5. Rate limit: minimum 10 seconds between suggestions
6. Minimum 15 characters of pending text required
7. Send last 20 conversation turns + latest text to Claude
8. Parse Claude's JSON response
9. Send to client as `suggestion` event

---

## UI Requirements

### Layout

**Desktop (≥768px):** Two panels side by side
- Left: Live Transcript (scrolling text)
- Right: "Say This Next" (coaching suggestions)

**Mobile (<768px):** Tab switcher at the top
- "SAY THIS NEXT" tab (default — this is what the rep looks at during the call)
- "TRANSCRIPT" tab (secondary — for review)

### Header
- App name: "NEPQ Coach"
- Status indicator: green pulsing dot when listening, gray when stopped
- Start/Stop button

### Transcript Panel
- Scrolling list of transcript segments
- Auto-scrolls to bottom as new text arrives
- Empty state: "Place this device near your meeting and click Start Coaching."

### Suggestions Panel (Most Important)
- Shows ONLY the latest suggestion (not a list of all suggestions)
- Stage name at top (e.g., "STAGE 1 — CONNECT")
- The suggestion text in large, readable font (18px+) with a colored left border
- "Why it works" explanation below in smaller gray text
- "Prospect mood" indicator
- Previous 3 suggestions collapsed at the bottom for reference

### Visual Style
- Dark theme (background: #0f0f13, text: #e4e4e7)
- Accent color: indigo (#818cf8)
- Suggestion cards: dark card (#1e1e2e) with indigo left border

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPGRAM_API_KEY` | Yes | Deepgram API key for speech-to-text |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude coaching (must have `claude-sonnet-4-6` access) |
| `PORT` | No | Server port, defaults to 3001 |

---

## Deployment

- Node.js 18+ required
- NPM workspaces: root `package.json` manages `server/` and `client/` workspaces
- Build: `npm run build` (builds React client via Vite)
- Start: `npm start` (builds client, then starts Express server which serves the static build + WebSocket)
- Server serves the built React app as static files AND runs the WebSocket on the same port
- Must support HTTPS in production (mic access requires secure context)

---

## Known Constraints to Design Around

1. **No speaker diarization yet.** The mic hears both the rep and the prospect. The AI uses conversational context to figure out who said what. Future improvement: use Deepgram's `diarize=true` parameter.
2. **Deepgram REST, not streaming.** We send the full accumulated WAV each cycle (up to 30 seconds, ~2.8 MB). This works but uses more bandwidth than streaming would. Future improvement: switch to Deepgram WebSocket streaming.
3. **Audio grows per cycle.** Each 3-second send includes all audio since the last trim (up to 30 seconds). The 30-second cap prevents unbounded growth.
4. **Second device required.** The app runs on a separate phone/tablet — not on the same laptop as Google Meet. Running on the same device would cause audio feedback.

---

## Estimated Costs Per Call

| Service | ~Cost per 30-min call |
|---------|-----------------------|
| Deepgram | $0.15 |
| Claude Sonnet 4.6 | $0.30–0.50 |
| **Total** | **$0.50–0.65** |

---

## Definition of Done

The app is done when:
- [ ] Rep can open the URL on their iPhone and see the app
- [ ] Tapping "Start Coaching" captures mic audio
- [ ] Live transcript appears within 3-6 seconds of someone speaking
- [ ] AI coaching suggestion appears after prospect pauses for 1 second
- [ ] Suggestions follow the 6-stage framework appropriately
- [ ] Only 1 suggestion shown at a time
- [ ] No new suggestion while prospect is mid-sentence
- [ ] Minimum 10 seconds between suggestions
- [ ] "Stop" button ends the session cleanly
- [ ] Works on iPhone Safari and Android Chrome
- [ ] Dark theme, mobile-first responsive layout
- [ ] Tab switcher on mobile between coaching and transcript

---

## Questions? 

Everything you need is in this document. The sales framework, the API details, the behavior rules, the UI requirements, and the acceptance criteria are all above. Build it.

— Gerald
