import { useRef, useCallback, useState } from "react";

function createWavBuffer(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  // WAV header
  const writeString = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  // Write PCM samples
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, samples[i], true);
  }
  return buffer;
}

export function useAudioCapture({ onAudioData }) {
  const [isCapturing, setIsCapturing] = useState(false);
  const cleanupRef = useRef(null);
  const onAudioDataRef = useRef(onAudioData);
  onAudioDataRef.current = onAudioData;

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
    });

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const sampleRate = audioContext.sampleRate;

    if (audioContext.state === "suspended") await audioContext.resume();

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    let allSamples = [];

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      // Convert to int16
      const int16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        int16[i] = s < 0 ? s * 32768 : s * 32767;
      }
      allSamples.push(int16);
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    // Every 3 seconds, send last ~30 seconds of audio as WAV
    const maxSamples = sampleRate * 30; // 30 seconds max
    const interval = setInterval(() => {
      if (allSamples.length === 0) return;

      // Combine all int16 arrays
      let totalLength = 0;
      for (const chunk of allSamples) totalLength += chunk.length;

      // Trim to last 30 seconds if needed
      if (totalLength > maxSamples) {
        let trimLength = 0;
        while (allSamples.length > 0 && trimLength + allSamples[0].length < totalLength - maxSamples) {
          trimLength += allSamples.shift().length;
        }
        totalLength = 0;
        for (const chunk of allSamples) totalLength += chunk.length;
      }
      const combined = new Int16Array(totalLength);
      let offset = 0;
      for (const chunk of allSamples) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const wav = createWavBuffer(combined, sampleRate);
      console.log("[Mic] Sending WAV:", wav.byteLength, "bytes,", (totalLength / sampleRate).toFixed(1), "sec");
      onAudioDataRef.current(wav);
    }, 3000);

    cleanupRef.current = () => {
      clearInterval(interval);
      processor.disconnect();
      audioContext.close().catch(() => {});
      stream.getTracks().forEach((t) => t.stop());
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
