'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

const SEND_INTERVAL_MS = 1500;
const PREGEN_DEBOUNCE_MS = 700; // fire pre-gen shortly after each speech pause so candidates are ready fast

export function useCoachingSession({ getWavBlob, clearBuffer, isCapturing, currentStage }) {
  const [transcripts, setTranscripts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [coachError, setCoachError] = useState(null);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [repCalibration, setRepCalibration] = useState(null);
  const [hasCandidatesReady, setHasCandidatesReady] = useState(false);

  const previousFullTranscript = useRef('');
  const pendingText = useRef('');
  const conversationHistory = useRef([]);
  const sendIntervalRef = useRef(null);

  // Pre-generation state
  const candidates = useRef([]); // cached suggestion candidates
  const candidateTextSnapshot = useRef(''); // text used to generate candidates
  const pregenTimer = useRef(null);
  const pregenAbort = useRef(null); // AbortController for in-flight pregen
  const isPregenning = useRef(false);

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

  // Pre-generate candidates in the background
  const pregenerate = useCallback(async () => {
    if (isPregenning.current) return;

    let text = pendingText.current.trim();
    if (text.length < 5) {
      const recent = conversationHistory.current.slice(-5);
      text = recent.map((t) => t.text).join(' ').trim();
    }
    if (text.length < 5) return;

    // Don't re-generate for the same text
    if (text === candidateTextSnapshot.current && candidates.current.length > 0) return;

    isPregenning.current = true;

    // Abort any previous in-flight pregen
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

  // Helper to get current conversation text (for pregen trigger only)
  const getConversationText = useCallback(() => {
    let text = pendingText.current.trim();
    if (text.length < 5) {
      const recent = conversationHistory.current.slice(-5);
      text = recent.map((t) => t.text).join(' ').trim();
    }
    return text;
  }, []);

  // When user taps "Suggest" — instantly show cached candidate, or generate on demand
  const requestSuggestion = useCallback(async () => {
    // If we have fresh candidates, show the best one instantly
    if (candidates.current.length > 0) {
      const best = candidates.current[0]; // ranked by priority from API
      setSuggestions((prev) => [best, ...prev]);
      candidates.current = [];
      candidateTextSnapshot.current = '';
      setHasCandidatesReady(false);
      pendingText.current = '';
      return;
    }

    // Fallback: generate on demand using the full conversation history
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
          latestText: pendingText.current.trim() || conversationHistory.current.slice(-1)[0]?.text || '',
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

  // "Go Deeper" — takes the current suggestion and generates a deeper follow-up
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
          latestText: pendingText.current.trim() || conversationHistory.current.slice(-1)[0]?.text || '',
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

    // Debounce pre-generation: regenerate candidates after speech pauses
    if (pregenTimer.current) clearTimeout(pregenTimer.current);
    pregenTimer.current = setTimeout(pregenerate, PREGEN_DEBOUNCE_MS);
  }, [isCapturing, getWavBlob, transcribe, pregenerate]);

  // Start/stop the send interval when capturing changes
  useEffect(() => {
    if (isCapturing) {
      setSessionStartedAt(new Date().toISOString());
      previousFullTranscript.current = '';
      pendingText.current = '';
      conversationHistory.current = [];
      candidates.current = [];
      candidateTextSnapshot.current = '';
      setHasCandidatesReady(false);

      sendIntervalRef.current = setInterval(processAudio, SEND_INTERVAL_MS);

      return () => {
        clearInterval(sendIntervalRef.current);
        if (pregenTimer.current) clearTimeout(pregenTimer.current);
        if (pregenAbort.current) pregenAbort.current.abort();
      };
    } else {
      if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
      if (pregenTimer.current) clearTimeout(pregenTimer.current);
      if (pregenAbort.current) pregenAbort.current.abort();
    }
  }, [isCapturing, processAudio]);

  // Re-trigger pre-generation when stage changes
  useEffect(() => {
    if (isCapturing && currentStage) {
      // Invalidate current candidates since stage changed
      candidates.current = [];
      candidateTextSnapshot.current = '';
      setHasCandidatesReady(false);
      // Immediately pre-generate for new stage
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
      // Silent fail — persistence is optional
    }
  }, [transcripts, suggestions, sessionStartedAt]);

  const reset = useCallback(() => {
    setTranscripts([]);
    setSuggestions([]);
    setSessionStartedAt(null);
    setRepCalibration(null);
    setCoachError(null);
    setHasCandidatesReady(false);
    previousFullTranscript.current = '';
    pendingText.current = '';
    conversationHistory.current = [];
    candidates.current = [];
    candidateTextSnapshot.current = '';
    if (pregenAbort.current) pregenAbort.current.abort();
    if (clearBuffer) clearBuffer();
  }, [clearBuffer]);

  return {
    transcripts,
    suggestions,
    isProcessing,
    coachError,
    sessionStartedAt,
    repCalibration,
    hasCandidatesReady,
    calibrate,
    requestSuggestion,
    goDeeper,
    saveCall,
    reset,
  };
}
