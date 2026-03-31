import https from "https";

export class TranscriptionService {
  constructor({ apiKey, onTranscript, onError }) {
    this.apiKey = apiKey;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.lastTranscript = "";
    this.processing = false;
    this.latestAudio = null;
    this.stopped = false;
  }

  async start() {
    console.log("[Transcription] Ready");
  }

  sendAudio(audioBuffer) {
    if (this.stopped) return;

    const buf = Buffer.from(audioBuffer);

    // Ignore tiny chunks (webm headers, etc)
    if (buf.length < 1000) return;

    // Each message from client is the FULL recording so far
    // Just keep the latest one
    this.latestAudio = buf;

    if (!this.processing) {
      this._process();
    }
  }

  async _process() {
    if (!this.latestAudio || this.processing) return;

    this.processing = true;
    const audio = this.latestAudio;
    this.latestAudio = null;

    console.log("[Transcription] Sending", audio.length, "bytes to Deepgram...");

    try {
      const result = await this._callDeepgram(audio);
      const newText = result.slice(this.lastTranscript.length).trim();

      if (newText.length > 0) {
        console.log("[Transcription]", newText.slice(0, 120));
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
      console.error("[Transcription] Error:", err.message.slice(0, 200));
    }

    this.processing = false;

    if (this.latestAudio) {
      this._process();
    }
  }

  _callDeepgram(audioBuffer) {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: "api.deepgram.com",
        path: "/v1/listen?model=nova-2&smart_format=true",
        method: "POST",
        headers: {
          Authorization: "Token " + this.apiKey,
          "Content-Type": "application/octet-stream",
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
    this.latestAudio = null;
  }
}
