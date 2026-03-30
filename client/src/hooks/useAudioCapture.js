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

  const start = useCallback(async () => {
    try {
      // Request tab audio sharing — user picks which tab to share
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;

      // If the user shared video too, we don't need it — only keep audio tracks
      stream.getVideoTracks().forEach((track) => track.stop());

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        throw new Error("No audio track — make sure you checked 'Share audio' when selecting the tab");
      }

      // When user stops sharing via browser UI
      audioTrack.onended = () => {
        stop();
      };

      // Set up AudioContext to process the stream into PCM chunks
      const audioContext = new AudioContext({ sampleRate: 16000 });
      contextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(
        new MediaStream([audioTrack])
      );

      // Use ScriptProcessor to get raw audio frames
      // (AudioWorklet would be cleaner but ScriptProcessor is simpler for this use case)
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const float32Data = event.inputBuffer.getChannelData(0);

        // Convert float32 [-1, 1] to int16 [-32768, 32767]
        const int16Array = new Int16Array(float32Data.length);
        for (let i = 0; i < float32Data.length; i++) {
          const s = Math.max(-1, Math.min(1, float32Data[i]));
          int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        onAudioData(int16Array.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsCapturing(true);
    } catch (err) {
      console.error("[Audio] Capture failed:", err);
      throw err;
    }
  }, [onAudioData]);

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
  }, []);

  return { isCapturing, start, stop };
}
