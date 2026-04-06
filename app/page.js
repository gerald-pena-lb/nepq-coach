'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useAudioCapture } from '@/hooks/useAudioCapture';
import { useCoachingSession } from '@/hooks/useCoachingSession';
import { STAGES } from '@/lib/salesFramework';
import AudioSourceSelector from '@/components/AudioSourceSelector';
import MeetingControls from '@/components/MeetingControls';
import Transcript from '@/components/Transcript';
import Suggestions from '@/components/Suggestions';
import StageSelector from '@/components/StageSelector';
import ModeToggle from '@/components/ModeToggle';

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    background: 'var(--bg)',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
  },
  tab: {
    flex: 1,
    padding: '10px 0',
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'center',
    background: 'transparent',
    color: 'var(--text-muted)',
    letterSpacing: '0.03em',
    transition: 'color 0.15s',
  },
  tabActive: {
    color: 'var(--accent)',
    borderBottom: '2px solid var(--accent)',
  },
  panels: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  panel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panelLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    padding: '10px 16px 0',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  divider: {
    width: 1,
    background: 'var(--border)',
  },
  calibrationOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 16,
  },
  calibrationModal: {
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius)',
    padding: 28,
    maxWidth: 420,
    width: '100%',
    textAlign: 'center',
  },
  calibrationTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 8,
  },
  calibrationDesc: {
    fontSize: 14,
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    marginBottom: 20,
  },
  calibrationDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: 'var(--red)',
    display: 'inline-block',
    marginRight: 8,
  },
  calibrationStatus: {
    fontSize: 14,
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  calibrationBtn: {
    padding: '10px 24px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent)',
    border: 'none',
    marginTop: 8,
  },
  calibrationSuccess: {
    fontSize: 14,
    color: 'var(--green)',
    marginBottom: 12,
  },
  calibrationSample: {
    fontSize: 13,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    padding: '8px 12px',
    background: 'var(--bg)',
    borderRadius: 8,
    marginBottom: 16,
    maxHeight: 60,
    overflow: 'hidden',
  },
  skipBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 13,
    color: 'var(--text-muted)',
    background: 'transparent',
    border: 'none',
    marginTop: 4,
  },
};

