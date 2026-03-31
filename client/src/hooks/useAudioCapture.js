import { useRef, useCallback, useState } from "react";

export function useAudioCapture({ onAudioData }) {
  const [isCapturing, setIsCapturing] = useState(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const blobsRef = useRef([]);
  const onAudioDataRef = useRef(onAudioData);
  onAudioDataRef.current = onAudioData;

  const start = useCallback(async () => {
    blobsRef.current = [];

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
    });
    streamRef.current = stream;

    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    recorderRef.current = recorder;

    recorder.ondataavailable = async (e) => {
      if (e.data.size > 0) {
        blobsRef.current.push(e.data);
        // Combine ALL blobs into one valid webm file
        const combined = new Blob(blobsRef.current, { type: "audio/webm;codecs=opus" });
        const buf = await combined.arrayBuffer();
        console.log("[Mic] Sending", buf.byteLength, "bytes (" + blobsRef.current.length + " segments)");
        onAudioDataRef.current(buf);
      }
    };

    recorder.start(3000);
    setIsCapturing(true);
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    recorderRef.current = null;
    streamRef.current = null;
    blobsRef.current = [];
    setIsCapturing(false);
  }, []);

  return { isCapturing, start, stop };
}
