'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

const SEND_INTERVAL_MS = 3000;
const SILENCE_DEBOUNCE_MS = 1000;
const MIN_SUGGESTION_INTERVAL_MS = 10000;
const MIN_TEXT_LENGTH = 15;

export function useCoachingSession({ getWavBlob, clearBuffer, isCapturing }) {
  const [transcripts, setTranscripts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [coachError, setCoachError] = useState(null);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);

  const previousFullTranscript = useRef('');
  const pendingText = useRef('');
  const conversationHistory = useRef([]);
  const silenceTimer = useRef(null);
  const lastSuggestionTime = useRef(0);
  const sendIntervalRef = useRef(null);
  const isGenerating = useRef(false);

  const transcribe = useCallback(
    async (blob) => {
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
    },
    []
  );

  const generateSuggestion = useCallback(async () => {
    if (isGenerating.current) return;

    const text = pendingText.current.trim();
    if (text.length < MIN_TEXT_LENGTH) return;

    const now = Date.now();
    if (now - lastSuggestionTime.current < MIN_SUGGESTION_INTERVAL_MS) return;

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
        }),
      });

      if (res.ok) {
        const suggestion = await res.json();
        if (suggestion && suggestion.suggestions) {
          setSuggestions((prev) => [suggestion, ...prev]);
          lastSuggestionTime.current = Date.now();
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
  }, []);

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

    // Debounce: reset silence timer
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = setTimeout(generateSuggestion, SILENCE_DEBOUNCE_MS);
  }, [isCapturing, getWavBlob, transcribe, generateSuggestion]);

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
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
      };
    } else {
      if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
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
    previousFullTranscript.current = '';
    pendingText.current = '';
    conversationHistory.current = [];
    lastSuggestionTime.current = 0;
    if (clearBuffer) clearBuffer();
  }, [clearBuffer]);

  return {
    transcripts,
    suggestions,
    isProcessing,
    coachError,
    sessionStartedAt,
    saveCall,
    reset,
  };
}
