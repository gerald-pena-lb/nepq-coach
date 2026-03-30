import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketManager } from "./websocket.js";
import { MeetBot } from "./meetBot.js";
import { TranscriptionService } from "./transcription.js";
import { CoachingEngine } from "./coachingEngine.js";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wsManager = new WebSocketManager(server);

let activeMeetBot = null;
let activeTranscription = null;
let activeCoaching = null;

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", meeting: activeMeetBot ? "active" : "idle" });
});

// Join a meeting
app.post("/api/meeting/join", async (req, res) => {
  const { meetingUrl } = req.body;

  if (!meetingUrl) {
    return res.status(400).json({ error: "meetingUrl is required" });
  }

  if (!meetingUrl.includes("meet.google.com")) {
    return res.status(400).json({ error: "Only Google Meet URLs are supported" });
  }

  if (activeMeetBot) {
    return res.status(409).json({ error: "Already in a meeting. Leave first." });
  }

  try {
    // Initialize coaching engine
    activeCoaching = new CoachingEngine({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Initialize transcription
    activeTranscription = new TranscriptionService({
      apiKey: process.env.DEEPGRAM_API_KEY,
      onTranscript: async (transcript) => {
        // Send transcript to frontend
        wsManager.sendTranscript(transcript);

        // Feed to coaching engine
        if (transcript.isFinal && transcript.text) {
          activeCoaching.addTranscript(transcript);

          // Get AI suggestion
          const suggestion = await activeCoaching.getSuggestion();
          if (suggestion) {
            wsManager.sendSuggestion(suggestion);
          }
        }
      },
      onError: (error) => {
        wsManager.sendError(`Transcription error: ${error}`);
      },
    });

    // Start transcription connection
    await activeTranscription.start();

    // Initialize and join with the bot
    activeMeetBot = new MeetBot({
      onAudioData: (buffer) => {
        if (activeTranscription) {
          activeTranscription.sendAudio(buffer);
        }
      },
      onStatusChange: (status, message) => {
        console.log(`[Meeting] ${status}: ${message}`);
        wsManager.sendStatus(status, message);
      },
    });

    // Don't await the full join - it takes time. Respond immediately.
    activeMeetBot.join(meetingUrl).catch((err) => {
      console.error("[Meeting] Join failed:", err);
      wsManager.sendError(`Failed to join meeting: ${err.message}`);
      cleanup();
    });

    res.json({ status: "joining", message: "Bot is joining the meeting..." });
  } catch (err) {
    console.error("[Meeting] Setup failed:", err);
    cleanup();
    res.status(500).json({ error: err.message });
  }
});

// Leave a meeting
app.post("/api/meeting/leave", async (req, res) => {
  if (!activeMeetBot) {
    return res.status(404).json({ error: "Not in a meeting" });
  }

  await cleanup();
  res.json({ status: "left", message: "Left the meeting" });
});

// Get conversation history
app.get("/api/meeting/history", (req, res) => {
  if (!activeCoaching) {
    return res.json({ history: [] });
  }
  res.json({ history: activeCoaching.conversationHistory });
});

async function cleanup() {
  if (activeMeetBot) {
    await activeMeetBot.leave().catch(() => {});
    activeMeetBot = null;
  }
  if (activeTranscription) {
    await activeTranscription.stop().catch(() => {});
    activeTranscription = null;
  }
  if (activeCoaching) {
    activeCoaching.reset();
    activeCoaching = null;
  }
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[NEPQ Coach] Server running on http://localhost:${PORT}`);
  console.log(`[NEPQ Coach] WebSocket available on ws://localhost:${PORT}`);
});
