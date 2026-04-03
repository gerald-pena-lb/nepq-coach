'use client';

import { useState, useCallback } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useAudioCapture } from '@/hooks/useAudioCapture';
import { useCoachingSession } from '@/hooks/useCoachingSession';
import AudioSourceSelector from '@/components/AudioSourceSelector';
import MeetingControls from '@/components/MeetingControls';
import Transcript from '@/components/Transcript';
import Suggestions from '@/components/Suggestions';

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
};

export default function HomePage() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('coach');
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  const audio = useAudioCapture();
  const session = useCoachingSession({
    getWavBlob: audio.getWavBlob,
    clearBuffer: audio.clearBuffer,
    isCapturing: audio.isCapturing,
  });

  const handleStart = useCallback(() => {
    setShowSourcePicker(true);
  }, []);

  const handleStop = useCallback(async () => {
    audio.stop();
    await session.saveCall();
  }, [audio, session]);

  const handleSelectMic = useCallback(() => {
    setShowSourcePicker(false);
    audio.startMic();
  }, [audio]);

  const handleSelectTab = useCallback(() => {
    setShowSourcePicker(false);
    audio.startTab();
  }, [audio]);

  return (
    <div style={styles.page}>
      <MeetingControls
        isActive={audio.isCapturing}
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
            <Suggestions
              suggestions={session.suggestions}
              isActive={audio.isCapturing}
              isProcessing={session.isProcessing}
            />
          ) : (
            <Transcript
              transcripts={session.transcripts}
              isActive={audio.isCapturing}
            />
          )}
        </>
      ) : (
        <div style={styles.panels}>
          <div style={styles.panel}>
            <div style={styles.panelLabel}>Live Transcript</div>
            <Transcript
              transcripts={session.transcripts}
              isActive={audio.isCapturing}
            />
          </div>
          <div style={styles.divider} />
          <div style={styles.panel}>
            <div style={styles.panelLabel}>Say This Next</div>
            <Suggestions
              suggestions={session.suggestions}
              isActive={audio.isCapturing}
              isProcessing={session.isProcessing}
            />
          </div>
        </div>
      )}

      {showSourcePicker && (
        <AudioSourceSelector
          onSelectMic={handleSelectMic}
          onSelectTab={handleSelectTab}
          onCancel={() => setShowSourcePicker(false)}
        />
      )}
    </div>
  );
}
