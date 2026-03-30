# NEPQ Coach - AI Sales Meeting Assistant

Real-time AI coaching for sales calls using the NEPQ (Neuro-Emotional Persuasion Questions) methodology. A bot joins your Google Meet, transcribes the conversation live, and suggests what to say next.

## How It Works

1. **Paste your Google Meet link** into the dashboard
2. **A bot joins your meeting** as a participant (via Puppeteer)
3. **Live transcription** streams what the prospect is saying (via Deepgram)
4. **AI coaching** suggests NEPQ-based responses in real-time (via Claude)
5. **You see it all** on a sleek live dashboard

## Architecture

```
Google Meet  -->  Puppeteer Bot  -->  Audio Stream  -->  Deepgram (STT)
                                                              |
                                                        Transcript
                                                              |
Dashboard  <--  WebSocket  <--  Express Server  <--  Claude API (NEPQ Coach)
```

## Prerequisites

- **Node.js** 18+
- **Google Chrome** installed (Puppeteer uses it)
- **Deepgram API key** - [Get one here](https://console.deepgram.com) (free tier available)
- **Anthropic API key** - [Get one here](https://console.anthropic.com)

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
   Edit `.env` and add your API keys:
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

5. **Join a meeting:** Paste a Google Meet URL and click "Join Meeting"

## NEPQ Framework Stages

The AI coach identifies which stage of the NEPQ framework the conversation is in and suggests appropriate questions:

| Stage | Purpose | Example |
|-------|---------|---------|
| **Connecting** | Build rapport | "What made you decide to look into this?" |
| **Situation** | Understand current state | "How are you currently handling X?" |
| **Problem Awareness** | Surface pain points | "What happens when that doesn't work?" |
| **Solution Awareness** | Paint the ideal outcome | "What would the ideal outcome look like?" |
| **Consequence** | Create urgency | "What happens if nothing changes?" |
| **Commitment** | Guide to decision | "What would need to be true to move forward?" |

## Tech Stack

- **Server:** Node.js, Express, WebSocket (ws)
- **Meet Bot:** Puppeteer (headless Chrome)
- **Transcription:** Deepgram Nova-2 (real-time streaming)
- **AI Coaching:** Claude API (Anthropic)
- **Frontend:** React + Vite

## Project Structure

```
nepq-coach/
├── server/
│   ├── index.js              # Express server + API routes
│   ├── meetBot.js            # Puppeteer Google Meet bot
│   ├── transcription.js      # Deepgram real-time STT
│   ├── coachingEngine.js     # Claude API NEPQ coaching
│   └── websocket.js          # WebSocket manager
├── client/
│   ├── src/
│   │   ├── App.jsx           # Main app
│   │   ├── components/
│   │   │   ├── MeetingControls.jsx
│   │   │   ├── Transcript.jsx
│   │   │   └── Suggestions.jsx
│   │   └── hooks/
│   │       └── useWebSocket.js
│   └── index.html
├── .env.example
└── package.json
```

## Notes

- The bot joins as a visible participant named "NEPQ Coach (AI Assistant)" - your prospect will see it
- For best results, ensure the meeting audio is clear
- The AI suggestions update every ~3 seconds to avoid overwhelming you
- Conversation history is kept in memory (resets when you leave)
