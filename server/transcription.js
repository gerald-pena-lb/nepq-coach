import WebSocket from "ws";

export class TranscriptionService {
  constructor({ apiKey, onTranscript, onError }) {
    this.apiKey = apiKey;
    this.ws = null;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.keepAliveInterval = null;
  }

  async start() {
    const url = "wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v1&language_code=en";

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, {
        headers: {
          "xi-api-key": this.apiKey,
        },
      });

      this.ws.on("open", () => {
        console.log("[ElevenLabs STT] Connection opened");

        // Send initial config
        this.ws.send(JSON.stringify({
          type: "config",
          encoding: "pcm_16000",
          sample_rate: 16000,
        }));

        // Keep alive every 10s
        this.keepAliveInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.ping();
          }
        }, 10000);

        resolve();
      });

      this.ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.type === "transcription" || msg.type === "transcript") {
            const text = msg.text || msg.channel?.alternatives?.[0]?.transcript || "";
            if (text.trim().length > 0) {
              const isFinal = msg.type === "transcription" ||
                msg.is_final === true ||
                msg.committed === true;

              this.onTranscript({
                text: text,
                isFinal: isFinal,
                speaker: msg.speaker || 0,
                confidence: msg.confidence || 0,
                timestamp: Date.now(),
              });
            }
          }

          // Handle partial/interim results
          if (msg.type === "partial_transcription" || msg.type === "partial_transcript") {
            const text = msg.text || "";
            if (text.trim().length > 0) {
              this.onTranscript({
                text: text,
                isFinal: false,
                speaker: msg.speaker || 0,
                confidence: msg.confidence || 0,
                timestamp: Date.now(),
              });
            }
          }
        } catch (err) {
          // Ignore non-JSON messages
        }
      });

      this.ws.on("error", (err) => {
        console.error("[ElevenLabs STT] Error:", err.message);
        this.onError(err.message || "Transcription error");
        reject(err);
      });

      this.ws.on("close", (code, reason) => {
        console.log("[ElevenLabs STT] Connection closed:", code, reason?.toString());
        this._cleanup();
      });
    });
  }

  sendAudio(audioBuffer) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Send raw PCM audio as binary
      this.ws.send(audioBuffer);
    }
  }

  _cleanup() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  async stop() {
    this._cleanup();
    if (this.ws) {
      // Send end-of-stream signal
      try {
        this.ws.send(JSON.stringify({ type: "close" }));
      } catch { /* ignore */ }
      this.ws.close();
      this.ws = null;
    }
  }
}
