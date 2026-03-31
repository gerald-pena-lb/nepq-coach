import { useRef, useCallback, useState } from "react";

export function useAudioCapture({ onAudioData }) {
  const [isCapturing, setIsCapturing] = useState(false);
  const cleanupRef = useRef(null);
  const onAudioDataRef = useRef(onAudioData);
  onAudioDataRef.current = onAudioData;

  const start = useCallback(async () => {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      const audioContext = new AudioContext();
      console.log("[AudioCapture] sampleRate:", audioContext.sampleRate);

      if (audioContext.state === "suspended") await audioContext.resume();

      const source = audioContext.createMediaStreamSource(micStream);

      // Use larger buffer for more reliable chunks
      const processor = audioContext.createScriptProcessor(16384, 1, 1);

      let chunkCount = 0;
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);

        // Convert float32 to int16 using DataView for explicit little-endian
        const buffer = new ArrayBuffer(input.length * 2);
        const view = new DataView(buffer);
        let maxAbs = 0;
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          const val = s < 0 ? s * 32768 : s * 32767;
          view.setInt16(i * 2, val, true);
          const abs = Math.abs(val);
          if (abs > maxAbs) maxAbs = abs;
        }

        chunkCount++;
        if (chunkCount <= 3) {
          console.log("[AudioCapture] Chunk #" + chunkCount, "samples:", input.length, "bytes:", buffer.byteLength, "maxAbs:", Math.round(maxAbs), "sampleRate:", audioContext.sampleRate);
        }

        onAudioDataRef.current(buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      cleanupRef.current = () => {
        processor.disconnect();
        audioContext.close().catch(() => {});
        micStream.getTracks().forEach(t => t.stop());
      };

      setIsCapturing(true);
    } catch (err) {
      console.error("[AudioCapture] Failed:", err);
      throw err;
    }
  }, []);

  const stop = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  return { isCapturing, start, stop };
}
