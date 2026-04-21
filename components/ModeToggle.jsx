'use client';

const styles = {
  container: {
    display: 'flex',
    padding: '12px',
    gap: 10,
    flexShrink: 0,
    background: 'var(--bg)',
    borderTop: '1px solid var(--border)',
  },
  btn: {
    flex: 1,
    padding: '14px 16px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    textAlign: 'center',
    border: '2px solid transparent',
    transition: 'all 0.15s',
    letterSpacing: '0.02em',
  },
  listenActive: {
    background: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'var(--green)',
    color: 'var(--green)',
  },
  listenInactive: {
    background: 'var(--bg-subtle)',
    borderColor: 'var(--border)',
    color: 'var(--text-muted)',
  },
  suggestReady: {
    background: 'var(--accent-dim)',
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },
  suggestNotReady: {
    background: 'var(--bg-subtle)',
    borderColor: 'var(--border)',
    color: 'var(--text-muted)',
  },
  suggestActive: {
    background: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: '#fff',
  },
  readyDot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--green)',
    marginRight: 6,
  },
};

export default function ModeToggle({ mode, onModeChange, disabled, isProcessing, hasCandidatesReady }) {
  const getSuggestStyle = () => {
    if (mode === 'suggest') return styles.suggestActive;
    if (hasCandidatesReady) return styles.suggestReady;
    return styles.suggestNotReady;
  };

  return (
    <div style={styles.container}>
      <button
        style={{
          ...styles.btn,
          ...(mode === 'listen' ? styles.listenActive : styles.listenInactive),
          opacity: disabled ? 0.5 : 1,
        }}
        onClick={() => onModeChange('listen')}
        disabled={disabled}
      >
        LISTEN
      </button>
      <button
        style={{
          ...styles.btn,
          ...getSuggestStyle(),
          opacity: disabled ? 0.5 : 1,
        }}
        onClick={() => onModeChange('suggest')}
        disabled={disabled || isProcessing}
      >
        {isProcessing ? (
          'THINKING...'
        ) : (
          <>
            {hasCandidatesReady && <span style={styles.readyDot} />}
            SUGGEST
          </>
        )}
      </button>
    </div>
  );
}
