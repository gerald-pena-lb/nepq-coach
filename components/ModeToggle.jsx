'use client';

const styles = {
  container: {
    display: 'flex',
    padding: '8px 12px',
    gap: 8,
    flexShrink: 0,
  },
  btn: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    textAlign: 'center',
    border: '2px solid transparent',
    transition: 'all 0.15s',
  },
  listenActive: {
    background: 'rgba(74, 222, 128, 0.12)',
    borderColor: 'var(--green)',
    color: 'var(--green)',
  },
  listenInactive: {
    background: 'var(--bg-card)',
    borderColor: 'var(--border)',
    color: 'var(--text-muted)',
  },
  suggestReady: {
    background: 'rgba(129, 140, 248, 0.2)',
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },
  suggestNotReady: {
    background: 'var(--bg-card)',
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
