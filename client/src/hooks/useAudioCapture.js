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

      console.log("[AudioCapture] Got mic stream");

      // Use MediaRecorder with webm — send raw to server
      // Server will convert format for Deepgram
      const recorder = new MediaRecorder(micStream, {
        mimeType: "audio/webm;codecs=opus",
      });

      let chunkCount = 0;
      recorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          chunkCount++;
          if (chunkCount <= 5 || chunkCount % 20 === 0) {
            console.log("[AudioCapture] Chunk #" + chunkCount, "size:", event.data.size);
          }
          const buffer = await event.data.arrayBuffer();
          onAudioDataRef.current(buffer);
        }
      };

      recorder.start(250); // 250ms chunks

      cleanupRef.current = () => {
        if (recorder.state !== "inactive") recorder.stop();
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
