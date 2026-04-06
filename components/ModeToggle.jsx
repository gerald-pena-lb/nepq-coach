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
  suggestActive: {
    background: 'rgba(129, 140, 248, 0.15)',
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },
  suggestInactive: {
    background: 'var(--bg-card)',
    borderColor: 'var(--border)',
    color: 'var(--text-muted)',
  },
};

export default function ModeToggle({ mode, onModeChange, disabled, isProcessing }) {
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
          ...(mode === 'suggest' ? styles.suggestActive : styles.suggestInactive),
          opacity: disabled ? 0.5 : 1,
        }}
        onClick={() => onModeChange('suggest')}
        disabled={disabled || isProcessing}
      >
        {isProcessing ? 'THINKING...' : 'SUGGEST'}
      </button>
    </div>
  );
}
