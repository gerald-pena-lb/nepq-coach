'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

const PREGEN_DEBOUNCE_MS = 700;

export function useCoachingSession({ isCapturing, currentStage }) {
  const [transcripts, setTranscripts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [coachError, setCoachError] = useState(null);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [repCalibration, setRepCalibration] = useState(null);
  const [hasCandidatesReady, setHasCandidatesReady] = useState(false);

  const pendingText = useRef('');
  const conversationHistory = useRef([]);

  // Pre-generation state
  const candidates = useRef([]);
  const candidateTextSnapshot = useRef('');
  const pregenTimer = useRef(null);
  const pregenAbort = useRef(null);
  const isPregenning = useRef(false);

  // Calibrate using the old transcribe endpoint (one-time, small payload)
  const calibrate = useCallback(async (blob) => {
    const formData = new FormData();
    formData.append('audio', blob, 'audio.wav');
    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data.text?.trim();
      if (text && text.length > 5) {
        setRepCalibration(text);
        return text;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Pre-generate candidates in the background
  const pregenerate = useCallback(async () => {
    if (isPregenning.current) return;

    let text = pendingText.current.trim();
    if (text.length < 5) {
      const recent = conversationHistory.current.slice(-5);
      text = recent.map((t) => t.text).join(' ').trim();
    }
    if (text.length < 5) return;

    if (text === candidateTextSnapshot.current && candidates.current.length > 0) return;

    isPregenning.current = true;

    if (pregenAbort.current) pregenAbort.current.abort();
    pregenAbort.current = new AbortController();

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationHistory: conversationHistory.current,
          latestText: text,
          repCalibration: repCalibration,
          currentStage: currentStage,
          pregenerate: true,
        }),
        signal: pregenAbort.current.signal,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.candidates && data.candidates.length > 0) {
          candidates.current = data.candidates;
          candidateTextSnapshot.current = text;
          setHasCandidatesReady(true);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Pregen failed:', err);
      }
    } finally {
      isPregenning.current = false;
    }
  }, [repCalibration, currentStage]);

  // Called by the WebSocket transcript callback — this replaces the old processAudio
  const addTranscript = useCallback(
    (text) => {
      setTranscripts((t) => [
        ...t,
        { text, timestamp: new Date().toISOString() },
      ]);

      conversationHistory.current.push({ text });
      if (conversationHistory.current.length > 50) {
        conversationHistory.current = conversationHistory.current.slice(-30);
      }

      pendingText.current += ' ' + text;

      // Debounce pre-generation
      if (pregenTimer.current) clearTimeout(pregenTimer.current);
      pregenTimer.current = setTimeout(pregenerate, PREGEN_DEBOUNCE_MS);
    },
    [pregenerate]
  );

  // When user taps "Suggest"
  const requestSuggestion = useCallback(async () => {
    if (candidates.current.length > 0) {
      const best = candidates.current[0];
      setSuggestions((prev) => [best, ...prev]);
      candidates.current = [];
      candidateTextSnapshot.current = '';
      setHasCandidatesReady(false);
      pendingText.current = '';
      return;
    }

    if (conversationHistory.current.length === 0 && pendingText.current.trim().length < 5) {
      return;
    }

    setIsProcessing(true);
    setCoachError(null);

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationHistory: conversationHistory.current,
          latestText:
            pendingText.current.trim() ||
            conversationHistory.current.slice(-1)[0]?.text ||
            '',
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
        setCoachError(errData.error || `Coach API error: ${res.status}`);
      }
    } catch (err) {
      console.error('Coaching request failed:', err);
      setCoachError('Network error reaching coaching API');
    } finally {
      pendingText.current = '';
      setIsProcessing(false);
    }
  }, [repCalibration, currentStage]);

  // "Go Deeper"
  const goDeeper = useCallback(async () => {
    const currentSuggestion = suggestions[0]?.suggestions?.[0]?.text;
    if (!currentSuggestion) return;

    setIsProcessing(true);
    setCoachError(null);

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationHistory: conversationHistory.current,
          latestText:
            pendingText.current.trim() ||
            conversationHistory.current.slice(-1)[0]?.text ||
            '',
          repCalibration: repCalibration,
          currentStage: currentStage,
          goDeeper: true,
          previousSuggestion: currentSuggestion,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions((prev) => [data, ...prev]);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setCoachError(errData.error || `Coach API error: ${res.status}`);
      }
    } catch (err) {
      console.error('Go deeper failed:', err);
      setCoachError('Network error reaching coaching API');
    } finally {
      setIsProcessing(false);
    }
  }, [suggestions, repCalibration, currentStage]);

  // Session lifecycle
  useEffect(() => {
    if (isCapturing) {
      setSessionStartedAt(new Date().toISOString());
      pendingText.current = '';
      conversationHistory.current = [];
      candidates.current = [];
      candidateTextSnapshot.current = '';
      setHasCandidatesReady(false);

      return () => {
        if (pregenTimer.current) clearTimeout(pregenTimer.current);
        if (pregenAbort.current) pregenAbort.current.abort();
      };
    } else {
      if (pregenTimer.current) clearTimeout(pregenTimer.current);
      if (pregenAbort.current) pregenAbort.current.abort();
    }
  }, [isCapturing]);

  // Re-trigger pre-generation when stage changes
  useEffect(() => {
    if (isCapturing && currentStage) {
      candidates.current = [];
      candidateTextSnapshot.current = '';
      setHasCandidatesReady(false);
      if (pregenTimer.current) clearTimeout(pregenTimer.current);
      pregenTimer.current = setTimeout(pregenerate, 500);
    }
  }, [currentStage, isCapturing, pregenerate]);

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
      // Silent fail
    }
  }, [transcripts, suggestions, sessionStartedAt]);

  const reset = useCallback(() => {
    setTranscripts([]);
    setSuggestions([]);
    setSessionStartedAt(null);
    setRepCalibration(null);
    setCoachError(null);
    setHasCandidatesReady(false);
    pendingText.current = '';
    conversationHistory.current = [];
    candidates.current = [];
    candidateTextSnapshot.current = '';
    if (pregenAbort.current) pregenAbort.current.abort();
  }, []);

  return {
    transcripts,
    suggestions,
    isProcessing,
    coachError,
    sessionStartedAt,
    repCalibration,
    hasCandidatesReady,
    calibrate,
    addTranscript,
    requestSuggestion,
    goDeeper,
    saveCall,
    reset,
  };
}
