import { useRef, useCallback, useState } from "react";

export function useAudioCapture({ onAudioData }) {
  const [isCapturing, setIsCapturing] = useState(false);
  const cleanupRef = useRef(null);
  const onAudioDataRef = useRef(onAudioData);
  onAudioDataRef.current = onAudioData;

  const start = useCallback(async () => {
    try {
      // Get tab audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const tabAudioTrack = displayStream.getAudioTracks()[0];

      // Get microphone
      let micStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch (e) {
        console.log("[AudioCapture] Mic not available, tab only");
      }

      // Create AudioContext at 16kHz for Deepgram
      const audioContext = new AudioContext({ sampleRate: 16000 });

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      console.log("[AudioCapture] Context sampleRate:", audioContext.sampleRate);

      const destination = audioContext.createMediaStreamDestination();

      // Connect tab audio if available
      if (tabAudioTrack) {
        const tabSource = audioContext.createMediaStreamSource(new MediaStream([tabAudioTrack]));
        tabSource.connect(destination);
      }

      // Connect mic if available
      if (micStream) {
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(destination);
      }

      // Use ScriptProcessor on the merged destination
      const mergedSource = audioContext.createMediaStreamSource(destination.stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      let chunkCount = 0;
      processor.onaudioprocess = (event) => {
        const float32Data = event.inputBuffer.getChannelData(0);

        const int16Array = new Int16Array(float32Data.length);
        for (let i = 0; i < float32Data.length; i++) {
          const s = Math.max(-1, Math.min(1, float32Data[i]));
          int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        chunkCount++;
        if (chunkCount <= 3 || chunkCount % 100 === 0) {
          console.log("[AudioCapture] PCM chunk #" + chunkCount, "size:", int16Array.buffer.byteLength);
        }

        onAudioDataRef.current(int16Array.buffer);
      };

      mergedSource.connect(processor);
      processor.connect(audioContext.destination);

      // Stop video tracks after pipeline is running
      setTimeout(() => {
        displayStream.getVideoTracks().forEach(t => t.stop());
      }, 2000);

      // Store cleanup function
      cleanupRef.current = () => {
        processor.disconnect();
        audioContext.close().catch(() => {});
        displayStream.getTracks().forEach(t => t.stop());
        if (micStream) micStream.getTracks().forEach(t => t.stop());
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
