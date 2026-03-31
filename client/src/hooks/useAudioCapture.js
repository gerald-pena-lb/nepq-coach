import { useRef, useCallback, useState } from "react";

export function useAudioCapture({ onAudioData }) {
  const [isCapturing, setIsCapturing] = useState(false);
  const cleanupRef = useRef(null);
  const onAudioDataRef = useRef(onAudioData);
  onAudioDataRef.current = onAudioData;

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      stream.getTracks().forEach(t => t.stop());
      throw new Error("No audio — make sure you checked 'Share audio'");
    }

    audioTrack.onended = () => stop();

    // Record tab audio as webm/opus
    const audioStream = new MediaStream([audioTrack]);
    const recorder = new MediaRecorder(audioStream, { mimeType: "audio/webm;codecs=opus" });

    recorder.ondataavailable = async (e) => {
      if (e.data.size > 0) {
        const buf = await e.data.arrayBuffer();
        onAudioDataRef.current(buf);
      }
    };

    recorder.start(500);

    // Stop video tracks after audio is running
    setTimeout(() => stream.getVideoTracks().forEach(t => t.stop()), 2000);

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
