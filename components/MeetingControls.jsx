'use client';

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  status: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  btn: {
    padding: '8px 20px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    transition: 'opacity 0.15s',
  },
  error: {
    fontSize: 12,
    color: 'var(--red)',
    padding: '6px 16px',
    background: 'rgba(248,113,113,0.08)',
  },
};

export default function MeetingControls({
  isActive,
  isProcessing,
  sourceType,
  error,
  onStart,
  onStop,
}) {
  const statusText = isActive
    ? isProcessing
      ? 'Thinking...'
      : sourceType === 'tab'
        ? 'Listening to tab'
        : 'Listening...'
    : 'Ready';

  return (
    <>
      <div style={styles.header}>
        <div style={styles.left}>
          <span style={styles.logo}>NEPQ Coach</span>
          <span
            className={isActive ? 'pulse' : ''}
            style={{
              ...styles.dot,
              background: isActive ? 'var(--green)' : 'var(--text-muted)',
            }}
          />
          <span style={styles.status}>{statusText}</span>
        </div>

        <button
          style={{
            ...styles.btn,
            background: isActive ? 'var(--red)' : 'var(--accent)',
          }}
          onClick={isActive ? onStop : onStart}
        >
          {isActive ? 'Stop' : 'Start Coaching'}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}
    </>
  );
}
