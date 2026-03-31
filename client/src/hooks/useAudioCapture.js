import { useRef, useCallback, useState } from "react";

export function useAudioCapture({ onAudioData }) {
  const [isCapturing, setIsCapturing] = useState(false);
  const cleanupRef = useRef(null);
  const onAudioDataRef = useRef(onAudioData);
  onAudioDataRef.current = onAudioData;

  const start = useCallback(async () => {
    try {
      // Capture microphone directly — simplest path that works
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      console.log("[AudioCapture] Got mic stream, track:", micStream.getAudioTracks()[0].label);

      const audioContext = new AudioContext();
      console.log("[AudioCapture] AudioContext sampleRate:", audioContext.sampleRate);

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(micStream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      let chunkCount = 0;
      processor.onaudioprocess = (event) => {
        const float32Data = event.inputBuffer.getChannelData(0);

        // Convert to explicit little-endian bytes using DataView
        const buffer = new ArrayBuffer(float32Data.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < float32Data.length; i++) {
          const s = Math.max(-1, Math.min(1, float32Data[i]));
          const val = s < 0 ? s * 0x8000 : s * 0x7fff;
          view.setInt16(i * 2, Math.round(val), true); // true = little-endian
        }

        chunkCount++;
        if (chunkCount <= 3) {
          let max = 0;
          for (let i = 0; i < float32Data.length; i++) {
            const abs = Math.abs(view.getInt16(i * 2, true));
            if (abs > max) max = abs;
          }
          console.log("[AudioCapture] Chunk #" + chunkCount, "size:", buffer.byteLength, "maxSample:", max);
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
