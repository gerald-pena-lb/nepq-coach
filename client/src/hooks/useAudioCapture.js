import { useRef, useCallback, useState } from "react";

export function useAudioCapture({ onAudioData }) {
  const [isCapturing, setIsCapturing] = useState(false);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const onAudioDataRef = useRef(onAudioData);
  onAudioDataRef.current = onAudioData;

  const start = useCallback(async () => {
    try {
      // Try tab audio first, fall back to microphone
      let stream;
      let source = "tab";

      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) {
          stream.getTracks().forEach(t => t.stop());
          throw new Error("No audio track from tab");
        }

        // Also capture microphone and merge both
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });

        // Combine tab audio + mic audio
        const audioContext = new AudioContext();
        const tabSource = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
        const micSource = audioContext.createMediaStreamSource(micStream);
        const destination = audioContext.createMediaStreamDestination();

        tabSource.connect(destination);
        micSource.connect(destination);

        // Stop video tracks
        stream.getVideoTracks().forEach(t => t.stop());

        // Use the merged stream
        stream = destination.stream;

        // Keep references to stop later
        stream._extraTracks = [...micStream.getTracks(), audioTrack];
        stream._audioContext = audioContext;

        source = "tab+mic";
      } catch (err) {
        console.log("[AudioCapture] Tab capture failed, using mic only:", err.message);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        source = "mic";
      }

      console.log("[AudioCapture] Source:", source);
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      recorderRef.current = recorder;

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

      recorder.start(500);
      setIsCapturing(true);
    } catch (err) {
      console.error("[AudioCapture] Failed:", err);
      throw err;
    }
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    if (streamRef.current) {
      // Stop extra tracks if we merged tab+mic
      if (streamRef.current._extraTracks) {
        streamRef.current._extraTracks.forEach(t => t.stop());
      }
      if (streamRef.current._audioContext) {
        streamRef.current._audioContext.close().catch(() => {});
      }
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  return { isCapturing, start, stop };
}
