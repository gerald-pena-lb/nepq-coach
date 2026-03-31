import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

export class TranscriptionService {
  constructor({ apiKey, onTranscript, onError }) {
    this.deepgram = createClient(apiKey);
    this.connection = null;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.keepAliveInterval = null;
  }

  async start() {
    this.connection = this.deepgram.listen.live({
      model: "nova-2",
      language: "en",
      smart_format: true,
      interim_results: true,
      utterance_end_ms: 1500,
      vad_events: true,
      encoding: "linear16",
      sample_rate: 44100,
      channels: 1,
    });

    return new Promise((resolve, reject) => {
      this.connection.on(LiveTranscriptionEvents.Open, () => {
        console.log("[Deepgram] Connection opened");

        this.keepAliveInterval = setInterval(() => {
          if (this.connection) {
            this.connection.keepAlive();
          }
        }, 10000);

        resolve();
      });

      this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        // Log every transcript event, even empty ones
        if (!this._loggedFirstTranscript) {
          console.log("[Deepgram] First transcript event received. Text:", JSON.stringify(transcript), "is_final:", data.is_final);
          this._loggedFirstTranscript = true;
        }
        if (transcript && transcript.trim().length > 0) {
          console.log("[Deepgram] Transcript:", data.is_final ? "FINAL" : "interim", transcript.slice(0, 80));
          this.onTranscript({
            text: transcript,
            isFinal: data.is_final,
            speaker: data.channel?.alternatives?.[0]?.words?.[0]?.speaker || 0,
            confidence: data.channel?.alternatives?.[0]?.confidence || 0,
            timestamp: Date.now(),
          });
        }
      });

      this.connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
        this.onTranscript({
          text: "",
          isFinal: true,
          isUtteranceEnd: true,
          timestamp: Date.now(),
        });
      });

      this.connection.on(LiveTranscriptionEvents.Metadata, (data) => {
        console.log("[Deepgram] Metadata:", JSON.stringify(data).slice(0, 200));
      });

      this.connection.on(LiveTranscriptionEvents.Error, (err) => {
        console.error("[Deepgram] Error:", JSON.stringify(err).slice(0, 300));
        this.onError(err.message || "Transcription error");
        reject(err);
      });

      this.connection.on(LiveTranscriptionEvents.Close, () => {
        console.log("[Deepgram] Connection closed");
        this._cleanup();
      });
    });
  }

  sendAudio(audioBuffer) {
    if (this.connection) {
      this.connection.send(audioBuffer);
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
    if (this.connection) {
      this.connection.requestClose();
      this.connection = null;
    }
  }
}
