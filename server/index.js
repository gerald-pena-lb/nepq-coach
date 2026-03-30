import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { TranscriptionService } from "./transcription.js";
import { CoachingEngine } from "./coachingEngine.js";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Track active sessions per WebSocket client
const sessions = new Map();

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", activeSessions: sessions.size });
});

wss.on("connection", (ws) => {
  console.log("[WS] Client connected");

  let transcription = null;
  let coaching = null;

  const send = (event, data) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ event, data }));
    }
  };

  ws.on("message", async (message) => {
    // Binary data = audio chunk from browser
    if (typeof message !== "string" && !(message instanceof String)) {
      if (transcription) {
        transcription.sendAudio(message);
      }
      return;
    }

    // JSON control messages
    let parsed;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }

    if (parsed.event === "start") {
      // Client wants to start a coaching session
      if (transcription) {
        send("error", { message: "Session already active. Stop first." });
        return;
      }

      try {
        coaching = new CoachingEngine({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

        transcription = new TranscriptionService({
          apiKey: process.env.ELEVENLABS_API_KEY,
          onTranscript: async (transcript) => {
            send("transcript", transcript);

            if (transcript.isFinal && transcript.text) {
              coaching.addTranscript(transcript);
              console.log("[Coaching] Transcript added, pending:", coaching.pendingTranscript.length, "chars");
              const suggestion = await coaching.getSuggestion();
              if (suggestion) {
                console.log("[Coaching] Suggestion generated:", suggestion.stage);
                send("suggestion", suggestion);
              }
            }
          },
          onError: (error) => {
            send("error", { message: `Transcription error: ${error}` });
          },
        });

        await transcription.start();
        sessions.set(ws, { transcription, coaching });
        send("status", { status: "ready", message: "Ready — share your meeting tab audio to begin" });
        console.log("[Session] Started. Waiting for audio...");
      } catch (err) {
        console.error("[Session] Start failed:", err);
        send("error", { message: `Failed to start session: ${err.message}` });
        transcription = null;
        coaching = null;
      }
    }

    if (parsed.event === "stop") {
      await cleanup();
      send("status", { status: "stopped", message: "Coaching session ended" });
    }
  });

  async function cleanup() {
    if (transcription) {
      await transcription.stop().catch(() => {});
      transcription = null;
    }
    if (coaching) {
      coaching.reset();
      coaching = null;
    }
    sessions.delete(ws);
    console.log("[Session] Cleaned up");
  }

  ws.on("close", () => {
    console.log("[WS] Client disconnected");
    cleanup();
  });

  ws.on("error", (err) => {
    console.error("[WS] Error:", err.message);
    cleanup();
  });
});

// In production, serve the built React frontend
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[NEPQ Coach] Server running on http://localhost:${PORT}`);
  console.log(`[NEPQ Coach] WebSocket available on ws://localhost:${PORT}`);
});
