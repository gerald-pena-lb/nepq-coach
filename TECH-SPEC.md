# NEPQ Coach — Technical Specification

**Version:** 1.0  
**Last Updated:** April 2026  
**Status:** MVP — Functional, deployed on Replit  

---

## 1. Overview

NEPQ Coach is a real-time AI sales coaching assistant. A sales rep opens the app on a second device (phone/tablet), places it near their computer during a Google Meet call, and receives live coaching suggestions based on a proprietary 6-stage NEPQ sales framework.

### How It Works
1. Rep opens the web app on a separate device
2. Clicks "Start Coaching" — app captures room audio via the device microphone
3. Audio is sent to the server every 3 seconds as a WAV file
4. Server transcribes speech using Deepgram's Nova-2 model
5. When the prospect pauses (1 second of silence), the server sends the conversation context to Claude Sonnet 4.6
6. Claude returns a single coaching suggestion based on the 6-stage NEPQ framework
7. The suggestion appears on the rep's screen in real time

### Architecture Diagram
```
┌──────────────────┐     WebSocket (binary WAV)     ┌──────────────────┐
│   Browser/Phone  │ ─────────────────────────────▶ │   Node.js Server │
│                  │                                 │   (Express + WS) │
│  - Mic capture   │ ◀───────────────────────────── │                  │
│  - WAV encoding  │     WebSocket (JSON events)     │  ┌────────────┐ │
│  - React UI      │                                 │  │ Deepgram   │ │
│                  │                                 │  │ REST API   │ │
│  ┌────────────┐ │                                 │  │ (nova-2)   │ │
│  │ Transcript │ │                                 │  └─────┬──────┘ │
│  │ Panel      │ │                                 │        │         │
│  ├────────────┤ │                                 │        ▼         │
│  │ "Say This  │ │                                 │  ┌────────────┐ │
│  │  Next"     │ │                                 │  │ Claude API │ │
│  │ Panel      │ │                                 │  │ Sonnet 4.6 │ │
│  └────────────┘ │                                 │  └────────────┘ │
└──────────────────┘                                 └──────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18.3 + Vite 6 | Single-page web app |
| **Server** | Node.js 20, Express 4, ws 8 | API server + WebSocket |
| **Speech-to-Text** | Deepgram Nova-2 (REST API) | Audio transcription |
| **AI Coaching** | Claude Sonnet 4.6 (Anthropic SDK) | NEPQ suggestion generation |
| **Hosting** | Replit (free tier) | Deployment |
| **Audio Capture** | Web Audio API (ScriptProcessor) | Browser mic → WAV encoding |

---

## 3. Server Components

### 3.1 `server/index.js` — Main Server

**Responsibilities:**
- Express HTTP server serving static frontend build
- WebSocket server handling bidirectional client communication
- Session lifecycle management (auto-start on first audio, cleanup on disconnect)
- Orchestrates transcription → coaching pipeline
- 1-second debounce timer: waits for prospect to pause before triggering coaching

**WebSocket Protocol:**

| Direction | Type | Format | Description |
|-----------|------|--------|-------------|
| Client → Server | Binary | WAV audio bytes | Full recording (up to 30 sec) sent every 3 sec |
| Client → Server | JSON | `{ event: "start" }` | Manual session start |
| Client → Server | JSON | `{ event: "stop" }` | End session |
| Server → Client | JSON | `{ event: "transcript", data: {...} }` | New transcript text |
| Server → Client | JSON | `{ event: "suggestion", data: {...} }` | NEPQ coaching suggestion |
| Server → Client | JSON | `{ event: "status", data: {...} }` | Session status update |
| Server → Client | JSON | `{ event: "error", data: {...} }` | Error message |

**Session Auto-Start:** The server creates a `TranscriptionService` and `CoachingEngine` on the first binary audio message. No explicit "start" message is required from the client.

**Suggestion Debounce Logic:**
```
Transcript arrives → clearTimeout(previous timer)
                   → setTimeout(generateSuggestion, 1000ms)
                   → If new transcript arrives within 1s, timer resets
                   → Suggestion only fires after 1 second of silence
