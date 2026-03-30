# NEPQ Coach - AI Sales Meeting Assistant

Real-time AI coaching for sales calls using the NEPQ (Neuro-Emotional Persuasion Questions) methodology. Captures your Google Meet audio directly from your browser, transcribes it live, and suggests what to say next.

**No downloads. No bots joining your call. No extensions. Just a web app.**

## How It Works

1. Open this app in one browser tab, your Google Meet in another
2. Click **Start Coaching**
3. Your browser asks you to share a tab — select your Google Meet tab and check **"Share audio"**
4. The app transcribes the conversation in real-time
5. AI suggests NEPQ-based responses as the prospect speaks

Your prospect never sees anything — no bot joins the call. The audio is captured directly from your browser tab.

## Architecture

```
Your Browser Tab (Google Meet)
        |
        | getDisplayMedia (tab audio sharing)
        v
NEPQ Coach Web App (another tab)
        |
        | WebSocket (binary audio stream)
        v
Express Server
   ├── Deepgram (real-time transcription)
   └── Claude API (NEPQ coaching suggestions)
        |
        | WebSocket (JSON)
        v
NEPQ Coach Web App (live dashboard)
```

## Prerequisites

- **Node.js** 18+
- **Chrome, Edge, or any Chromium browser** (for tab audio sharing via `getDisplayMedia`)
- **Deepgram API key** — [Get one here](https://console.deepgram.com) (free tier available)
- **Anthropic API key** — [Get one here](https://console.anthropic.com)

## Setup

1. **Clone and install:**
   ```bash
   git clone <repo-url>
   cd nepq-coach
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Add your API keys to `.env`:
   ```
   DEEPGRAM_API_KEY=your_key_here
   ANTHROPIC_API_KEY=your_key_here
   ```

3. **Run the app:**
   ```bash
   npm run dev
   ```
   This starts both the server (port 3001) and the frontend (port 5173).

4. **Open the dashboard:** Go to `http://localhost:5173`

5. **Start coaching:** Click "Start Coaching", select your Google Meet tab, and check "Share audio"

## Deploying Online

To use this fully online (no local setup), deploy the server to any Node.js host:

- **Railway / Render / Fly.io** — Deploy the `server/` directory, set environment variables
- **Vercel** — Deploy the `client/` as a static site, point the API proxy to your server URL
- Or run both behind a single service on Railway/Render

## NEPQ Framework Stages

The AI coach identifies which stage of the NEPQ framework the conversation is in:

| Stage | Purpose | Example |
|-------|---------|---------|
| **Connecting** | Build rapport | "What made you decide to look into this?" |
| **Situation** | Understand current state | "How are you currently handling X?" |
| **Problem Awareness** | Surface pain points | "What happens when that doesn't work?" |
| **Solution Awareness** | Paint the ideal outcome | "What would the ideal outcome look like?" |
| **Consequence** | Create urgency | "What happens if nothing changes?" |
| **Commitment** | Guide to decision | "What would need to be true to move forward?" |

## Tech Stack

- **Frontend:** React + Vite (browser audio capture via `getDisplayMedia`)
- **Server:** Node.js, Express, WebSocket
- **Transcription:** Deepgram Nova-2 (real-time streaming)
- **AI Coaching:** Claude API (Anthropic)

## Project Structure

```
nepq-coach/
├── server/
│   ├── index.js              # Express + WebSocket server
│   ├── transcription.js      # Deepgram real-time STT
│   └── coachingEngine.js     # Claude API NEPQ coaching
├── client/
│   ├── src/
│   │   ├── App.jsx           # Main app
│   │   ├── components/
│   │   │   ├── MeetingControls.jsx
│   │   │   ├── Transcript.jsx
│   │   │   └── Suggestions.jsx
│   │   └── hooks/
│   │       ├── useWebSocket.js
│   │       └── useAudioCapture.js
│   └── index.html
├── .env.example
└── package.json
```

## Notes

- **No bot joins your call** — audio is captured from your browser, not from a bot participant
- **Chrome/Edge required** — `getDisplayMedia` with audio sharing is a Chromium feature
- **"Share audio" checkbox** — You must check this when the browser asks which tab to share, otherwise no audio is captured
- The AI suggestions update every ~3 seconds to avoid overwhelming you
- Conversation history is kept in memory (resets when you stop)
