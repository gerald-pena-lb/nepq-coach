import WebSocket from "ws";

export class TranscriptionService {
  constructor({ apiKey, onTranscript, onError }) {
    this.apiKey = apiKey;
    this.ws = null;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.ready = false;
    this._loggedFirstSend = false;
    this._loggedNotReady = false;
  }

  async start() {
    const url = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, {
        headers: {
          "xi-api-key": this.apiKey,
        },
      });

      this.ws.on("open", () => {
        console.log("[ElevenLabs STT] WebSocket opened, waiting for session_started...");
      });

      this.ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          const msgType = msg.message_type || msg.type;

          // Session ready
          if (msgType === "session_started") {
            console.log("[ElevenLabs STT] Session started:", msg.session_id);
            this.ready = true;
            resolve();
            return;
          }

          // Final transcript (auto-committed by VAD)
          if (msgType === "committed_transcript") {
            console.log("[ElevenLabs STT] Committed transcript:", msg.text?.slice(0, 100));
            if (msg.text && msg.text.trim().length > 0) {
              this.onTranscript({
                text: msg.text,
                isFinal: true,
                speaker: 0,
                confidence: 1,
                timestamp: Date.now(),
              });
            }
            return;
          }

          // Partial/interim transcript
          if (msgType === "partial_transcript") {
            if (msg.text && msg.text.trim().length > 0) {
              this.onTranscript({
                text: msg.text,
                isFinal: false,
                speaker: 0,
                confidence: 0.5,
                timestamp: Date.now(),
              });
            }
            return;
          }

          // Committed transcript with timestamps
          if (msgType === "committed_transcript_with_timestamps") {
            if (msg.text && msg.text.trim().length > 0) {
              this.onTranscript({
                text: msg.text,
                isFinal: true,
                speaker: 0,
                confidence: 1,
                timestamp: Date.now(),
              });
            }
            return;
          }

          // Log any unhandled message types
          console.log("[ElevenLabs STT] Unhandled:", msgType, JSON.stringify(msg).slice(0, 200));
        } catch (err) {
          console.error("[ElevenLabs STT] Parse error:", err.message);
        }
      });

      this.ws.on("error", (err) => {
        console.error("[ElevenLabs STT] Error:", err.message);
        this.onError(err.message || "Transcription error");
        if (!this.ready) reject(err);
      });

      this.ws.on("close", (code, reason) => {
        console.log("[ElevenLabs STT] Closed:", code, reason?.toString());
        this.ready = false;
      });

      // Timeout if session doesn't start within 10s
      setTimeout(() => {
        if (!this.ready) {
          reject(new Error("ElevenLabs STT connection timeout"));
        }
      }, 10000);
    });
  }

  sendAudio(audioBuffer) {
    if (!this.ready || this.ws?.readyState !== WebSocket.OPEN) {
      if (!this._loggedNotReady) {
        console.log("[ElevenLabs STT] Not ready. ready:", this.ready, "wsState:", this.ws?.readyState);
        this._loggedNotReady = true;
      }
      return;
    }

    const base64Audio = Buffer.from(audioBuffer).toString("base64");

    if (!this._loggedFirstSend) {
      console.log("[ElevenLabs STT] Sending first audio chunk, base64 length:", base64Audio.length);
      this._loggedFirstSend = true;
    }

    // ElevenLabs requires message_type (not type) and audio_base_64
    this.ws.send(JSON.stringify({
      message_type: "input_audio_chunk",
      audio_base_64: base64Audio,
    }));
  }

  async stop() {
    this.ready = false;
    if (this.ws) {
      try {
        this.ws.send(JSON.stringify({ type: "close" }));
      } catch { /* ignore */ }
      this.ws.close();
      this.ws = null;
    }
  }
}
