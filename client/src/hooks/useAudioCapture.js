import { useRef, useCallback, useState } from "react";

export function useAudioCapture({ onAudioData }) {
  const [isCapturing, setIsCapturing] = useState(false);
  const cleanupRef = useRef(null);
  const onAudioDataRef = useRef(onAudioData);
  onAudioDataRef.current = onAudioData;

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
    });

    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    const allBlobs = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        allBlobs.push(e.data);
        // Build a complete webm file from all blobs so far
        const fullBlob = new Blob(allBlobs, { type: "audio/webm;codecs=opus" });
        fullBlob.arrayBuffer().then(buf => onAudioDataRef.current(buf));
      }
    };

    recorder.start(3000);

    cleanupRef.current = () => {
      if (recorder.state !== "inactive") recorder.stop();
      stream.getTracks().forEach(t => t.stop());
    };

    setIsCapturing(true);
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
