import { useRef, useCallback, useState } from "react";

/**
 * Captures audio from a browser tab using getDisplayMedia.
 * Converts to 16kHz linear16 PCM and calls onAudioData with the buffer.
 */
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
        audio: true,
      });

      console.log("[AudioCapture] Got stream. Audio tracks:", stream.getAudioTracks().length, "Video tracks:", stream.getVideoTracks().length);

      streamRef.current = stream;

      // Stop video tracks — we only need audio
      stream.getVideoTracks().forEach((track) => track.stop());

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        throw new Error("No audio track — make sure you checked 'Share audio' when selecting the tab");
      }

      console.log("[AudioCapture] Audio track:", audioTrack.label, "enabled:", audioTrack.enabled, "readyState:", audioTrack.readyState);

      audioTrack.onended = () => {
        console.log("[AudioCapture] Audio track ended");
        stop();
      };

      // Create AudioContext — use default sample rate first, then we'll downsample
      const audioContext = new AudioContext();
      contextRef.current = audioContext;

      console.log("[AudioCapture] AudioContext state:", audioContext.state, "sampleRate:", audioContext.sampleRate);

      // Resume context if suspended (Chrome autoplay policy)
      if (audioContext.state === "suspended") {
        await audioContext.resume();
        console.log("[AudioCapture] AudioContext resumed:", audioContext.state);
      }

      const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));

      // ScriptProcessor to extract raw audio frames
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      let chunkCount = 0;
      processor.onaudioprocess = (event) => {
        const float32Data = event.inputBuffer.getChannelData(0);

        // Downsample to 16kHz from whatever the context sample rate is
        const ratio = Math.round(audioContext.sampleRate / 16000);
        const downsampled = new Float32Array(Math.floor(float32Data.length / ratio));
        for (let i = 0; i < downsampled.length; i++) {
          downsampled[i] = float32Data[i * ratio];
        }

        // Convert float32 [-1, 1] to int16 [-32768, 32767]
        const int16Array = new Int16Array(downsampled.length);
        for (let i = 0; i < downsampled.length; i++) {
          const s = Math.max(-1, Math.min(1, downsampled[i]));
          int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        chunkCount++;
        if (chunkCount === 1 || chunkCount % 50 === 0) {
          console.log("[AudioCapture] Sending chunk #" + chunkCount, "size:", int16Array.buffer.byteLength, "bytes");
        }

        onAudioDataRef.current(int16Array.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      console.log("[AudioCapture] Audio pipeline connected and running");
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
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
    console.log("[AudioCapture] Stopped");
  }, []);

  return { isCapturing, start, stop };
}
