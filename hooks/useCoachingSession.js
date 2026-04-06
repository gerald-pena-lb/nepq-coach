'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

const SEND_INTERVAL_MS = 1500;

export function useCoachingSession({ getWavBlob, clearBuffer, isCapturing }) {
  const [transcripts, setTranscripts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [coachError, setCoachError] = useState(null);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [repCalibration, setRepCalibration] = useState(null);

  const previousFullTranscript = useRef('');
  const pendingText = useRef('');
  const conversationHistory = useRef([]);
  const sendIntervalRef = useRef(null);
  const isGenerating = useRef(false);

  const transcribe = useCallback(async (blob) => {
    const formData = new FormData();
    formData.append('audio', blob, 'audio.wav');

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) return null;
      const data = await res.json();
      return data.text || '';
    } catch {
      return null;
    }
  }, []);

  // Calibrate rep voice — transcribe what the rep says before the call
  const calibrate = useCallback(
    async (blob) => {
      const text = await transcribe(blob);
      if (text && text.trim().length > 5) {
        setRepCalibration(text.trim());
        return text.trim();
      }
      return null;
    },
    [transcribe]
  );

  // Manual trigger — called when user clicks "Suggest"
  const requestSuggestion = useCallback(async (currentStage) => {
    if (isGenerating.current) return;

    // Use pending text or fall back to recent conversation history
    let text = pendingText.current.trim();
    if (text.length < 5) {
      const recent = conversationHistory.current.slice(-5);
      text = recent.map((t) => t.text).join(' ').trim();
    }
    if (text.length < 5) return;

    isGenerating.current = true;
    setIsProcessing(true);
    setCoachError(null);

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationHistory: conversationHistory.current,
          latestText: text,
          repCalibration: repCalibration,
          currentStage: currentStage,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions((prev) => [data, ...prev]);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error || `Coach API error: ${res.status}`;
        console.error('Coach API error:', msg);
        setCoachError(msg);
      }
    } catch (err) {
      console.error('Coaching request failed:', err);
      setCoachError('Network error reaching coaching API');
    } finally {
      pendingText.current = '';
      isGenerating.current = false;
      setIsProcessing(false);
    }
  }, [repCalibration]);

  const processAudio = useCallback(async () => {
    if (!isCapturing) return;

    const blob = getWavBlob();
    if (!blob || blob.size < 1000) return;

    const fullText = await transcribe(blob);
    if (!fullText) return;

    // Compute delta from previous full transcript
    const prev = previousFullTranscript.current;
    let delta = fullText;
    if (prev && fullText.startsWith(prev)) {
      delta = fullText.slice(prev.length).trim();
    } else if (prev && fullText.length > prev.length) {
      delta = fullText.slice(prev.length).trim();
    }

    previousFullTranscript.current = fullText;

    if (!delta) return;

    // Add to transcript display
    setTranscripts((t) => [
      ...t,
      { text: delta, timestamp: new Date().toISOString() },
    ]);

    // Add to conversation history (keep last 50, trim to 30)
    conversationHistory.current.push({ text: delta });
    if (conversationHistory.current.length > 50) {
      conversationHistory.current = conversationHistory.current.slice(-30);
    }

    // Accumulate pending text
    pendingText.current += ' ' + delta;
  }, [isCapturing, getWavBlob, transcribe]);

  // Start/stop the send interval when capturing changes
  useEffect(() => {
    if (isCapturing) {
      setSessionStartedAt(new Date().toISOString());
      previousFullTranscript.current = '';
      pendingText.current = '';
      conversationHistory.current = [];

      sendIntervalRef.current = setInterval(processAudio, SEND_INTERVAL_MS);

      return () => {
        clearInterval(sendIntervalRef.current);
      };
    } else {
      if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
    }
  }, [isCapturing, processAudio]);

  const saveCall = useCallback(async () => {
    if (!sessionStartedAt) return;

    try {
      await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcripts,
          suggestions,
          duration: Math.round(
            (Date.now() - new Date(sessionStartedAt).getTime()) / 1000
          ),
          startedAt: sessionStartedAt,
        }),
      });
    } catch {
      // Silent fail — persistence is optional
    }
  }, [transcripts, suggestions, sessionStartedAt]);

  const reset = useCallback(() => {
    setTranscripts([]);
    setSuggestions([]);
    setSessionStartedAt(null);
    setRepCalibration(null);
    setCoachError(null);
    previousFullTranscript.current = '';
    pendingText.current = '';
    conversationHistory.current = [];
    if (clearBuffer) clearBuffer();
  }, [clearBuffer]);

  return {
    transcripts,
    suggestions,
    isProcessing,
    coachError,
    sessionStartedAt,
    repCalibration,
    calibrate,
    requestSuggestion,
    saveCall,
    reset,
  };
}
