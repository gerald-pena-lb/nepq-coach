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
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        stream.getTracks().forEach(t => t.stop());
        throw new Error("No audio track — make sure you checked 'Share audio'");
      }

      audioTrack.onended = () => stop();

      // Use DEFAULT sample rate — forcing 16kHz breaks getDisplayMedia in Chrome
      const audioContext = new AudioContext();
      contextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // Store sample rate so server knows what we're sending
      window.__audioSampleRate = audioContext.sampleRate;
      console.log("[AudioCapture] Sample rate:", audioContext.sampleRate);

      const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      let chunkCount = 0;
      processor.onaudioprocess = (event) => {
        const float32Data = event.inputBuffer.getChannelData(0);

        // Convert float32 to int16
        const int16Array = new Int16Array(float32Data.length);
        for (let i = 0; i < float32Data.length; i++) {
          const s = Math.max(-1, Math.min(1, float32Data[i]));
          int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        chunkCount++;
        if (chunkCount <= 3 || chunkCount % 100 === 0) {
          console.log("[AudioCapture] Chunk #" + chunkCount, "size:", int16Array.buffer.byteLength);
        }

        onAudioDataRef.current(int16Array.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Stop video after audio pipeline is running
      setTimeout(() => {
        stream.getVideoTracks().forEach(t => t.stop());
      }, 2000);

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
  }, []);

  return { isCapturing, start, stop };
}
