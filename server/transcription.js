import https from "https";

export class TranscriptionService {
  constructor({ apiKey, onTranscript, onError }) {
    this.apiKey = apiKey;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.allChunks = [];
    this.newChunks = 0;
    this.processing = false;
    this.interval = null;
    this.stopped = false;
    this.lastTranscriptLength = 0;
  }

  async start() {
    console.log("[Transcription] Service started, waiting for audio...");

    // Process accumulated audio every 3 seconds
    this.interval = setInterval(() => {
      if (!this.processing && this.newChunks > 0) {
        this._processChunks();
      }
    }, 3000);
  }

  sendAudio(audioBuffer) {
    if (!this.stopped) {
      this.allChunks.push(Buffer.from(audioBuffer));
      this.newChunks++;
    }
  }

  async _processChunks() {
    if (this.newChunks === 0) return;

    this.processing = true;
    this.newChunks = 0;

    // Send ALL accumulated chunks as one continuous webm stream
    // because webm chunks are not independently decodable
    const combined = Buffer.concat(this.allChunks);

    console.log("[Transcription] Processing", audioChunks.length, "chunks,", combined.length, "bytes");

    try {
      const fullResult = await this._transcribe(combined);
      // Only emit the NEW portion of the transcript
      const newText = fullResult.slice(this.lastTranscriptLength).trim();
      this.lastTranscriptLength = fullResult.length;

      if (newText.length > 0) {
        console.log("[Transcription] New text:", newText.slice(0, 100));
        this.onTranscript({
          text: newText,
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
    if (this.newChunks > 0) {
      await this._processChunks();
    }
  }
}
