'use client';

import { useRef, useCallback, useState } from 'react';

const WS_URL = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime';
const WS_MODEL = 'scribe_v2_realtime';
const TARGET_SAMPLE_RATE = 16000;

// Downsample from browser sample rate (usually 48kHz) to 16kHz for ElevenLabs
function downsample(buffer, fromRate, toRate) {
  if (fromRate === toRate) return buffer;
  const ratio = fromRate / toRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    result[i] = buffer[Math.round(i * ratio)];
  }
  return result;
}

// Convert Float32 [-1,1] to Int16 PCM bytes
function float32ToInt16(buffer) {
  const result = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    result[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return result;
}

// Convert Int16Array to base64
function int16ToBase64(int16Arr) {
  const bytes = new Uint8Array(int16Arr.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Simple noise filter — same logic as the server-side cleanTranscript
function isCleanEnglish(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;
  if (!/[a-zA-Z]{3,}/.test(trimmed)) return false;
  // Check ASCII ratio
  const ascii = (trimmed.match(/[a-zA-Z]/g) || []).length;
  const total = trimmed.replace(/\s/g, '').length;
  if (total > 0 && ascii / total < 0.6) return false;
  return true;
}

// WAV encoding for calibration (one-time use)
function createWavBuffer(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export function useAudioCapture() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [sourceType, setSourceType] = useState(null);
  const [error, setError] = useState(null);

  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const wsRef = useRef(null);
  const onTranscriptRef = useRef(null);
  const sampleRateRef = useRef(48000);
  const calibrationChunksRef = useRef([]);
  const isCalibrationMode = useRef(false);

  const setOnTranscript = useCallback((fn) => {
    onTranscriptRef.current = fn;
  }, []);

  // Fetch a single-use token from our API, then open WebSocket to ElevenLabs
  const connectWebSocket = useCallback(async () => {
    try {
      const tokenRes = await fetch('/api/stt-token', { method: 'POST' });
      if (!tokenRes.ok) {
        setError('Failed to get transcription token');
        return false;
      }
      const { token } = await tokenRes.json();

      const wsUrl = `${WS_URL}?model_id=${WS_MODEL}&token=${token}&language_code=en`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Connection established — audio chunks will flow
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Only process committed (final) transcripts — ignore partials to avoid duplication
          if (msg.message_type === 'committed_transcript' && msg.text) {
            const cleaned = msg.text.trim();
            if (isCleanEnglish(cleaned) && onTranscriptRef.current) {
              onTranscriptRef.current(cleaned);
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        wsRef.current = null;
      };

      wsRef.current = ws;
      return true;
    } catch (err) {
      setError(err.message || 'WebSocket setup failed');
      return false;
    }
  }, []);

  // Set up audio processing and either stream to WS or buffer for calibration
  const setupAudioProcessing = useCallback(
    (stream, type) => {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      sampleRateRef.current = ctx.sampleRate;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const samples = new Float32Array(input);

        if (isCalibrationMode.current) {
          calibrationChunksRef.current.push(samples);
          return;
        }

        // Downsample to 16kHz, convert to int16, base64, send over WS
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          const downsampled = downsample(samples, ctx.sampleRate, TARGET_SAMPLE_RATE);
          const int16 = float32ToInt16(downsampled);
          const base64 = int16ToBase64(int16);

          ws.send(
            JSON.stringify({
              message_type: 'input_audio_chunk',
              audio_base_64: base64,
              sample_rate: TARGET_SAMPLE_RATE,
            })
          );
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      audioContextRef.current = ctx;
      streamRef.current = stream;
      processorRef.current = processor;
      setSourceType(type);
      setIsCapturing(true);
    },
    []
  );

  const startMic = useCallback(
    async (calibration = false) => {
      try {
        setError(null);
        isCalibrationMode.current = calibration;
        calibrationChunksRef.current = [];

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: true,
          },
        });

        if (!calibration) {
          const connected = await connectWebSocket();
          if (!connected) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
        }

        setupAudioProcessing(stream, 'mic');
      } catch (err) {
        setError(err.message || 'Microphone access denied');
      }
    },
    [connectWebSocket, setupAudioProcessing]
  );

  const startTab = useCallback(
    async (calibration = false) => {
      try {
        setError(null);
        isCalibrationMode.current = calibration;
        calibrationChunksRef.current = [];

        if (!navigator.mediaDevices.getDisplayMedia) {
          setError('Tab audio sharing is not supported in this browser');
          return;
        }

        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          stream.getTracks().forEach((t) => t.stop());
          setError('No audio track — make sure to check "Share tab audio"');
          return;
        }

        stream.getVideoTracks().forEach((t) => t.stop());

        if (!calibration) {
          const connected = await connectWebSocket();
          if (!connected) {
            audioTracks.forEach((t) => t.stop());
            return;
          }
        }

        setupAudioProcessing(new MediaStream(audioTracks), 'tab');
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          setError('Screen sharing was cancelled');
        } else {
          setError(err.message || 'Tab capture failed');
        }
      }
    },
    [connectWebSocket, setupAudioProcessing]
  );

  // Get WAV blob from calibration buffer (used only for voice calibration)
  const getWavBlob = useCallback(() => {
    const chunks = calibrationChunksRef.current;
    if (chunks.length === 0) return null;
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

  const clearBuffer = useCallback(() => {
    calibrationChunksRef.current = [];
  }, []);

  // Switch from calibration mode to streaming mode (opens WS, starts sending audio)
  const switchToStreaming = useCallback(async () => {
    isCalibrationMode.current = false;
    calibrationChunksRef.current = [];
    const connected = await connectWebSocket();
    if (!connected) {
      setError('Failed to connect to transcription service');
    }
  }, [connectWebSocket]);

  const stop = useCallback(() => {
    // Close WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        // Send end-of-stream
        try {
          wsRef.current.send(JSON.stringify({ message_type: 'flush' }));
        } catch { /* ignore */ }
      }
      wsRef.current.close();
      wsRef.current = null;
    }

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
    calibrationChunksRef.current = [];
    isCalibrationMode.current = false;
    setIsCapturing(false);
    setSourceType(null);
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
    setOnTranscript,
    switchToStreaming,
  };
}
