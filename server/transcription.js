import WebSocket from "ws";
import { writeFileSync } from "fs";

export class TranscriptionService {
  constructor({ apiKey, onTranscript, onError }) {
    this.apiKey = apiKey;
    this.ws = null;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.keepAliveInterval = null;
    this._transcriptCount = 0;
  }

  async start() {
    const url = "wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=48000&channels=1&model=nova-2&smart_format=true&interim_results=true&utterance_end_ms=1500&vad_events=true&endpointing=500";

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, {
        headers: {
          Authorization: "Token " + this.apiKey,
        },
      });

      this.ws.on("open", () => {
        console.log("[Deepgram] WebSocket connected directly");

        this.keepAliveInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: "KeepAlive" }));
          }
        }, 10000);

        resolve();
      });

      this.ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.type === "Results") {
            const transcript = msg.channel?.alternatives?.[0]?.transcript || "";
            this._transcriptCount++;

            if (this._transcriptCount <= 5) {
              console.log("[Deepgram] Result #" + this._transcriptCount, "text:", JSON.stringify(transcript), "is_final:", msg.is_final, "speech_final:", msg.speech_final);
            }

            if (transcript.trim().length > 0) {
              console.log("[Deepgram] Transcript:", msg.is_final ? "FINAL" : "interim", transcript.slice(0, 80));
              this.onTranscript({
                text: transcript,
                isFinal: msg.is_final,
                speaker: msg.channel?.alternatives?.[0]?.words?.[0]?.speaker || 0,
                confidence: msg.channel?.alternatives?.[0]?.confidence || 0,
                timestamp: Date.now(),
              });
            }
          } else if (msg.type === "Metadata") {
            console.log("[Deepgram] Metadata:", JSON.stringify(msg).slice(0, 200));
          } else if (msg.type === "UtteranceEnd") {
            this.onTranscript({
              text: "",
              isFinal: true,
              isUtteranceEnd: true,
              timestamp: Date.now(),
            });
          } else {
            console.log("[Deepgram] Message type:", msg.type);
          }
        } catch (err) {
          console.error("[Deepgram] Parse error:", err.message);
        }
      });

      this.ws.on("error", (err) => {
        console.error("[Deepgram] Error:", err.message);
        this.onError(err.message);
        reject(err);
      });

      this.ws.on("close", (code, reason) => {
        console.log("[Deepgram] Closed:", code, reason?.toString());
        this._cleanup();
      });

      setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          reject(new Error("Deepgram connection timeout"));
        }
      }, 10000);
    });
  }

  sendAudio(audioBuffer) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Save first 5 seconds of audio for debugging
      if (!this._savedAudio) {
        this._audioChunks = this._audioChunks || [];
        this._audioChunks.push(Buffer.from(audioBuffer));
        this._totalSaved = (this._totalSaved || 0) + audioBuffer.length;
        if (this._totalSaved > 48000 * 2 * 5) { // 5 seconds at 48kHz 16-bit
          this._savedAudio = true;
          const combined = Buffer.concat(this._audioChunks);
          // Write WAV header + PCM data
          const header = Buffer.alloc(44);
          header.write("RIFF", 0);
          header.writeUInt32LE(36 + combined.length, 4);
          header.write("WAVE", 8);
          header.write("fmt ", 12);
          header.writeUInt32LE(16, 16);
          header.writeUInt16LE(1, 20);
          header.writeUInt16LE(1, 22);
          header.writeUInt32LE(48000, 24);
          header.writeUInt32LE(96000, 28);
          header.writeUInt16LE(2, 32);
          header.writeUInt16LE(16, 34);
          header.write("data", 36);
          header.writeUInt32LE(combined.length, 40);
          writeFileSync("/tmp/debug-audio.wav", Buffer.concat([header, combined]));
          console.log("[Deepgram] Saved debug audio to /tmp/debug-audio.wav (" + combined.length + " bytes)");
        }
      }
      this.ws.send(audioBuffer);
    }
  }
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
      try {
        this.ws.send(JSON.stringify({ type: "CloseStream" }));
      } catch {}
      this.ws.close();
      this.ws = null;
    }
  }
}