```

---

### 3.2 `server/transcription.js` — TranscriptionService

**Strategy:** Deepgram REST API (not WebSocket streaming)

**Why REST instead of WebSocket streaming:**
- Deepgram's WebSocket streaming had compatibility issues with browser-generated audio formats
- REST API was proven to work reliably with WAV audio
- Simplifies error handling and retry logic

**Audio Processing Flow:**
1. Client sends full WAV recording (up to 30 seconds, ~2.8 MB) every 3 seconds
2. Server keeps only the latest buffer (deduplication — skips if previous request still in-flight)
3. Sends WAV to `POST https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true`
4. Extracts transcript text from JSON response
5. Computes delta (new text since last transcription) to avoid duplicate output
6. Calls `onTranscript()` callback with new text only

**Key Parameters:**

| Parameter | Value | Notes |
|-----------|-------|-------|
| Model | `nova-2` | Deepgram's latest, most accurate model |
| Content-Type | `audio/wav` | WAV with RIFF header, 16-bit PCM, mono |
| Smart Format | `true` | Adds punctuation and capitalization |
| Min audio size | 1000 bytes | Ignores tiny chunks (headers only) |

---

### 3.3 `server/coachingEngine.js` — CoachingEngine

**Model:** `claude-sonnet-4-6` via `@anthropic-ai/sdk`

**System Prompt:** A ~2000 token prompt containing the complete 6-stage NEPQ sales framework:

| Stage | Name | Goal |
|-------|------|------|
| 1 | **CONNECT** | Establish rapport, get prospect to own the decision to meet |
| 2 | **SITUATION** | Understand current state, goals, what they've tried |
| 3 | **PROBLEM** | Get prospect to articulate why staying put is unacceptable |
| 4 | **CONSEQUENCE** | Help them feel the emotional cost of inaction |
| 5 | **OPEN WALLET TEST** | Qualify financial seriousness without revealing price |
| 6 | **BOOK THE STRATEGY CALL** | Lock in next step, send materials, prep the closer |

Each stage includes specific example questions, objection handlers, and transition triggers. The LLM uses this as a flexible guide, not a rigid script.

**Prompt Structure:**
```
System: [Full NEPQ framework with all 6 stages, rules, output format]
User:   "Conversation so far:\n{last 20 turns}\n\nProspect just said: \"{new text}\"\n\nWhat should I say next?"
```

**Response Format (JSON):**
```json
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

**Rate Limiting:**

| Constraint | Value | Purpose |
|------------|-------|---------|
| Min interval | 10 seconds | Prevents suggestion spam |
| Min text length | 15 characters | Ignores noise/short utterances |
| Silence debounce | 1 second | Waits for prospect to finish thought |
| History window | Last 20 turns | Keeps context manageable |
| Max history | 50 entries (auto-trim to 30) | Memory management |

**Error Handling:**
- `NotFoundError` → Log "ask admin to enable model" (API key permissions)
- `AuthenticationError` → Log "invalid API key"
- `RateLimitError` → Silently skip, retry next cycle
- Generic `APIError` → Log status + message
- All errors return `null` (no suggestion sent to client)

---

## 4. Client Components

### 4.1 `client/src/hooks/useAudioCapture.js`

**Audio Pipeline:**
```
getUserMedia({ audio }) → AudioContext → ScriptProcessor(4096) → Int16 PCM → WAV
```

**Key Design Decisions:**

| Decision | Value | Rationale |
|----------|-------|-----------|
| Echo cancellation | `false` | Needs to hear both sides of conversation |
| Noise suppression | `false` | Prospect voice may be from speaker |
| Auto gain control | `true` | Normalizes volume from room mic |
| Buffer size | 4096 samples | Balance between latency and efficiency |
| Send interval | 3 seconds | Trade-off: faster = more API calls, slower = delayed coaching |
| Max buffer | 30 seconds | Prevents unbounded memory growth |
| Audio format | WAV (RIFF, 16-bit PCM, mono) | Universal compatibility with Deepgram |

**WAV Encoding:** Custom `createWavBuffer()` function builds a standard RIFF WAV header (44 bytes) followed by raw int16 PCM samples. The header includes the actual AudioContext sample rate (typically 48kHz on desktop, 44.1kHz on mobile).

**Sliding Window:** After 30 seconds, oldest audio chunks are dropped from the front of the buffer to prevent memory growth. Each send includes up to 30 seconds of audio.

---

### 4.2 `client/src/hooks/useWebSocket.js`

- Auto-detects `ws://` vs `wss://` based on page protocol
- Binary type set to `arraybuffer` for audio transmission
- Auto-reconnects on close with 2-second delay
- Event dispatch: JSON messages parsed and routed to registered handlers
- `send(event, data)` for JSON control messages
- `sendBinary(buffer)` for raw audio data

---

### 4.3 `client/src/App.jsx`

**State Management:**

| State | Type | Source |
|-------|------|--------|
| `transcripts` | Array | WebSocket `"transcript"` events |
| `suggestions` | Array | WebSocket `"suggestion"` events |
| `status` | Object | WebSocket `"status"` events |
| `isActive` | Boolean | Local (start/stop toggle) |
| `tab` | String | Local ("coach" or "transcript", mobile only) |

**Responsive Layout:**
- Desktop (≥768px): Side-by-side panels — transcript left, coaching right
- Mobile (<768px): Tab switcher — "SAY THIS NEXT" and "TRANSCRIPT" tabs, full-width single panel

---

### 4.4 UI Components

**MeetingControls:** Header bar with logo, status indicator (pulsing green dot when active), start/stop button, error display. Responsive — hides subtitle on mobile.

