import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { TranscriptionService } from "./transcription.js";
import { CoachingEngine } from "./coachingEngine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const sessions = new Map();

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", activeSessions: sessions.size });
});

wss.on("connection", (ws) => {
  console.log("[WS] Client connected");

  let transcription = null;
  let coaching = null;
  let starting = false;
  let audioChunkCount = 0;

  const send = (event, data) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ event, data }));
    }
  };

  async function ensureSession() {
    if (transcription || starting) return;
    starting = true;

    try {
      console.log("[Session] Auto-starting session on first audio...");

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
          console.error("[Session] Transcription error:", error);
          send("error", { message: `Transcription error: ${error}` });
        },
      });

      await transcription.start();
      sessions.set(ws, { transcription, coaching });
      send("status", { status: "ready", message: "Listening \u2014 coaching is live" });
      console.log("[Session] Started successfully, ready for audio");
    } catch (err) {
      console.error("[Session] Start failed:", err.message);
      send("error", { message: `Failed to start: ${err.message}` });
      transcription = null;
      coaching = null;
    } finally {
      starting = false;
    }
  }

  ws.on("message", async (message) => {
    // Binary data = audio chunk from browser
    if (Buffer.isBuffer(message) || message instanceof ArrayBuffer || (typeof message !== "string")) {
      audioChunkCount++;

      // Auto-start session on first audio chunk
      if (!transcription && !starting) {
        await ensureSession();
      }

      if (audioChunkCount === 1) {
        console.log("[Audio] First audio chunk received, size:", message.length, "bytes");
      }
      if (audioChunkCount % 100 === 0) {
        console.log("[Audio] Received", audioChunkCount, "chunks so far");
      }

      if (transcription) {
        transcription.sendAudio(message);
      }
      return;
    }

    // JSON control messages
    const str = typeof message === "string" ? message : message.toString();
    let parsed;
    try {
      parsed = JSON.parse(str);
    } catch {
      return;
    }

    console.log("[WS] Control message:", parsed.event);

    if (parsed.event === "start") {
      if (!transcription && !starting) {
        await ensureSession();
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
    audioChunkCount = 0;
    starting = false;
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

// Serve static frontend in production
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
