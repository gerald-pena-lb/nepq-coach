import https from "https";

export class TranscriptionService {
  constructor({ apiKey, onTranscript, onError }) {
    this.apiKey = apiKey;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.chunks = [];
    this.processing = false;
    this.interval = null;
    this.stopped = false;
  }

  async start() {
    console.log("[Transcription] Service started, waiting for audio...");

    // Process accumulated audio every 3 seconds
    this.interval = setInterval(() => {
      if (!this.processing && this.chunks.length > 0) {
        this._processChunks();
      }
    }, 3000);
  }

  sendAudio(audioBuffer) {
    if (!this.stopped) {
      this.chunks.push(Buffer.from(audioBuffer));
    }
  }

  async _processChunks() {
    if (this.chunks.length === 0) return;

    this.processing = true;
    const audioChunks = this.chunks.splice(0);
    const combined = Buffer.concat(audioChunks);

    console.log("[Transcription] Processing", audioChunks.length, "chunks,", combined.length, "bytes");

    try {
      const result = await this._transcribe(combined);
      if (result && result.trim().length > 0) {
        console.log("[Transcription] Got:", result.slice(0, 100));
        this.onTranscript({
          text: result,
          isFinal: true,
          speaker: 0,
          confidence: 1,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      console.error("[Transcription] Error:", err.message);
      this.onError(err.message);
    }

    this.processing = false;
  }

  _transcribe(audioBuffer) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "api.deepgram.com",
        path: "/v1/listen?model=nova-2&smart_format=true",
        method: "POST",
        headers: {
          Authorization: "Token " + this.apiKey,
          "Content-Type": "audio/webm",
        },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (d) => (data += d));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode !== 200) {
              reject(new Error("Deepgram API error: " + res.statusCode + " " + data.slice(0, 200)));
              return;
            }
            const transcript = json.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
            resolve(transcript);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on("error", reject);
      req.write(audioBuffer);
      req.end();
    });
  }

  async stop() {
    this.stopped = true;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    // Process any remaining audio
    if (this.chunks.length > 0) {
      await this._processChunks();
    }
  }
}
