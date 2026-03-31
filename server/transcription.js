import https from "https";

export class TranscriptionService {
  constructor({ apiKey, onTranscript, onError }) {
    this.apiKey = apiKey;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.lastTranscript = "";
    this.processing = false;
    this.pendingAudio = null;
    this.stopped = false;
  }

  async start() {
    console.log("[Transcription] Service started");
  }

  sendAudio(audioBuffer) {
    if (this.stopped) return;

    // Each message is the full recording so far — just keep the latest
    this.pendingAudio = Buffer.from(audioBuffer);

    if (!this.processing) {
      this._process();
    }
  }

  async _process() {
    if (!this.pendingAudio || this.processing) return;

    this.processing = true;
    const audio = this.pendingAudio;
    this.pendingAudio = null;

    console.log("[Transcription] Sending", audio.length, "bytes to Deepgram");

    try {
      const result = await this._transcribe(audio);
      const newText = result.slice(this.lastTranscript.length).trim();

      if (newText.length > 0) {
        console.log("[Transcription] New:", newText.slice(0, 100));
        this.lastTranscript = result;
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
    }

    this.processing = false;

    // Process next pending audio if any
    if (this.pendingAudio) {
      this._process();
    }
  }

  _transcribe(audioBuffer) {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: "api.deepgram.com",
        path: "/v1/listen?model=nova-2&smart_format=true",
        method: "POST",
        headers: {
          Authorization: "Token " + this.apiKey,
          "Content-Type": "audio/webm",
        },
      }, (res) => {
        let data = "";
        res.on("data", (d) => (data += d));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(data.slice(0, 200)));
            return;
          }
          try {
            const json = JSON.parse(data);
            resolve(json.results?.channels?.[0]?.alternatives?.[0]?.transcript || "");
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
    this.lastTranscript = "";
  }
}
