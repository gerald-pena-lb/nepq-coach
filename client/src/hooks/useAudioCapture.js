import { useRef, useCallback, useState } from "react";

export function useAudioCapture({ onAudioData }) {
  const [isCapturing, setIsCapturing] = useState(false);
  const streamRef = useRef(null);
  const contextRef = useRef(null);
  const processorRef = useRef(null);
  const onAudioDataRef = useRef(onAudioData);
  onAudioDataRef.current = onAudioData;

  const start = useCallback(async () => {
    try {
      console.log("[AudioCapture] Requesting getDisplayMedia...");

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          sampleRate: 16000,
          channelCount: 1,
        },
      });

      console.log("[AudioCapture] Got stream. Audio tracks:", stream.getAudioTracks().length);

      streamRef.current = stream;

      // Don't stop video tracks immediately — it can kill the audio stream in some browsers
      // Just ignore the video data

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        // Stop everything if no audio
        stream.getTracks().forEach(t => t.stop());
        throw new Error("No audio track — make sure you checked 'Share audio' when selecting the tab");
      }

      console.log("[AudioCapture] Audio track:", audioTrack.label, "settings:", JSON.stringify(audioTrack.getSettings()));

      audioTrack.onended = () => {
        console.log("[AudioCapture] Audio track ended");
        stop();
      };

      // Create AudioContext at 16kHz to match what ElevenLabs expects
      const audioContext = new AudioContext({ sampleRate: 16000 });
      contextRef.current = audioContext;

      console.log("[AudioCapture] AudioContext state:", audioContext.state, "sampleRate:", audioContext.sampleRate);

      if (audioContext.state === "suspended") {
        await audioContext.resume();
        console.log("[AudioCapture] Resumed AudioContext");
      }

      const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      let chunkCount = 0;
      processor.onaudioprocess = (event) => {
        const float32Data = event.inputBuffer.getChannelData(0);

        // Check if there's actual audio data (not all zeros)
        let hasAudio = false;
        for (let i = 0; i < float32Data.length; i += 100) {
          if (Math.abs(float32Data[i]) > 0.0001) {
            hasAudio = true;
            break;
          }
        }

        // Convert float32 [-1, 1] to int16 [-32768, 32767]
        const int16Array = new Int16Array(float32Data.length);
        for (let i = 0; i < float32Data.length; i++) {
          const s = Math.max(-1, Math.min(1, float32Data[i]));
          int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        chunkCount++;
        if (chunkCount === 1 || chunkCount % 50 === 0) {
          console.log("[AudioCapture] Chunk #" + chunkCount, "size:", int16Array.buffer.byteLength, "bytes, hasAudio:", hasAudio);
        }

        // Always send — even silence keeps the connection alive
        onAudioDataRef.current(int16Array.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Now safe to stop video tracks after audio pipeline is established
      setTimeout(() => {
        stream.getVideoTracks().forEach(t => t.stop());
        console.log("[AudioCapture] Video tracks stopped (delayed)");
      }, 2000);

      console.log("[AudioCapture] Pipeline connected");
      setIsCapturing(true);
    } catch (err) {
      console.error("[AudioCapture] Failed:", err);
      throw err;
    }
  }, []);

  const stop = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (contextRef.current) {
      contextRef.current.close().catch(() => {});
      contextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
    console.log("[AudioCapture] Stopped");
  }, []);

  return { isCapturing, start, stop };
}
