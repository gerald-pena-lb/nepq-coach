'use client';

import { useRef, useCallback, useState } from 'react';

function createWavBuffer(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF header
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

export function useAudioCapture() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [sourceType, setSourceType] = useState(null); // 'mic' | 'tab'
  const [error, setError] = useState(null);

  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const chunksRef = useRef([]);
  const sampleRateRef = useRef(48000);

  const MAX_BUFFER_SECONDS = 30;

  const getWavBlob = useCallback(() => {
    const chunks = chunksRef.current;
    if (chunks.length === 0) return null;

    // Concatenate all chunks
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const allSamples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      allSamples.set(chunk, offset);
      offset += chunk.length;
    }

    const wavBuffer = createWavBuffer(allSamples, sampleRateRef.current);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }, []);

  const startMic = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      sampleRateRef.current = ctx.sampleRate;
      chunksRef.current = [];

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(input));

        // Trim to max buffer
        const maxSamples = MAX_BUFFER_SECONDS * sampleRateRef.current;
        let totalSamples = chunksRef.current.reduce((s, c) => s + c.length, 0);
        while (totalSamples > maxSamples && chunksRef.current.length > 1) {
          const removed = chunksRef.current.shift();
          totalSamples -= removed.length;
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      audioContextRef.current = ctx;
      streamRef.current = stream;
      processorRef.current = processor;
      setSourceType('mic');
      setIsCapturing(true);
    } catch (err) {
      setError(err.message || 'Microphone access denied');
    }
  }, []);

  const startTab = useCallback(async () => {
    try {
      setError(null);
      if (!navigator.mediaDevices.getDisplayMedia) {
        setError('Tab audio sharing is not supported in this browser');
        return;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      // Check if we got audio
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        setError('No audio track — make sure to check "Share tab audio"');
        return;
      }

      // Stop video tracks — we only need audio
      stream.getVideoTracks().forEach((t) => t.stop());

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(
        new MediaStream(audioTracks)
      );
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      sampleRateRef.current = ctx.sampleRate;
      chunksRef.current = [];

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(input));

        const maxSamples = MAX_BUFFER_SECONDS * sampleRateRef.current;
        let totalSamples = chunksRef.current.reduce((s, c) => s + c.length, 0);
        while (totalSamples > maxSamples && chunksRef.current.length > 1) {
          const removed = chunksRef.current.shift();
          totalSamples -= removed.length;
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      audioContextRef.current = ctx;
      streamRef.current = stream;
      processorRef.current = processor;
      setSourceType('tab');
      setIsCapturing(true);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Screen sharing was cancelled');
      } else {
        setError(err.message || 'Tab capture failed');
      }
    }
  }, []);

  const stop = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    chunksRef.current = [];
    setIsCapturing(false);
    setSourceType(null);
  }, []);

  const clearBuffer = useCallback(() => {
    chunksRef.current = [];
  }, []);

  return {
    isCapturing,
    sourceType,
    error,
    startMic,
    startTab,
    stop,
    getWavBlob,
    clearBuffer,
  };
}