export default function HomePage() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('coach');
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationDone, setCalibratedDone] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [activeStage, setActiveStage] = useState('connecting');
  const [mode, setMode] = useState('listen'); // 'listen' | 'suggest'
  const calibrationTimerRef = useRef(null);

  const audio = useAudioCapture();
  const session = useCoachingSession({
    getWavBlob: audio.getWavBlob,
    clearBuffer: audio.clearBuffer,
    isCapturing: isSessionActive && audio.isCapturing,
  });

  // When user switches to "suggest" mode, immediately request a suggestion
  const handleModeChange = useCallback(
    (newMode) => {
      setMode(newMode);
      if (newMode === 'suggest' && isSessionActive) {
        const stageLabel = STAGES.find((s) => s.id === activeStage)?.label || activeStage;
        session.requestSuggestion(stageLabel);
        // Auto-switch back to listen after suggestion is generated
        // (the user can tap suggest again when needed)
      }
    },
    [isSessionActive, activeStage, session]
  );

  // Once suggestion finishes processing, auto-switch back to listen mode
  useEffect(() => {
    if (mode === 'suggest' && !session.isProcessing && session.suggestions.length > 0) {
      setMode('listen');
    }
  }, [mode, session.isProcessing, session.suggestions.length]);

  const handleStart = useCallback(() => {
    setShowSourcePicker(true);
  }, []);

  const handleStop = useCallback(async () => {
    setIsSessionActive(false);
    setMode('listen');
    audio.stop();
    await session.saveCall();
  }, [audio, session]);

  const beginCalibration = useCallback(
    async (mode) => {
      setShowSourcePicker(false);
      if (mode === 'mic') {
        await audio.startMic();
      } else {
        await audio.startTab();
      }
      setCalibrating(true);
      setCalibratedDone(false);
    },
    [audio]
  );

  const finishCalibration = useCallback(async () => {
    const blob = audio.getWavBlob();
    if (blob && blob.size > 1000) {
      await session.calibrate(blob);
    }
    audio.clearBuffer();
    setCalibratedDone(true);
  }, [audio, session]);

  const startSession = useCallback(() => {
    setCalibrating(false);
    setCalibratedDone(false);
    setIsSessionActive(true);
    setActiveStage('connecting');
    setMode('listen');
  }, []);

  const skipCalibration = useCallback(() => {
    audio.clearBuffer();
    setCalibrating(false);
    setCalibratedDone(false);
    setIsSessionActive(true);
    setActiveStage('connecting');
    setMode('listen');
  }, [audio]);

  // Auto-finish calibration after 5 seconds of recording
  useEffect(() => {
    if (calibrating && !calibrationDone && audio.isCapturing) {
      calibrationTimerRef.current = setTimeout(() => {
        finishCalibration();
      }, 5000);
      return () => clearTimeout(calibrationTimerRef.current);
    }
  }, [calibrating, calibrationDone, audio.isCapturing, finishCalibration]);

  const coachPanel = (
    <div style={styles.panel}>
      {!isMobile && <div style={styles.panelLabel}>Say This Next</div>}
      <StageSelector
        activeStage={activeStage}
        onSelect={setActiveStage}
        disabled={!isSessionActive}
      />
      <Suggestions
        suggestions={session.suggestions}
        isActive={isSessionActive}
        isProcessing={session.isProcessing}
        mode={mode}
      />
      <ModeToggle
        mode={mode}
        onModeChange={handleModeChange}
        disabled={!isSessionActive}
        isProcessing={session.isProcessing}
      />
    </div>
  );

  return (
    <div style={styles.page}>
      <MeetingControls
        isActive={isSessionActive}
        isProcessing={session.isProcessing}
        sourceType={audio.sourceType}
        error={audio.error || session.coachError}
        onStart={handleStart}
        onStop={handleStop}
      />

      {isMobile ? (
        <>
          <div style={styles.tabs}>
            <button
              style={{
                ...styles.tab,
                ...(tab === 'coach' ? styles.tabActive : {}),
              }}
              onClick={() => setTab('coach')}
            >
              SAY THIS NEXT
            </button>
            <button
              style={{
                ...styles.tab,
                ...(tab === 'transcript' ? styles.tabActive : {}),
              }}
              onClick={() => setTab('transcript')}
            >
              TRANSCRIPT
            </button>
          </div>

          {tab === 'coach' ? (
            coachPanel
          ) : (
            <Transcript
              transcripts={session.transcripts}
              isActive={isSessionActive}
            />
          )}
        </>
      ) : (
        <div style={styles.panels}>
          <div style={styles.panel}>
            <div style={styles.panelLabel}>Live Transcript</div>
            <Transcript
              transcripts={session.transcripts}
              isActive={isSessionActive}
            />
          </div>
          <div style={styles.divider} />
          {coachPanel}
        </div>
      )}

      {showSourcePicker && (
        <AudioSourceSelector
          onSelectMic={() => beginCalibration('mic')}
          onSelectTab={() => beginCalibration('tab')}
          onCancel={() => setShowSourcePicker(false)}
        />
      )}

      {calibrating && (
        <div style={styles.calibrationOverlay}>
          <div style={styles.calibrationModal}>
            {!calibrationDone ? (
              <>
                <div style={styles.calibrationTitle}>
                  Voice Calibration
                </div>
                <div style={styles.calibrationDesc}>
                  Say a few sentences so the AI can learn your voice. This helps
                  it distinguish you from the prospect during the call.
                </div>
                <div style={styles.calibrationStatus}>
                  <span className="pulse" style={styles.calibrationDot} />
                  Recording your voice...
                </div>
                <button style={styles.calibrationBtn} onClick={finishCalibration}>
                  Done Speaking
                </button>
                <br />
                <button style={styles.skipBtn} onClick={skipCalibration}>
                  Skip calibration
                </button>
              </>
            ) : (
              <>
                <div style={styles.calibrationTitle}>
                  Voice Captured
                </div>
                {session.repCalibration ? (
                  <>
                    <div style={styles.calibrationSuccess}>
                      Got it! The AI will use this to identify your voice.
                    </div>
                    <div style={styles.calibrationSample}>
                      &ldquo;{session.repCalibration}&rdquo;
                    </div>
                  </>
                ) : (
                  <div style={styles.calibrationDesc}>
                    Could not capture clear speech. The AI will use conversation
                    context to identify speakers instead.
                  </div>
                )}
                <button style={styles.calibrationBtn} onClick={startSession}>
                  Start Coaching
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
