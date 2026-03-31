import { useRef, useCallback, useState } from "react";

export function useAudioCapture({ onAudioData }) {
  const [isCapturing, setIsCapturing] = useState(false);
  const cleanupRef = useRef(null);
  const onAudioDataRef = useRef(onAudioData);
  onAudioDataRef.current = onAudioData;

  const start = useCallback(async () => {
    // Ask user what to capture
    let stream;
    try {
      // Try tab sharing first
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        stream.getTracks().forEach(t => t.stop());
        throw new Error("No audio");
      }
      // Also get mic
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Merge tab + mic
        const ctx = new AudioContext();
        const tabSrc = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
        const micSrc = ctx.createMediaStreamSource(mic);
        const dest = ctx.createMediaStreamDestination();
        tabSrc.connect(dest);
        micSrc.connect(dest);
        setTimeout(() => stream.getVideoTracks().forEach(t => t.stop()), 2000);
        const merged = dest.stream;
        merged._cleanup = () => {
          ctx.close().catch(() => {});
          mic.getTracks().forEach(t => t.stop());
          stream.getTracks().forEach(t => t.stop());
        };
        stream = merged;
      } catch {
        // Mic denied, tab only
        setTimeout(() => stream.getVideoTracks().forEach(t => t.stop()), 2000);
      }
    } catch {
      // Tab sharing denied/failed, try mic only
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true }
      });
    }

    // Record as webm/opus
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    const allBlobs = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        allBlobs.push(e.data);
        // Send the full recording so far as one blob
        const fullBlob = new Blob(allBlobs, { type: "audio/webm;codecs=opus" });
        fullBlob.arrayBuffer().then(buf => {
          onAudioDataRef.current(buf);
        });
      }
    };

    recorder.start(3000); // 3 second chunks

    cleanupRef.current = () => {
      if (recorder.state !== "inactive") recorder.stop();
      if (stream._cleanup) stream._cleanup();
      else stream.getTracks().forEach(t => t.stop());
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
