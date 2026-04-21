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
    gap: 12,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    flex: 1,
  },
  logo: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
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
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  btn: {
    padding: '8px 18px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    transition: 'background 0.15s',
    flexShrink: 0,
    boxShadow: 'var(--shadow-sm)',
  },
  error: {
    fontSize: 12,
    color: 'var(--red)',
    padding: '8px 16px',
    background: 'rgba(239, 68, 68, 0.08)',
    borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
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
          <span style={styles.logo}>Jeremy</span>
          <span
            className={isActive ? 'pulse' : ''}
            style={{
              ...styles.dot,
              background: isActive ? 'var(--green)' : 'var(--border-strong)',
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
          {isActive ? 'Stop' : 'Start'}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}
    </>
  );
}