**Transcript:** Scrolling list of transcribed text segments. Auto-scrolls to bottom on new entries. Empty state prompts user to place device near meeting.

**Suggestions:** Shows the latest coaching suggestion prominently with:
- NEPQ stage badge (e.g., "STAGE 1 — CONNECT")
- Quoted suggestion text (18px, indigo left border)
- "Why it works" explanation
- Prospect sentiment indicator
- Collapsed list of previous 3 suggestions below

---

## 5. Data Flow & Latency

**End-to-end latency: ~4–6 seconds from speech to coaching suggestion**

| Step | Duration | Notes |
|------|----------|-------|
| Audio batching | 0–3 sec | Waits for next 3-second interval |
| Network upload | 0.2–0.5 sec | WAV file ~2.8 MB max |
| Deepgram transcription | 0.5–1 sec | REST API call |
| Silence detection | 1 sec | Debounce timer |
| Claude API call | 1–2 sec | Sonnet 4.6, 500 max tokens |
| Network + render | 0.1–0.2 sec | WebSocket JSON + React update |

---

## 6. Environment & Deployment

### Required Environment Variables

| Variable | Service | How to Get |
|----------|---------|------------|
| `DEEPGRAM_API_KEY` | Speech-to-text | [console.deepgram.com](https://console.deepgram.com) — $200 free credits |
| `ANTHROPIC_API_KEY` | AI coaching | [console.anthropic.com](https://console.anthropic.com) — requires billing |
| `PORT` | Server | Default: 3001 |

### Deployment (Replit)

- **Build command:** `npm run build --workspace=client`
- **Start command:** `npm run start --workspace=server`
- **Start script:** Builds client, then starts Express server which serves the static build
- **Nix config:** `replit.nix` specifies Node.js 16.x (Replit's available version; Node 20 available at runtime)

### Cost Estimates (per 30-minute call)

| Service | Cost | Notes |
|---------|------|-------|
| Deepgram | ~$0.15 | ~10 API calls × ~30 sec each |
| Claude Sonnet 4.6 | ~$0.30–0.50 | ~10–15 suggestions × ~600 tokens each |
| **Total** | **~$0.50–0.65** | Per 30-minute sales call |

---

## 7. File Structure

```
nepq-coach/
├── package.json                  # Monorepo: npm workspaces
├── .env.example                  # Environment variable template
├── .gitignore
├── render.yaml                   # Render.com deploy config
├── glitch.json                   # Glitch deploy config
├── .replit                       # Replit run config
├── replit.nix                    # Replit Nix environment
├── README.md
│
├── server/
│   ├── package.json              # Server deps: anthropic, deepgram, express, ws
│   ├── index.js                  # Express + WebSocket server, session management
│   ├── transcription.js          # Deepgram REST API integration
│   └── coachingEngine.js         # Claude Sonnet 4.6 + NEPQ framework
│
└── client/
    ├── package.json              # Client deps: react, react-dom, vite
    ├── vite.config.js            # Dev server + proxy config
    ├── index.html                # SPA entry point
    └── src/
        ├── main.jsx              # React mount
        ├── App.jsx               # Main app: state, layout, responsive tabs
        ├── components/
        │   ├── MeetingControls.jsx   # Header: start/stop, status
        │   ├── Transcript.jsx        # Live transcript display
        │   └── Suggestions.jsx       # NEPQ coaching cards
        └── hooks/
            ├── useWebSocket.js       # WS connection, auto-reconnect
            └── useAudioCapture.js    # Mic → WAV → binary send
```

---

## 8. Known Limitations & Future Work

### Current Limitations
1. **No speaker diarization** — Cannot distinguish prospect voice from rep voice. Transcribes everything the mic picks up.
2. **Deepgram REST (not streaming)** — Re-sends full audio each cycle. Works but uses more bandwidth than streaming.
3. **Audio grows linearly** — 30-second sliding window caps memory, but each WAV upload is ~2.8 MB.
4. **Single device** — App must be opened on a separate device with its own mic; cannot capture Google Meet audio from the same machine.
5. **Anthropic API key access** — Requires admin-enabled model permissions for Claude Sonnet 4.6.

### Recommended Improvements
1. **Switch to Deepgram WebSocket streaming** — Lower latency, smaller payloads, real-time interim results
2. **Add speaker diarization** — Deepgram supports `diarize=true` to identify different speakers
3. **Compress audio** — Use Opus/WebM encoding instead of raw WAV to reduce upload size by ~90%
4. **Add conversation summary** — Post-call summary with key objections, stage progression, and follow-up items
5. **Persistent sessions** — Save transcripts and coaching history to a database for review
6. **Custom script editor** — Let reps customize the NEPQ stages and example questions via a settings page
7. **Multi-language support** — Deepgram supports 30+ languages; add language selection
8. **Auth & team management** — User accounts, team dashboards, call analytics
