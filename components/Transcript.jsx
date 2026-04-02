'use client';

import { useEffect, useRef } from 'react';

const styles = {
  container: {
    flex: 1,
    overflow: 'auto',
    padding: 16,
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-muted)',
    fontSize: 14,
    textAlign: 'center',
    padding: 32,
    lineHeight: 1.5,
  },
  entry: {
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--text)',
    marginBottom: 8,
    padding: '6px 10px',
    borderRadius: 6,
    background: 'var(--bg-card)',
  },
  time: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginRight: 8,
  },
};

export default function Transcript({ transcripts, isActive }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  if (transcripts.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>
          {isActive
            ? 'Listening for speech...'
            : 'Place this device near your meeting and click Start Coaching.'}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {transcripts.map((t, i) => {
        const time = new Date(t.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        return (
          <div key={i} style={styles.entry}>
            <span style={styles.time}>{time}</span>
            {t.text}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
